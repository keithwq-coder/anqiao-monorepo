# SPEC lifecycle

Only files under `30-approved/` with valid paired approval metadata can
authorize application implementation.

## States

| Directory | Meaning | May authorize code? |
|---|---|---|
| `00-inbox` | Raw ideas, notes, copied requests | No |
| `10-draft` | Working SPEC drafts | No |
| `20-review` | Complete drafts awaiting human approval | No |
| `30-approved` | Explicitly approved current behavior | Yes, with an authorized active task |
| `90-deprecated` | Superseded or withdrawn approved SPECs | No |
| `99-legacy` | Historical material with untrusted claims | Never |

## Promotion rules

1. Use `templates/SPEC-TEMPLATE.md` for a new draft.
2. Resolve material placeholders before moving to review.
3. Present the product owner with one plain-language decision brief.
4. Obtain explicit approval naming the SPEC id and version.
5. Record the decision in `docs/decisions/DECISION-LOG.md`.
6. Put the final SPEC in `30-approved/` with `Status: APPROVED`.
7. Create `<spec-name>.approval.json` using the approval metadata template.
8. Compute the SPEC SHA-256 after the final edit and store it in the JSON.
9. Run `scripts/check-governance.ps1`.

Changing an approved SPEC invalidates its stored hash. Create a new version and
repeat approval rather than editing around the gate.

Legacy content may be quoted only with an explicit `UNTRUSTED LEGACY` label,
source path, and a statement of what still needs verification.
