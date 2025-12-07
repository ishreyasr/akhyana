import { useCallback, useEffect, useRef, useState } from 'react';
import { webSocketService } from '../utils/websocketService';

interface RegistrationParams {
  vehicleId: string;
  driverName?: string;
  batteryLevel?: number;
  signalStrength?: number;
  vehicleInfo?: { licensePlate?: string; model?: string; color?: string };
}

export function useV2VBackend() {
  const [connected, setConnected] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [nearby, setNearby] = useState<any[]>([]);
  const newBadgeTimers = useRef<Map<string, any>>(new Map());
  const [presence, setPresence] = useState<Record<string, string>>({});
  const vehicleIdRef = useRef<string | null>(null);
  const [connectionState, setConnectionState] = useState<string>('disconnected'); // Start with consistent state

  const connect = useCallback(async () => {
    console.log('[useV2VBackend] Connecting to V2V backend...');
    const ok = await webSocketService.connect();
    setConnected(ok);
    console.log('[useV2VBackend] Connection result:', ok);
    return ok;
  }, []);

  const register = useCallback(async (params: RegistrationParams) => {
    console.log('[useV2VBackend] Registering vehicle:', params.vehicleId);
    vehicleIdRef.current = params.vehicleId;
    const result = await webSocketService.registerVehicle(params);
    console.log('[useV2VBackend] Registration result:', result);
    return result;
  }, []);

  const updateLocation = useCallback((lat: number, lon: number, battery?: number, signal?: number) => {
    webSocketService.updateLocation(lat, lon, battery, signal);
  }, []);

  // Monitor WebSocket connection state
  useEffect(() => {
    const unsubscribe = webSocketService.onConnectionStateChange((state, details) => {
      console.log('[useV2VBackend] Connection state changed:', state, details);
      setConnectionState(state);
      setConnected(state === 'connected');

      if (state === 'disconnected' || state === 'error') {
        setRegistered(false);
      }
    });

    // Check initial connection state
    const initialState = webSocketService.getConnectionStatus();
    setConnected(initialState === 'connected');
    setConnectionState(initialState);

    return unsubscribe;
  }, []);

  useEffect(() => {
    const onRegistered = (d: any) => { if (d?.vehicleId) setRegistered(true); };
    const onNearby = (d: any) => {
      console.log('[useV2VBackend] Received nearby vehicles:', d);

      let vehicles = [];
      if (d && Array.isArray(d.vehicles)) {
        vehicles = d.vehicles;
      } else if (d && Array.isArray(d)) {
        vehicles = d;
      } else if (d && d.data && Array.isArray(d.data)) {
        vehicles = d.data;
      }

      setNearby(prev => {
        // Preserve existing isNew flags if still present
        const prevMap = new Map(prev.map((p: any) => [p.vehicleId || p.id, p]));
        const updatedVehicles = vehicles.map((item: any) => {
          const id = item.vehicleId || item.id;
          const existing = prevMap.get(id);
          return existing ? { ...item, isNew: existing.isNew } : item;
        });

        console.log('[useV2VBackend] Updated nearby vehicles count:', updatedVehicles.length);
        return updatedVehicles;
      });
    };
    const onProximityEvent = (e: any) => {
      if (!e || !e.eventType) return;
      if (e.eventType === 'enter') {
        setNearby(prev => {
          const id = e.peerVehicleId;
          const existing = prev.find((p: any) => (p.vehicleId || p.id) === id);
          if (existing) {
            const updated = prev.map((p: any) => (p.vehicleId || p.id) === id ? { ...p, isNew: true } : p);
            return updated;
          }
          return [...prev, { vehicleId: id, distance: e.distanceM, isNew: true }];
        });
        // Clear flag after 10s
        const id = e.peerVehicleId;
        if (newBadgeTimers.current.has(id)) clearTimeout(newBadgeTimers.current.get(id));
        newBadgeTimers.current.set(id, setTimeout(() => {
          setNearby(prev => prev.map((p: any) => (p.vehicleId || p.id) === id ? { ...p, isNew: false } : p));
          newBadgeTimers.current.delete(id);
        }, 10000));
      } else if (e.eventType === 'exit') {
        setNearby(prev => prev.filter((p: any) => (p.vehicleId || p.id) !== e.peerVehicleId));
      }
    };
    const onPresence = (d: any) => { setPresence(p => ({ ...p, [d.vehicleId]: d.status })); };
    const onError = (d: any) => {
      // Normalize & downgrade to warn to avoid Next.js error overlay spam
      if (!d || (Object.keys(d).length === 0)) {
        console.warn('[V2V] backend error (empty payload)');
        return;
      }
      const code = (d as any).code;
      const message = (d as any).message;
      if (code === 'unknown_event') {
        // Likely client sent optional feature event not yet supported; ignore quietly in production
        if (process.env.NEXT_PUBLIC_V2V_DEBUG_WS === '1') {
          console.debug('[V2V] ignoring unknown_event', d.details || '');
        }
        return;
      }
      if (code === 'rate_limited') {
        // Soft log only
        console.warn('[V2V] rate limited', d.details || '');
        return;
      }
      console.warn('[V2V] backend error', code || message, d.details || '');
    };
    const onConnState = (d: any) => setConnectionState(d.state);

    webSocketService.subscribe('registered', onRegistered);
    webSocketService.subscribe('nearby_vehicles', onNearby);
    webSocketService.subscribe('proximity_event', onProximityEvent);
    webSocketService.subscribe('presence_update', onPresence);
    webSocketService.subscribe('error', onError);
    webSocketService.subscribe('connection_state', onConnState);
    return () => {
      webSocketService.unsubscribe('registered', onRegistered);
      webSocketService.unsubscribe('nearby_vehicles', onNearby);
      webSocketService.unsubscribe('proximity_event', onProximityEvent);
      webSocketService.unsubscribe('presence_update', onPresence);
      webSocketService.unsubscribe('error', onError);
      webSocketService.unsubscribe('connection_state', onConnState);
    };
  }, []);

  return {
    connect,
    register,
    updateLocation,
    connected,
    registered,
    nearby,
    presence,
    connectionState,
    vehicleId: vehicleIdRef.current
  };
}
