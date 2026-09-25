# TASK-0001 W1: Isolated native server base resources

- Date: 2026-07-27 Asia/Shanghai
- Owner: Codex / GPT-5.6-sol
- Status: PASSED
- Authorization: `DEC-0046`
- Server write: limited to the authorized system identity and empty directories
- Secret handling: no credential, password, token or private-key value was read,
  printed, stored or changed

## Resources created

| Resource | Verified state |
|---|---|
| OS user/group `anqiao-crm` | system identity; home `/opt/anqiao-crm`; shell `/usr/sbin/nologin` |
| `/opt/anqiao-crm` | mode `0750`; owner/group `anqiao-crm`; contains only the two authorized empty directories |
| `/opt/anqiao-crm/releases` | mode `0750`; owner/group `anqiao-crm`; empty |
| `/opt/anqiao-crm/shared` | mode `0750`; owner/group `anqiao-crm`; empty |

The numeric UID is server-assigned and is not treated as a portable contract.

## Attempt and rollback evidence

The first W1 attempt created the authorized resources but its validation command
tried to inspect a `0750` child directory without `sudo`. Validation failed with
permission denied and the scripted error trap removed the new directories,
account and group. Read-only follow-up confirmed the account/path were absent,
the legacy CRM checksums were unchanged and `nginx -t` still passed.

The validation was corrected to inspect restricted metadata with `sudo`; directory
permissions were not weakened. The second attempt completed and passed all checks.

## Isolation checks actually run

- account name and `/opt/anqiao-crm` were absent immediately before creation;
- account home and non-login shell matched the resource manifest;
- all three directories had mode `0750` and the dedicated owner/group;
- no file existed under `/opt/anqiao-crm`;
- no `anqiao-crm.service` or candidate nginx site was created;
- no listener appeared on candidate port `8200`;
- legacy nginx configuration checksum remained unchanged;
- legacy placeholder index checksum remained unchanged;
- legacy HTTPS baseline remained homepage `500` and health `502`;
- `nginx -t` passed after W1.

## Explicitly not changed

No package, PostgreSQL component, database, role, secret, application release,
systemd unit, listener, firewall, nginx/TLS/DNS configuration, legacy CRM file or
other project resource was changed.

## Rollback

While these resources remain unused, rollback is removal of the two empty child
directories, root directory and system identity. Destructive rollback still
requires immediate confirmation and was not performed after the successful run.
