# V2V Dashboard User Guide

## Overview

The V2V (Vehicle-to-Vehicle) Dashboard is the main interface for vehicle communication and emergency management. This guide covers all features and functionality available to drivers.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Vehicle Status Monitoring](#vehicle-status-monitoring)
3. [Nearby Device Discovery](#nearby-device-discovery)
4. [Emergency Alert System](#emergency-alert-system)
5. [Settings and Configuration](#settings-and-configuration)
6. [Performance Optimization](#performance-optimization)
7. [Troubleshooting](#troubleshooting)

## Getting Started

### Dashboard Layout

The V2V Dashboard consists of four main sections:

- **Vehicle Status Card**: Shows your vehicle's connectivity and system status
- **Nearby Vehicles List**: Displays discoverable vehicles within 500 meters
- **Emergency Alert Panel**: Manages emergency communications
- **Settings Panel**: Configures communication preferences

### Initial Setup

1. **Vehicle Connection**: Ensure your vehicle's V2V system is powered on
2. **GPS Lock**: Wait for GPS to acquire a lock (indicated by green GPS status)
3. **Device Scanning**: The system automatically starts scanning for nearby vehicles
4. **Network Connection**: Verify online status in the Vehicle Status card

## Vehicle Status Monitoring

### Status Indicators

#### Online/Offline Status
- **Green "Online"**: Vehicle is connected and ready for communication
- **Red "Offline"**: Vehicle is disconnected or experiencing connectivity issues

#### Signal Strength
- **Green (70-100%)**: Excellent signal quality
- **Yellow (40-69%)**: Good signal quality
- **Red (0-39%)**: Poor signal quality

#### Battery Level
- **Green (>20%)**: Normal battery level
- **Red (≤20%)**: Low battery - system will optimize performance automatically

#### GPS Status
- **GPS Locked**: Accurate location available
- **GPS Searching**: Acquiring satellite lock
- **GPS Offline**: Location services unavailable

### Vehicle Information
- **Vehicle ID**: Your unique vehicle identifier
- **Last Connected**: Timestamp of last successful connection

## Nearby Device Discovery

### Device Scanning

The system continuously scans for nearby vehicles within a 500-meter range. Scanning intervals are automatically optimized based on:
- Battery level (longer intervals when battery is low)
- Number of detected devices (adaptive intervals for performance)
- System load (throttled updates during high activity)

### Device Information

For each detected vehicle, you'll see:
- **Device Name**: Identifier or type (e.g., "Ambulance Unit 42")
- **Distance**: Distance in meters from your vehicle
- **Signal Strength**: Connection quality percentage
- **Device Type**: Vehicle category (Emergency, Vehicle, Infrastructure)
- **Last Seen**: Time since last detection
- **Connection Status**: Available for connection or busy

### Device Types

- **Emergency Vehicles**: Ambulances, fire trucks, police (red icon)
- **Civilian Vehicles**: Regular passenger vehicles (car icon)
- **Infrastructure**: Traffic systems, road sensors (building icon)

### Connecting to Devices

1. **Select Device**: Click on a vehicle in the nearby devices list
2. **Connect**: Click the "Connect" button (only available for connectable devices)
3. **Connection Process**: Wait for connection establishment
4. **Navigation**: Successful connections navigate to the detailed communication interface

### Scan Controls

- **Stop Scanning**: Temporarily pause device discovery to save battery
- **Start Scanning**: Resume device discovery
- **Auto-Refresh**: Devices are automatically updated every 5-8 seconds

## Emergency Alert System

### Alert Types

#### Medical Emergency
- **Priority**: High
- **Use Case**: Medical emergencies requiring immediate assistance
- **Color**: Red
- **Auto-Expiry**: 5 minutes

#### Vehicle Accident
- **Priority**: High
- **Use Case**: Traffic accidents, collisions
- **Color**: Orange
- **Auto-Expiry**: 5 minutes

#### Vehicle Breakdown
- **Priority**: Medium
- **Use Case**: Mechanical failures, disabled vehicles
- **Color**: Yellow
- **Auto-Expiry**: 5 minutes

#### Road Hazard
- **Priority**: Medium
- **Use Case**: Debris, weather conditions, road damage
- **Color**: Blue
- **Auto-Expiry**: 5 minutes

### Sending Emergency Alerts

#### Method 1: Main Emergency Button
1. **Select Alert Type**: Choose from Medical, Accident, Breakdown, or Hazard
2. **Emergency Button**: Click the large red "Send Emergency Alert" button
3. **Confirmation**: System displays confirmation with timestamp
4. **Broadcast**: Alert is sent to all nearby vehicles within 500 meters

#### Method 2: Quick Send Buttons
1. **Direct Selection**: Click any of the quick-send buttons (Medical Emergency, Accident, etc.)
2. **Immediate Broadcast**: Alert is sent instantly without additional confirmation

### Receiving Emergency Alerts

- **Visual Notification**: Prominent alert display with type and sender information
- **Priority Sorting**: Medical alerts are prioritized over other types
- **Distance Information**: Shows distance to the alerting vehicle
- **Auto-Expiry**: Alerts automatically expire after 5 minutes

### Alert History

- **View History**: Click "Show History" to see sent and received alerts
- **Alert Details**: Each entry shows type, message, timestamp, and priority
- **Priority Indicators**: Color-coded badges (HIGH, MEDIUM, LOW)
- **Time Display**: Relative time (e.g., "2m ago", "1h ago")

## Settings and Configuration

### Communication Settings

#### Channel Selection
- **Manual Channel**: Select specific communication channel (1-10)
- **Auto-Channel**: Enable automatic channel selection for optimal quality
- **Channel Quality**: Real-time signal quality indicators

#### Voice Communication
- **Quality Threshold**: Minimum acceptable voice quality (0-100%)
- **Noise Reduction**: Enable/disable background noise filtering

### Alert Preferences

#### Notification Settings
- **Sound Alerts**: Enable/disable audio notifications
- **Vibration**: Enable/disable haptic feedback
- **Display Brightness**: Adjust screen brightness (0-100%)

#### Alert Filtering
- **Alert Types**: Choose which alert types to receive
- **Distance Filter**: Set maximum distance for alert reception
- **Priority Filter**: Minimum priority level for notifications

### Discovery Settings

#### Scan Configuration
- **Scan Interval**: Time between device scans (3-10 seconds)
- **Maximum Range**: Detection range limit (100-500 meters)
- **Device Filters**: Filter by device type (Emergency, Vehicle, Infrastructure)

#### Performance Settings
- **Battery Optimization**: Enable adaptive scanning for battery conservation
- **Update Frequency**: How often the display refreshes (500ms-2s)
- **Memory Management**: Automatic cleanup of old device data

### Settings Management

- **Save Settings**: Changes are automatically saved
- **Reset to Defaults**: Restore factory settings
- **Export Settings**: Create backup file for settings
- **Import Settings**: Restore from backup file

## Performance Optimization

### Battery Conservation

The system automatically optimizes performance based on battery level:

#### High Battery (>50%)
- **Scan Interval**: 5 seconds
- **Update Frequency**: 500ms
- **Full Feature Set**: All features enabled

#### Medium Battery (20-50%)
- **Scan Interval**: 7 seconds
- **Update Frequency**: 1 second
- **Reduced Animations**: Minimized visual effects

#### Low Battery (<20%)
- **Scan Interval**: 10 seconds
- **Update Frequency**: 2 seconds
- **Essential Features Only**: Emergency alerts and basic connectivity

### Performance Monitoring

The system continuously monitors performance metrics:
- **Response Times**: Component render and update speeds
- **Memory Usage**: Automatic cleanup of unused data
- **Network Efficiency**: Optimized message broadcasting
- **Battery Impact**: Adaptive feature scaling

### Optimization Features

#### Device List Virtualization
- Large device lists are virtualized for smooth scrolling
- Only visible items are rendered to improve performance
- Automatic memory management for device data

#### Debounced Updates
- Rapid state changes are debounced to prevent excessive re-renders
- WebSocket messages are throttled to reduce network load
- User interactions are optimized for responsiveness

#### React.memo Optimization
- Components are memoized to prevent unnecessary re-renders
- Expensive calculations are cached and reused
- State updates are batched for efficiency

## Troubleshooting

### Common Issues

#### "No nearby vehicles found"
**Possible Causes:**
- No vehicles in range (500m limit)
- GPS not locked
- Scanner hardware issues
- Network connectivity problems

**Solutions:**
1. Verify GPS status is "Locked"
2. Check vehicle online status
3. Try stopping and restarting scan
4. Move to area with more traffic

#### "Failed to send emergency alert"
**Possible Causes:**
- Network connectivity issues
- No nearby vehicles to receive alert
- System overload

**Solutions:**
1. Check online status
2. Verify nearby vehicles are present
3. Try again after a few seconds
4. Use quick-send buttons as alternative

#### "Connection failed"
**Possible Causes:**
- Target vehicle moved out of range
- Target vehicle is busy/unavailable
- Network interference
- System compatibility issues

**Solutions:**
1. Verify target vehicle is still in range
2. Check signal strength
3. Try connecting to different vehicle
4. Wait and retry connection

#### Poor performance with many devices
**Possible Causes:**
- System overload from too many nearby devices
- Low battery triggering power-saving mode
- Memory constraints

**Solutions:**
1. System automatically adapts scan intervals
2. Use device filters to reduce list size
3. Enable battery optimization
4. Restart application if needed

### Performance Issues

#### Slow device list updates
- Check battery level (low battery triggers longer intervals)
- Verify scan interval settings
- Consider reducing maximum range

#### Delayed emergency alerts
- Check network connectivity
- Verify nearby vehicles are present
- Try quick-send buttons for faster transmission

#### High battery usage
- Enable battery optimization in settings
- Reduce scan frequency
- Lower display brightness
- Disable unnecessary alert types

### Error Recovery

The system includes automatic error recovery:
- **Connection Timeouts**: Automatic retry with exponential backoff
- **Network Errors**: Graceful degradation and reconnection
- **Memory Issues**: Automatic cleanup and optimization
- **Hardware Failures**: Fallback modes and user notifications

### Getting Help

If issues persist:
1. Check system status indicators
2. Review settings configuration
3. Restart the V2V system
4. Contact technical support with error details

## Advanced Features

### Real-time Updates

The dashboard provides real-time updates for:
- Vehicle status changes
- New device discoveries
- Incoming emergency alerts
- Connection state changes

### WebSocket Integration

- Persistent connection for real-time communication
- Automatic reconnection on network issues
- Message queuing during disconnections
- Optimized bandwidth usage

### Error Boundaries

- Graceful error handling prevents system crashes
- User-friendly error messages
- Automatic error reporting
- Recovery suggestions

## Best Practices

### Safety Guidelines

1. **Emergency Use**: Only use emergency alerts for genuine emergencies
2. **Distraction Prevention**: Minimize interaction while driving
3. **Battery Management**: Monitor battery levels during long trips
4. **Privacy**: Be aware that your vehicle ID is visible to nearby vehicles

### Performance Tips

1. **Regular Updates**: Keep the system updated for optimal performance
2. **Settings Optimization**: Adjust settings based on typical usage patterns
3. **Battery Conservation**: Enable power-saving features for long trips
4. **Network Management**: Ensure stable connectivity for best experience

### Maintenance

1. **Regular Restarts**: Restart the system periodically to clear memory
2. **Settings Backup**: Export settings before major updates
3. **Performance Monitoring**: Check system performance metrics regularly
4. **Error Logs**: Review error logs for recurring issues

## Conclusion

The V2V Dashboard provides comprehensive vehicle communication capabilities with automatic performance optimization. The system is designed to be intuitive while providing advanced features for power users. Regular use of the troubleshooting guide and best practices will ensure optimal performance and safety.

For technical support or feature requests, please contact the development team with detailed information about your use case and any error messages encountered.