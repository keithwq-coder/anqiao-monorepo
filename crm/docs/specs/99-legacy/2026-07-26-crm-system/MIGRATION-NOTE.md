# Legacy snapshot migration note

- Snapshot date: 2026-07-26
- Source: `D:\Project\中科安樵\CRM 系统`
- Destination: `docs/specs/99-legacy/2026-07-26-crm-system/source/`
- Classification: `UNTRUSTED LEGACY`
- Authority: none
- Migration method: byte-preserving file copy; SHA-256 and byte size recorded
  in `manifest.json`

## Included material

- prior `AGENTS.md` and `CLAUDE.md` for governance provenance;
- prior `docs/PLAN.md` and `docs/TASKS.md` as supporting planning context;
- the complete prior `docs/SPEC` file tree, including the empty file and empty
  directories that the copy operation preserved where supported.

The original files were not modified.

## Confirmed audit observations

These observations describe the snapshot's internal condition. They do not
decide future product behavior.

1. The old SPEC index refers to `01-global-rules.md`, `ARCHITECTURE.md`, an
   OpenAPI file, diagram files, and acceptance criteria that were not present in
   the inspected old project tree.
2. `README_temp.md` is empty.
3. The index says a single SPEC file should remain below 300 lines, while the
   migrated MEDDIC `.py` file has 487 lines and the error-handling document has
   423 lines.
4. The file named `01-meddic-scoring.py` contains Markdown document text and
   fails Python `compile()` at line 6. Its extension must not be treated as
   proof that it is executable code.
5. The MEDDIC file tells implementers to see `test_meddic_scoring.py`, but no
   such test file was present in the old SPEC tree.
6. The old `AGENTS.md` and `CLAUDE.md` are duplicate policy documents. They mix
   general engineering principles with tool-specific claims and old project
   assumptions, which makes cross-tool drift more likely.

## Claims that remain unverified

All business and technical content remains unverified, including:

- the product goal and MVP modules;
- CRM stages, ratings, scoring thresholds, and retry rules;
- data sources, crawling behavior, volumes, and accuracy targets;
- frameworks, databases, infrastructure, deployment, and integrations;
- statements that decisions were locked, reviewed, tested, or assigned to a
  particular tool/model;
- claims about Qoder, ZCode, Claude, Cursor, or any model's capabilities.

## Reuse procedure

Do not repair or promote this snapshot in place. To reconsider one claim:

1. quote the exact legacy path and label it `UNTRUSTED LEGACY`;
2. verify whether it describes a real user need or current repository fact;
3. create a new SPEC draft using the current template;
4. explain the choice to the product owner in plain language;
5. follow review, explicit approval, hashing, task authorization, and
   verification gates.
