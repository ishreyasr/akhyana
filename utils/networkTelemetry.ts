// Utility to derive a 0-100 network quality percentage from browser Network Information API + latency

export interface NetworkStatsInput {
  effectiveType?: string | null;
  downlink?: number | null; // Mbps
  rtt?: number | null; // ms
  saveData?: boolean;
  latencyMs?: number | null; // measured custom fetch latency
}

export function computeNetworkQuality(stats: NetworkStatsInput): number {
  const { effectiveType, downlink, rtt, latencyMs, saveData } = stats;

  // Base from effectiveType
  let base: number;
  switch (effectiveType) {
    case 'slow-2g': base = 5; break;
    case '2g': base = 15; break;
    case '3g': base = 35; break;
    case '4g': base = 65; break;
    case '5g': base = 80; break; // not standardized everywhere
    default: base = 40; break; // unknown
  }

  // Downlink contribution (0 - ~10+30+15 = 55 potential)
  const dl = (downlink ?? 0);
  let dlScore = 0;
  if (dl > 0) {
    const phase1 = Math.min(dl, 0.5) / 0.5; // 0..1
    dlScore += phase1 * 10; // up to 10
    if (dl > 0.5) {
      const phase2 = Math.min(dl - 0.5, 4.5) / 4.5; // 0..1 for 0.5-5
      dlScore += phase2 * 30; // up to 30
    }
    if (dl > 5) {
      const phase3 = Math.min(dl - 5, 20) / 20; // additional improvement up to 25 Mbps
      dlScore += phase3 * 15; // up to 15
    }
  }

  let quality = base + dlScore; // could exceed 100, clamp later

  // RTT penalty
  const latency = latencyMs ?? rtt ?? null;
  if (latency != null) {
    if (latency > 50) {
      const penalty = Math.min(((latency - 50) / 10) * 2, 25); // up to -25
      quality -= penalty;
    }
  }

  // Save-data preference reduces score slightly (user wants to conserve)
  if (saveData) quality -= 5;

  return Math.max(0, Math.min(100, Math.round(quality)));
}

export async function measureLatency(url: string, timeoutMs = 4000): Promise<number | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const start = performance.now();
    await fetch(url, { method: 'HEAD', cache: 'no-store', signal: controller.signal });
    clearTimeout(t);
    return performance.now() - start;
  } catch {
    return null;
  }
}