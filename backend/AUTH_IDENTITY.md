# Local account identity contract (not deployed)

## Changes

- User/admin login issues explicit `account_kind` on access and refresh tokens. Namespace is determined by the login handler's table, never by a client field. IDs in token/profile payloads are canonical decimal strings to avoid JavaScript bigint precision loss.
- User login requires `status = active`. Admin login requires active status and one of `admin`, `superadmin`, or `moderator`. Missing/null status fails closed.
- `src/services/accountIdentity.js` resolves a signature-verified token in exactly its declared table using bound ID values. No cross-table fallback is performed, including for equal user/admin IDs.
- Profile now rechecks existence, active status, and matching admin role. It returns `{success: true, user: {id, username, role, account_kind, status}}`, not raw JWT claims or private database columns. Successful profiles include `Cache-Control: no-store`. Missing/inconsistent identity returns 401; database failures return a sanitized 503.
- Refresh requires both the existing stored refresh token and the same active-account verification before issuing a new access token. Existing refresh error mapping remains 403, including storage failures; it was not redesigned here.

## Compatibility and remaining gates

**Existing tokens without `account_kind` no longer work with profile or refresh. Users must sign in again.** Coordinate the chatbot verifier deployment with this backend change; the verifier now requires an explicit active namespace. No migration has been run or is needed for this code. Verify real user/admin status values, role values, ID types, and login/profile/refresh flows in an authorized test environment before deploying.

This change does NOT add per-request account checks to other protected routes. Their existing JWT middleware is unchanged. It does NOT implement immediate logout/access-token revocation, session invalidation on password change, refresh rotation, a denylist, or protection against ID reuse. Status/role changes can invalidate the profile temporarily but reverting them can restore unexpired token usability. Do not describe the entire backend as account-state or session-revocation hardened.

## Validation

Run `npm test` from `D:\cc\backend\backend`. The current suite has 36 passing tests, including 16 new account-identity tests using mocked database queries and test-only signing keys. New tests cover overlapping IDs, legacy/mismatched namespaces, status checks, role changes, lossless IDs, login issuance, refresh checks, allowlisted profiles, sanitized errors, and expired/tampered JWTs. No real database queries or deployed-token tests were performed.

Frontend files are unchanged. Deployment, commit, and push are separate operational steps and were not performed.

## Subsequent loopback integration milestone

`D:\cc\backend\backend\test-support\identityServer.cjs` is an explicit test-only fixture used by `D:\cc\chatbot\test_auth_integration.py`. Ten additional tests passed with real auth routes/JWT verification and Python HTTP verification over loopback. Database module replacement happens before route imports, avoiding .env/pg initialization; account/refresh storage remains fake. The fixture is outside Node's default test discovery paths and is not imported by the application. See `D:\cc\chatbot\AUTH_INTEGRATION.md` for execution, cleanup, and outstanding real-database/deployment gates. These 10 tests are separate from the 36-test backend suite.