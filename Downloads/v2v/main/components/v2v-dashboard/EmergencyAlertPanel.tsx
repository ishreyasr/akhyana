'use client';

import { useState, useMemo, useCallback, memo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useEmergencyAlerts } from '@/hooks/useEmergencyAlerts';
import { useV2VBackend } from '@/hooks/useV2VBackend';
import { EmergencyAlert } from '@/types/v2v.types';
import {
  AlertTriangle,
  Car,
  Construction,
  Heart,
  Clock,
  Send,
  History,
  CheckCircle2,
  XCircle
} from 'lucide-react';

// Memoized alert item component
const AlertItem = memo(({
  alert,
  getAlertIcon,
  getPriorityBadge,
  getTimeAgo
}: {
  alert: EmergencyAlert;
  getAlertIcon: (type: EmergencyAlert['type']) => React.ComponentType<any>;
  getPriorityBadge: (severity: EmergencyAlert['severity']) => React.ReactNode;
  getTimeAgo: (timestamp: Date) => string;
}) => {
  const Icon = getAlertIcon(alert.type);

  return (
    <Alert className="p-3">
      <Icon className="h-4 w-4" />
      <AlertDescription className="ml-2">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium">{alert.message}</span>
              {getPriorityBadge(alert.severity)}
            </div>
            <div className="text-xs text-muted-foreground">
              {getTimeAgo(alert.timestamp)}
            </div>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
});

AlertItem.displayName = 'AlertItem';

export const EmergencyAlertPanel = memo(function EmergencyAlertPanel() {
  const {
    alerts,
    broadcastAlert,
    isBroadcasting,
    acknowledgeAlert,
    clearAllAlerts,
    unacknowledgedActive
  } = useEmergencyAlerts();

  const { vehicleId: backendVehicleId } = useV2VBackend();

  const [selectedAlertType, setSelectedAlertType] = useState<EmergencyAlert['type'] | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Get vehicleId from session storage as fallback (available immediately)
  const vehicleId = useMemo(() => {
    if (backendVehicleId) return backendVehicleId;

    if (typeof window !== 'undefined') {
      const authUserRaw = sessionStorage.getItem('authUser');
      if (authUserRaw) {
        try {
          const authUser = JSON.parse(authUserRaw);
          return authUser.vehicle?.vehicleId || null;
        } catch (e) {
          console.error('[EmergencyAlertPanel] Failed to parse authUser:', e);
        }
      }
    }
    return null;
  }, [backendVehicleId]);

  // Debug: Log vehicleId when it changes
  useEffect(() => {
    console.log('[EmergencyAlertPanel] Current vehicleId:', vehicleId, 'from backend:', backendVehicleId);
  }, [vehicleId, backendVehicleId]);

  const alertTypes = useMemo(() => [
    {
      type: 'medical' as const,
      label: 'Medical Emergency',
      icon: Heart,
      color: 'bg-red-600 hover:bg-red-700',
      priority: 'high' as const
    },
    {
      type: 'accident' as const,
      label: 'Accident',
      icon: Car,
      color: 'bg-orange-600 hover:bg-orange-700',
      priority: 'high' as const
    },
    {
      type: 'breakdown' as const,
      label: 'Vehicle Breakdown',
      icon: AlertTriangle,
      color: 'bg-yellow-600 hover:bg-yellow-700',
      priority: 'medium' as const
    },
    {
      type: 'hazard' as const,
      label: 'Road Hazard',
      icon: Construction,
      color: 'bg-blue-600 hover:bg-blue-700',
      priority: 'medium' as const
    },
  ], []);

  const handleQuickSend = useCallback(async (alertType: EmergencyAlert['type']) => {
    const alertConfig = alertTypes.find(a => a.type === alertType);
    if (!alertConfig) return;

    if (!vehicleId) {
      console.error('[EmergencyAlertPanel] Cannot send alert - vehicleId is not available:', vehicleId);
      return;
    }

    // Get current GPS location with multiple fallbacks
    const getLocation = (): Promise<{ lat: number; lng: number }> => {
      return new Promise((resolve) => {
        // First try: Browser Geolocation API
        if ('geolocation' in navigator) {
          console.log('[EmergencyAlertPanel] Requesting GPS location...');
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const location = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
              };
              console.log('[EmergencyAlertPanel] ✅ GPS location obtained:', location);
              resolve(location);
            },
            (error) => {
              console.warn('[EmergencyAlertPanel] GPS error:', error.code, error.message);
              
              // Second try: Get from sessionStorage (user profile or previous location)
              try {
                const authUser = sessionStorage.getItem('authUser');
                if (authUser) {
                  const user = JSON.parse(authUser);
                  if (user.location?.lat && user.location?.lng) {
                    console.log('[EmergencyAlertPanel] ✅ Using location from user profile:', user.location);
                    resolve({ lat: user.location.lat, lng: user.location.lng });
                    return;
                  }
                }
                
                // Third try: Get from vehicle status
                const vehicleStatus = sessionStorage.getItem('vehicleStatus');
                if (vehicleStatus) {
                  const status = JSON.parse(vehicleStatus);
                  if (status.location?.lat && status.location?.lng) {
                    console.log('[EmergencyAlertPanel] ✅ Using location from vehicle status:', status.location);
                    resolve({ lat: status.location.lat, lng: status.location.lng });
                    return;
                  }
                }
              } catch (e) {
                console.warn('[EmergencyAlertPanel] Error reading stored location:', e);
              }
              
              // Final fallback: Bangalore coordinates
              console.log('[EmergencyAlertPanel] ⚠️ Using Bangalore fallback coordinates');
              resolve({ lat: 12.9716, lng: 77.5946 });
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          );
        } else {
          console.warn('[EmergencyAlertPanel] Geolocation not available in navigator');
          // Try stored location before final fallback
          try {
            const authUser = sessionStorage.getItem('authUser');
            if (authUser) {
              const user = JSON.parse(authUser);
              if (user.location?.lat && user.location?.lng) {
                console.log('[EmergencyAlertPanel] ✅ Using stored location:', user.location);
                resolve({ lat: user.location.lat, lng: user.location.lng });
                return;
              }
            }
          } catch (e) { }
          resolve({ lat: 12.9716, lng: 77.5946 });
        }
      });
    };

    const location = await getLocation();
    console.log('[EmergencyAlertPanel] 📍 Final location to send:', location);

    // Get license plate from session storage
    let licensePlate = null;
    try {
      const authUser = sessionStorage.getItem('authUser');
      if (authUser) {
        const user = JSON.parse(authUser);
        licensePlate = user.vehicle?.licensePlate || user.licensePlate || null;
        console.log('[EmergencyAlertPanel] 🚗 License plate:', licensePlate);
      }
    } catch (e) {
      console.warn('[EmergencyAlertPanel] Error reading license plate:', e);
    }

    console.log('[EmergencyAlertPanel] Sending emergency alert:', {
      type: alertType,
      senderId: vehicleId,
      message: `${alertConfig.label} reported`,
      location,
      licensePlate
    });

    await broadcastAlert({
      type: alertType,
      message: `${alertConfig.label} reported`,
      location,
      severity: alertConfig.priority === 'high' ? 'high' : 'medium',
      senderId: vehicleId,
      licensePlate
    });
  }, [alertTypes, broadcastAlert, vehicleId]);

  const handleEmergencyButtonClick = useCallback(() => {
    if (selectedAlertType) {
      handleQuickSend(selectedAlertType);
      setSelectedAlertType(null);
    }
  }, [selectedAlertType, handleQuickSend]);

  const getPriorityBadge = useCallback((severity: EmergencyAlert['severity']) => {
    const variants = {
      high: 'destructive' as const,
      medium: 'default' as const,
      low: 'secondary' as const,
    };

    return (
      <Badge variant={variants[severity]} className="text-xs">
        {severity.toUpperCase()}
      </Badge>
    );
  }, []);

  const getAlertIcon = useCallback((type: EmergencyAlert['type']) => {
    const alertType = alertTypes.find(a => a.type === type);
    if (!alertType) return AlertTriangle;
    return alertType.icon;
  }, [alertTypes]);

  const getTimeAgo = useCallback((timestamp: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - timestamp.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  }, []);

  // Memoized sorted alerts for performance
  const sortedAlerts = useMemo(() => {
    return [...alerts].sort((a, b) => {
      // First sort by priority
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.severity] - priorityOrder[a.severity];
      if (priorityDiff !== 0) return priorityDiff;

      // Then by timestamp (newest first)
      return b.timestamp.getTime() - a.timestamp.getTime();
    });
  }, [alerts]);

  // Memoized active alerts check
  const hasActiveAlerts = useMemo(() => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return alerts.some(alert => alert.timestamp > fiveMinutesAgo);
  }, [alerts]);

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">Emergency Alerts {unacknowledgedActive.length > 0 && <Badge variant="destructive" className="text-[10px]">{unacknowledgedActive.length}</Badge>}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Emergency Button and Alert Type Selection */}
        <div className="space-y-3">
          <div className="text-sm font-medium">Select Emergency Type:</div>
          <div className="grid grid-cols-2 gap-2">
            {alertTypes.map((alertType) => {
              const Icon = alertType.icon;
              return (
                <Button
                  key={alertType.type}
                  variant={selectedAlertType === alertType.type ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedAlertType(alertType.type)}
                  className="flex items-center gap-2 h-auto py-2"
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-xs">{alertType.label}</span>
                </Button>
              );
            })}
          </div>

          {/* Main Emergency Button */}
          <Button
            className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3"
            disabled={!selectedAlertType || isBroadcasting}
            onClick={handleEmergencyButtonClick}
          >
            <Send className="h-4 w-4 mr-2" />
            {isBroadcasting ? 'Sending Alert...' : 'Send Emergency Alert'}
          </Button>
        </div>

        {/* Quick Send Buttons */}
        <div className="space-y-2">
          <div className="text-sm font-medium">Quick Send:</div>
          <div className="flex flex-wrap gap-2">
            {alertTypes.map((alertType) => {
              const Icon = alertType.icon;
              return (
                <Button
                  key={`quick-${alertType.type}`}
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickSend(alertType.type)}
                  disabled={isBroadcasting}
                  className="flex items-center gap-1"
                >
                  <Icon className="h-3 w-3" />
                  <span className="text-xs">{alertType.label}</span>
                </Button>
              );
            })}
          </div>
        </div>

        {/* Alert History */}
        {showHistory && (
          <div className="space-y-2">
            <div className="text-sm font-medium flex items-center gap-2">
              <History className="h-4 w-4" />
              Alert History
            </div>
            <ScrollArea className="h-[200px] w-full">
              {sortedAlerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Clock className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No alerts yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {sortedAlerts.map((alert, index) => (
                    <AlertItem
                      key={`${alert.id || index}-${alert.timestamp.getTime()}`}
                      alert={alert}
                      getAlertIcon={getAlertIcon}
                      getPriorityBadge={getPriorityBadge}
                      getTimeAgo={getTimeAgo}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        )}

        {/* Active Alerts Notification */}
        {hasActiveAlerts && (
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800 flex flex-col gap-2">
              <div>You have active emergency alerts. They will expire automatically after 5 minutes.</div>
              <div className="flex flex-wrap gap-2">
                {unacknowledgedActive.map(a => (
                  <Button key={a.id} size="sm" variant="destructive" className="h-6 text-[10px] flex items-center gap-1" onClick={() => acknowledgeAlert(a.id)}>
                    <CheckCircle2 className="h-3 w-3" /> Ack {a.type}
                  </Button>
                ))}
                {unacknowledgedActive.length > 0 && (
                  <Button size="sm" variant="outline" className="h-6 text-[10px] flex items-center gap-1" onClick={() => unacknowledgedActive.forEach(a => acknowledgeAlert(a.id))}>
                    <CheckCircle2 className="h-3 w-3" /> Ack All
                  </Button>
                )}
                {alerts.length > 0 && (
                  <Button size="sm" variant="outline" className="h-6 text-[10px] flex items-center gap-1" onClick={() => clearAllAlerts()}>
                    <XCircle className="h-3 w-3" /> Clear Active
                  </Button>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
});