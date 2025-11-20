'use client';

import { memo, useMemo, useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useVehicleStatus } from '@/hooks/useVehicleStatus';
import { useDeviceTelemetry } from '@/hooks/useDeviceTelemetry';
import { Wifi, WifiOff, Battery, MapPin, Signal, Info } from 'lucide-react';

export const VehicleStatusCard = memo(function VehicleStatusCard() {
  const { vehicleStatus } = useVehicleStatus();
  const [authVehicle, setAuthVehicle] = useState<any | null>(null);
  const [authUser, setAuthUser] = useState<any | null>(null);
  const deviceTelemetry = useDeviceTelemetry({ pollIntervalMs: 15000, latencyEveryN: 2 });

  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? sessionStorage.getItem('authUser') : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        setAuthUser(parsed);
        if (parsed.vehicle) setAuthVehicle(parsed.vehicle);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const getGpsStatusIcon = useCallback(() => {
    switch (vehicleStatus.gpsStatus) {
      case 'locked':
        return <MapPin className="h-4 w-4 text-green-500" />;
      case 'searching':
        return <MapPin className="h-4 w-4 text-yellow-500 animate-pulse" />;
      case 'offline':
        return <MapPin className="h-4 w-4 text-red-500" />;
      default:
        return <MapPin className="h-4 w-4 text-gray-500" />;
    }
  }, [vehicleStatus.gpsStatus]);

  const getGpsStatusText = useCallback(() => {
    switch (vehicleStatus.gpsStatus) {
      case 'locked':
        return 'GPS Locked';
      case 'searching':
        return 'GPS Searching';
      case 'offline':
        return 'GPS Offline';
      default:
        return 'GPS Unknown';
    }
  }, [vehicleStatus.gpsStatus]);

  const formattedLastConnected = useMemo(() => {
    return vehicleStatus.lastConnected.toLocaleTimeString();
  }, [vehicleStatus.lastConnected]);

  const batteryProgressStyle = useMemo(() => {
    if (vehicleStatus.batteryLevel == null) return {} as React.CSSProperties;
    return {
      '--progress-background': vehicleStatus.batteryLevel > 20 ? 'hsl(var(--primary))' : 'hsl(var(--destructive))'
    } as React.CSSProperties;
  }, [vehicleStatus.batteryLevel]);

  const gpsStatusColor = useMemo(() => {
    return vehicleStatus.gpsStatus === 'locked' ? 'text-green-500' :
      vehicleStatus.gpsStatus === 'searching' ? 'text-yellow-500' :
        'text-red-500';
  }, [vehicleStatus.gpsStatus]);

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span>Vehicle Status</span>
          <Badge
            variant={vehicleStatus.isOnline ? "default" : "destructive"}
            className="flex items-center gap-1"
          >
            {vehicleStatus.isOnline ? (
              <Wifi className="h-3 w-3" />
            ) : (
              <WifiOff className="h-3 w-3" />
            )}
            {vehicleStatus.isOnline ? 'Online' : 'Offline'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Vehicle ID / Owner / Type */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Vehicle ID:</span>
            <span className="font-mono">{vehicleStatus.vehicleId}</span>
          </div>
          {authVehicle?.licensePlate && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">License Plate:</span>
              <span className="font-medium">{authVehicle.licensePlate}</span>
            </div>
          )}
          {authVehicle?.vehicleType && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Type:</span>
              <span>{authVehicle.vehicleType}</span>
            </div>
          )}
          {(authVehicle?.brand || authVehicle?.model) && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Brand/Model:</span>
              <span>{[authVehicle?.brand, authVehicle?.model].filter(Boolean).join(' ')}</span>
            </div>
          )}
          {authUser?.fullName && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Owner:</span>
              <span>{authUser.fullName}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Last Connected:</span>
            <span>{formattedLastConnected}</span>
          </div>
        </div>

        {/* Signal Strength (Vehicle or Device Fallback) */}
        {(() => {
          const primaryValue = vehicleStatus.signalStrength ?? deviceTelemetry.networkQuality ?? null;
          if (primaryValue == null) {
            return (
              <div className="flex items-center gap-2 text-xs text-muted-foreground" title="No signal data from vehicle or device">
                <Signal className="h-3 w-3" />
                <span>No signal data</span>
                <Info className="h-3 w-3" />
              </div>
            );
          }
          const usedVehicle = vehicleStatus.signalStrength != null;
          const titleParts: string[] = [];
          if (usedVehicle) titleParts.push(`Vehicle source: ${vehicleStatus.signalSource || 'unknown'}`);
          else titleParts.push('Device network measurement');
          if (deviceTelemetry.networkStats?.effectiveType) titleParts.push(`Effective: ${deviceTelemetry.networkStats.effectiveType}`);
          if (deviceTelemetry.networkStats?.latencyMs != null) titleParts.push(`Latency: ${Math.round(deviceTelemetry.networkStats.latencyMs)}ms`);
          return (
            <div className="space-y-2" title={titleParts.join(' | ')}>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Signal className="h-4 w-4" />
                  <span>Signal Strength</span>
                </div>
                <span>{primaryValue}%</span>
              </div>
              <Progress value={primaryValue} className="h-2" />
              <div className="flex flex-wrap gap-2">
                <span className="text-[10px] text-muted-foreground">
                  Source: {usedVehicle ? (vehicleStatus.signalSource || 'vehicle') : 'device'}
                </span>
                {usedVehicle && deviceTelemetry.networkQuality != null && (
                  <span className="text-[10px] text-muted-foreground">
                    Device Net: {deviceTelemetry.networkQuality}% {deviceTelemetry.networkStats?.effectiveType || ''}
                  </span>
                )}
              </div>
            </div>
          );
        })()}

        {/* Battery Level (Vehicle or Device Fallback) */}
        {(() => {
          const primaryValue = vehicleStatus.batteryLevel ?? deviceTelemetry.batteryLevel ?? null;
          if (primaryValue == null) {
            return (
              <div className="flex items-center gap-2 text-xs text-muted-foreground" title="No battery data from vehicle or device">
                <Battery className="h-3 w-3" />
                <span>No battery data</span>
                <Info className="h-3 w-3" />
              </div>
            );
          }
          const usedVehicle = vehicleStatus.batteryLevel != null;
          const titleParts: string[] = [];
          if (usedVehicle) titleParts.push(`Vehicle source: ${vehicleStatus.batterySource || 'unknown'}`);
          else titleParts.push('Device battery');
          if (deviceTelemetry.charging != null) titleParts.push(deviceTelemetry.charging ? 'Charging' : 'Discharging');
          return (
            <div className="space-y-2" title={titleParts.join(' | ')}>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Battery className="h-4 w-4" />
                  <span>Battery Level</span>
                </div>
                <span>{primaryValue}%</span>
              </div>
              <Progress
                value={primaryValue}
                className="h-2"
                style={batteryProgressStyle}
              />
              <div className="flex flex-wrap gap-2">
                <span className="text-[10px] text-muted-foreground">Source: {usedVehicle ? (vehicleStatus.batterySource || 'vehicle') : 'device'}</span>
                {usedVehicle && deviceTelemetry.batteryLevel != null && (
                  <span className="text-[10px] text-muted-foreground">
                    Device Batt: {deviceTelemetry.batteryLevel}% {deviceTelemetry.charging ? '(charging)' : ''}
                  </span>
                )}
              </div>
            </div>
          );
        })()}

        {/* GPS Status */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            {getGpsStatusIcon()}
            <span>GPS Status</span>
          </div>
          <span className={gpsStatusColor}>
            {getGpsStatusText()}
          </span>
        </div>
      </CardContent>
    </Card>
  );
});