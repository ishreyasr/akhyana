'use client';

import { useEffect, useMemo, memo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNearbyDevices } from '@/hooks/useNearbyDevices';
import { NearbyDevice } from '@/types/v2v.types';
import { Car, Truck, Building, Signal, MapPin, Clock } from 'lucide-react';
import { useV2VBackend } from '@/hooks/useV2VBackend';
import { useUserSettings } from '@/hooks/useUserSettings';

interface NearbyDevicesListProps {
  onDeviceConnect?: (device: NearbyDevice) => void;
  emergencyVehicleIds?: Set<string>;
}

// Memoized device card component for performance
const DeviceCard = memo(({ device, onConnect, presenceStatus, formatDistance, isEmergency }: { device: NearbyDevice; onConnect: (device: NearbyDevice) => void; presenceStatus?: string; formatDistance: (m: number) => string; isEmergency?: boolean }) => {
  const getDeviceIcon = useCallback((deviceType: NearbyDevice['deviceType']) => {
    switch (deviceType) {
      case 'vehicle':
        return <Car className="h-4 w-4" />;
      case 'emergency':
        return <Truck className="h-4 w-4 text-red-500" />;
      case 'infrastructure':
        return <Building className="h-4 w-4 text-blue-500" />;
      default:
        return <Car className="h-4 w-4" />;
    }
  }, []);

  const getDeviceTypeBadge = useCallback((deviceType: NearbyDevice['deviceType']) => {
    const variants = { vehicle: 'secondary' as const, emergency: 'destructive' as const, infrastructure: 'default' as const };
    return (
      <Badge variant={variants[deviceType]} className="text-xs">
        {deviceType.charAt(0).toUpperCase() + deviceType.slice(1)}
      </Badge>
    );
  }, []);

  const getSignalStrengthColor = useCallback((strength: number) => {
    if (strength >= 70) return 'text-green-500';
    if (strength >= 40) return 'text-yellow-500';
    return 'text-red-500';
  }, []);

  const { label: timeAgoLabel, seconds } = useMemo(() => {
    const diff = Math.floor((Date.now() - device.lastSeen.getTime()) / 1000);
    if (diff < 60) return { label: diff + 's ago', seconds: diff };
    const m = Math.floor(diff / 60);
    if (m < 60) return { label: m + 'm ago', seconds: diff };
    const h = Math.floor(m / 60);
    return { label: h + 'h ago', seconds: diff };
  }, [device.lastSeen]);

  const statusPill = useMemo(() => {
    const status = presenceStatus || (seconds < 40 ? 'online' : 'timeout');
    const color = status === 'online' ? 'bg-green-500' : status === 'offline' ? 'bg-gray-400' : 'bg-amber-500';
    return <span className={`flex items-center gap-1 text-[10px] rounded-full px-2 py-0.5 text-white ${color}`}>{status}</span>;
  }, [presenceStatus, seconds]);

  const handleConnect = useCallback(() => { onConnect(device); }, [device, onConnect]);

  return (
    <Card className="p-4 min-h-[120px]">
      <div className="flex flex-col space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start space-x-3 flex-1 min-w-0">
            <div className="flex-shrink-0 mt-0.5">{getDeviceIcon(device.deviceType)}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <p className="text-sm font-medium truncate flex items-center gap-1">
                  {device.name}
                  {device.isNew && <Badge variant="default" className="text-[10px] bg-blue-600">NEW</Badge>}
                  {isEmergency && <Badge variant="destructive" className="text-[10px] bg-red-600 animate-pulse">🚨 EMERGENCY</Badge>}
                </p>
                {getDeviceTypeBadge(device.deviceType)}
                {statusPill}
              </div>
              {device.licensePlate && <p className="text-xs text-muted-foreground font-mono tracking-wide">{device.licensePlate}</p>}
              {(device.brand || device.model) && (
                <p className="text-[11px] text-muted-foreground mt-1 truncate">
                  {(device.brand || '') + (device.brand && device.model ? ' ' : '') + (device.model || '')}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            <span>{formatDistance(device.distance)} away</span>
          </div>
          <div className="flex items-center gap-1">
            <Signal className={`h-3 w-3 flex-shrink-0 ${getSignalStrengthColor(device.signalStrength)}`} />
            <span>{device.signalStrength}% signal</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{timeAgoLabel}</span>
          </div>
        </div>
        <div className="flex justify-end pt-2">
          <Button size="sm" disabled={!device.isConnectable} onClick={handleConnect} className="min-w-[90px]">
            {device.isConnectable ? 'Connect' : 'Busy'}
          </Button>
        </div>
      </div>
    </Card>
  );
});
DeviceCard.displayName = 'DeviceCard';

export const NearbyDevicesList = memo(function NearbyDevicesList({ onDeviceConnect, emergencyVehicleIds }: NearbyDevicesListProps) {
  const { devices, isScanning } = useNearbyDevices();
  const { presence } = useV2VBackend();
  const { settings } = useUserSettings();

  // Debug logging
  useEffect(() => {
    console.log('[NearbyDevicesList] Devices updated:', devices?.length || 0, devices);
    if (devices && devices.length > 0) {
      console.log('[NearbyDevicesList] Device details:', devices.map(d => ({ id: d.id, name: d.name, distance: d.distance, type: d.deviceType })));
    }
    if (emergencyVehicleIds && emergencyVehicleIds.size > 0) {
      console.log('[NearbyDevicesList] Emergency vehicles:', Array.from(emergencyVehicleIds));
    }
  }, [devices, emergencyVehicleIds]);

  const sortedDevices = useMemo(() => [...devices].sort((a, b) => a.distance - b.distance), [devices]);
  const formatDistance = useCallback((m: number) => {
    if (settings.distanceUnit === 'km') {
      if (m >= 1000) return (m / 1000).toFixed(2) + ' km';
      return (m / 1000).toFixed(3) + ' km';
    }
    return m + ' m';
  }, [settings.distanceUnit]);
  const handleDeviceConnect = useCallback((device: NearbyDevice) => { onDeviceConnect?.(device); }, [onDeviceConnect]);
  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">Nearby Vehicles
          <Badge variant="outline" className="flex items-center gap-1">
            <div className={`h-2 w-2 rounded-full ${isScanning ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
            {isScanning ? 'Scanning' : 'Idle'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[450px] w-full">
          {sortedDevices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground font-medium">No nearby vehicles</p>
              <p className="text-xs text-muted-foreground max-w-xs mt-1">{isScanning ? 'Actively scanning the area… stay tuned.' : 'No devices currently detected.'}</p>
            </div>
          ) : (
            <div className="space-y-4 pr-2">
              {sortedDevices.map((device) => (
                <DeviceCard
                  key={device.id}
                  device={device}
                  presenceStatus={presence[device.id]}
                  onConnect={handleDeviceConnect}
                  formatDistance={formatDistance}
                  isEmergency={emergencyVehicleIds?.has(device.id)}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
});