# Design Document

## Overview

The V2V Dashboard is the main interface that drivers interact with when they first open the V2V communication system. This dashboard serves as the central hub before connecting to specific nearby vehicles. The design leverages the existing UI component library (shadcn/ui) and follows the established design patterns from the current connected vehicle interface.

The dashboard will be implemented as a React component using Next.js 15 with TypeScript, maintaining consistency with the existing codebase architecture. The interface will be responsive and optimized for both desktop and mobile viewing in vehicle environments.

## Architecture

### Component Structure
```
V2VMainDashboard/
├── components/
│   ├── VehicleStatusCard.tsx      # Shows current vehicle online/offline status
│   ├── NearbyDevicesList.tsx      # Lists nearby vehicles within 500m
│   ├── EmergencyAlertPanel.tsx    # Emergency alert broadcasting interface
│   ├── SettingsPanel.tsx          # Communication settings and preferences
│   └── ConnectionDialog.tsx       # Modal for connecting to selected vehicle
├── hooks/
│   ├── useVehicleStatus.ts        # Manages vehicle connectivity state
│   ├── useNearbyDevices.ts        # Handles device discovery and scanning
│   ├── useEmergencyAlerts.ts      # Manages emergency alert system
│   └── useV2VSettings.ts          # Handles settings persistence
├── types/
│   └── v2v.types.ts               # TypeScript interfaces for V2V data
└── utils/
    ├── deviceScanner.ts           # Device discovery utilities
    ├── emergencyAlerts.ts         # Emergency alert broadcasting
    └── distanceCalculator.ts      # GPS distance calculations
```

### State Management
- **Local State**: React useState for UI interactions and temporary data
- **Persistent State**: localStorage for user preferences and settings
- **Real-time State**: WebSocket connections for live device discovery and status updates

### Integration Points
- **Existing Dashboard**: The main dashboard will navigate to the existing `dashboard.tsx` when a vehicle connection is established
- **UI Components**: Reuse existing shadcn/ui components for consistency
- **Styling**: Follow existing Tailwind CSS patterns and design system

## Components and Interfaces

### 1. Vehicle Status Card
**Purpose**: Display current vehicle's connectivity status and basic information

**Interface**:
```typescript
interface VehicleStatus {
  isOnline: boolean;
  lastConnected: Date;
  vehicleId: string;
  signalStrength: number;
  batteryLevel: number;
  gpsStatus: 'locked' | 'searching' | 'offline';
}
```

**Visual Design**:
- Large status indicator (green/red circle with online/offline text)
- Vehicle ID and last connection timestamp
- Signal strength and battery level progress bars
- GPS status indicator
- Uses Card component with prominent status styling

### 2. Nearby Devices List
**Purpose**: Show discoverable vehicles within 500m range with connection options

**Interface**:
```typescript
interface NearbyDevice {
  id: string;
  name: string;
  distance: number;
  signalStrength: number;
  lastSeen: Date;
  deviceType: 'vehicle' | 'emergency' | 'infrastructure';
  isConnectable: boolean;
}
```

**Visual Design**:
- Scrollable list with device cards
- Each card shows: device name, distance, signal strength, device type badge
- Connect button for each device
- Auto-refresh every 5 seconds
- Empty state when no devices found
- Sort by distance (closest first)

### 3. Emergency Alert Panel
**Purpose**: Broadcast emergency alerts to nearby vehicles

**Interface**:
```typescript
interface EmergencyAlert {
  type: 'accident' | 'breakdown' | 'hazard' | 'medical';
  message: string;
  timestamp: Date;
  location: { lat: number; lng: number };
  severity: 'low' | 'medium' | 'high';
}
```

**Visual Design**:
- Prominent red emergency button
- Alert type selection (accident, breakdown, hazard, medical)
- Quick-send buttons for common alerts
- Alert history panel showing sent/received alerts
- Visual priority indicators for different alert types

### 4. Settings Panel
**Purpose**: Configure communication channels and preferences

**Interface**:
```typescript
interface V2VSettings {
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
}
```

**Visual Design**:
- Tabbed interface for different setting categories
- Channel selection dropdown with signal quality indicators
- Toggle switches for boolean preferences
- Sliders for numeric values (brightness, thresholds)
- Save/Reset buttons for settings management

### 5. Connection Dialog
**Purpose**: Handle connection process to selected nearby vehicle

**Visual Design**:
- Modal dialog triggered when connecting to a device
- Connection progress indicator
- Device information display
- Cancel connection option
- Success/error states with appropriate messaging

## Data Models

### Core Data Structures

