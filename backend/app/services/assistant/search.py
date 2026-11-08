"""In-memory search over the static catalogs the assistant reads: the
knowledge base, the TTX-Zone inject catalog and the objective catalog
(about a hundred entries each at most). No embeddings and no database:
each corpus is indexed once per process (lru_cache) and scored with
Okapi BM25, title and summary weighted above the body, and filtered on
metadata before scoring."""

import math
import re
import unicodedata
from collections import Counter
from collections.abc import Callable, Iterable
from dataclasses import dataclass, field
from functools import lru_cache

from app.data.inject_catalog import load_inject_catalog
from app.data.knowledge_catalog import load_knowledge_catalog
from app.data.objective_catalog import OBJECTIVE_CATALOG

_WORD = re.compile(r"[a-z0-9]+(?:[-'][a-z0-9]+)*")
# Words too common to tell entries apart, English and Spanish.
_STOPWORDS = frozenset(
    """a an and are as at be by for from has have in into is it its of on or that the
    their this to was were will with what which who how when where why do does
    el la los las un una unos unas y o de del al en con por para que se su sus es
    son lo como mas pero sin sobre entre""".split()
)
_TITLE_WEIGHT = 3
_SUMMARY_WEIGHT = 2
_K1 = 1.5
_B = 0.75


def tokenize(text: str) -> list[str]:
    """Lower-case words without accents, minus stopwords and single letters."""
    folded = unicodedata.normalize("NFKD", text.lower())
    folded = "".join(ch for ch in folded if not unicodedata.combining(ch))
    return [_stem(w) for w in _WORD.findall(folded) if len(w) > 1 and w not in _STOPWORDS]


def _stem(word: str) -> str:
    """Plurals fold onto the singular ("regulators" finds "regulator",
    "acciones" finds "accion"); nothing smarter."""
    if len(word) > 4 and word.endswith(("ies",)):
        return word[:-3] + "y"
    if len(word) > 4 and word.endswith("es") and word[-3] in "nrlsxz":
        return word[:-2]
    if len(word) > 3 and word.endswith("s") and not word.endswith(("ss", "us", "is")):
        return word[:-1]
    return word


@dataclass(frozen=True)
class Document:
    id: str
    title: str
    summary: str
    sections: tuple[tuple[str, str], ...] = ()
    # Filterable metadata: each key holds the values an entry has.
    meta: dict[str, frozenset[str]] = field(default_factory=dict)


@dataclass(frozen=True)
class Hit:
    document: Document
    score: float
    # The section whose text matched the query best, if any did.
    section: str | None


class Index:
    def __init__(self, documents: Iterable[Document]) -> None:
        self.documents = list(documents)
        self._terms: list[Counter[str]] = []
        self._lengths: list[int] = []
        df: Counter[str] = Counter()
        for doc in self.documents:
            terms = Counter(tokenize(doc.title) * _TITLE_WEIGHT)
            terms.update(tokenize(doc.summary) * _SUMMARY_WEIGHT)
            for heading, text in doc.sections:
                terms.update(tokenize(f"{heading} {text}"))
            self._terms.append(terms)
            self._lengths.append(sum(terms.values()))
            df.update(terms.keys())
        n = max(len(self.documents), 1)
        self._avg_length = (sum(self._lengths) / n) or 1.0
        self._idf = {t: math.log(1 + (n - f + 0.5) / (f + 0.5)) for t, f in df.items()}

    def search(
        self,
        query: str,
        *,
        filters: dict[str, str | None] | None = None,
        limit: int = 8,
    ) -> list[Hit]:
        """Best matches for `query` among the entries whose metadata holds
        every given filter value. An empty query lists the filtered entries
        in catalog order."""
        wanted = {k: v.lower() for k, v in (filters or {}).items() if v}
        query_terms = list(dict.fromkeys(tokenize(query)))
        hits: list[Hit] = []
        for i, doc in enumerate(self.documents):
            if any(value not in doc.meta.get(key, frozenset()) for key, value in wanted.items()):
                continue
            if not query_terms:
                hits.append(Hit(doc, 0.0, None))
                continue
            score = self._score(i, query_terms)
            if score > 0:
                hits.append(Hit(doc, score, _best_section(doc, query_terms)))
        if query_terms:
            hits.sort(key=lambda h: (-h.score, h.document.id))
        return hits[:limit]

    def _score(self, i: int, query_terms: list[str]) -> float:
        terms, length = self._terms[i], self._lengths[i]
        score = 0.0
        for term in query_terms:
            tf = terms.get(term, 0)
            if tf:
                norm = tf + _K1 * (1 - _B + _B * length / self._avg_length)
                score += self._idf[term] * tf * (_K1 + 1) / norm
        return score


def _best_section(doc: Document, query_terms: list[str]) -> str | None:
    best, best_hits = None, 0
    wanted = set(query_terms)
    for heading, text in doc.sections:
        found = sum(1 for t in tokenize(f"{heading} {text}") if t in wanted)
        if found > best_hits:
            best, best_hits = heading, found
    return best


def _values(*values: Iterable[str] | str | None) -> frozenset[str]:
    out: set[str] = set()
    for value in values:
        if value is None:
            continue
        if isinstance(value, str):
            out.add(value.lower())
        else:
            out.update(str(v).lower() for v in value)
    return frozenset(out)


@lru_cache(maxsize=1)
def knowledge_index() -> Index:
    return Index(
        Document(
            id=entry.id,
            title=entry.title,
            summary=entry.summary,
            sections=tuple((s.heading, s.text) for s in entry.sections),
            meta={
                "kind": _values(entry.kind.value),
                "sector": _values([s.value for s in entry.sectors]),
                "family": _values([f.value for f in entry.families]),
                "capability": _values([c.value for c in entry.capabilities]),
            },
        )
        for entry in load_knowledge_catalog().entries
    )


@lru_cache(maxsize=1)
def inject_index() -> Index:
    """Both languages indexed, so a query in either finds the inject."""
    documents = []
    for inject in load_inject_catalog().injects:
        sections = [
            ("content", f"{inject.content.en}\n{inject.content.es}"),
            (
                "expected actions",
                "\n".join(
                    f"{a.description.en} {a.description.es}" for a in inject.expected_actions
                ),
            ),
        ]
        if inject.key_question:
            sections.append(("key question", f"{inject.key_question.en} {inject.key_question.es}"))
        documents.append(
            Document(
                id=inject.id,
                title=f"{inject.title.en} / {inject.title.es}",
                summary=" ".join(a.technique for a in inject.attack) + f" {inject.actor}",
                sections=tuple(sections),
                meta={
                    "family": _values([f.value for f in inject.families]),
                    "stage": _values(inject.stage.value),
                    "capability": _values([c.value for c in inject.capabilities]),
                    "kind": _values(inject.kind.value),
                },
            )
        )
    return Index(documents)


@lru_cache(maxsize=1)
def objective_index() -> Index:
    return Index(
        Document(
            id=template.id,
            title=f"{template.title_en} / {template.title_es}",
            summary=f"{template.statement_en} {template.statement_es}",
            sections=(
                ("criteria", " ".join(template.criterion_en + template.criterion_es)),
                ("evidence", " ".join(template.evidence_en + template.evidence_es)),
            ),
            meta={"capability": _values(template.capability.value)},
        )
        for template in OBJECTIVE_CATALOG
    )


INDEXES: dict[str, Callable[[], Index]] = {
    "knowledge": knowledge_index,
    "injects": inject_index,
    "objectives": objective_index,
}
