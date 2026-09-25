# TASK-0007 Step 1 Design Note — Auth Contracts, Call Graph, and Schema Facts

- Task: `docs/tasks/active/TASK-0007-auth-authorization-repair.md` (TASK-0007)
- Executor runtime id: `5f121e6f-b747-4f1e-8162-dd0214cef1d2/k3-256k`
- Date: 2026-08-02
- Authority: SPEC-0002 v0.2.0 (approved, SHA-256 `0c313e4f2592ba33bf7331dff7a4f1e73ede5b107436f4446309f3354115b8f4` verified in preflight), DEC-0044, DEC-0051, DEC-0065, DEC-0066, DEC-0067
- Labels: [VERIFIED] = read from the cited file during this execution; [INFERENCE] = derived conclusion; [PROPOSAL] = design to be implemented in steps 2–4.

This note maps the current authentication contracts and persistence callers before any source edit, per task-card step 1.

## 1. Current call graph [VERIFIED]

Construction and wiring:

- `src/crm/web/main.py:82-119` `setup_app_dependencies()` constructs `AuthenticationService(user_repository=UserRepository(), sessions_store={}, csrf_store={}, login_trackers={}, auth_settings=AuthSettings())` and stores it plus `user_repository` on `app.state`. It is called at module import (`src/crm/web/main.py:121`).
- `src/crm/web/main.py:19` evaluates `settings = Settings()` at import time; `src/crm/web/main.py:25-27` raises RuntimeError if `SESSION_SECRET_KEY` is missing; `src/crm/web/main.py:33-40` adds `SessionMiddleware` with `https_only=os.environ.get('SESSION_COOKIE_SECURE', 'true').lower() == 'true'`, `same_site='lax'`, `max_age=3600`.

Consumers of `AuthenticationService` (grep over `src/` and `tests/`):

- `src/crm/web/routes/auth.py` — `/api/auth` router:
  - `login()` (line 53-95) calls `auth_service.authenticate(...)`; on success sets `request.session["session_id"]`; calls `auth_service.get_csrf_token(session_id)` and returns the raw CSRF token in `LoginResponse`. Contains defect D6 below (line 85).
  - `logout()` (line 98-114) calls `auth_service.invalidate_session(...)` and `auth_service.get_csrf_token(...)`; clears `request.session`.
  - `get_session()` (line 117-139) calls `deps.get_current_user_optional`; returns `csrf_token` via `auth_service.get_csrf_token(session_id)` when authenticated.
  - `require_auth()` (line 142-150) dependency factory wrapping `deps.get_current_user`.
- `src/crm/web/deps.py` — `get_current_user_optional(request)` (line 18-43) reads `request.session["session_id"]`, calls `auth_service.validate_session(session_id)`, then `user_repository.find_by_id(session.user_id)`, returning dict `{id, username, display_name, status}`. No roles or scopes are loaded.
- `src/crm/web/routes/institutions.py` imports only `get_current_user` / `get_current_user_optional` from deps and hardcodes `roles=frozenset()` into `PolicySubject` at lines 101, 147, 184 with comments "Would be populated from RoleGrant". (Not owned by TASK-0007; institution authorization repair is an explicit non-goal of the task card.)
- `src/crm/web/main.py` page routes `/dashboard` (line 161), `/` (line 180), `/login` (line 185) use `deps.get_current_user_optional` for template context only.
- `tests/test_s4_authentication.py` fixtures construct `AuthenticationService` with `sessions_store={}`, `csrf_store={}`, `login_trackers={}` dicts and assert against those dicts and `auth_service.audit_log` (in-memory list). These assertions must be adapted to the repository-based constructor (owned file).

No other module consumes the auth service, the session stores, or the CSRF store. Blast radius of the refactor is confined to owned files [VERIFIED by grep].

Persistence callers:

- `src/crm/persistence/user_repository.py` is the only existing identity repository; it is consumed by `deps.py`, `routes/auth.py` (via `app.state`), and `AuthenticationService`.
- `RoleGrantModel`, `AuditEventModel`, `ServerSessionModel` exist in `src/crm/persistence/models.py` and are exported from `src/crm/persistence/__init__.py`, but no repository or application code reads or writes them anywhere in `src/` [VERIFIED by grep — confirms task-card [VERIFIED] assumption].

## 2. Schema facts [VERIFIED]

Read from `src/crm/persistence/models.py` and `migrations/versions/0001_initial_schema.py`; cross-checked against `tests/test_persistence_schema.py` (asserts the exact 9-table set: audit_events, contacts, follow_up_activities, follow_up_activity_revisions, institution_owner_history, institutions, role_grants, server_sessions, user_identities — any schema change would break this approved-schema test).

