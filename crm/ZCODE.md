# ZCode project entry

This file is a manual startup card. Automatic loading of `ZCODE.md` has not
been verified for the installed ZCode version.

Before using ZCode on this repository, attach `AGENTS.md` to the task context
and require ZCode to read:

1. `docs/NOW.md`
2. `docs/PROJECT.md`
3. `docs/specs/INDEX.md`
4. `docs/decisions/DECISION-LOG.md`
5. the active task, if one exists

ZCode must report whether those files were actually loaded. A model-generated
plan, subagent result, or previous session is not a repository fact.

No application edit is allowed without the four implementation gates in
`AGENTS.md` section 5.
