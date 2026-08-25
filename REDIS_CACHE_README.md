# Redis Cache Guide

This document explains how Redis is used by the Crime Records of India backend,
including the complete request flow for users and administrators, cache-key
formats, expiration, invalidation, security, configuration, and troubleshooting.

## 1. Why Redis Is Used

PostgreSQL is the source of truth for application data. Redis stores temporary
copies of selected API responses so the backend can avoid repeating the same
database queries.

Redis is currently used to cache:

- the list of available dataset tables;
- a dataset table's schema;
- paginated dataset rows;
- filtered and sorted dataset searches; and
- the analytics overview.

Redis does not replace PostgreSQL, authenticate a user, or grant permissions.
Every protected request passes through JWT authentication before its controller
reads from Redis.

## 2. Configuration

The Redis client is configured in
[`backend/src/config/redis.js`](backend/src/config/redis.js). Set these values in
the backend environment:

```env
# Upstash commonly provides a TLS URL beginning with rediss://.
REDIS_URL=rediss://default:your_password@your_upstash_host:6379

# Optional. The application uses 1000 milliseconds when this is not set.
REDIS_CONNECT_TIMEOUT=1000
```

Never commit a real Redis URL or password. Use `backend/.env.example` only as a
template and keep the real value in a local `.env` file or deployment secret
manager.

If `REDIS_URL` is missing, the Redis client is disabled. If Redis cannot connect
or a Redis command fails, the cache service logs the error and lets the request
continue using PostgreSQL. This is called fail-open caching: a Redis outage can
make requests slower, but should not make the dataset API unavailable.

## 3. Cache Keys and Expiration

| Redis key | Used by | Scope | TTL |
| --- | --- | --- | --- |
| `all_tables` | `GET /api/tables` | Shared | 30 minutes |
| `schema_{table}` | `GET /api/tables/:table/schema` | Shared per table | 1 hour |
| `dataset:rows:{table}:list:{hash}` | `GET /api/data/:table` | Shared per table and pagination | 1 hour |
| `dataset:rows:{table}:search:{hash}` | `POST /api/data/:table/search` | Shared per table and search request | 1 hour |
| `analytics_overview` | `GET /api/analytics/overview` | Shared | 5 minutes |

TTL means time to live. When the TTL ends, Redis removes the key. The next
matching request queries PostgreSQL and creates a fresh cached response.

The filter-options endpoint is not currently cached:

```text
GET /api/data/:table/filter-options/:column
```

## 4. Dataset Row Key Format

Dataset list and search responses use this format:

```text
dataset:rows:{table}:{endpoint}:{request-hash}
```

The key is built by `datasetRowsKey()` in
[`backend/src/services/redisCache.js`](backend/src/services/redisCache.js).

### Key fields

| Field | How it is created | Purpose |
| --- | --- | --- |
| `dataset:rows` | Fixed text | Identifies dataset-row cache entries |
| `table` | Plain table name | Identifies the requested dataset table |
| `endpoint` | Plain text `list` or `search` | Separates normal listing from search results |
| `request-hash` | SHA-256 of normalized request parameters | Separates pages, limits, filters, and sorting choices |

Objects are recursively sorted by key before hashing. Therefore, logically
identical search bodies generate the same hash even when their object keys were
provided in a different order.

### Example key

```text
dataset:rows:auto_theft:list:20502c394fedad542399ec2d249e076c35f69d6b07838e9d17d02fe0f0bcca3b
```

It means:

| Key segment | Meaning |
| --- | --- |
| `auto_theft` | Dataset table |
| `list` | Normal paginated list operation |
| `20502c...` | SHA-256 of `{"limit":10,"page":1}` |

The complete key therefore stores the response for:

```http
GET /api/data/auto_theft?page=1&limit=10
Authorization: Bearer <valid-access-token>
```

The SHA-256 suffix is used to create a fixed-length identifier for the request
parameters. It is not used to verify passwords or request authenticity.

## 5. User Read Flow

All dataset routes use `authMiddleware`, which verifies the bearer JWT and puts
the decoded user information in `req.user`.

```mermaid
sequenceDiagram
    actor User
    participant API as Express API
    participant Redis
    participant DB as PostgreSQL

    User->>API: Request with bearer access token
    API->>API: Verify JWT and validate input
    API->>Redis: GET generated cache key
    alt Cache hit
        Redis-->>API: Cached JSON response
        API->>DB: Write view/search log when applicable
        API-->>User: Return cached response
    else Cache miss or Redis unavailable
        Redis-->>API: No cached value
        API->>DB: Query dataset and write view/search log
        DB-->>API: Current database result
        API->>Redis: SET response with TTL
        API-->>User: Return database response
    end
```

