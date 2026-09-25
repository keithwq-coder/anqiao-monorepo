# Verification evidence

Store durable, non-secret evidence referenced by tasks and handoffs here when
plain command output is not enough. Prefer small text/JSON reports over large
binary artifacts.

Evidence must record:

- date/time and environment;
- exact command or human procedure;
- relevant versions/configuration without secrets;
- exit status/result;
- what the evidence proves and what it does not prove.