- `server_sessions` (models.py `ServerSessionModel`): `id` UUID PK; `session_token_hash` String(64) unique, NOT NULL; `csrf_token_hash` String(64) NOT NULL; `user_id` UUID FK → user_identities ON DELETE RESTRICT; `user_session_epoch` Integer ≥ 0; `created_at`, `expires_at` (CHECK expires_at > created_at), `last_seen_at` tz-aware NOT NULL; `invalidated_at` / `invalidation_reason` with complete-pair CHECK (both set or both NULL). Index on (user_id, expires_at). Sufficient for durable sessions with hash-only token storage, expiry, epoch capture, and invalidation with reason.
- `audit_events` (models.py `AuditEventModel`): `actor_user_id` UUID FK nullable; `action` String(120) non-blank; `target_type` String(80); `target_id` UUID nullable; `outcome` CHECK IN ('success','denied','failure'); `reason` Text nullable; `before_state` / `after_state` JSON nullable; `failure_summary` Text nullable; `occurred_at` NOT NULL. Sufficient for durable auth audit with non-sensitive failure classification. There is no IP column — no schema change adds one (smallest schema-compatible solution per task card).
- `role_grants` (models.py `RoleGrantModel`): `role` CHECK IN ('business_user','administrator','general_manager','manager'); `scope_reference` required when role='manager'; revocation complete-pair CHECK; `granted_by_user_id`, `granted_at`, `reason` NOT NULL. Active grants = `revoked_at IS NULL`. Sufficient for canonical role/scope loading.
- `user_identities` (models.py `UserIdentityModel`): `status` CHECK IN ('pending','enabled','disabled'); `session_epoch` Integer ≥ 0; `password_hash` CHECK LIKE '$argon2id$%'. Sufficient for fail-closed status checks and the session-epoch forced-logout pattern (DEC-0044).
- No rate-limit table exists. Per the task card's smallest-schema-compatible-solution guidance, normalized login rate limiting stays in-process (per-identifier attempt tracker); this matches the existing `LoginAttemptTracker` design and requires no schema change.

Conclusion [INFERENCE]: the approved schema supports every SPEC-0002/DEC-0044 requirement for this task. No model or migration change is needed, so none will be made (also required to keep `tests/test_persistence_schema.py` passing).

## 3. Defects mapped to binding rules [VERIFIED at cited lines]

- D1 — Sessions are process-memory dicts (`src/crm/web/auth.py:242` `self.sessions_store[session.session_id] = session`); restart drops all sessions and invalidations. Violates DEC-0044 (server-side sessions), SPEC-0002 R-014 (revoked sessions expire within a verifiable short bound — in-memory state is not verifiable or durable). → Persist via a new `ServerSessionRepository` over `server_sessions`, SHA-256 token hashes only.
- D2 — Audit is a process-memory list (`src/crm/web/auth.py:170` `self.audit_log = []`); lost on restart. Violates SPEC-0002 §7/R-005 durable audit and DEC-0044 ("security-audited"). → Persist via a new `AuditEventRepository` over `audit_events`.
- D3 — Roles/scopes never loaded: `deps.py:34-41` returns identity without roles; institutions routes hardcode `roles=frozenset()`. Violates SPEC-0002 R-013 (same identity/roles across surfaces), R-003/R-006 (deny by default until grants load), AC-009. → New `RoleGrantRepository`; deps returns the canonical identity dict including `roles` and `management_scope_keys`, deny (None) on load failure.
- D4 — Credential-failure enumeration: `auth.py:215` returns the literal string "Account is disabled" (reveals account state), and rate limiting applies only to existing users (`auth.py:208-229` — unknown usernames are never tracked or locked, a user-existence oracle). Violates SPEC-0002 §8 deny-without-disclosure and the fail-closed boundary (generic credential failure messages). → One generic message for all credential failures; normalized casefold-keyed rate limiting applied uniformly to existing, unknown, and disabled accounts.
- D5 — CSRF tokens are issued (`auth.py:300-311`) but never enforced on any write request. Violates DEC-0044 ("write requests have CSRF protection"). → Enforcement for mutating `/api/` requests (login exempt), checking the header against the signed-cookie copy and the persisted server-side hash.
- D6 — Login response derives `user_id` via `session_id.split("_")[1]` (`routes/auth.py:85`); `session_id` is `sess_<hex>` with no user id embedded, so the value is garbage. → `authenticate` returns the session object; the route uses `session.user_id`.
- D7 — Cookie security depends only on the raw `SESSION_COOKIE_SECURE` env var (`main.py:36`); production could be silently weakened by setting it false. Violates the explicit-per-environment cookie boundary. → Explicit environment resolution: default secure; `SESSION_COOKIE_SECURE=false` honored only outside production; production + false → RuntimeError at startup.
- D8 — Login success can be shown even when the audit/session persistence layer failed, because stores were infallible dicts. With durable stores this must stay fail-closed per SPEC-0002 §8 (no success shown if the audit write fails) and R-017 (no faked login success when the identity backend is unavailable). → `authenticate` treats session/audit persistence failure as login failure with the generic message.

## 4. Design decisions for steps 2–4 [PROPOSAL]

Each decision cites its authority. All code stays inside handoff §3 owned files.

