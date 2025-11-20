# V2V Dashboard Component Documentation

## Overview

This document provides comprehensive documentation for all components in the V2V Dashboard system, including their APIs, performance characteristics, and usage patterns.

## Table of Contents

1. [Core Components](#core-components)
2. [Hook Components](#hook-components)
3. [Utility Components](#utility-components)
4. [Performance Optimizations](#performance-optimizations)
5. [Testing Strategy](#testing-strategy)

## Core Components

### V2VMainDashboard

**File**: `components/v2v-dashboard/V2VMainDashboard.tsx`

The main dashboard component that orchestrates all V2V functionality.

#### Props
```typescript
interface V2VMainDashboardProps {
  className?: string;
  onDeviceConnect?: (device: NearbyDevice) => void;
}
```

#### Features
- Responsive grid layout
- Error boundary integration
- Real-time state management
- Performance monitoring
- Battery optimization

#### Performance Optimizations
- React.memo for preventing unnecessary re-renders
- Lazy loading of non-critical components
- Debounced state updates
- Memory cleanup on unmount

#### Usage Example
```tsx
import { V2VMainDashboard } from '@/components/v2v-dashboard/V2VMainDashboard';

function App() {
  const handleDeviceConnect = (device: NearbyDevice) => {
    // Handle device connection
    console.log('Connecting to:', device.name);
  };

  return (
    <V2VMainDashboard 
      onDeviceConnect={handleDeviceConnect}
      className="dashboard-container"
    />
  );
}
```

### VehicleStatusCard

**File**: `components/v2v-dashboard/VehicleStatusCard.tsx`

Displays current vehicle connectivity and system status.

#### Props
```typescript
// No props - uses useVehicleStatus hook internally
```

#### Features
- Real-time status updates
- Battery level monitoring with color coding
- GPS status with visual indicators
- Signal strength display
- Connection timestamp

#### Performance Optimizations
- React.memo with dependency tracking
- Memoized status calculations
- Optimized re-render conditions
- Cached time formatting

#### Status Indicators
- **Online/Offline**: Connection state with color coding
- **Signal Strength**: Progress bar with percentage
- **Battery Level**: Color-coded progress (red <20%, normal ≥20%)
- **GPS Status**: Icon with animation for searching state

#### Usage Example
```tsx
import { VehicleStatusCard } from '@/components/v2v-dashboard/VehicleStatusCard';

function Dashboard() {
  return (
    <div className="dashboard-grid">
      <VehicleStatusCard />
    </div>
  );
}
```

### NearbyDevicesList

**File**: `components/v2v-dashboard/NearbyDevicesList.tsx`

Manages device discovery and displays nearby vehicles.

#### Props
```typescript
interface NearbyDevicesListProps {
  onDeviceConnect?: (device: NearbyDevice) => void;
}
```

#### Features
- Real-time device discovery
- Distance-based sorting
- Device type categorization
- Connection management
- Adaptive scan intervals
- Battery optimization

#### Performance Optimizations
- Virtualized device list for large datasets
- Memoized DeviceCard components
- Debounced scan operations
- Adaptive refresh intervals based on device count

#### Device Types
- **Emergency**: Ambulances, fire trucks, police
- **Vehicle**: Civilian passenger vehicles
- **Infrastructure**: Traffic systems, road sensors

#### Scan Optimization
```typescript
// Adaptive intervals based on conditions
const getOptimalInterval = (deviceCount: number, batteryLevel: number) => {
  if (batteryLevel < 0.2) return 10000; // Low battery: 10s
  if (deviceCount > 10) return 8000;    // Many devices: 8s
  return 5000;                          // Normal: 5s
};
```

#### Usage Example
```tsx
import { NearbyDevicesList } from '@/components/v2v-dashboard/NearbyDevicesList';

function Dashboard() {
  const handleConnect = (device: NearbyDevice) => {
    // Initiate connection to selected device
    connectionService.connect(device.id);
  };

  return (
    <NearbyDevicesList onDeviceConnect={handleConnect} />
  );
}
```

### EmergencyAlertPanel

**File**: `components/v2v-dashboard/EmergencyAlertPanel.tsx`

Manages emergency alert broadcasting and history.

#### Props
```typescript
// No props - uses useEmergencyAlerts hook internally
```

#### Features
- Multiple alert types (medical, accident, breakdown, hazard)
- Quick-send functionality
- Alert history with priority sorting
- Real-time alert reception
- Auto-expiry after 5 minutes

#### Performance Optimizations
- Memoized alert components
- Debounced broadcast operations
- Optimized alert sorting
- Cached time calculations

#### Alert Types
```typescript
type AlertType = 'medical' | 'accident' | 'breakdown' | 'hazard';

interface AlertConfig {
  type: AlertType;
  label: string;
  icon: React.ComponentType;
  priority: 'high' | 'medium';
  color: string;
}
```

#### Broadcasting Flow
1. User selects alert type
2. System validates selection
3. Alert is broadcast to nearby vehicles
4. Confirmation is displayed
5. Alert is added to history

#### Usage Example
```tsx
import { EmergencyAlertPanel } from '@/components/v2v-dashboard/EmergencyAlertPanel';

function Dashboard() {
  return (
    <div className="emergency-section">
      <EmergencyAlertPanel />
    </div>
  );
}
```

### SettingsPanel

**File**: `components/v2v-dashboard/SettingsPanel.tsx`

Provides configuration interface for V2V system settings.

#### Props
```typescript
interface SettingsPanelProps {
  onSettingsChange?: (settings: V2VSettings) => void;
}
```

#### Features
- Communication channel configuration
- Alert preferences management
- Discovery settings
- Performance optimization controls
- Settings import/export

#### Settings Categories
- **Communication**: Channel selection, voice quality
- **Alerts**: Notification preferences, filtering
- **Discovery**: Scan intervals, range limits
- **Performance**: Battery optimization, update frequency

#### Usage Example
```tsx
import { SettingsPanel } from '@/components/v2v-dashboard/SettingsPanel';

function Dashboard() {
  const handleSettingsChange = (newSettings: V2VSettings) => {
    // Apply new settings
    settingsService.updateSettings(newSettings);
  };

  return (
    <SettingsPanel onSettingsChange={handleSettingsChange} />
  );
}
```

### ConnectionDialog

**File**: `components/v2v-dashboard/ConnectionDialog.tsx`

Modal dialog for managing device connections.

#### Props
```typescript
interface ConnectionDialogProps {
  device: NearbyDevice | null;
  isOpen: boolean;
  onClose: () => void;
  onConnect: (device: NearbyDevice) => Promise<boolean>;
}
```

#### Features
- Connection progress indication
- Device information display
- Error handling and retry
- Cancel functionality

#### Connection States
- **Idle**: No connection attempt
- **Connecting**: Connection in progress
- **Connected**: Successfully connected
- **Error**: Connection failed

#### Usage Example
```tsx
import { ConnectionDialog } from '@/components/v2v-dashboard/ConnectionDialog';

function Dashboard() {
  const [selectedDevice, setSelectedDevice] = useState<NearbyDevice | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleConnect = async (device: NearbyDevice) => {
    try {
      const success = await connectionService.connect(device.id);
      if (success) {
        // Navigate to connected device interface
        router.push('/connected-vehicle');
      }
      return success;
    } catch (error) {
      console.error('Connection failed:', error);
      return false;
    }
  };

  return (
    <ConnectionDialog
      device={selectedDevice}
      isOpen={isDialogOpen}
      onClose={() => setIsDialogOpen(false)}
      onConnect={handleConnect}
    />
  );
}
```

## Hook Components

### useVehicleStatus

**File**: `hooks/useVehicleStatus.ts`

Manages vehicle connectivity and system status.

#### Return Value
```typescript
interface UseVehicleStatusReturn {
  vehicleStatus: VehicleStatus;
  isLoading: boolean;
  error: string | null;
  setOnlineStatus: (isOnline: boolean) => void;
  updateSignalStrength: (strength: number) => void;
  updateGpsStatus: (status: 'locked' | 'searching' | 'offline') => void;
  updateBatteryLevel: (level: number) => void;
  refreshStatus: () => Promise<void>;
}
```

#### Features
- Real-time status monitoring
- WebSocket integration
- Automatic status updates
- Error handling and recovery

#### Performance Optimizations
- Debounced status updates
- Memoized status calculations
- Efficient WebSocket message handling

### useNearbyDevices

**File**: `hooks/useNearbyDevices.ts`

Manages device discovery and scanning operations.

#### Return Value
```typescript
interface UseNearbyDevicesReturn {
  devices: NearbyDevice[];
  isScanning: boolean;
  error: string | null;
  lastScanTime: Date | null;
  scanInterval: number;
  startScanning: (intervalMs?: number) => Promise<void>;
  stopScanning: () => Promise<void>;
  refreshDevices: () => void;
  updateScanInterval: (intervalMs: number) => Promise<void>;
  getDevicesByType: (type: DeviceType) => NearbyDevice[];
  getConnectableDevices: () => NearbyDevice[];
  getDeviceById: (id: string) => NearbyDevice | undefined;
  getDevicesInRange: (maxDistance: number) => NearbyDevice[];
}
```

#### Features
- Adaptive scan intervals
- Battery optimization
- Device filtering and sorting
- Real-time updates via WebSocket

#### Performance Optimizations
- Debounced device updates
- Throttled WebSocket broadcasts
- Memory-efficient device storage
- Automatic cleanup of stale devices

### useEmergencyAlerts

**File**: `hooks/useEmergencyAlerts.ts`

Manages emergency alert broadcasting and reception.

#### Return Value
```typescript
interface UseEmergencyAlertsReturn {
  alerts: EmergencyAlert[];
  activeAlerts: EmergencyAlert[];
  isBroadcasting: boolean;
  error: string | null;
  broadcastAlert: (alert: Omit<EmergencyAlert, 'id' | 'timestamp'>) => Promise<AlertBroadcastResult | null>;
  broadcastQuickAlert: (type: AlertType, location: Location, senderId: string) => Promise<AlertBroadcastResult | null>;
  refreshAlerts: () => void;
  clearExpiredAlerts: () => void;
  getAlertsByType: (type: AlertType) => EmergencyAlert[];
  getAlertsBySeverity: (severity: AlertSeverity) => EmergencyAlert[];
  getPrioritizedAlerts: () => EmergencyAlert[];
}
```

#### Features
- Multiple alert types
- Priority-based sorting
- Automatic expiry (5 minutes)
- Real-time alert reception

### useV2VSettings

**File**: `hooks/useV2VSettings.ts`

Manages V2V system configuration and preferences.

#### Return Value
```typescript
interface UseV2VSettingsReturn {
  settings: V2VSettings;
  isLoading: boolean;
  error: string | null;
  updateSettings: (newSettings: Partial<V2VSettings>) => Promise<void>;
  resetSettings: () => Promise<void>;
  exportSettings: () => string;
  importSettings: (settingsJson: string) => Promise<boolean>;
}
```

#### Features
- Persistent settings storage
- Settings validation
- Import/export functionality
- Real-time settings application

### useConnection

**File**: `hooks/useConnection.ts`

Manages device connection state and operations.

#### Return Value
```typescript
interface UseConnectionReturn {
  isConnected: boolean;
  isConnecting: boolean;
  connectedDevice: NearbyDevice | null;
  connectionError: string | null;
  connect: (device: NearbyDevice) => Promise<boolean>;
  disconnect: () => Promise<void>;
  getConnectionStatus: () => ConnectionStatus;
}
```

#### Features
- Connection state management
- Error handling and retry logic
- Connection timeout handling
- Automatic reconnection

## Utility Components

### Performance Monitoring

**File**: `utils/debounce.ts`

Provides performance monitoring and optimization utilities.

#### PerformanceMonitor Class
```typescript
class PerformanceMonitor {
  static startMeasurement(name: string): () => void;
  static getAverageTime(name: string): number;
  static getStats(name: string): PerformanceStats;
  static getAllStats(): Record<string, PerformanceStats>;
  static reset(name?: string): void;
}
```

#### Features
- Operation timing measurement
- Performance statistics
- Slow operation detection
- Memory usage tracking

#### Usage Example
```typescript
const endMeasurement = PerformanceMonitor.startMeasurement('device-scan');
// Perform operation
await deviceScanner.scan();
endMeasurement();

// Get statistics
const stats = PerformanceMonitor.getStats('device-scan');
console.log(`Average scan time: ${stats.average}ms`);
```

### Battery Optimization

**File**: `utils/debounce.ts`

Provides battery-aware performance optimization.

#### BatteryOptimizer Class
```typescript
class BatteryOptimizer {
  static isLowPower(): boolean;
  static getBatteryLevel(): number;
  static getOptimalScanInterval(): number;
  static getOptimalUpdateFrequency(): number;
}
```

#### Features
- Battery level monitoring
- Adaptive performance scaling
- Power-aware feature toggling
- Automatic optimization

### Debounce and Throttle

**File**: `utils/debounce.ts`

Provides function execution control utilities.

#### Functions
```typescript
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate?: boolean
): (...args: Parameters<T>) => void;

function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void;
```

#### Usage Examples
```typescript
// Debounce device updates
const debouncedUpdate = debounce((devices: NearbyDevice[]) => {
  setDevices(devices);
}, 500);

// Throttle WebSocket messages
const throttledBroadcast = throttle((message: any) => {
  webSocket.send(JSON.stringify(message));
}, 1000);
```

## Performance Optimizations

### React.memo Usage

All major components use React.memo to prevent unnecessary re-renders:

```typescript
export const VehicleStatusCard = memo(function VehicleStatusCard() {
  // Component implementation
});

export const NearbyDevicesList = memo(function NearbyDevicesList({ onDeviceConnect }) {
  // Component implementation
});
```

### Memoized Calculations

Expensive calculations are memoized using useMemo:

```typescript
const sortedDevices = useMemo(() => {
  return [...devices].sort((a, b) => a.distance - b.distance);
}, [devices]);

const formattedTime = useMemo(() => {
  return timestamp.toLocaleTimeString();
}, [timestamp]);
```

### Debounced Updates

State updates are debounced to prevent excessive re-renders:

```typescript
const debouncedSetDevices = useCallback(
  debounce((newDevices: NearbyDevice[]) => {
    setDevices(newDevices);
  }, BatteryOptimizer.getOptimalUpdateFrequency()),
  []
);
```

### WebSocket Optimization

WebSocket messages are throttled and queued:

```typescript
// Debounced broadcast methods
private debouncedBroadcastDeviceDiscovery = debounce((device: NearbyDevice) => {
  this.sendMessage('device_discovered', device);
}, 200);

// Message queuing during disconnections
private messageQueue: Array<{ type: string; payload: any }> = [];
```

### Memory Management

Automatic cleanup and memory optimization:

```typescript
useEffect(() => {
  return () => {
    // Cleanup WebSocket connections
    webSocketService.disconnect();
    
    // Clear intervals and timeouts
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    // Reset performance measurements
    PerformanceMonitor.reset();
  };
}, []);
```

## Testing Strategy

### Unit Tests

Each component has comprehensive unit tests covering:
- Rendering with different props
- User interactions
- State changes
- Error conditions
- Performance characteristics

### Integration Tests

Integration tests cover complete workflows:
- Emergency alert broadcasting
- Device discovery and connection
- Settings management
- Real-time updates

### E2E Tests

End-to-end tests validate critical user journeys:
- Complete emergency alert workflow
- Device connection process
- Settings configuration
- Performance under load

### Performance Tests

Performance tests monitor:
- Component render times
- Memory usage patterns
- Battery optimization effectiveness
- WebSocket message throughput

### Test Coverage

Target coverage metrics:
- **Unit Tests**: >90% line coverage
- **Integration Tests**: All major workflows
- **E2E Tests**: Critical user paths
- **Performance Tests**: Key performance metrics

## Best Practices

### Component Design

1. **Single Responsibility**: Each component has a clear, focused purpose
2. **Prop Validation**: TypeScript interfaces for all props
3. **Error Boundaries**: Graceful error handling
4. **Performance**: Memoization and optimization by default

### State Management

1. **Local State**: Use useState for component-specific state
2. **Shared State**: Custom hooks for cross-component state
3. **Persistence**: localStorage for user preferences
4. **Real-time**: WebSocket for live updates

### Performance

1. **Memoization**: React.memo for components, useMemo for calculations
2. **Debouncing**: Throttle rapid state changes
3. **Virtualization**: Large lists use virtual scrolling
4. **Battery Awareness**: Adaptive performance based on battery level

### Testing

1. **Test-Driven**: Write tests before implementation
2. **Comprehensive Coverage**: Unit, integration, and E2E tests
3. **Performance Monitoring**: Continuous performance measurement
4. **Error Scenarios**: Test error conditions and recovery

## Conclusion

The V2V Dashboard component system is designed for performance, reliability, and maintainability. Each component is optimized for its specific use case while maintaining consistency across the system. The comprehensive testing strategy ensures reliability and performance under various conditions.

For questions or contributions, please refer to the development guidelines and testing documentation.