# Threat Modeling Note (Initial Draft)

## Scope
Core real-time V2V dashboard: WebSocket server (`Backend/server.js`), Redis, optional Supabase persistence, client Next.js frontend.

## Assets
- Vehicle presence & location data
- Emergency alerts
- User settings & messages
- Call signaling metadata
- System availability & integrity

## Trust Boundaries
1. Browser <-> WebSocket server
2. Server <-> Redis
3. Server <-> Supabase REST
4. (Future) Multi-process / cluster pub/sub channel

## Primary Threats (STRIDE)
| Category | Example | Impact | Mitigation |
|----------|---------|--------|------------|
| Spoofing | Fake vehicleId registration | False data / confusion | Firebase auth token (planned), server-side mapping, rate limits |
| Tampering | Crafted WebSocket payload altering another vehicle state | Data corruption | Zod validation + vehicleId binding on server session |
| Repudiation | User denies sending message | Persist logs with requestId/sessionId and timestamps |
| Information Disclosure | Public exposure of write-enabled Supabase anon key | Unauthorized writes | Remove write perms; server proxy route; RLS |
| Denial of Service | Flood location_update events | Resource exhaustion | Token bucket, server/client coalescing, per-event limits |
| Elevation of Privilege | Bypass CORS / WS origin checks | Unauthorized access | Allowed origins list + Origin enforcement |

## Existing Controls
- Input validation (Zod schemas)
- Sanitization of control chars
- Structured logging with correlation IDs
- Rate limiting & coalescing for noisy events
- Redis pub/sub isolation channel

## Planned Controls
- Mandatory Firebase auth for register
- Redis-backed distributed rate limiting in cluster mode
- Secrets: move service keys to backend-only env

## Abuse Scenarios & Responses
1. Location flood: Coalescing drops intermediates; counters indicate scale.
2. Replay of broadcast frames via pub/sub: origin PID tag prevents local echo loops; add signature (future) if needed.
3. Unauthorized WS origin: connection destroyed pre-upgrade if origin mismatch.
4. Enum fuzzing (unknown events): standardized error + ignore.

## Residual Risks
- Without auth, spoofing vehicleId remains possible (short window until auth added).
- Proximity calculations per-node may diverge slightly in a clustered future—document as eventual consistency.

## Action Items
- [ ] Implement Firebase auth hardening (Backlog item 4).
- [ ] Add metrics for pub/sub publish/consume counts.
- [ ] Automate dependency audit in CI (script added).
- [ ] Extend settings proxy to real Supabase service key usage.

## Review Cadence
Quarterly or upon major architectural changes (cluster mode, new data types).
