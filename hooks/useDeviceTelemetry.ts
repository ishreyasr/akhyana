"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { computeNetworkQuality, measureLatency } from '../utils/networkTelemetry';

// Minimal BatteryManager type (not always in TS lib depending on target)
declare global {
  // eslint-disable-next-line no-var
  interface BatteryManager {
    level: number; // 0..1
    charging: boolean;
    addEventListener: (type: string, handler: any) => void;
    removeEventListener: (type: string, handler: any) => void;
  }
}

export interface DeviceTelemetry {
  networkQuality: number | null; // 0-100
  networkStats: {
    effectiveType?: string | null;
    downlink?: number | null;
    rtt?: number | null;
    saveData?: boolean;
    latencyMs?: number | null;
  } | null;
  batteryLevel: number | null; // 0-100
  charging: boolean | null;
  lastUpdated: number | null; // epoch ms
}

const LS_KEY = 'deviceTelemetry:last';

const INITIAL: DeviceTelemetry = {
  networkQuality: null,
  networkStats: null,
  batteryLevel: null,
  charging: null,
  lastUpdated: null,
};

interface Options {
  latencyProbeUrl?: string; // a lightweight HEAD endpoint (default: '/api/ping' else '/favicon.ico')
  pollIntervalMs?: number; // default 15000
  latencyEveryN?: number; // perform latency measure every N polls (default 1 every poll)
}

export function useDeviceTelemetry(options: Options = {}): DeviceTelemetry {
  const { latencyProbeUrl, pollIntervalMs = 15000, latencyEveryN = 1 } = options;
  const [data, setData] = useState<DeviceTelemetry>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) return { ...INITIAL, ...JSON.parse(raw) } as DeviceTelemetry;
      } catch { /* ignore */ }
    }
    return INITIAL;
  });
  const pollCountRef = useRef(0);
  const batteryRef = useRef<BatteryManager | null>(null);

  const updateBattery = useCallback(() => {
    const mgr = batteryRef.current;
    if (!mgr) return;
    setData(prev => ({
      ...prev,
      batteryLevel: mgr.level != null ? Math.round(mgr.level * 100) : prev.batteryLevel,
      charging: mgr.charging,
      lastUpdated: Date.now(),
    }));
  }, []);

  const pollNetwork = useCallback(async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - NetworkInformation not yet in TS lib for all targets
      const connection: any = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
      let measuredLatency: number | null = null;
      pollCountRef.current += 1;
      // Always measure latency OR based on frequency option
      if (pollCountRef.current % latencyEveryN === 0 || true) {
        measuredLatency = await measureLatency(latencyProbeUrl || '/favicon.ico');
      }
      const stats = connection ? {
        effectiveType: connection.effectiveType || null,
        downlink: typeof connection.downlink === 'number' ? connection.downlink : null,
        rtt: typeof connection.rtt === 'number' ? connection.rtt : null,
        saveData: !!connection.saveData,
        latencyMs: measuredLatency,
      } : {
        effectiveType: null,
        downlink: null,
        rtt: null,
        saveData: false,
        latencyMs: measuredLatency,
      };
      let networkQuality = computeNetworkQuality(stats);
      // If effectiveType absent, refine networkQuality primarily from latency
      if (!stats.effectiveType && stats.latencyMs != null) {
        const L = stats.latencyMs;
        let latencyScore: number;
        if (L <= 40) latencyScore = 95;
        else if (L <= 80) latencyScore = 85 - ((L - 40) / 40) * 10; // 85->75
        else if (L <= 150) latencyScore = 75 - ((L - 80) / 70) * 20; // 75->55
        else if (L <= 300) latencyScore = 55 - ((L - 150) / 150) * 25; // 55->30
        else if (L <= 600) latencyScore = 30 - ((L - 300) / 300) * 20; // 30->10
        else latencyScore = 5;
        networkQuality = Math.round((networkQuality + latencyScore) / 2);
      }
      setData(prev => ({
        ...prev,
        networkQuality,
        networkStats: stats,
        lastUpdated: Date.now(),
      }));
    } catch {
      // swallow
    }
  }, [latencyProbeUrl, latencyEveryN]);

  useEffect(() => {
    let interval: any;
    pollNetwork();
    interval = setInterval(pollNetwork, pollIntervalMs);
    return () => interval && clearInterval(interval);
  }, [pollNetwork, pollIntervalMs]);

  useEffect(() => {
    if ('getBattery' in navigator) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      (navigator as any).getBattery().then((battery: BatteryManager) => {
        batteryRef.current = battery;
        updateBattery();
        battery.addEventListener('levelchange', updateBattery);
        battery.addEventListener('chargingchange', updateBattery);
      }).catch(() => {/* ignore */ });
      return () => {
        const mgr = batteryRef.current;
        if (mgr) {
          mgr.removeEventListener('levelchange', updateBattery);
          mgr.removeEventListener('chargingchange', updateBattery);
        }
      };
    }
  }, [updateBattery]);

  // Listen for connection change events for more reactivity
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const connection = (navigator as any).connection;
    if (connection && connection.addEventListener) {
      const handler = () => pollNetwork();
      connection.addEventListener('change', handler);
      return () => connection.removeEventListener('change', handler);
    }
  }, [pollNetwork]);

  // Persist lightweight snapshot whenever data changes
  useEffect(() => {
    if (data.lastUpdated) {
      try {
        const snapshot = { ...data };
        localStorage.setItem(LS_KEY, JSON.stringify(snapshot));
      } catch { /* ignore */ }
    }
  }, [data]);

  return data;
}
