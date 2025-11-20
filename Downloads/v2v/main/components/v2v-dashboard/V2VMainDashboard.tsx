'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/hooks/use-toast';
import {
  Wifi,
  WifiOff,
  AlertTriangle,
  Settings,
  RefreshCw,
  Car,
  Activity
} from 'lucide-react';

// Import V2V dashboard components
import { VehicleStatusCard } from './VehicleStatusCard';
import { NearbyDevicesList } from './NearbyDevicesList';
import { EmergencyAlertPanel } from './EmergencyAlertPanel';
import { EmergencyAlertDialog } from './EmergencyAlertDialog';
import { SettingsPanel } from './SettingsPanel';
import { ConnectionDialog } from './ConnectionDialog';
import { ConnectionApprovalDialog } from './ConnectionApprovalDialog';
import { ErrorBoundary } from './ErrorBoundary';
import { ConnectionStatus } from './ConnectionStatus';

// Import hooks and types
import { useVehicleStatus } from '@/hooks/useVehicleStatus';
import { useNearbyDevices } from '@/hooks/useNearbyDevices';
import { useEmergencyAlerts } from '@/hooks/useEmergencyAlerts';
import { useConnection } from '@/hooks/useConnection';
import { NearbyDevice, EmergencyAlert } from '@/types/v2v.types';
import { useV2VBackend } from '@/hooks/useV2VBackend';
import { useHardwareMode } from '@/hooks/useHardwareMode';
import { useHardwarePort } from '@/hooks/useHardwarePort';
import { useAutoVehicleRegistration } from '@/hooks/useAutoVehicleRegistration';

interface V2VMainDashboardProps {
  className?: string;
}

