"""The API reference on the documentation site is built from this description."""

from scripts.export_openapi import TAGS, build


def _operations():
    for path, operations in build()["paths"].items():
        for method, operation in operations.items():
            yield f"{method.upper()} {path}", operation


def test_every_operation_says_what_it_does():
    undescribed = [name for name, operation in _operations() if not operation.get("description")]
    assert undescribed == []


def test_every_operation_is_in_a_named_group():
    titles = {title for title, _ in TAGS.values()}
    assert {tag for _, operation in _operations() for tag in operation["tags"]} <= titles


def test_titles_read_as_words():
    titles = [operation["summary"] for _, operation in _operations()]
    assert not [title for title in titles if "Endpoint" in title or "ttx" in title.lower()]


def test_operations_declare_how_they_authenticate():
    operations = dict(_operations())
    assert operations["POST /api/v1/auth/login"]["security"] == []
    assert operations["GET /api/v1/auth/me"]["security"] == [{"sessionCookie": []}]
    assert operations["POST /api/v1/ttx"]["security"] == [{"sessionCookie": [], "csrfToken": []}]
    assert operations["POST /api/v1/mcp"]["security"] == [{"accessToken": []}]
