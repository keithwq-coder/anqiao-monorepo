# Claude project entry

`AGENTS.md` is the canonical repository contract. Read it in full before doing
anything else, then read:

1. `docs/NOW.md`
2. `docs/PROJECT.md`
3. `docs/specs/INDEX.md`
4. `docs/decisions/DECISION-LOG.md`
5. the active task, if one exists

Do not treat this adapter as an independent policy. In particular:

- legacy and draft SPEC files do not authorize code;
- application code may be edited only when every implementation gate in
  `AGENTS.md` section 5 is satisfied. That set includes the project baseline
  gate: the complete SPEC baseline must be `COMPLETE` and explicitly approved.
  Do not treat "approved SPEC + active task + authorization" as sufficient on
  its own; while the baseline is incomplete all implementation is frozen;
- AI owns all engineering execution; do not hand engineering work back to the
  product owner (no "run this", "edit that", "choose a framework"). Ask the
  user only for business facts, material product/risk choices, and explicit
  approvals, per `AGENTS.md` section 4;
- verify repository facts and tool results instead of filling gaps;
- stop and ask when authority, scope, or business meaning is unclear.

At the start of the response, report as required by `AGENTS.md` section 1.4:
which required files were actually read, the current SDD phase, intended scope,
whether an approved SPEC and active task were found, assumptions, and unknowns.
