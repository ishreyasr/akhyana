// Distance calculation utilities for V2V communication

export interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * Calculate distance between two GPS coordinates using Haversine formula
 * @param coord1 First coordinate
 * @param coord2 Second coordinate
 * @returns Distance in meters
 */
export function calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
  const R = 6371000; // Earth's radius in meters
  const φ1 = coord1.lat * Math.PI / 180;
  const φ2 = coord2.lat * Math.PI / 180;
  const Δφ = (coord2.lat - coord1.lat) * Math.PI / 180;
  const Δλ = (coord2.lng - coord1.lng) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}

/**
 * Check if a device is within the specified range
 * @param deviceCoord Device coordinates
 * @param vehicleCoord Vehicle coordinates
 * @param maxRange Maximum range in meters
 * @returns True if device is within range
 */
export function isWithinRange(
  deviceCoord: Coordinates,
  vehicleCoord: Coordinates,
  maxRange: number
): boolean {
  const distance = calculateDistance(deviceCoord, vehicleCoord);
  return distance <= maxRange;
}

/**
 * Sort devices by distance from vehicle
 * @param devices Array of devices with coordinates
 * @param vehicleCoord Vehicle coordinates
 * @returns Sorted array of devices (closest first)
 */
export function sortDevicesByDistance<T extends { location: Coordinates; distance: number }>(
  devices: T[],
  vehicleCoord: Coordinates
): T[] {
  return devices
    .map(device => ({
      ...device,
      distance: calculateDistance(device.location, vehicleCoord)
    }))
    .sort((a, b) => a.distance - b.distance);
}