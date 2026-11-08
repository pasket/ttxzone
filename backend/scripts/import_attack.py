"""Import a MITRE ATT&CK release into TTX-Zone's code-level catalog.

    python scripts/import_attack.py            # the latest release
    python scripts/import_attack.py 19.2       # a given one
    python scripts/import_attack.py 19.2 --from-dir /tmp/stix   # offline

Downloads the official STIX 2.1 bundles of the Enterprise and ICS domains
from github.com/mitre-attack/attack-stix-data and writes one compact file
per domain to app/data/attack/{domain}-v{version}.json: tactics in matrix
order, techniques and sub-techniques (deprecated ones kept, flagged, so
names still resolve), the groups (threat actors: MITRE's name, associated
groups and the techniques MITRE attributes to each), and the revoked ->
replacement maps of techniques and groups an MSEL upgrade uses. Each file
records its source URL and SHA-256.

Bringing in a new release, step by step:

1. Import it -- inside the backend container (the host's Python may lack
   the root certificates for raw.githubusercontent.com):
       docker compose exec backend python scripts/import_attack.py 20.0
2. Add "20.0" to ATTACK_VERSIONS in app/data/attack_catalog.py (oldest
   first). Never delete an older release's files: MSELs, snapshots and
   library items pinned to it read their names from them.
3. Review TTX-Zone's inject catalog (app/data/injects/catalog.json) against
   the new release -- techniques may be revoked, deprecated or moved to
   another tactic -- then bump its `attack_version`.
   test_the_catalog_is_written_against_the_latest_attack_release fails
   until you do.
4. Run the whole suite (the loader checks each file: tactics, techniques,
   groups' techniques) and commit. No database migration is needed.

What then happens in the app: existing MSELs stay on their release and
offer an explicit upgrade; new MSELs pin the new one; Library ->
Threat actors shows its groups; organization libraries offer "Update to
v20"; copies across releases are converted (app/services/
attack_conversion.py). See CLAUDE.md, "ATT&CK is versioned".

Stdlib only, run at development time -- the app never downloads anything
at runtime."""

import argparse
import hashlib
import json
import sys
import urllib.request
from pathlib import Path

INDEX_URL = "https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master/index.json"
DOMAINS = {"enterprise": "Enterprise ATT&CK", "ics": "ICS ATT&CK"}
KILL_CHAINS = {"enterprise": "mitre-attack", "ics": "mitre-ics-attack"}
OUT_DIR = Path(__file__).resolve().parent.parent / "app" / "data" / "attack"


def _fetch(url: str) -> bytes:
    if not url.startswith("https://"):
        raise ValueError(f"Refusing a non-HTTPS URL: {url}")
    with urllib.request.urlopen(url, timeout=120) as response:  # nosec B310 -- https only
        return response.read()


def _external_id(obj: dict) -> str | None:
    for ref in obj.get("external_references", []):
        if ref.get("source_name") in ("mitre-attack", "mitre-ics-attack") and ref.get(
            "external_id"
        ):
            return ref["external_id"]
    return None


def convert(domain: str, version: str, raw: bytes, url: str) -> dict:
    objects = json.loads(raw)["objects"]
    by_stix = {o["id"]: o for o in objects}
    collection = next(o for o in objects if o["type"] == "x-mitre-collection")
    matrix = next(o for o in objects if o["type"] == "x-mitre-matrix")
    copyright_ = next(
        (
            o["definition"]["statement"]
            for o in objects
            if o["type"] == "marking-definition" and "statement" in o.get("definition", {})
        ),
        "",
    )

    tactics = []
    tactic_by_shortname = {}
    for ref in matrix["tactic_refs"]:
        tactic = by_stix[ref]
        tactic_id = _external_id(tactic)
        tactics.append({"id": tactic_id, "name": tactic["name"]})
        tactic_by_shortname[tactic["x_mitre_shortname"]] = tactic_id

    parents = {
        r["source_ref"]: r["target_ref"]
        for r in objects
        if r["type"] == "relationship" and r["relationship_type"] == "subtechnique-of"
    }
    revoked_by = {
        r["source_ref"]: r["target_ref"]
        for r in objects
        if r["type"] == "relationship" and r["relationship_type"] == "revoked-by"
    }

    techniques = []
    revoked: dict[str, str] = {}
    for obj in objects:
        if obj["type"] != "attack-pattern":
            continue
        technique_id = _external_id(obj)
        if technique_id is None:
            continue
        if obj.get("revoked"):
            # Follow the chain to a live replacement, if there is one.
            target, seen = revoked_by.get(obj["id"]), set()
            while target in by_stix and by_stix[target].get("revoked") and target not in seen:
                seen.add(target)
                target = revoked_by.get(target)
            replacement = _external_id(by_stix[target]) if target in by_stix else None
            if replacement and replacement != technique_id:
                revoked[technique_id] = replacement
            continue
        technique = {
            "id": technique_id,
            "name": obj["name"],
            "tactics": [
                tactic_by_shortname[phase["phase_name"]]
                for phase in obj.get("kill_chain_phases", [])
                if phase["kill_chain_name"] == KILL_CHAINS[domain]
                and phase["phase_name"] in tactic_by_shortname
            ],
        }
        if obj["id"] in parents:
            technique["parent"] = _external_id(by_stix[parents[obj["id"]]])
        if obj.get("x_mitre_deprecated"):
            technique["deprecated"] = True
        techniques.append(technique)

    techniques.sort(key=lambda t: t["id"])
    groups, revoked_groups = _groups(objects, by_stix, revoked_by)
    return {
        "domain": domain,
        "version": version,
        "released": collection["modified"][:10],
        "source": {"url": url, "sha256": hashlib.sha256(raw).hexdigest()},
        "copyright": copyright_,
        "tactics": tactics,
        "techniques": techniques,
        "revoked": dict(sorted(revoked.items())),
        "groups": groups,
        "revoked_groups": revoked_groups,
    }