Users and administrators authenticate independently, but they use the same
shared dataset response once authorization succeeds. The current dataset SQL
returns the same rows for both roles, so there is no reason to store duplicate
copies keyed by user ID or role.

The backend still writes `views_log` and `search_logs` records on cache hits.
Caching the response therefore does not skip user activity logging.

## 6. List and Search Examples

### Paginated list

Request:

```http
GET /api/data/auto_theft?page=2&limit=20
Authorization: Bearer <access-token>
```

Input included in the hash:

```json
{
  "page": 2,
  "limit": 20
}
```

Changing either `page` or `limit` produces a different key.

### Filtered and sorted search

Request:

```http
POST /api/data/auto_theft/search
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "filters": {
    "State/UT": "Delhi"
  },
  "sortBy": "Year",
  "sortOrder": "DESC",
  "page": 1,
  "limit": 20
}
```

The hash includes `filters`, `sortBy`, `sortOrder`, `page`, and `limit`.
Changing any of them produces a separate cached result. Search keys use the
plain text value `search`, while ordinary row keys use `list`.

## 7. Administrator Read and Write Flow

Administrators, superadministrators, and moderators can read datasets through
the same routes as regular users. Administrative writes additionally pass
through `adminMiddleware` and use these routes:

```text
PATCH  /api/admin/table/:table/row
PUT    /api/admin/table/:table/row
DELETE /api/admin/table/:table/row
```

After a successful update or delete, the backend invalidates every shared list
and search cache entry for the affected table.

### Exact update/delete lifecycle

Suppose `auto_theft` has cached pages and searches, and an administrator changes
one row. The cache lifecycle is:

```text
1. Admin sends PATCH, PUT, or DELETE for one row.
2. The API authenticates the token and checks the admin role.
3. The API starts a database transaction and sets the audit context.
4. The database updates or deletes the row.
5. The database trigger creates the audit record.
6. The API commits the transaction.
7. The API scans Redis for dataset:rows:auto_theft:*
8. Redis deletes every matching list/search key.
9. The admin receives the successful mutation response.
10. The next user or admin read queries the database.
11. The fresh response is stored in Redis under its shared key.
12. Later identical reads receive that fresh value from Redis.
```

Before the change, Redis might contain:

```text
dataset:rows:auto_theft:list:<hash-for-page-1>
dataset:rows:auto_theft:list:<hash-for-page-2>
dataset:rows:auto_theft:search:<hash-for-filter-a>
```

After the committed admin change, all of those keys are removed by the pattern:

```text
dataset:rows:auto_theft:*
```

The backend does not manually edit a JSON value inside Redis. It deletes the
old table cache and lets the next normal read rebuild it from the database. This
ensures that pagination and search variants are rebuilt from the same current
database state.

```mermaid
sequenceDiagram
    actor Admin
    participant API as Express API
    participant DB as PostgreSQL
    participant Redis

    Admin->>API: Update or delete request with bearer token
    API->>API: Verify JWT and administrative role
    API->>DB: Begin transaction and set audit context
    API->>DB: Update or delete exactly one row
    DB->>DB: Trigger creates audit record
    API->>DB: Commit transaction
    API->>Redis: SCAN keys for the affected table
    Redis-->>API: Matching list and search keys
    API->>Redis: DEL all matching keys
    API-->>Admin: Return successful response
```

Invalidation happens after the database transaction commits. For a table such
as `auto_theft`, Redis scans with a pattern equivalent to:

```text
dataset:rows:auto_theft:*
```

This removes cached pages and searches for that table. The next user or admin
read is a cache miss, so the response is rebuilt from the updated PostgreSQL
data and stored once under the shared key. Keys created by older application
versions are no longer read and expire naturally according to their original
TTL.

### Failure and no-op cases

- If validation fails, the database operation never starts and Redis is not
  changed.
- If the database update/delete fails, the transaction is rolled back and Redis
  is not invalidated.
- If an update requests the value already present in the cell, the transaction
  is rolled back and the existing row cache remains valid.
- If the database commit succeeds but Redis is unavailable, the database change
  still succeeds. The old Redis value can remain until its one-hour TTL expires;
  the API logs the Redis error and continues operating from the database.
- A direct SQL change made outside the API does not call
  `invalidateDatasetTable()`. Its cached rows can remain until the TTL expires
  or the keys are manually deleted.

For consistent cache behavior, dataset mutations should always use the admin
API endpoints rather than direct database writes.

