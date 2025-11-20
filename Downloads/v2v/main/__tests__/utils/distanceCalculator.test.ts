// Unit tests for distance calculation utilities

import { calculateDistance, isWithinRange, sortDevicesByDistance } from '../../utils/distanceCalculator';

describe('distanceCalculator', () => {
  describe('calculateDistance', () => {
    it('should calculate distance between two coordinates correctly', () => {
      const coord1 = { lat: 40.7128, lng: -74.0060 }; // New York
      const coord2 = { lat: 40.7589, lng: -73.9851 }; // Times Square
      
      const distance = calculateDistance(coord1, coord2);
      
      // Distance should be approximately 5.8 km
      expect(distance).toBeGreaterThan(5000);
      expect(distance).toBeLessThan(7000);
    });

    it('should return 0 for identical coordinates', () => {
      const coord = { lat: 40.7128, lng: -74.0060 };
      
      const distance = calculateDistance(coord, coord);
      
      expect(distance).toBe(0);
    });

    it('should handle negative coordinates', () => {
      const coord1 = { lat: -33.8688, lng: 151.2093 }; // Sydney
      const coord2 = { lat: -37.8136, lng: 144.9631 }; // Melbourne
      
      const distance = calculateDistance(coord1, coord2);
      
      // Distance should be approximately 714 km
      expect(distance).toBeGreaterThan(700000);
      expect(distance).toBeLessThan(800000);
    });
  });

  describe('isWithinRange', () => {
    it('should return true when device is within range', () => {
      const vehicleCoord = { lat: 40.7128, lng: -74.0060 };
      const deviceCoord = { lat: 40.7130, lng: -74.0058 }; // Very close
      
      const result = isWithinRange(deviceCoord, vehicleCoord, 500);
      
      expect(result).toBe(true);
    });

    it('should return false when device is outside range', () => {
      const vehicleCoord = { lat: 40.7128, lng: -74.0060 };
      const deviceCoord = { lat: 40.7589, lng: -73.9851 }; // Times Square (~5.8km)
      
      const result = isWithinRange(deviceCoord, vehicleCoord, 500);
      
      expect(result).toBe(false);
    });

    it('should handle edge case at exact range limit', () => {
      const vehicleCoord = { lat: 40.7128, lng: -74.0060 };
      const deviceCoord = { lat: 40.7128, lng: -74.0060 }; // Same location
      
      const result = isWithinRange(deviceCoord, vehicleCoord, 0);
      
      expect(result).toBe(true);
    });
  });

  describe('sortDevicesByDistance', () => {
    it('should sort devices by distance from vehicle', () => {
      const vehicleCoord = { lat: 40.7128, lng: -74.0060 };
      const devices = [
        {
          id: 'device1',
          location: { lat: 40.7589, lng: -73.9851 }, // Far
          distance: 0
        },
        {
          id: 'device2',
          location: { lat: 40.7130, lng: -74.0058 }, // Close
          distance: 0
        },
        {
          id: 'device3',
          location: { lat: 40.7200, lng: -74.0100 }, // Medium
          distance: 0
        }
      ];

      const sorted = sortDevicesByDistance(devices, vehicleCoord);

      expect(sorted[0].id).toBe('device2'); // Closest
      expect(sorted[2].id).toBe('device1'); // Farthest
      expect(sorted[0].distance).toBeLessThan(sorted[1].distance);
      expect(sorted[1].distance).toBeLessThan(sorted[2].distance);
    });

    it('should handle empty device array', () => {
      const vehicleCoord = { lat: 40.7128, lng: -74.0060 };
      const devices: any[] = [];

      const sorted = sortDevicesByDistance(devices, vehicleCoord);

      expect(sorted).toEqual([]);
    });

    it('should handle single device', () => {
      const vehicleCoord = { lat: 40.7128, lng: -74.0060 };
      const devices = [
        {
          id: 'device1',
          location: { lat: 40.7130, lng: -74.0058 },
          distance: 0
        }
      ];

      const sorted = sortDevicesByDistance(devices, vehicleCoord);

      expect(sorted).toHaveLength(1);
      expect(sorted[0].id).toBe('device1');
      expect(sorted[0].distance).toBeGreaterThan(0);
    });
  });
});