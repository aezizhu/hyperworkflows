"""Oracle for .github/ISSUE_TEMPLATE/feature.yml

Property/schema test: validates the file parses as YAML and conforms to
GitHub's issue-form contract (https://docs.github.com/issues -> forms syntax),
plus repo-specific invariants that make the template do its job.

Run from repo root:
    python3 tests/test_feature_issue_template.py
Exit 0 = all invariants hold on the current file.
"""
import os
import sys

try:
    import yaml
except ImportError:
    print("SKIP-FAIL: PyYAML not installed", file=sys.stderr)
    sys.exit(2)

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEMPLATE = os.path.join(REPO_ROOT, ".github", "ISSUE_TEMPLATE", "feature.yml")

# GitHub issue-form allowed top-level body element types.
VALID_TYPES = {"markdown", "textarea", "input", "dropdown", "checkboxes"}


def fail(msg):
    print(f"FAIL: {msg}", file=sys.stderr)
    sys.exit(1)


def main():
    if not os.path.isfile(TEMPLATE):
        fail(f"template not found: {TEMPLATE}")

    with open(TEMPLATE, "r", encoding="utf-8") as fh:
        raw = fh.read()

    # 1. Must be valid YAML (mapping at top level).
    try:
        doc = yaml.safe_load(raw)
    except yaml.YAMLError as exc:
        fail(f"not valid YAML: {exc}")
    if not isinstance(doc, dict):
        fail("top-level YAML is not a mapping")

    # 2. Required GitHub issue-form top-level keys.
    for key in ("name", "description", "body"):
        if key not in doc:
            fail(f"missing required top-level key: {key}")
    if not isinstance(doc["name"], str) or not doc["name"].strip():
        fail("name must be a non-empty string")
    if not isinstance(doc["description"], str) or not doc["description"].strip():
        fail("description must be a non-empty string")

    # 3. labels must include the routing label 'enhancement'.
    labels = doc.get("labels")
    if not isinstance(labels, list) or "enhancement" not in labels:
        fail("labels must be a list containing 'enhancement'")

    # 4. body must be a non-empty list of valid form elements.
    body = doc["body"]
    if not isinstance(body, list) or not body:
        fail("body must be a non-empty list")

    ids = []
    for i, el in enumerate(body):
        if not isinstance(el, dict):
            fail(f"body[{i}] is not a mapping")
        t = el.get("type")
        if t not in VALID_TYPES:
            fail(f"body[{i}].type {t!r} not a valid issue-form type")
        # Non-markdown elements need an id and attributes.label.
        if t != "markdown":
            if "id" not in el:
                fail(f"body[{i}] (type={t}) missing 'id'")
            ids.append(el["id"])
            attrs = el.get("attributes")
            if not isinstance(attrs, dict) or not attrs.get("label"):
                fail(f"body[{i}] (id={el.get('id')}) missing attributes.label")

    # 5. ids must be unique (GitHub rejects duplicate ids).
    if len(ids) != len(set(ids)):
        fail(f"duplicate element ids: {ids}")

    # 6. Repo-specific contract: the template must gather problem, proposal,
    #    and a required 'layer' dropdown whose options are the engine layers.
    by_id = {el["id"]: el for el in body if "id" in el}
    for req in ("problem", "proposal", "layer"):
        if req not in by_id:
            fail(f"missing expected field id: {req}")
        if not by_id[req].get("validations", {}).get("required") is True:
            fail(f"field '{req}' must be validations.required: true")

    layer = by_id["layer"]
    if layer.get("type") != "dropdown":
        fail("'layer' must be a dropdown")
    opts = layer.get("attributes", {}).get("options")
    if not isinstance(opts, list) or len(opts) < 2:
        fail("'layer' dropdown must define >=2 options")
    if not all(isinstance(o, str) and o.strip() for o in opts):
        fail("'layer' options must be non-empty strings")

    print(f"OK: feature.yml valid issue-form; {len(body)} elements, "
          f"ids={ids}, layer options={len(opts)}")
    sys.exit(0)


if __name__ == "__main__":
    main()