export function V2VMainDashboard({ className }: V2VMainDashboardProps) {
  const { toast } = useToast();

  // Component state
  const [showSettings, setShowSettings] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<NearbyDevice | null>(null);
  const [showConnectionDialog, setShowConnectionDialog] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<any | null>(null);

  // Connection approval state
  const [incomingConnectionRequest, setIncomingConnectionRequest] = useState<{
    requesterId: string;
    targetId: string;
    purpose?: string;
    timestamp: number;
  } | null>(null);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);

  // Emergency alert notification state
  const [incomingEmergencyAlert, setIncomingEmergencyAlert] = useState<EmergencyAlert | null>(null);
  const [showEmergencyDialog, setShowEmergencyDialog] = useState(false);
  const [emergencyVehiclesSet, setEmergencyVehiclesSet] = useState<Set<string>>(new Set());
  const emergencyTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Auto-clear emergency status after 5 minutes
  useEffect(() => {
    return () => {
      // Cleanup all timers on unmount
      emergencyTimersRef.current.forEach(timer => clearTimeout(timer));
      emergencyTimersRef.current.clear();
    };
  }, []);

  // Custom hooks
  const { vehicleStatus, isLoading: vehicleLoading, error: vehicleError } = useVehicleStatus();
  const { devices, isScanning, error: devicesError } = useNearbyDevices();
  const { alerts, error: alertsError } = useEmergencyAlerts();
  const { connectionStatus, connectionError } = useConnection();
  const { connectionState, vehicleId: backendVehicleId } = useV2VBackend();
  const { isOnline, hardwareMode } = useHardwareMode();
  const { status: hwStatus, connect: connectHardware, lastMessage } = useHardwarePort();

  // Get vehicleId from session storage as fallback (available immediately)
  const myVehicleId = useMemo(() => {
    if (backendVehicleId) return backendVehicleId;

    if (typeof window !== 'undefined') {
      const authUserRaw = sessionStorage.getItem('authUser');
      if (authUserRaw) {
        try {
          const authUser = JSON.parse(authUserRaw);
          return authUser.vehicle?.vehicleId || null;
        } catch (e) {
          console.error('[V2VMainDashboard] Failed to parse authUser:', e);
        }
      }
    }
    return null;
  }, [backendVehicleId]);

  // Auto vehicle registration hook
  const autoRegistration = useAutoVehicleRegistration();

  // Initialize dashboard
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        toast({
          title: 'V2V Dashboard Ready',
          description: 'Vehicle-to-Vehicle communication system is online.',
        });
      } catch (error) {
        console.log('Toast initialization skipped');
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [toast]);

  // Load mock auth user (from prototype auth flow)
  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? sessionStorage.getItem('authUser') : null;
      if (raw) setAuthUser(JSON.parse(raw));
    } catch (e) {
      // Ignore parse errors
    }
  }, []);

  // Handle real-time updates
  useEffect(() => {
    const updateInterval = setInterval(() => {
      // Real-time updates handled by hooks
    }, 5000);

    return () => clearInterval(updateInterval);
  }, []);

  // Listen for incoming connection requests
  useEffect(() => {
    const handleConnectionRequest = async (payload: any) => {
      if (payload && payload.requesterId && payload.targetId) {
        console.log('[V2VMainDashboard] Received connection request:', payload);

        setIncomingConnectionRequest({
          requesterId: payload.requesterId,
          targetId: payload.targetId,
          purpose: payload.purpose,
          timestamp: payload.ts || Date.now()
        });
        setShowApprovalDialog(true);

        toast({
          title: 'Incoming Connection Request',
          description: `Vehicle ${payload.requesterId} wants to connect`,
          duration: 5000
        });
      }
    };

    // Subscribe to connection requests
    import('@/utils/websocketService').then(({ webSocketService }) => {
      webSocketService.subscribe('connect_request', handleConnectionRequest);
    });

    return () => {
      import('@/utils/websocketService').then(({ webSocketService }) => {
        webSocketService.unsubscribe('connect_request', handleConnectionRequest);
      });
    };
  }, [toast]);

  // Listen for incoming emergency alerts
  useEffect(() => {
    const handleEmergencyAlert = async (payload: any) => {
      console.log('[V2VMainDashboard] ========== EMERGENCY ALERT RECEIVED ==========');
      console.log('[V2VMainDashboard] Raw payload:', payload);
      console.log('[V2VMainDashboard] Payload keys:', Object.keys(payload || {}));
      console.log('[V2VMainDashboard] Payload.senderId:', payload?.senderId);
      console.log('[V2VMainDashboard] My Vehicle ID:', myVehicleId);
      console.log('[V2VMainDashboard] Are they equal?', payload?.senderId === myVehicleId);
      console.log('[V2VMainDashboard] Type of payload.senderId:', typeof payload?.senderId);
      console.log('[V2VMainDashboard] Type of myVehicleId:', typeof myVehicleId);
      console.log('[V2VMainDashboard] ==============================================');

      // Check if payload has required data (be flexible with structure)
      if (!payload || !payload.senderId) {
        console.warn('[V2VMainDashboard] Invalid emergency alert payload - missing senderId');
        return;
      }

      // Ignore alerts from own vehicle
      if (payload.senderId === myVehicleId) {
        console.log('[V2VMainDashboard] ✅ IGNORING emergency alert from own vehicle');
        return;
      }

      console.log('[V2VMainDashboard] ✅ Alert is from different vehicle, processing...');

      const alert: EmergencyAlert = {
        id: payload.id || `emergency-${Date.now()}`,
        type: payload.type || 'hazard',
        message: payload.message || 'Emergency assistance needed',
        timestamp: payload.timestamp ? new Date(payload.timestamp) : (payload.ts ? new Date(payload.ts) : new Date()),
        location: payload.location || { lat: 0, lng: 0 },
        severity: payload.severity || 'high',
        senderId: payload.senderId,
        recipientCount: payload.recipientCount
      };

      console.log('[V2VMainDashboard] Processed alert:', alert);

      // Add sender to emergency vehicles set
      setEmergencyVehiclesSet(prev => {
        const newSet = new Set(prev);
        newSet.add(alert.senderId);
        console.log('[V2VMainDashboard] Emergency vehicles updated:', Array.from(newSet));

        // Clear any existing timer for this vehicle
        if (emergencyTimersRef.current.has(alert.senderId)) {
          clearTimeout(emergencyTimersRef.current.get(alert.senderId)!);
        }

        // Set new timer to auto-clear after 5 minutes
        const timer = setTimeout(() => {
          setEmergencyVehiclesSet(current => {
            const updated = new Set(current);
            updated.delete(alert.senderId);
            console.log('[V2VMainDashboard] Emergency status auto-cleared for:', alert.senderId);
            return updated;
          });
          emergencyTimersRef.current.delete(alert.senderId);
        }, 5 * 60 * 1000); // 5 minutes

        emergencyTimersRef.current.set(alert.senderId, timer);

        return newSet;
      });

      // Show emergency dialog
      setIncomingEmergencyAlert(alert);
      setShowEmergencyDialog(true);
      console.log('[V2VMainDashboard] Emergency dialog should be showing now');

      toast({
        title: '🚨 Emergency Alert!',
        description: `${alert.message} from nearby vehicle`,
        variant: 'destructive',
        duration: 10000
      });
    };

    console.log('[V2VMainDashboard] Subscribing to emergency_alert events...');

    // Subscribe to emergency alerts
    import('@/utils/websocketService').then(({ webSocketService }) => {
      webSocketService.subscribe('emergency_alert', handleEmergencyAlert);
      console.log('[V2VMainDashboard] Successfully subscribed to emergency_alert');
    });

    return () => {
      import('@/utils/websocketService').then(({ webSocketService }) => {
        webSocketService.unsubscribe('emergency_alert', handleEmergencyAlert);
        console.log('[V2VMainDashboard] Unsubscribed from emergency_alert');
      });
    };
  }, [toast, myVehicleId]);

  // Listen for emergency cleared events
  useEffect(() => {
    const handleEmergencyCleared = async (payload: any) => {
      console.log('[V2VMainDashboard] Emergency cleared event:', payload);

      if (payload && payload.senderId) {
        // Clear from emergency vehicles set
        setEmergencyVehiclesSet(prev => {
          const newSet = new Set(prev);
          newSet.delete(payload.senderId);
          console.log('[V2VMainDashboard] Emergency cleared for:', payload.senderId);
          return newSet;
        });

        // Clear timer if exists
        if (emergencyTimersRef.current.has(payload.senderId)) {
          clearTimeout(emergencyTimersRef.current.get(payload.senderId)!);
          emergencyTimersRef.current.delete(payload.senderId);
        }

        toast({
          title: 'Emergency Cleared',
          description: `Vehicle ${payload.senderId} emergency has been resolved`,
        });
      }
    };

    // Subscribe to emergency cleared events
    import('@/utils/websocketService').then(({ webSocketService }) => {
      webSocketService.subscribe('emergency_cleared', handleEmergencyCleared);
      console.log('[V2VMainDashboard] Subscribed to emergency_cleared');
    });

    return () => {
      import('@/utils/websocketService').then(({ webSocketService }) => {
        webSocketService.unsubscribe('emergency_cleared', handleEmergencyCleared);
      });
    };
  }, [toast]);

  // Handle errors from various components
  useEffect(() => {
    const errors = [vehicleError, devicesError, alertsError, connectionError].filter(Boolean);
    if (errors.length > 0) {
      const errorMessage = errors.join(', ');
      if (errorMessage !== dashboardError) {
        setDashboardError(errorMessage);
        try {
          toast({
            title: 'Dashboard Error',
            description: errorMessage,
            variant: 'destructive',
          });
        } catch (error) {
          console.error('Toast error:', error);
        }
      }
    } else if (dashboardError !== null) {
      setDashboardError(null);
    }
  }, [vehicleError, devicesError, alertsError, connectionError, toast]);

  // Handle device connection
  const handleDeviceConnect = (device: NearbyDevice) => {
    try {
      setSelectedDevice(device);
      setShowConnectionDialog(true);
    } catch (error) {
      console.error('Error opening connection dialog:', error);
      window.location.href = '/connected-vehicle';
    }
  };

  // Handle successful connection
  const handleConnectionSuccess = async (deviceId: string) => {
    try {
      // Store connection info
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('connectedDeviceId', deviceId);

        // Find the device in nearby vehicles to get complete data
        const deviceData = devices.find((v: any) => v.id === deviceId);

        // Check if this is an emergency connection
        const emergencyContext = sessionStorage.getItem('emergencyAlertContext');
        const isEmergencyConnection = emergencyContext !== null;

        const connectionInfo = {
          deviceId,
          deviceName: selectedDevice?.name || deviceData?.name || `Device ${deviceId}`,
          licensePlate: deviceData?.licensePlate,
          connectedAt: new Date().toISOString(),
          connectionType: 'outgoing',
          isEmergencyConnection,
          emergencyAlert: isEmergencyConnection ? JSON.parse(emergencyContext) : null,
          // Include vehicle data if available
          vehicleData: deviceData ? {
            name: deviceData.name,
            licensePlate: deviceData.licensePlate,
            distance: deviceData.distance,
            signalStrength: deviceData.signalStrength,
            brand: deviceData.brand,
            model: deviceData.model,
            deviceType: deviceData.deviceType
          } : null
        };
        sessionStorage.setItem('connectionInfo', JSON.stringify(connectionInfo));

        console.log('[V2VMainDashboard] Connection info stored:', connectionInfo);
      }

      // Close dialog and clear state
      setShowConnectionDialog(false);
      setSelectedDevice(null);

      // Use setTimeout to ensure state updates complete before navigation
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.location.href = '/connecting';
        }
      }, 100);
    } catch (error) {
      console.error('Connection success handler error:', error);
      // Fallback navigation
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.location.href = '/connecting';
        }
      }, 100);
    }
  };

  // Handle connection error
  const handleConnectionError = (error: string) => {
    try {
      toast({
        title: 'Connection Failed',
        description: error,
        variant: 'destructive',
      });
    } catch (toastError) {
      console.error('Toast error:', toastError);
    }
  };

  // Handle connection request approval
  const handleConnectionApproval = async () => {
    if (!incomingConnectionRequest) return;

    try {
      const { webSocketService } = await import('@/utils/websocketService');

      // Send approval response
      webSocketService.respondConnection(
        incomingConnectionRequest.requesterId,
        true,
        'approved'
      );

      // Store connection info for the connected vehicle dashboard
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('connectedDeviceId', incomingConnectionRequest.requesterId);

        // Find the requesting vehicle in nearby vehicles to get complete data
        const deviceData = devices.find((v: any) => v.id === incomingConnectionRequest.requesterId);

        const connectionInfo = {
          deviceId: incomingConnectionRequest.requesterId,
          deviceName: deviceData?.name || `Vehicle ${incomingConnectionRequest.requesterId}`,
          licensePlate: deviceData?.licensePlate,
          connectedAt: new Date().toISOString(),
          connectionType: 'incoming',
          // Include vehicle data if available
          vehicleData: deviceData ? {
            name: deviceData.name,
            licensePlate: deviceData.licensePlate,
            distance: deviceData.distance,
            signalStrength: deviceData.signalStrength,
            brand: deviceData.brand,
            model: deviceData.model,
            deviceType: deviceData.deviceType
          } : null
        };
        sessionStorage.setItem('connectionInfo', JSON.stringify(connectionInfo));
      }

      // Close approval dialog
      setShowApprovalDialog(false);
      setIncomingConnectionRequest(null);

      toast({
        title: 'Connection Approved',
        description: 'Redirecting to communication interface...'
      });

      // Redirect to connected vehicle dashboard
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.location.href = '/connected-vehicle';
        }
      }, 1000);

    } catch (error) {
      console.error('Error approving connection:', error);
      toast({
        title: 'Approval Failed',
        description: 'Failed to approve connection request',
        variant: 'destructive'
      });
    }
  };

  // Handle connection request decline
  const handleConnectionDecline = async (reason?: string) => {
    if (!incomingConnectionRequest) return;

    try {
      const { webSocketService } = await import('@/utils/websocketService');

      // Send decline response
      webSocketService.respondConnection(
        incomingConnectionRequest.requesterId,
        false,
        reason || 'declined'
      );

      // Close approval dialog
      setShowApprovalDialog(false);
      setIncomingConnectionRequest(null);

      toast({
        title: 'Connection Declined',
        description: `Declined connection from ${incomingConnectionRequest.requesterId}`
      });

    } catch (error) {
      console.error('Error declining connection:', error);
      toast({
        title: 'Decline Failed',
        description: 'Failed to decline connection request',
        variant: 'destructive'
      });
    }
  };

  // Handle connection request timeout
  const handleConnectionTimeout = async () => {
    if (!incomingConnectionRequest) return;

    try {
      const { webSocketService } = await import('@/utils/websocketService');

      // Send timeout response
      webSocketService.respondConnection(
        incomingConnectionRequest.requesterId,
        false,
        'timeout'
      );

      // Close approval dialog
      setShowApprovalDialog(false);
      setIncomingConnectionRequest(null);

      toast({
        title: 'Connection Request Timed Out',
        description: 'No response was sent to the requesting vehicle',
        variant: 'destructive'
      });

    } catch (error) {
      console.error('Error handling connection timeout:', error);
    }
  };

  // Handle emergency alert connect action
  const handleEmergencyConnect = () => {
    if (!incomingEmergencyAlert) return;

    try {
      console.log('[V2VMainDashboard] Connecting to emergency vehicle:', incomingEmergencyAlert.senderId);

      // Store emergency alert context before connecting
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('emergencyAlertContext', JSON.stringify({
          alertId: incomingEmergencyAlert.id,
          alertType: incomingEmergencyAlert.type,
          alertMessage: incomingEmergencyAlert.message,
          alertSeverity: incomingEmergencyAlert.severity,
          senderId: incomingEmergencyAlert.senderId,
          timestamp: incomingEmergencyAlert.timestamp
        }));
      }

      // Find the device in nearby vehicles
      const emergencyDevice = devices.find((d: any) => d.id === incomingEmergencyAlert.senderId);

      if (emergencyDevice) {
        console.log('[V2VMainDashboard] Found emergency device in nearby list:', emergencyDevice);
        // Connect to the emergency vehicle
        handleDeviceConnect(emergencyDevice);
      } else {
        console.log('[V2VMainDashboard] Emergency device not in nearby list, creating minimal device object');
        // Create a minimal device object if not found in nearby list
        const emergencyDeviceObj: NearbyDevice = {
          id: incomingEmergencyAlert.senderId,
          name: `Emergency Vehicle ${incomingEmergencyAlert.senderId}`,
          deviceType: 'emergency',
          distance: 0,
          signalStrength: 100,
          lastSeen: new Date(),
          isNew: false,
          isConnectable: true
        };
        handleDeviceConnect(emergencyDeviceObj);
      }

      // Close emergency dialog
      setShowEmergencyDialog(false);
      setIncomingEmergencyAlert(null);

      toast({
        title: 'Connecting to Emergency Vehicle',
        description: 'Establishing connection to provide assistance',
      });
    } catch (error) {
      console.error('Error connecting to emergency vehicle:', error);
      toast({
        title: 'Connection Failed',
        description: 'Failed to connect to emergency vehicle',
        variant: 'destructive'
      });
    }
  };

  // Handle emergency alert ignore action
  const handleEmergencyIgnore = () => {
    setShowEmergencyDialog(false);
    setIncomingEmergencyAlert(null);

    toast({
      title: 'Emergency Alert Ignored',
      description: 'You can still see emergency vehicles in the nearby list',
    });
  };

  // Handle dashboard refresh
  const handleRefresh = () => {
    window.location.reload();
  };

  // Error boundary fallback
  const ErrorFallback = ({ error, retry }: { error: Error; retry: () => void }) => (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          Dashboard Error
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            The V2V dashboard encountered an error: {error.message}
          </AlertDescription>
        </Alert>
        <div className="flex justify-center gap-2">
          <Button onClick={retry} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
          <Button onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Page
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // Loading state
  if (vehicleLoading) {
    return (
      <div className={`min-h-screen bg-background p-4 md:p-6 ${className}`}>
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Connection State Banner */}
          {['reconnecting', 'connecting', 'offline', 'error'].includes(connectionState) && (
            <div className={`w-full text-xs md:text-sm rounded-md px-3 py-2 flex items-center gap-2 border ${connectionState === 'reconnecting' ? 'bg-amber-50 border-amber-300 text-amber-800' : connectionState === 'connecting' ? 'bg-blue-50 border-blue-300 text-blue-800' : 'bg-red-50 border-red-300 text-red-800'}`}>
              <span className="font-medium">{connectionState === 'reconnecting' ? 'Reconnecting to server…' : connectionState === 'connecting' ? 'Connecting…' : connectionState === 'offline' ? 'Offline' : 'Connection Error'}</span>
              {connectionState === 'reconnecting' && <span className="hidden md:inline">Attempting automatic recovery.</span>}
            </div>
          )}
          <div className="text-center space-y-2">
            <Skeleton className="h-8 w-64 mx-auto" />
            <Skeleton className="h-4 w-96 mx-auto" />
          </div>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            </CardContent>
          </Card>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            <Skeleton className="h-96 w-full" />
            <Skeleton className="h-96 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary fallback={ErrorFallback}>
      <div className={`min-h-screen bg-background p-4 md:p-6 ${className}`}>
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Dashboard Header */}
          <div className="flex flex-col space-y-4 md:space-y-0 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
                <Car className="h-6 w-6 md:h-8 md:w-8 text-primary" />
                Akhyana : V2V Communication Dashboard
              </h1>
              <p className="text-sm md:text-base text-muted-foreground">
                Advanced Vehicle-to-Vehicle communication control center
              </p>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <ConnectionStatus connectionState={connectionState} />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSettings(!showSettings)}
                className="flex items-center gap-2"
              >
                <Settings className="h-4 w-4" />
                {showSettings ? 'Dashboard' : 'Settings'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  try {
                    document.cookie = 'v2v_auth=; path=/; max-age=0';
                    sessionStorage.clear();
                  } catch { }
                  window.location.href = '/auth/login';
                }}
                className="flex items-center gap-2"
              >
                Logout
              </Button>
            </div>
          </div>

          {/* Auto-Registration Status */}
          {(autoRegistration.isRegistering || autoRegistration.registrationError || !autoRegistration.isRegistered) && (
            <Card className="border-blue-200 bg-blue-50/50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  {autoRegistration.isRegistering && (
                    <>
                      <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-blue-900">
                          Setting up your vehicle...
                        </p>
                        <p className="text-xs text-blue-700">
                          Connecting to V2V network and requesting location permissions
                        </p>
                      </div>
                    </>
                  )}

                  {autoRegistration.registrationError && (
                    <>
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-medium text-red-900">
                          Vehicle registration failed
                        </p>
                        <p className="text-xs text-red-700">
                          {autoRegistration.registrationError}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={autoRegistration.retryRegistration}
                        className="text-red-700 border-red-300 hover:bg-red-50"
                      >
                        Retry
                      </Button>
                    </>
                  )}

                  {!autoRegistration.isRegistered && !autoRegistration.registrationError && !autoRegistration.isRegistering && (
                    <>
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-amber-900">
                          Vehicle not registered
                        </p>
                        <p className="text-xs text-amber-700">
                          V2V features will be limited until registration completes
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Location Permission Status */}
          {autoRegistration.locationPermissionRequested && autoRegistration.locationPermission !== 'granted' && (
            <Alert className="border-amber-200 bg-amber-50">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                {autoRegistration.locationPermission === 'denied'
                  ? 'Location access denied. Proximity detection and nearby vehicle features will not be available.'
                  : 'Location permission required for full V2V functionality. Please allow location access when prompted.'
                }
              </AlertDescription>
            </Alert>
          )}

          {/* Connection State Banner */}
          {['reconnecting', 'connecting', 'offline', 'error'].includes(connectionState) && (
            <div className={`w-full text-xs md:text-sm rounded-md px-3 py-2 flex items-center gap-2 border ${connectionState === 'reconnecting' ? 'bg-amber-50 border-amber-300 text-amber-800' : connectionState === 'connecting' ? 'bg-blue-50 border-blue-300 text-blue-800' : 'bg-red-50 border-red-300 text-red-800'}`}>
              <span className="font-medium">{connectionState === 'reconnecting' ? 'Reconnecting to server…' : connectionState === 'connecting' ? 'Connecting…' : connectionState === 'offline' ? 'Offline' : 'Connection Error'}</span>
              {connectionState === 'reconnecting' && <span className="hidden md:inline">Attempting automatic recovery.</span>}
            </div>
          )}

          {/* Dashboard Status Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                System Status
                <Badge
                  variant={vehicleStatus.isOnline ? "default" : "destructive"}
                  className="ml-auto"
                >
                  {vehicleStatus.isOnline ? (
                    <>
                      <Wifi className="h-3 w-3 mr-1" />
                      Online
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-3 w-3 mr-1" />
                      Offline
                    </>
                  )}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center space-y-2 p-2">
                  <div className="text-xl md:text-2xl font-bold text-primary">
                    {devices.length}
                  </div>
                  <div className="text-xs md:text-sm text-muted-foreground">Nearby Vehicles</div>
                </div>

                <div className="text-center space-y-2 p-2">
                  <div className="text-xl md:text-2xl font-bold text-green-600">
                    {alerts.filter(alert => {
                      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
                      return alert.timestamp > fiveMinutesAgo;
                    }).length}
                  </div>
                  <div className="text-xs md:text-sm text-muted-foreground">Active Alerts</div>
                </div>

                <div className="text-center space-y-2 p-2">
                  <Badge
                    variant={isScanning ? "default" : "secondary"}
                    className="text-xs md:text-sm mx-auto"
                  >
                    {isScanning ? 'Scanning' : 'Idle'}
                  </Badge>
                  <div className="text-xs md:text-sm text-muted-foreground">Discovery Status</div>
                </div>

                <div className="text-center space-y-2 p-2">
                  <Badge
                    variant={connectionStatus.state === 'connected' ? 'default' : 'outline'}
                    className={`text-xs md:text-sm mx-auto ${connectionStatus.state !== 'connected' ? 'bg-green-600 text-white border-green-600' : ''}`}
                  >
                    {connectionStatus.state === 'connected' ? 'Connected' : 'Ready'}
                  </Badge>
                  <div className="text-xs md:text-sm text-muted-foreground">Connection Status</div>
                </div>
                {hardwareMode && (
                  <>
                    <div className="text-center space-y-2 p-2 col-span-2 md:col-span-1">
                      <Badge
                        variant={'destructive'}
                        className="text-xs md:text-sm mx-auto bg-amber-600 border-amber-600 text-white"
                      >
                        Hardware Mode
                      </Badge>
                      <div className="text-xs md:text-sm text-muted-foreground">Offline Operation</div>
                    </div>
                    <div className="text-center space-y-2 p-2 col-span-2 md:col-span-1">
                      <Badge
                        variant={hwStatus.connected ? 'default' : 'outline'}
                        className={`text-xs md:text-sm mx-auto ${hwStatus.connected ? 'bg-green-600 text-white border-green-600' : ''}`}
                      >
                        {hwStatus.connected ? 'Port Linked' : 'Port Disconnected'}
                      </Badge>
                      <div className="text-xs md:text-sm text-muted-foreground">ESP32 / nRF24L01</div>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
          {hardwareMode && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">Hardware Link Setup</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <p className="text-muted-foreground">Select your ESP32 serial bridge to enable RF communication while offline. The firmware should output line-delimited JSON.</p>
                <div className="flex flex-wrap gap-2 items-center">
                  <Button size="sm" variant="outline" onClick={() => connectHardware()} disabled={hwStatus.initializing}>{hwStatus.initializing ? 'Connecting...' : hwStatus.connected ? 'Reconnect' : 'Choose Port'}</Button>
                  {hwStatus.portName && <span className="text-[11px] text-green-600">{hwStatus.portName}</span>}
                  {hwStatus.error && <span className="text-[11px] text-red-600">{hwStatus.error}</span>}
                  {hwStatus.reconnecting && !hwStatus.initializing && !hwStatus.connected && (
                    <span className="text-[11px] text-amber-600">Reconnecting (attempt {hwStatus.attempt})...</span>
                  )}
                </div>
                {lastMessage !== null && lastMessage !== undefined && (
                  <div className="bg-muted rounded p-2 font-mono text-[10px] max-h-32 overflow-auto">
                    <div className="opacity-70 mb-1">Last HW Msg:</div>
                    <pre className="whitespace-pre-wrap break-all">{(() => {
                      try { return JSON.stringify(lastMessage, null, 2); } catch { return String(lastMessage); }
                    })()}</pre>
                  </div>
                )}
                {!hwStatus.connected && !hwStatus.initializing && (
                  <div className="text-[11px] text-muted-foreground">Click "Choose Port" and grant browser access to the device.</div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Error Alert */}
          {dashboardError && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {dashboardError}
              </AlertDescription>
            </Alert>
          )}

          {/* Main Dashboard Grid */}
          {showSettings ? (
            <div className="grid grid-cols-1 gap-6">
              <SettingsPanel />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              <div className="w-full">
                <ErrorBoundary>
                  <VehicleStatusCard />
                </ErrorBoundary>
              </div>

              <div className="w-full lg:row-span-2">
                <ErrorBoundary>
                  <NearbyDevicesList
                    onDeviceConnect={handleDeviceConnect}
                    emergencyVehicleIds={emergencyVehiclesSet}
                  />
                </ErrorBoundary>
              </div>

              <div className="w-full lg:col-span-1 xl:col-span-1">
                <ErrorBoundary>
                  <EmergencyAlertPanel />
                </ErrorBoundary>
              </div>
            </div>
          )}

          {/* Connection Dialog */}
          <ConnectionDialog
            isOpen={showConnectionDialog}
            onClose={() => {
              setShowConnectionDialog(false);
              setSelectedDevice(null);
            }}
            device={selectedDevice}
            onConnectionSuccess={handleConnectionSuccess}
            onConnectionError={handleConnectionError}
          />

          {/* Connection Approval Dialog */}
          <ConnectionApprovalDialog
            isOpen={showApprovalDialog}
            request={incomingConnectionRequest}
            onApprove={handleConnectionApproval}
            onDecline={handleConnectionDecline}
            onTimeout={handleConnectionTimeout}
          />

          {/* Emergency Alert Dialog */}
          <EmergencyAlertDialog
            alert={incomingEmergencyAlert}
            open={showEmergencyDialog}
            onConnect={handleEmergencyConnect}
            onIgnore={handleEmergencyIgnore}
          />

          {/* Toast Notifications */}
          <Toaster />
        </div>
      </div>
    </ErrorBoundary>
  );
}