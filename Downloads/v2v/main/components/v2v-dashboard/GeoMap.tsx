"use client";
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useNearbyDevices } from '@/hooks/useNearbyDevices';
import { webSocketService } from '@/utils/websocketService';

// Enhanced canvas-based geo visualization
// - Distance rings
// - Live updates via peer_location events
// - Click select & highlight
// - Hover tooltip

interface LiveDevice {
  id: string;
  name: string;
  distance: number;
  deviceType?: string;
  lat?: number;
  lon?: number;
}

export const GeoMap: React.FC<{ onSelect?: (id: string) => void }> = ({ onSelect }) => {
  const { devices } = useNearbyDevices();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const markersRef = useRef<{ id: string; x: number; y: number; r: number }[]>([]);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [liveDevices, setLiveDevices] = useState<LiveDevice[]>([]);

  // Merge scanner devices with live updates
  useEffect(() => {
    setLiveDevices(prev => {
      const map = new Map<string, LiveDevice>(prev.map(d => [d.id, d]));
      devices.forEach(d => {
        const existing = map.get(d.id);
        map.set(d.id, { ...existing, ...d });
      });
      return Array.from(map.values());
    });
  }, [devices]);

  // Subscribe to peer_location events
  useEffect(() => {
    const handler = (payload: any) => {
      if (!payload?.vehicleId) return;
      setLiveDevices(prev => {
        const idx = prev.findIndex(p => p.id === payload.vehicleId);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], lat: payload.lat, lon: payload.lon };
          return updated;
        }
        return prev;
      });
    };
    webSocketService.subscribe('peer_location', handler);
    return () => webSocketService.unsubscribe('peer_location', handler);
  }, []);

  const handlePointerMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left; const y = e.clientY - rect.top;
    const hit = markersRef.current.find(m => Math.hypot(m.x - x, m.y - y) <= m.r + 6);
    setHoverId(hit?.id || null);
  }, []);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left; const y = e.clientY - rect.top;
    const hit = markersRef.current.find(m => Math.hypot(m.x - x, m.y - y) <= m.r + 6);
    if (hit) {
      setSelectedId(prev => prev === hit.id ? null : hit.id);
      if (onSelect) onSelect(hit.id);
    }
  }, [onSelect]);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const W = canvas.width; const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const list = liveDevices.length ? liveDevices : devices;
    const maxDeviceDistance = list.reduce((m, d) => Math.max(m, d.distance || 0), 0);
    const maxRange = Math.max(200, Math.ceil(maxDeviceDistance / 50) * 50);
    const centerX = W / 2; const centerY = H / 2;

    // Rings
    ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 1;
    for (let r = 50; r <= maxRange; r += 50) {
      const radiusPx = (r / maxRange) * (Math.min(W, H) / 2 - 20);
      ctx.beginPath(); ctx.arc(centerX, centerY, radiusPx, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#6b7280'; ctx.font = '10px sans-serif'; ctx.fillText(r + 'm', centerX + radiusPx + 4, centerY + 4);
    }

    // Self
    ctx.fillStyle = '#2563eb'; ctx.beginPath(); ctx.arc(centerX, centerY, 6, 0, Math.PI * 2); ctx.fill();

    // Devices radial layout (even angle)
    const sorted = [...list].sort((a, b) => a.id.localeCompare(b.id));
    const angleStep = Math.PI * 2 / Math.max(sorted.length, 1);
    markersRef.current = [];
    sorted.forEach((d, i) => {
      const angle = i * angleStep;
      const radiusNorm = Math.min((d.distance || 0) / maxRange, 1);
      const radiusPx = radiusNorm * (Math.min(W, H) / 2 - 30);
      const x = centerX + Math.cos(angle) * radiusPx;
      const y = centerY + Math.sin(angle) * radiusPx;
      const baseR = 5;
      const isHover = hoverId === d.id; const isSelected = selectedId === d.id;
      markersRef.current.push({ id: d.id, x, y, r: baseR });
      ctx.fillStyle = d.deviceType === 'emergency' ? '#dc2626' : d.deviceType === 'infrastructure' ? '#0d9488' : '#1d4ed8';
      ctx.beginPath(); ctx.arc(x, y, (isHover || isSelected) ? 8 : baseR, 0, Math.PI * 2); ctx.fill();
      if (isHover || isSelected) { ctx.strokeStyle = isSelected ? '#f59e0b' : '#111827'; ctx.lineWidth = isSelected ? 3 : 1.5; ctx.stroke(); }
      ctx.fillStyle = '#111827'; ctx.font = '10px sans-serif'; ctx.fillText(d.name.slice(0, 8), x + 8, y + 3);
    });
  }, [devices, liveDevices, hoverId, selectedId]);

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Geo Visualization</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={400}
            height={400}
            onMouseMove={handlePointerMove}
            onMouseLeave={() => setHoverId(null)}
            onClick={handleClick}
            className="w-full h-[320px] border rounded bg-white dark:bg-neutral-900 cursor-crosshair"
          />
          {(hoverId || selectedId) && (
            <div className="absolute top-2 right-2 text-[11px] bg-black/60 text-white px-2 py-1 rounded max-w-[200px] space-y-1">
              <div>{selectedId || hoverId}</div>
              {selectedId && (
                <div className="text-[10px] opacity-80">Click again to deselect</div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
