// Vehicle connection service for V2V communication

import { NearbyDevice, ConnectionStatus } from '../types/v2v.types';

export interface ConnectionResult {
  success: boolean;
  deviceId?: string;
  error?: string;
  connectionTime?: number;
}

export interface ConnectionStep {
  id: string;
  label: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  error?: string;
}

export class VehicleConnectionService {
  private connectionStatus: ConnectionStatus = { state: 'idle' };
  private connectionCallbacks: ((status: ConnectionStatus) => void)[] = [];
  private currentConnection: string | null = null;
  private hardwareMode = false; // When true, we bypass network-dependent steps

  /** Enable/disable hardware fallback mode */
  setHardwareMode(enabled: boolean) {
    this.hardwareMode = enabled;
  }

  /** Returns true if hardware fallback mode is active */
  isHardwareMode() {
    return this.hardwareMode;
  }

  /**
   * Connect to a nearby device
   */
  async connectToDevice(device: NearbyDevice): Promise<ConnectionResult> {
    if (this.connectionStatus.state === 'connecting') {
      throw new Error('Connection already in progress');
    }

    if (!device.isConnectable) {
      throw new Error('Device is not available for connection');
    }

    const startTime = Date.now();

    try {
      this.updateConnectionStatus({ state: 'connecting', deviceId: device.id });

      if (this.hardwareMode) {
        // In hardware mode we assume a direct local (e.g., DSRC/Bluetooth) link with minimal handshake
        await new Promise(r => setTimeout(r, 250)); // fast local setup
      } else {
        // Simulate connection process with realistic delays
        const steps = [
          { id: 'discovery', duration: 1000 + Math.random() * 1000 },
          { id: 'handshake', duration: 800 + Math.random() * 800 },
          { id: 'authentication', duration: 1200 + Math.random() * 1200 },
          { id: 'channel-setup', duration: 600 + Math.random() * 600 },
          { id: 'connection-test', duration: 400 + Math.random() * 400 }
        ];

        for (const step of steps) {
          await new Promise(resolve => setTimeout(resolve, step.duration));
          // Simulate occasional failures (5% chance after first step) only in online mode
          if (step.id !== 'discovery' && Math.random() < 0.05) {
            throw new Error(`Connection failed during ${step.id.replace('-', ' ')}`);
          }
        }
      }

      const connectionTime = Date.now() - startTime;
      this.currentConnection = device.id;

      this.updateConnectionStatus({
        state: 'connected',
        deviceId: device.id,
        connectedAt: new Date()
      });

      return {
        success: true,
        deviceId: device.id,
        connectionTime
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection failed';
      const connectionTime = Date.now() - startTime;

      this.updateConnectionStatus({
        state: 'error',
        deviceId: device.id,
        error: errorMessage
      });

      return {
        success: false,
        error: errorMessage,
        connectionTime
      };
    }
  }

  /**
   * Disconnect from current device
   */
  async disconnect(): Promise<boolean> {
    try {
      if (this.currentConnection) {
        // Simulate disconnection delay
        await new Promise(resolve => setTimeout(resolve, 500));

        this.currentConnection = null;
        this.updateConnectionStatus({ state: 'idle' });

        return true;
      }
      return false;
    } catch (error) {
      console.error('Disconnection failed:', error);
      return false;
    }
  }

  /**
   * Cancel ongoing connection attempt
   */
  cancelConnection(): void {
    if (this.connectionStatus.state === 'connecting') {
      this.updateConnectionStatus({ state: 'idle' });
    }
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): ConnectionStatus {
    return { ...this.connectionStatus };
  }

  /**
   * Subscribe to connection status changes
   */
  onConnectionStateChange(callback: (status: ConnectionStatus) => void): () => void {
    this.connectionCallbacks.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.connectionCallbacks.indexOf(callback);
      if (index > -1) {
        this.connectionCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Check if device is currently connected
   */
  isConnectedToDevice(deviceId: string): boolean {
    return this.currentConnection === deviceId && this.connectionStatus.state === 'connected';
  }

  /**
   * Get connected device ID
   */
  getConnectedDeviceId(): string | null {
    return this.connectionStatus.state === 'connected' ? this.currentConnection : null;
  }

  /**
   * Test connection quality
   */
  async testConnection(): Promise<{ success: boolean; latency?: number; quality?: number }> {
    if (this.connectionStatus.state !== 'connected') {
      return { success: false };
    }

    try {
      const startTime = Date.now();

      // Simulate connection test
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

      const latency = Date.now() - startTime;
      const quality = Math.max(10, 100 - latency * 0.5 + Math.random() * 20 - 10);

      return {
        success: true,
        latency,
        quality: Math.round(quality)
      };
    } catch (error) {
      return { success: false };
    }
  }

  /**
   * Get connection statistics
   */
  getConnectionStats(): {
    isConnected: boolean;
    deviceId?: string;
    connectedAt?: Date;
    duration?: number;
  } {
    const stats: any = {
      isConnected: this.connectionStatus.state === 'connected'
    };

    if (this.connectionStatus.state === 'connected') {
      stats.deviceId = this.currentConnection;
      stats.connectedAt = this.connectionStatus.connectedAt;

      if (this.connectionStatus.connectedAt) {
        stats.duration = Date.now() - this.connectionStatus.connectedAt.getTime();
      }
    }

    return stats;
  }

  /**
   * Update connection status and notify subscribers
   */
  private updateConnectionStatus(status: Partial<ConnectionStatus>): void {
    this.connectionStatus = { ...this.connectionStatus, ...status };

    // Notify all subscribers
    this.connectionCallbacks.forEach(callback => {
      try {
        callback(this.connectionStatus);
      } catch (error) {
        console.error('Error in connection status callback:', error);
      }
    });
  }

  /**
   * Simulate network conditions affecting connection
   */
  private simulateNetworkConditions(): {
    latency: number;
    packetLoss: number;
    signalStrength: number;
  } {
    if (this.hardwareMode) {
      // Hardware mode: treat metrics as stable local link
      return {
        latency: 20 + Math.random() * 30,
        packetLoss: Math.random(),
        signalStrength: 85 + Math.random() * 10
      };
    }
    return {
      latency: 50 + Math.random() * 200, // 50-250ms
      packetLoss: Math.random() * 5, // 0-5%
      signalStrength: 60 + Math.random() * 40 // 60-100%
    };
  }
}

// Singleton instance
export const connectionService = new VehicleConnectionService();

// Connection step definitions for UI
export const CONNECTION_STEPS: ConnectionStep[] = [
  { id: 'discovery', label: 'Device Discovery', status: 'pending' },
  { id: 'handshake', label: 'Initial Handshake', status: 'pending' },
  { id: 'authentication', label: 'Authentication', status: 'pending' },
  { id: 'channel-setup', label: 'Channel Setup', status: 'pending' },
  { id: 'connection-test', label: 'Connection Test', status: 'pending' }
];