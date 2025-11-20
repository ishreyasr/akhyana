'use client'

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { Separator } from '../ui/separator';
import { Alert, AlertDescription } from '../ui/alert';
import {
  Wifi,
  WifiOff,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Car,
  Truck,
  Building,
  X
} from 'lucide-react';
import { NearbyDevice, ConnectionStatus } from '../../types/v2v.types';
import { useToast } from '../ui/use-toast';

interface ConnectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  device: NearbyDevice | null;
  onConnectionSuccess: (deviceId: string) => void;
  onConnectionError: (error: string) => void;
}

interface ConnectionStep {
  id: string;
  label: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  error?: string;
}

export function ConnectionDialog({
  isOpen,
  onClose,
  device,
  onConnectionSuccess,
  onConnectionError
}: ConnectionDialogProps) {
  const { toast } = useToast();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus['state']>('idle');
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [connectionSteps, setConnectionSteps] = useState<ConnectionStep[]>([
    { id: 'discovery', label: 'Device Discovery', status: 'pending' },
    { id: 'handshake', label: 'Initial Handshake', status: 'pending' },
    { id: 'authentication', label: 'Authentication', status: 'pending' },
    { id: 'channel-setup', label: 'Channel Setup', status: 'pending' },
    { id: 'connection-test', label: 'Connection Test', status: 'pending' }
  ]);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectionTime, setConnectionTime] = useState<number>(0);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (isOpen && device) {
      setConnectionStatus('idle');
      setProgress(0);
      setCurrentStep(0);
      setConnectionError(null);
      setConnectionTime(0);
      setConnectionSteps(steps => steps.map(step => ({ ...step, status: 'pending', error: undefined })));
    }
  }, [isOpen, device]);

  // Connection timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (connectionStatus === 'connecting') {
      interval = setInterval(() => {
        setConnectionTime(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [connectionStatus]);

  // Simulate connection process
  const startConnection = async () => {
    if (!device) return;

    setConnectionStatus('connecting');
    setConnectionError(null);

    try {
      // Send actual connection request via WebSocket
      const { webSocketService } = await import('@/utils/websocketService');

      // Check if we have a registered vehicle ID
      const currentVehicleId = webSocketService.getVehicleId();
      if (!currentVehicleId) {
        throw new Error('Vehicle not registered. Please register first.');
      }

      // Send connection request to target device
      webSocketService.requestConnection(device.id, 'v2v_communication');

      toast({
        title: 'Connection Request Sent',
        description: `Waiting for ${device.name} to approve the connection...`
      });

      // Listen for connection response
      const handleConnectionResponse = (payload: any) => {
        if (payload.requesterId === currentVehicleId && payload.targetId === device.id) {
          if (payload.approved) {
            // Connection approved
            setConnectionStatus('connected');
            setProgress(100);

            toast({
              title: 'Connection Approved',
              description: `${device.name} approved your connection request. Redirecting...`
            });

            // Wait a moment to show success state then redirect
            setTimeout(() => {
              try {
                onConnectionSuccess(device.id);
              } catch (error) {
                console.error('Connection success callback error:', error);
                onClose();
              }
            }, 1000);
          } else {
            // Connection declined
            setConnectionStatus('error');
            const reason = payload.reason || 'Connection declined by remote vehicle';
            setConnectionError(reason);
            onConnectionError(reason);

            toast({
              title: 'Connection Declined',
              description: reason,
              variant: 'destructive'
            });
          }

          // Unsubscribe from further responses
          webSocketService.unsubscribe('connect_response', handleConnectionResponse);
        }
      };

      // Subscribe to connection response
      webSocketService.subscribe('connect_response', handleConnectionResponse);

      // Set up timeout for connection request (30 seconds to match backend)
      setTimeout(() => {
        if (connectionStatus === 'connecting') {
          setConnectionStatus('error');
          setConnectionError('Connection request timed out');
          onConnectionError('Connection request timed out');
          webSocketService.unsubscribe('connect_response', handleConnectionResponse);

          toast({
            title: 'Connection Timeout',
            description: 'No response from the remote vehicle',
            variant: 'destructive'
          });
        }
      }, 30000);

      // Update progress to show request sent
      setProgress(25);
      setConnectionSteps(prev => prev.map((step, index) =>
        index === 0 ? { ...step, status: 'completed' } : step
      ));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection failed';
      setConnectionStatus('error');
      setConnectionError(errorMessage);
      onConnectionError(errorMessage);

      toast({
        title: 'Connection Failed',
        description: errorMessage,
        variant: 'destructive'
      });
    }
  };

  // Cancel connection
  const cancelConnection = () => {
    setConnectionStatus('idle');
    setProgress(0);
    setCurrentStep(0);
    setConnectionError(null);
    onClose();

    toast({
      title: 'Connection Cancelled',
      description: 'Connection attempt was cancelled'
    });
  };

  // Retry connection
  const retryConnection = () => {
    setConnectionStatus('idle');
    setProgress(0);
    setCurrentStep(0);
    setConnectionError(null);
    setConnectionSteps(steps => steps.map(step => ({ ...step, status: 'pending', error: undefined })));
    startConnection();
  };

  // Get device type icon
  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'vehicle':
        return <Car data-testid="car-icon" className="h-5 w-5" />;
      case 'emergency':
        return <Truck data-testid="truck-icon" className="h-5 w-5 text-red-500" />;
      case 'infrastructure':
        return <Building data-testid="building-icon" className="h-5 w-5" />;
      default:
        return <Wifi data-testid="wifi-icon" className="h-5 w-5" />;
    }
  };

  // Get signal strength color
  const getSignalColor = (strength: number) => {
    if (strength >= 80) return 'text-green-500';
    if (strength >= 60) return 'text-yellow-500';
    if (strength >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

  // Format connection time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  if (!device) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getDeviceIcon(device.deviceType)}
            Connect to {device.name}
          </DialogTitle>
          <DialogDescription>
            Establishing V2V communication with nearby device
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Device Information */}
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Device ID</span>
                  <span className="text-sm text-muted-foreground">{device.id}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Distance</span>
                  <span className="text-sm text-muted-foreground">{device.distance}m</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Signal Strength</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${getSignalColor(device.signalStrength)}`}>
                      {device.signalStrength}%
                    </span>
                    {device.signalStrength >= 60 ? (
                      <Wifi data-testid="wifi-icon" className={`h-4 w-4 ${getSignalColor(device.signalStrength)}`} />
                    ) : (
                      <WifiOff data-testid="wifi-off-icon" className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Device Type</span>
                  <Badge variant={device.deviceType === 'emergency' ? 'destructive' : 'secondary'}>
                    {device.deviceType}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Status</span>
                  <Badge variant={device.isConnectable ? 'default' : 'secondary'}>
                    {device.isConnectable ? 'Available' : 'Busy'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Connection Progress */}
          {connectionStatus !== 'idle' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Connection Progress</span>
                  <span className="text-sm text-muted-foreground">
                    {connectionStatus === 'connecting' && `${formatTime(connectionTime)}`}
                  </span>
                </div>
                <Progress value={progress} className="w-full" />
              </div>

              {/* Connection Steps */}
              <div className="space-y-2">
                {connectionSteps.map((step, index) => (
                  <div key={step.id} className="flex items-center gap-3">
                    {step.status === 'completed' && (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                    {step.status === 'in-progress' && (
                      <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                    )}
                    {step.status === 'error' && (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    {step.status === 'pending' && (
                      <div className="h-4 w-4 rounded-full border-2 border-muted" />
                    )}

                    <span className={`text-sm ${step.status === 'completed' ? 'text-green-600' :
                        step.status === 'in-progress' ? 'text-blue-600' :
                          step.status === 'error' ? 'text-red-600' :
                            'text-muted-foreground'
                      }`}>
                      {step.label}
                    </span>

                    {step.error && (
                      <span className="text-xs text-red-500">({step.error})</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Connection Error */}
          {connectionError && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{connectionError}</AlertDescription>
            </Alert>
          )}

          {/* Success Message */}
          {connectionStatus === 'connected' && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Successfully connected to {device.name}. Redirecting to communication interface...
              </AlertDescription>
            </Alert>
          )}

          <Separator />

          {/* Action Buttons */}
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={connectionStatus === 'connecting'}
            >
              <X className="h-4 w-4 mr-2" />
              {connectionStatus === 'connecting' ? 'Cancel' : 'Close'}
            </Button>

            <div className="flex gap-2">
              {connectionStatus === 'error' && (
                <Button onClick={retryConnection} variant="outline">
                  Retry
                </Button>
              )}

              {connectionStatus === 'idle' && (
                <Button
                  onClick={startConnection}
                  disabled={!device.isConnectable}
                >
                  Connect
                </Button>
              )}

              {connectionStatus === 'connecting' && (
                <Button onClick={cancelConnection} variant="destructive">
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}