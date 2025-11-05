'use client'

import React, { useState } from 'react';
import { ConnectionDialog } from './ConnectionDialog';
import { SettingsPanel } from './SettingsPanel';
import { NearbyDevice } from '../../types/v2v.types';
import { handleConnectionSuccess } from '../../utils/navigation';
import { useToast } from '../ui/use-toast';

/**
 * Integration component demonstrating how ConnectionDialog and SettingsPanel
 * work together with proper navigation handling for successful connections
 */
export function V2VDashboardIntegration() {
  const [isConnectionDialogOpen, setIsConnectionDialogOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<NearbyDevice | null>(null);
  const { toast } = useToast();

  // Mock device for demonstration
  const mockDevice: NearbyDevice = {
    id: 'demo-vehicle-123',
    name: 'Demo Vehicle',
    distance: 150,
    signalStrength: 85,
    lastSeen: new Date(),
    deviceType: 'vehicle',
    isConnectable: true
  };

  const handleConnectToDevice = (device: NearbyDevice) => {
    setSelectedDevice(device);
    setIsConnectionDialogOpen(true);
  };

  const handleConnectionSuccessWithNavigation = (deviceId: string) => {
    // Use the navigation utility to handle successful connection
    // This will store connection info and navigate to the existing dashboard.tsx
    handleConnectionSuccess(deviceId, selectedDevice?.name);
    
    toast({
      title: 'Connection Successful',
      description: `Connected to ${selectedDevice?.name}. Redirecting to communication interface...`
    });
  };

  const handleConnectionError = (error: string) => {
    toast({
      title: 'Connection Failed',
      description: error,
      variant: 'destructive'
    });
  };

  const handleCloseConnectionDialog = () => {
    setIsConnectionDialogOpen(false);
    setSelectedDevice(null);
  };

  return (
    <div className="space-y-6">
      {/* Settings Panel */}
      <SettingsPanel />
      
      {/* Demo Connection Button */}
      <div className="flex justify-center">
        <button
          onClick={() => handleConnectToDevice(mockDevice)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          Demo Connection to {mockDevice.name}
        </button>
      </div>

      {/* Connection Dialog with Navigation Integration */}
      <ConnectionDialog
        isOpen={isConnectionDialogOpen}
        onClose={handleCloseConnectionDialog}
        device={selectedDevice}
        onConnectionSuccess={handleConnectionSuccessWithNavigation}
        onConnectionError={handleConnectionError}
      />
    </div>
  );
}