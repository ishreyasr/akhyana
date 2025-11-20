# Horizontal Scale Readiness Plan (Redis Pub/Sub Skeleton)

## Goals
Enable the V2V real-time server to scale beyond a single Node.js process / host while keeping broadcast-style events (presence updates, emergency alerts, radio relays, future proximity events) coherent across all connected clients.

## Current State (Before Change)
- Single-process in-memory maps: `vehicles`, `lastNearbyMap`, geohash `geoIndex`.
- Broadcast helper simply iterated local `vehicles` and sent WebSocket frames.
- Redis already available (persistence + presence hashing) but not used for fan-out.

## Added Hooks (This Commit)
- Introduced Redis pub/sub channel `v2v:broadcast`.
- `broadcast(obj)` now:
  1. Fans out to local process clients.
  2. Publishes `{ origin: <pid>, obj }` JSON to Redis.
- A dedicated subscriber listens and replays messages from other processes (skipping its own via `origin` check).

## Event Types Covered Immediately
- `presence_update`
- `emergency_alert`
- `radio_text` (radio bridge text frames)
- Any future use of `broadcast()` automatically participates.

## Out-of-Scope / Deferred
- Cross-process synchronization of: proximity diff state (`lastNearbyMap`), geohash index, and rate-limit buckets.
- Distributed locks or leader election for periodic tasks (heartbeat sweeps, proximity recalcs).
- Persisted rate limiting (still in-memory per process).

## Next Scaling Steps (Recommended Roadmap)
1. Presence Replication:
   - Continue storing authoritative presence snapshot in Redis hash (`v2v:presence`). Periodic reconcile job to repopulate local cache on process start.
2. Proximity Computation Strategy:
   - Option A: Each process runs proximity for only the vehicles it owns (that connected to it).
   - Option B: Dedicated worker (or cluster primary) performs global proximity calc and publishes `proximity_event` via pub/sub.
3. Heartbeat & Stale Sweep:
   - Convert current `setInterval` sweeps to only act on locally-owned vehicles; optionally a shared key `v2v:maintenance:last_sweep` to avoid duplicates if switching to a single global sweeper.
4. Geo Index Distribution:
   - Maintain per-process geohash maps locally; for cross-process queries rely on coarser presence data or move to centralized spatial service if global queries required.
5. Rate Limiting:
   - Migrate token buckets to Redis LUA script for atomic increment/expire (key pattern `v2v:rl:<vehicleId>:<event>`).
6. Horizontal Session Affinity (Optional):
   - Use a load balancer with sticky sessions on `vehicleId` or WebSocket upgrade hash to keep moving vehicles on same node—reduces cross-node proximity recomputation inconsistency.
7. Cluster Module Extraction:
   - Extract WebSocket + in-memory maps to `wsCluster.js` exposing factory: `createRealtimeServer({ redisUrl })`.
   - Allow spinning multiple workers (Node cluster or PM2) each instantiating a server on shared port via SO_REUSEPORT.
8. Graceful Scale-Out / Rolling Restart:
   - Implement `SIGTERM` handler: stop accepting new connections, broadcast planned shutdown status, wait N seconds for clients to reconnect elsewhere, then exit.

## Data Consistency Notes
- Presence race: Two processes may send conflicting status (online/offline). Rely on timestamp ordering; client treats latest `lastSeen` as authoritative.
- Emergency alerts are idempotent by `alert.id`— duplicate display suppression handled client-side.

## Monitoring & Metrics
Add (future):
- Counters: `v2v_pubsub_messages_published`, `v2v_pubsub_messages_consumed`, `v2v_pubsub_replay_skipped`.
- Gauge: `v2v_ws_process_count` (number of workers).

## Failure Modes & Mitigations
| Failure | Effect | Mitigation |
|---------|--------|------------|
| Redis down | Cross-node broadcast stops | Local still works; log & alert; optionally queue last N messages for retry |
| Message storm | High Redis traffic | Add lightweight filter: only publish whitelisted event types |
| Large payload | Redis channel bloat | Enforce slim broadcast payloads (no bulk arrays) |

## Example Cluster Launch (Future)
```bash
# Using Node cluster (pseudo)
node cluster.js --workers=4 --port=3002
```
Each worker loads server.js; pub/sub ensures broadcasts propagate.

## Validation Plan
1. Start two server instances pointing to same Redis.
2. Connect one vehicle to each instance.
3. Register; observe that `presence_update` from one appears to the client on the other.
4. Trigger emergency alert; verify both clients display it exactly once.

## Open Questions
- Do we need cross-node proximity events immediately? If yes, choose Option B (central worker) to avoid duplication & inconsistent ordering.
- Global ordering guarantees? Currently best-effort; if strict ordering needed, introduce sequence IDs via Redis INCR.

## Summary
We now have a foundational pub/sub layer enabling multi-process or multi-host horizontal scaling with minimal code churn. Further steps can iterate independently without refactoring existing event emission logic.