```typescript
// Main dashboard state
interface DashboardState {
  vehicleStatus: VehicleStatus;
  nearbyDevices: NearbyDevice[];
  emergencyAlerts: EmergencyAlert[];
  settings: V2VSettings;
  isScanning: boolean;
  connectionState: 'idle' | 'connecting' | 'connected' | 'error';
}

// Device discovery result
interface DeviceDiscoveryResult {
  devices: NearbyDevice[];
  scanTimestamp: Date;
  scanDuration: number;
  errors: string[];
}

// Emergency alert broadcast result
interface AlertBroadcastResult {
  success: boolean;
  recipientCount: number;
  failedRecipients: string[];
  broadcastId: string;
}
```

### API Interfaces

```typescript
// Device scanning service
interface DeviceScannerService {
  startScanning(): Promise<void>;
  stopScanning(): Promise<void>;
  getCurrentDevices(): NearbyDevice[];
  onDeviceDiscovered: (callback: (device: NearbyDevice) => void) => void;
  onDeviceLost: (callback: (deviceId: string) => void) => void;
}

// Emergency alert service
interface EmergencyAlertService {
  broadcastAlert(alert: EmergencyAlert): Promise<AlertBroadcastResult>;
  subscribeToAlerts(callback: (alert: EmergencyAlert) => void): void;
  getAlertHistory(): EmergencyAlert[];
}

// Vehicle connection service
interface VehicleConnectionService {
  connectToDevice(deviceId: string): Promise<boolean>;
  getConnectionStatus(): ConnectionStatus;
  onConnectionStateChange: (callback: (state: ConnectionStatus) => void) => void;
}
```

## Error Handling

### Error Categories
1. **Network Errors**: Device scanning failures, connection timeouts
2. **Hardware Errors**: GPS unavailable, communication hardware issues
3. **User Errors**: Invalid settings, connection to unavailable devices
4. **System Errors**: Memory issues, unexpected crashes

### Error Handling Strategy
- **Toast Notifications**: For non-critical errors and user feedback
- **Error Boundaries**: Catch and handle component-level errors
- **Retry Mechanisms**: Automatic retry for network operations
- **Graceful Degradation**: Fallback modes when features are unavailable
- **Error Logging**: Comprehensive logging for debugging and monitoring

### Error UI Components
- Error toast messages using existing toast system
- Error states in device list (e.g., "Scanning failed, tap to retry")
- Connection error dialog with retry options
- Settings validation with inline error messages

## Testing Strategy

### Unit Testing
- **Component Testing**: React Testing Library for UI components
- **Hook Testing**: Custom hooks with mock data and scenarios
- **Utility Testing**: Pure functions for calculations and data processing
- **Service Testing**: Mock external dependencies and API calls

### Integration Testing
- **Device Discovery Flow**: End-to-end device scanning and listing
- **Connection Flow**: Complete connection process to nearby devices
- **Emergency Alert Flow**: Alert creation, broadcasting, and receiving
- **Settings Persistence**: Save/load settings across sessions

### E2E Testing
- **Dashboard Navigation**: Complete user journey through main features
- **Cross-Device Communication**: Multi-device testing scenarios
- **Error Recovery**: Testing error states and recovery mechanisms
- **Performance Testing**: Response times and resource usage

### Test Data and Mocks
```typescript
// Mock nearby devices for testing
const mockNearbyDevices: NearbyDevice[] = [
  {
    id: 'vehicle-001',
    name: 'Emergency Vehicle Alpha',
    distance: 150,
    signalStrength: 85,
    lastSeen: new Date(),
    deviceType: 'emergency',
    isConnectable: true
  },
  {
    id: 'vehicle-002', 
    name: 'Civilian Vehicle Beta',
    distance: 300,
    signalStrength: 72,
    lastSeen: new Date(),
    deviceType: 'vehicle',
    isConnectable: true
  }
];

// Mock vehicle status for testing
const mockVehicleStatus: VehicleStatus = {
  isOnline: true,
  lastConnected: new Date(),
  vehicleId: 'my-vehicle-123',
  signalStrength: 90,
  batteryLevel: 85,
  gpsStatus: 'locked'
};
```

## Performance Considerations

### Optimization Strategies
- **Device Scanning**: Throttled scanning to prevent battery drain
- **List Virtualization**: For large numbers of nearby devices
- **Memoization**: React.memo for expensive component renders
- **Debounced Updates**: Prevent excessive re-renders during rapid state changes
- **Lazy Loading**: Load settings and non-critical features on demand

### Resource Management
- **Memory Usage**: Cleanup intervals and device list size limits
- **Battery Optimization**: Configurable scan intervals and sleep modes
- **Network Usage**: Efficient data structures and compression
- **CPU Usage**: Optimized distance calculations and sorting algorithms

### Monitoring and Metrics
- Device discovery success rates
- Connection establishment times
- Emergency alert delivery rates
- User interaction patterns and feature usage