1. New `src/crm/persistence/session_repository.py` — `ServerSessionRepository` with `create_session(session, csrf_token)`, `find_active_session(session_token)` (hash lookup, `invalidated_at IS NULL`, `expires_at > now`, touches `last_seen_at`, returns the domain session plus persisted CSRF hash), `update_csrf_token_hash(session_token, csrf_token)`, `invalidate_session(session_token, reason)`. Persists only SHA-256 hex digests of raw tokens (64 chars, fits String(64)). Authority: DEC-0044 server-side sessions; task card "Only token hashes may be persisted"; `tests/test_persistence_schema.py::test_server_sessions_store_hashes_instead_of_raw_tokens`. Style matches `user_repository.py` (lazy `SessionLocal` import, `with SessionLocal() as session: ... session.commit()`).
2. New `src/crm/persistence/audit_repository.py` — `AuditEventRepository.record(...)` writing `AuditEventModel` rows with `outcome` in success/denied/failure and `failure_summary` for non-sensitive internal classification; never passwords, raw tokens, or hashes. Authority: SPEC-0002 §7 (audit content rules) and §8 (failure behavior).
3. New `src/crm/persistence/role_grant_repository.py` — `RoleGrantRepository.find_active_roles(user_id)` returning `(frozenset[Role], frozenset[str] management_scope_keys)` from grants with `revoked_at IS NULL`; manager grants contribute their `scope_reference` as scope keys. Authority: SPEC-0002 R-013, AC-009, DEC-0051 (policy subject is the canonical role carrier).
4. Refactor `src/crm/web/auth.py` — `AuthenticationService(user_repository, session_repository, audit_repository, auth_settings, login_trackers=None)` becomes stateless apart from the rate-limit trackers; durability delegated to the repositories. `authenticate()` returns `(True, UserSession)` on success (issuing the session row and its CSRF hash atomically) and `(False, <generic>)` for every failure including disabled/unknown accounts, rate-limit refusal, identity-lookup errors, and session/audit persistence failure (D4, D8). Rate limiting keyed by `username.casefold()` applied uniformly before user lookup (D4). Session validation re-checks user status and `session_epoch` and persistently invalidates on mismatch with an audited reason (DEC-0044, R-004, R-014). `UserSession`, `CsrfTokenPair`, `LoginAttemptTracker`, `AuthSettings`, `hash_password`/`verify_password` contracts preserved so dependent code changes stay minimal.
5. `src/crm/web/deps.py` — `get_current_user_optional` returns the canonical dict `{id, username, display_name, status, role, roles, management_scope_keys}`; role-load exception or missing repository → return None (fail-closed deny, R-003/R-006). Add `enforce_csrf(request)` helper used by main.py middleware (D5): mutating methods on `/api/` paths except `/api/auth/login` require the `X-CSRF-Token` header to match the signed-cookie copy (`secrets.compare_digest`) and the persisted server-side hash via `auth_service.validate_csrf_token`; failures return 403 with a generic detail and a denied audit event; unauthenticated requests pass through to route-level 401 (no information added).
6. `src/crm/web/routes/auth.py` — login uses the returned `UserSession` (fixes D6), stores `session_id` and the raw `csrf_token` in the signed cookie, returns `role`/`roles` from the canonical context; `/session` echoes the cookie CSRF copy (re-issuing only if absent); logout requires a valid session (CSRF enforced by middleware).
7. `src/crm/web/main.py` — wire the three real repositories into `setup_app_dependencies()`; add `resolve_session_cookie_https_only()` implementing the explicit environment matrix (D7); register the CSRF middleware after `SessionMiddleware` so `request.session` is available. No other main.py behavior changes.
8. Tests — adapt `tests/test_s4_authentication.py` fixtures to the repository-based constructor using in-memory fakes (`tests/test_task0007_inmemory_fakes.py`); new `tests/test_task0007_auth_service.py` (durable semantics over fakes: hash-only persistence, expiry, invalidation with reason, epoch capture, role loading, restart proof via a second service instance over the same backend, enumeration-uniform rate limiting, fail-closed audit/session persistence); new `tests/test_task0007_auth_http.py` (TestClient negative/positive HTTP: CSRF 403 matrix, generic 401 messages, logout flow, cookie-environment matrix); the existing `CRM_RUN_POSTGRESQL_TESTS=1`-gated PostgreSQL test is adapted to the real repositories and a new gated durable-session round-trip test is added — both skip locally (no local PostgreSQL, preflight §6) and are reported NOT VERIFIED with the exact remaining check.
9. Rate limiting remains in-process per the task card's smallest-schema-compatible-solution guidance (no rate-limit table exists; adding one would change the approved schema and break `test_persistence_schema.py`). Recorded limitation: per-process counters reset on restart; the durable parts (sessions, audit, roles) do not. This is the card-sanctioned trade-off, not a silent weakening.

## 5. Out of scope (confirmed)

- `src/crm/web/routes/institutions.py` role population (task card: institution authorization repair is a separate task; deps keeps returning a compatible dict so its behavior is unchanged).
- Any schema/migration change (section 2 shows none is needed).
- `tests/conftest.py`, `src/crm/config.py`, `pyproject.toml`, governance scripts, specs, decisions — all forbidden by handoff §3.
- Pre-existing baseline failures in `tests/test_s6_*` (Settings() env validation at import; root cause recorded in `docs/evidence/TASK-0007-preflight.md` §5) — not owned; will be distinguished from regressions in the final report.
