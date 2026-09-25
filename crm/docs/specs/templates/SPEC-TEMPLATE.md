# SPEC-XXXX: Plain-language feature name

- Spec ID: SPEC-XXXX
- Version: 0.1.0
- Status: DRAFT
- Product owner: User
- Prepared by: Tool and model name
- Last updated: YYYY-MM-DD
- Supersedes: none

## 1. Problem

Describe the user's real problem without naming a technical solution.

## 2. Verified context

- [VERIFIED] Fact with file path, command output, user decision id, or external
  source and retrieval date.
- [UNKNOWN] Missing fact that must not be invented.

## 3. Goal and success measure

State one bounded outcome and how a non-technical person can recognize success.

## 4. Non-goals

List nearby capabilities that this version intentionally does not include.

## 5. Users and permissions

For each user/role, state what they may see or do. Mark unresolved identity or
permission questions as `UNKNOWN`.

## 6. Required behavior

Number each rule so tests and tasks can cite it:

- R-001: ...
- R-002: ...

Do not hide product choices inside implementation details.

## 7. Data and integrations

Define inputs, outputs, ownership, retention, validation, failure behavior, and
external side effects. Use `Not applicable` only when verified.

## 8. Failure and edge behavior

State what the user sees and what the system does for invalid input, partial
failure, retry, duplicate actions, unavailable dependencies, and permission
denial where relevant.

## 9. Acceptance criteria

Use observable cases:

- AC-001 Given ..., when ..., then ...
- AC-002 Given ..., when ..., then ...

Separate automated checks from human visual/business acceptance.

## 10. Constraints and safety

Record verified security, privacy, legal, performance, compatibility, budget,
and operational constraints. Do not invent thresholds.

## 11. Open decisions

- OD-001: decision, options, recommendation, and practical consequences.

A SPEC cannot enter review while an open decision changes required behavior or
acceptance.

## 12. References

For each reference, include path/URL, status (`VERIFIED`, `EXTERNAL`, or
`UNTRUSTED LEGACY`), retrieval date when external, and exactly what it supports.

## 13. Verification plan

| Criterion | Check | Environment | Evidence location |
|---|---|---|---|
| AC-001 | Command or human procedure | Local/test/staging/production | To be recorded |

## 14. Approval

`NOT APPROVED`

Approval must be recorded in the decision log and paired JSON after the final
SPEC content is fixed.