def _live_replacement(obj: dict, by_stix: dict, revoked_by: dict) -> str | None:
    """The external id a revoked object points to, following the chain to
    a live one; None when there is none."""
    target, seen = revoked_by.get(obj["id"]), set()
    while target in by_stix and by_stix[target].get("revoked") and target not in seen:
        seen.add(target)
        target = revoked_by.get(target)
    return _external_id(by_stix[target]) if target in by_stix else None


def _groups(objects: list, by_stix: dict, revoked_by: dict) -> tuple[list, dict]:
    """MITRE's groups (intrusion sets): id, name, associated groups and the
    live techniques their `uses` relationships name."""
    uses: dict[str, set[str]] = {}
    for r in objects:
        if (
            r["type"] != "relationship"
            or r["relationship_type"] != "uses"
            or r.get("revoked")
            or r.get("x_mitre_deprecated")
            or not r["source_ref"].startswith("intrusion-set--")
            or not r["target_ref"].startswith("attack-pattern--")
        ):
            continue
        target = by_stix.get(r["target_ref"])
        if target is None or target.get("revoked") or target.get("x_mitre_deprecated"):
            continue
        technique_id = _external_id(target)
        if technique_id:
            uses.setdefault(r["source_ref"], set()).add(technique_id)

    groups, revoked = [], {}
    for obj in objects:
        if obj["type"] != "intrusion-set":
            continue
        group_id = _external_id(obj)
        if group_id is None:
            continue
        if obj.get("revoked"):
            replacement = _live_replacement(obj, by_stix, revoked_by)
            if replacement and replacement != group_id:
                revoked[group_id] = replacement
            continue
        group = {
            "id": group_id,
            "name": obj["name"],
            "aliases": [a for a in obj.get("aliases", []) if a != obj["name"]],
            "techniques": sorted(uses.get(obj["id"], ())),
        }
        if obj.get("x_mitre_deprecated"):
            group["deprecated"] = True
        groups.append(group)
    groups.sort(key=lambda g: g["id"])
    return groups, dict(sorted(revoked.items()))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("version", nargs="?", help="e.g. 19.2 (default: the latest)")
    parser.add_argument(
        "--from-dir",
        type=Path,
        help="read index.json and {domain}-attack-{v}.json from here instead of downloading",
    )
    args = parser.parse_args()

    local_index = args.from_dir / "index.json" if args.from_dir else None
    index = json.loads(
        local_index.read_bytes() if local_index and local_index.exists() else _fetch(INDEX_URL)
    )
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for domain, collection_name in DOMAINS.items():
        collection = next(c for c in index["collections"] if c["name"] == collection_name)
        release = (
            next((v for v in collection["versions"] if v["version"] == args.version), None)
            if args.version
            else collection["versions"][0]
        )
        if release is None:
            print(f"{collection_name} has no version {args.version}.", file=sys.stderr)
            return 1
        url = release["url"]
        if args.from_dir:
            raw = (args.from_dir / url.rsplit("/", 1)[-1]).read_bytes()
        else:
            raw = _fetch(url)
        data = convert(domain, release["version"], raw, url)
        path = OUT_DIR / f"{domain}-v{release['version']}.json"
        path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n")
        print(
            f"{path.name}: {len(data['tactics'])} tactics, {len(data['techniques'])} techniques, "
            f"{len(data['revoked'])} revoked, {len(data['groups'])} groups"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
