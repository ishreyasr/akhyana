// V2V Dashboard TypeScript Interfaces

export interface VehicleStatus {
  isOnline: boolean;
  lastConnected: Date;
  vehicleId: string;
  /** 0-100 if available else null */
  signalStrength: number | null;
  /** 0-100 if available else null */
  batteryLevel: number | null;
  gpsStatus: 'locked' | 'searching' | 'offline';
  /** Source classification for signal metric */
  signalSource?: 'telemetry' | 'simulated' | 'unknown';
  /** Source classification for battery metric */
  batterySource?: 'telemetry' | 'simulated' | 'unknown';
  /** Last telemetry update timestamp (ms) */
  telemetryUpdatedAt?: number;
}

export interface NearbyDevice {
  id: string;
  name: string;
  distance: number;
  signalStrength: number;
  lastSeen: Date;
  deviceType: 'vehicle' | 'emergency' | 'infrastructure';
  isConnectable: boolean;
  /** Optional vehicle registration / license plate for display */
  licensePlate?: string;
  /** Optional brand (make) */
  brand?: string;
  /** Optional model */
  model?: string;
  /** UI transient flag for newly entered proximity */
  isNew?: boolean;
}

export interface EmergencyAlert {
  id: string;
  type: 'accident' | 'breakdown' | 'hazard' | 'medical';
  message: string;
  timestamp: Date;
  location: { lat: number; lng: number };
  severity: 'low' | 'medium' | 'high';
  senderId: string;
  recipientCount?: number;
  /** Whether the alert has been acknowledged (soft-dismissed) in this client session */
  acknowledged?: boolean;
}

export interface V2VSettings {
  communicationChannel: number;
  autoChannelSelection: boolean;
  voiceQualityThreshold: number;
  alertPreferences: {
    soundEnabled: boolean;
    vibrationEnabled: boolean;
    displayBrightness: number;
  };
  discoverySettings: {
    scanInterval: number;
    maxRange: number;
    deviceFilters: string[];
  };
  nightMode: boolean;
}

export interface DashboardState {
  vehicleStatus: VehicleStatus;
  nearbyDevices: NearbyDevice[];
  emergencyAlerts: EmergencyAlert[];
  settings: V2VSettings;
  isScanning: boolean;
  connectionState: 'idle' | 'connecting' | 'connected' | 'error';
}

export interface DeviceDiscoveryResult {
  devices: NearbyDevice[];
  scanTimestamp: Date;
  scanDuration: number;
  errors: string[];
}

export interface AlertBroadcastResult {
  success: boolean;
  recipientCount: number;
  failedRecipients: string[];
  broadcastId: string;
}

export interface ConnectionStatus {
  state: 'idle' | 'connecting' | 'connected' | 'error';
  deviceId?: string;
  error?: string;
  connectedAt?: Date;
}

// WebSocket message types
export interface WebSocketMessage {
  type: 'device_discovered' | 'device_lost' | 'emergency_alert' | 'status_update';
  payload: any;
  timestamp: Date;
}

export interface ProximityEvent {
  id: string;
  vehicleId: string; // self
  peerVehicleId: string;
  eventType: 'enter' | 'exit';
  distanceM: number | null;
  ts: number;
}

// ---------------- Error Handling ----------------
export type V2VErrorCode =
  | 'invalid_register'
  | 'invalid_location'
  | 'unknown_event'
  | 'target_offline'
  | 'rate_limited'
  | 'auth_failed'
  | 'validation_error';

export interface V2VErrorEvent {
  code: V2VErrorCode;
  message: string;
  ts: number;
  details?: any;
}