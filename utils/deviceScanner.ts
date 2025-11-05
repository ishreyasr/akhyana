// Device scanner service with mock data for V2V communication

import { NearbyDevice, DeviceDiscoveryResult } from '../types/v2v.types';

// Local coordinate type (not exported in v2v.types)
type Coordinates = { lat: number; lng: number };
import { calculateDistance, isWithinRange } from './distanceCalculator';

// Toggle for mock data: enabled in tests or when explicitly requested.
const ENABLE_MOCKS = process.env.NODE_ENV === 'test' || process.env.V2V_USE_MOCK_NEARBY === 'true';

// Mock vehicle location (used only when mocks enabled)
const MOCK_VEHICLE_LOCATION: Coordinates = { lat: 40.7128, lng: -74.0060 };

// Mock nearby devices for testing (empty in real runtime so no placeholders appear)
const MOCK_DEVICES: Array<NearbyDevice & { location: Coordinates }> = ENABLE_MOCKS ? [
  {
    id: 'vehicle-001',
    name: 'Emergency Vehicle Alpha',
    distance: 150,
    signalStrength: 85,
    lastSeen: new Date(),
    deviceType: 'emergency',
    isConnectable: true,
    licensePlate: 'KA-05-EM-1001',
    brand: 'Mahindra',
    model: 'Responder-X',
    location: { lat: 40.7130, lng: -74.0058 }
  },
  {
    id: 'vehicle-002',
    name: 'Civilian Vehicle Beta',
    distance: 300,
    signalStrength: 72,
    lastSeen: new Date(),
    deviceType: 'vehicle',
    isConnectable: true,
    licensePlate: 'KA-05-AB-1312',
    brand: 'Tesla',
    model: 'Model 3',
    location: { lat: 40.7125, lng: -74.0065 }
  },
  {
    id: 'infrastructure-001',
    name: 'Traffic Signal Node',
    distance: 200,
    signalStrength: 90,
    lastSeen: new Date(),
    deviceType: 'infrastructure',
    isConnectable: false,
    location: { lat: 40.7132, lng: -74.0062 }
  },
  {
    id: 'vehicle-003',
    name: 'Commercial Vehicle Gamma',
    distance: 450,
    signalStrength: 60,
    lastSeen: new Date(),
    deviceType: 'vehicle',
    isConnectable: true,
    licensePlate: 'KA-05-CM-4420',
    brand: 'Ashok Leyland',
    model: 'Cargo-12T',
    location: { lat: 40.7120, lng: -74.0070 }
  }
] : [];

export class DeviceScannerService {
  private isScanning = false;
  private scanInterval: NodeJS.Timeout | null = null;
  private discoveredDevices: Map<string, NearbyDevice> = new Map();
  private onDeviceDiscoveredCallbacks: Array<(device: NearbyDevice) => void> = [];
  private onDeviceLostCallbacks: Array<(deviceId: string) => void> = [];
  private vehicleLocation: Coordinates = MOCK_VEHICLE_LOCATION;
  private maxRange = 500; // meters

  /**
   * Start scanning for nearby devices
   */
  async startScanning(scanIntervalMs = 5000): Promise<void> {
    if (this.isScanning) return;

    this.isScanning = true;
    console.log(`Starting device scanning... (mocks: ${ENABLE_MOCKS ? 'enabled' : 'disabled'})`);

    // Initial scan
    await this.performScan();

    // Set up periodic scanning
    this.scanInterval = setInterval(async () => {
      await this.performScan();
    }, scanIntervalMs);
  }

  /**
   * Stop scanning for devices
   */
  async stopScanning(): Promise<void> {
    if (!this.isScanning) return;

    this.isScanning = false;
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    console.log('Stopped device scanning');
  }

  /**
   * Get currently discovered devices
   */
  getCurrentDevices(): NearbyDevice[] {
    return Array.from(this.discoveredDevices.values());
  }

  /**
   * Subscribe to device discovery events
   */
  onDeviceDiscovered(callback: (device: NearbyDevice) => void): void {
    this.onDeviceDiscoveredCallbacks.push(callback);
  }

  /**
   * Subscribe to device lost events
   */
  onDeviceLost(callback: (deviceId: string) => void): void {
    this.onDeviceLostCallbacks.push(callback);
  }

  /**
   * Update vehicle location
   */
  updateVehicleLocation(location: Coordinates): void {
    this.vehicleLocation = location;
  }

  /**
   * Set maximum scanning range
   */
  setMaxRange(range: number): void {
    this.maxRange = range;
  }

  /**
   * Perform a single device scan
   */
  private async performScan(): Promise<DeviceDiscoveryResult> {
    const scanStart = new Date();
    const errors: string[] = [];
    const devicesInRange: NearbyDevice[] = [];

    try {
      // In real runtime (mocks disabled) we don't fabricate devices; we simply clear any previous mock entries.
      if (!ENABLE_MOCKS) {
        if (this.discoveredDevices.size) {
          for (const id of this.discoveredDevices.keys()) this.notifyDeviceLost(id);
          this.discoveredDevices.clear();
        }
        return {
          devices: [],
          scanTimestamp: scanStart,
          scanDuration: 0,
          errors
        };
      }
      // Simulate scanning delay
      await new Promise(resolve => setTimeout(resolve, 100));

      // Filter mock devices by range and update distances
      for (const mockDevice of MOCK_DEVICES) {
        if (isWithinRange(mockDevice.location, this.vehicleLocation, this.maxRange)) {
          const distance = calculateDistance(mockDevice.location, this.vehicleLocation);
          const device: NearbyDevice = {
            ...mockDevice,
            distance: Math.round(distance),
            lastSeen: new Date(),
            // Simulate signal strength based on distance
            signalStrength: Math.max(20, 100 - Math.round(distance / 10))
          };

          devicesInRange.push(device);

          // Check if this is a new device
          if (!this.discoveredDevices.has(device.id)) {
            this.discoveredDevices.set(device.id, device);
            this.notifyDeviceDiscovered(device);
          } else {
            // Update existing device
            this.discoveredDevices.set(device.id, device);
          }
        }
      }

      // Check for devices that are no longer in range
      const currentDeviceIds = new Set(devicesInRange.map(d => d.id));
      for (const [deviceId] of this.discoveredDevices) {
        if (!currentDeviceIds.has(deviceId)) {
          this.discoveredDevices.delete(deviceId);
          this.notifyDeviceLost(deviceId);
        }
      }

    } catch (error) {
      errors.push(`Scan error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const scanEnd = new Date();
    return {
      devices: devicesInRange,
      scanTimestamp: scanStart,
      scanDuration: scanEnd.getTime() - scanStart.getTime(),
      errors
    };
  }

  /**
   * Notify subscribers of device discovery
   */
  private notifyDeviceDiscovered(device: NearbyDevice): void {
    this.onDeviceDiscoveredCallbacks.forEach(callback => {
      try {
        callback(device);
      } catch (error) {
        console.error('Error in device discovered callback:', error);
      }
    });
  }

  /**
   * Notify subscribers of device loss
   */
  private notifyDeviceLost(deviceId: string): void {
    this.onDeviceLostCallbacks.forEach(callback => {
      try {
        callback(deviceId);
      } catch (error) {
        console.error('Error in device lost callback:', error);
      }
    });
  }
}

// Singleton instance
export const deviceScanner = new DeviceScannerService();