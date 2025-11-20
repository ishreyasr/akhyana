# Observability & Diagnostics Guide

## Endpoints

### /health
JSON health report.
Fields:
- status: 'ok' | 'degraded' | 'error'
- vehicles: number currently connected
- radioEnabled: boolean
- redis: 'up' | 'down'
- supabase: 'up' | 'down' | 'disabled'
- version: build version (BUILD_VERSION env or 'dev')
- buildTimestamp: build time ISO if provided
- timestamp: server epoch ms

Usage: curl http://localhost:3002/health

### /metrics (Prometheus format)
Exports counters & histogram.
Metrics:
- v2v_messages_total (counter)
- v2v_emergencies_total (counter)
- v2v_call_sessions_total (counter)
- v2v_active_vehicles (gauge)
- v2v_uptime_seconds (gauge)
- v2v_message_delivery_latency_ms_bucket / _sum / _count (histogram)

Scrape example (prometheus.yml):
```
scrape_configs:
  - job_name: 'v2v'
    static_configs:
      - targets: ['host.docker.internal:3002']
    metrics_path: /metrics
    scrape_interval: 15s
```

### /presence
Returns current presence state with lastSeenMsAgo for each vehicle.

## Correlation IDs
- HTTP: requestId header X-Request-Id returned; all access logs: http_access
- WebSocket: sessionId generated per connection and included in all per-event logs.

## Message Latency Histogram
Client can include `sentTs` (ms epoch) in `send_message` events. Server records delivery latency into buckets (0,10,50,100,250,500,1000,2000,5000,+Inf). Exported via the histogram metrics.

## Proximity Events
Events: `proximity_event` with eventType enter|exit. Persisted to Supabase when persistence enabled.
UI: newly entered peers flagged with isNew for 10s.

## Troubleshooting
- Redis down: redis field becomes 'down'; system continues with in-memory only.
- Supabase disabled: supabase field 'disabled'.
- High latency buckets growing: check network path and client clocks; ensure clients send accurate sentTs.

## Logging
Structured JSON to stdout. Fields include: ts, level, message, category, requestId (HTTP), sessionId (WebSocket), and event-specific metadata.

## Next Improvements (Future)
- Add per-message correlationId echo back to sender.
- Export process memory & heap usage metrics.
- Graceful shutdown hook emitting final metrics snapshot.
