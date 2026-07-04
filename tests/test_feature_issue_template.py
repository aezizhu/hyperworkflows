"""Executable acceptance for .github/ISSUE_TEMPLATE/feature.yml.

Oracle type: property-based conformance test against the GitHub issue-forms
schema contract (https://docs.github.com/en/communities/using-templates-to-
encourage-useful-issues-and-pull-requests/syntax-for-github-issue-forms).

A golden-file exact-match test would be tautological for a static config, and
GitHub does not ship a public JSON schema binary. So the strongest feasible
oracle is a property test asserting every documented structural invariant the
GitHub issue-form parser enforces. If GitHub would reject this template, one of
these assertions fails.

Run from repo root:  python3 -m pytest tests/test_feature_issue_template.py -q
"""
import pathlib

import yaml

TEMPLATE = (
    pathlib.Path(__file__).resolve().parents[1]
    / ".github"
    / "ISSUE_TEMPLATE"
    / "feature.yml"
)

ALLOWED_TYPES = {"markdown", "textarea", "input", "dropdown", "checkboxes"}
# GitHub allows kebab-case, alnum, _ and - in ids.
ID_CHARS = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-")


def load():
    with TEMPLATE.open(encoding="utf-8") as fh:
        return yaml.safe_load(fh)


def test_file_exists():
    assert TEMPLATE.is_file(), f"missing template: {TEMPLATE}"


def test_parses_as_mapping():
    doc = load()
    assert isinstance(doc, dict), "top-level issue form must be a mapping"


def test_required_top_level_keys():
    doc = load()
    # name and description are required by the GitHub issue-form schema.
    assert isinstance(doc.get("name"), str) and doc["name"].strip()
    assert isinstance(doc.get("description"), str) and doc["description"].strip()


def test_labels_shape():
    doc = load()
    if "labels" in doc:
        labels = doc["labels"]
        assert isinstance(labels, list) and labels
        assert all(isinstance(x, str) and x.strip() for x in labels)


def test_body_is_nonempty_list():
    doc = load()
    assert isinstance(doc.get("body"), list) and doc["body"], "body must be a non-empty list"


def test_every_element_has_valid_type():
    for el in load()["body"]:
        assert isinstance(el, dict)
        assert el.get("type") in ALLOWED_TYPES, f"bad element type: {el.get('type')}"


def test_ids_present_valid_and_unique():
    seen = set()
    for el in load()["body"]:
        # markdown elements are display-only and take no id.
        if el["type"] == "markdown":
            assert "id" not in el
            continue
        eid = el.get("id")
        assert isinstance(eid, str) and eid, f"element missing id: {el}"
        assert set(eid) <= ID_CHARS, f"invalid id characters: {eid!r}"
        assert eid not in seen, f"duplicate id: {eid}"
        seen.add(eid)


def test_input_types_have_label():
    for el in load()["body"]:
        if el["type"] in {"input", "textarea", "dropdown", "checkboxes"}:
            attrs = el.get("attributes")
            assert isinstance(attrs, dict), f"{el.get('id')} missing attributes"
            assert isinstance(attrs.get("label"), str) and attrs["label"].strip()


def test_dropdowns_have_nonempty_options():
    for el in load()["body"]:
        if el["type"] == "dropdown":
            opts = el["attributes"].get("options")
            assert isinstance(opts, list) and opts, f"{el['id']} dropdown needs options"
            assert all(isinstance(o, str) and o.strip() for o in opts)


def test_validations_required_is_bool():
    for el in load()["body"]:
        v = el.get("validations")
        if v is not None:
            assert isinstance(v, dict)
            if "required" in v:
                assert isinstance(v["required"], bool)


def test_feature_template_specific_contract():
    """Guards this template's intended shape so a silent gut of it fails."""
    doc = load()
    assert doc["name"] == "Feature request"
    assert doc["labels"] == ["enhancement"]
    ids = [el["id"] for el in doc["body"] if el["type"] != "markdown"]
    assert ids == ["problem", "proposal", "layer"]
    # The three collected fields must all be required (the template's whole point).
    assert all(
        el["validations"]["required"] is True
        for el in doc["body"]
        if el["type"] != "markdown"
    )