## 8. What Administrative Invalidation Does Not Remove

A row update or deletion currently removes only `dataset:rows:*` entries for
the affected table. It does not remove:

- `all_tables`, because the set of tables did not change;
- `schema_{table}`, because the table structure did not change; or
- `analytics_overview`, which expires naturally after five minutes.

Because analytics includes view and search totals, those numbers can be up to
five minutes old even though activity logs continue to be written during cache
hits. This is expected with the current TTL-based analytics strategy.

If future administrative features create/drop tables or alter columns, those
features should explicitly invalidate `all_tables` and/or `schema_{table}`.

## 9. Cache Service Behavior

The cache wrapper in
[`backend/src/services/redisCache.js`](backend/src/services/redisCache.js)
provides these operations:

| Function | Behavior |
| --- | --- |
| `connect()` | Connects lazily when the first Redis operation is needed |
| `get(key)` | Returns the cached string or `null` on a miss/failure |
| `set(key, value, ttl)` | Stores a value, using `SETEX` when a TTL is supplied |
| `del(keys)` | Deletes one key or a list of keys |
| `datasetRowsKey(...)` | Creates stable shared list/search keys |
| `invalidateDatasetTable(table)` | Scans and deletes all row keys for one table |

API response objects are converted to JSON strings before storage and parsed
back into objects on a cache hit.

## 10. Reading the Source Logs

The dataset and analytics controllers log whether the response source was Redis
or the database. Examples:

```text
[Redis HIT] GET /api/data/auto_theft key=dataset:rows:auto_theft:list:<hash>
[DATABASE] GET /api/data/auto_theft source=Supabase/PostgreSQL reason=Redis MISS key=dataset:rows:auto_theft:list:<hash>
[Redis HIT] POST /api/data/auto_theft/search key=dataset:rows:auto_theft:search:<hash>
[DATABASE] GET /api/data/auto_theft/filter-options/Year source=Supabase/PostgreSQL reason=NOT CACHED
[Redis HIT] GET /api/analytics/overview key=analytics_overview
```

`[Redis HIT]` means the response was read from Redis. `[DATABASE]` means the
response was obtained from the database, either because Redis had a miss or
because that endpoint is intentionally not cached. These logs are server-side;
the API response body is unchanged.

The HTTP access log may separately show `304 Not Modified`. That status is
browser/Express ETag validation and does not identify the Redis source. Use the
`[Redis HIT]` or `[DATABASE]` line immediately before it to determine where the
backend obtained the response.

## 11. Security Rules

- A Redis key is an internal lookup name, not an access token.
- Knowing a cache key does not bypass JWT or administrator authorization.
- Plain-text key segments must not contain secrets.
- Keep `REDIS_URL`, Redis passwords, JWT secrets, and database credentials out
  of source control, logs, screenshots, and client-side code.
- Redis should not be exposed directly to browsers. Only the backend should
  connect to it.
- Use a TLS Redis URL (`rediss://`) in production when supported by the provider.
- Set an appropriate Redis provider policy, password, and network restrictions.

## 12. Troubleshooting

### Requests work but no Redis keys appear

Check that `REDIS_URL` exists in the environment used by the backend process.
The application intentionally continues against PostgreSQL when Redis is not
configured.

### `Redis connect failed` or `Redis Error` appears

Check the Redis host, port, password, TLS scheme, provider status, and network
access. Upstash URLs normally use `rediss://`.

### A response is still old after an admin change

Confirm that the change used the provided admin update/delete endpoints and
that the transaction completed. Direct database modifications do not call the
application's Redis invalidation function, so matching keys remain until their
one-hour TTL expires or they are manually deleted.

### Inspecting keys with Redis CLI

Use `SCAN`, not `KEYS`, in production because `KEYS` can block Redis while it
examines the complete keyspace.

```text
SCAN 0 MATCH dataset:rows:* COUNT 100
TTL all_tables
TTL analytics_overview
GET all_tables
```

Cached values may contain dataset rows. Inspect them only in an authorized
environment and avoid pasting production records into logs or support chats.

## 13. Source Locations

- Redis client configuration: `backend/src/config/redis.js`
- Cache helper and key generation: `backend/src/services/redisCache.js`
- Dataset cache reads and writes: `backend/src/controllers/datasets/datasetController.js`
- Admin row invalidation: `backend/src/controllers/admin/adminController.js`
- JWT authentication: `backend/src/middleware/authMiddleware.js`
- Admin authorization: `backend/src/middleware/adminMiddleware.js`
- Analytics cache: `backend/src/controllers/analytics/analyticsController.js`
