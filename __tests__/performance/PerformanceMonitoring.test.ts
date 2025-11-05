import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PerformanceMonitor, BatteryOptimizer, debounce, throttle } from '@/utils/debounce';

describe('Performance Monitoring', () => {
  beforeEach(() => {
    PerformanceMonitor.reset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('PerformanceMonitor', () => {
    it('measures operation duration correctly', () => {
      const endMeasurement = PerformanceMonitor.startMeasurement('test-operation');
      
      // Simulate some work
      vi.advanceTimersByTime(100);
      
      endMeasurement();
      
      const stats = PerformanceMonitor.getStats('test-operation');
      expect(stats.count).toBe(1);
      expect(stats.average).toBeGreaterThan(0);
    });

    it('tracks multiple measurements', () => {
      // Perform multiple measurements
      for (let i = 0; i < 5; i++) {
        const endMeasurement = PerformanceMonitor.startMeasurement('multi-test');
        vi.advanceTimersByTime(50 + i * 10); // Varying durations
        endMeasurement();
      }
      
      const stats = PerformanceMonitor.getStats('multi-test');
      expect(stats.count).toBe(5);
      expect(stats.average).toBeGreaterThan(0);
      expect(stats.min).toBeLessThanOrEqual(stats.max);
    });

    it('warns about slow operations', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const endMeasurement = PerformanceMonitor.startMeasurement('slow-operation');
      vi.advanceTimersByTime(150); // Slow operation (>100ms)
      endMeasurement();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Slow operation detected: slow-operation')
      );
      
      consoleSpy.mockRestore();
    });

    it('limits measurement history to 100 entries', () => {
      // Add more than 100 measurements
      for (let i = 0; i < 150; i++) {
        const endMeasurement = PerformanceMonitor.startMeasurement('limit-test');
        vi.advanceTimersByTime(10);
        endMeasurement();
      }
      
      const stats = PerformanceMonitor.getStats('limit-test');
      expect(stats.count).toBe(100); // Should be limited to 100
    });

    it('calculates percentiles correctly', () => {
      // Add measurements with known values
      const durations = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      
      durations.forEach(duration => {
        const endMeasurement = PerformanceMonitor.startMeasurement('percentile-test');
        vi.advanceTimersByTime(duration);
        endMeasurement();
      });
      
      const stats = PerformanceMonitor.getStats('percentile-test');
      expect(stats.p95).toBeGreaterThan(stats.average);
      expect(stats.min).toBeLessThan(stats.max);
    });

    it('provides comprehensive stats for all measurements', () => {
      PerformanceMonitor.startMeasurement('test-1')();
      PerformanceMonitor.startMeasurement('test-2')();
      
      const allStats = PerformanceMonitor.getAllStats();
      expect(allStats).toHaveProperty('test-1');
      expect(allStats).toHaveProperty('test-2');
    });

    it('resets measurements correctly', () => {
      PerformanceMonitor.startMeasurement('reset-test')();
      
      let stats = PerformanceMonitor.getStats('reset-test');
      expect(stats.count).toBe(1);
      
      PerformanceMonitor.reset('reset-test');
      
      stats = PerformanceMonitor.getStats('reset-test');
      expect(stats.count).toBe(0);
    });
  });

  describe('BatteryOptimizer', () => {
    it('provides optimal scan intervals based on battery level', () => {
      // Test different battery levels
      const intervals = {
        high: BatteryOptimizer.getOptimalScanInterval(),
        // We can't easily mock the battery API in tests, so we test the default behavior
      };
      
      expect(intervals.high).toBeGreaterThan(0);
    });

    it('provides optimal update frequencies', () => {
      const frequency = BatteryOptimizer.getOptimalUpdateFrequency();
      expect(frequency).toBeGreaterThan(0);
    });

    it('detects low power mode correctly', () => {
      const isLowPower = BatteryOptimizer.isLowPower();
      expect(typeof isLowPower).toBe('boolean');
    });

    it('returns battery level', () => {
      const batteryLevel = BatteryOptimizer.getBatteryLevel();
      expect(batteryLevel).toBeGreaterThanOrEqual(0);
      expect(batteryLevel).toBeLessThanOrEqual(1);
    });
  });

  describe('Debounce Utility', () => {
    it('debounces function calls correctly', () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 100);
      
      // Call multiple times rapidly
      debouncedFn('arg1');
      debouncedFn('arg2');
      debouncedFn('arg3');
      
      // Should not be called yet
      expect(mockFn).not.toHaveBeenCalled();
      
      // Fast-forward time
      vi.advanceTimersByTime(100);
      
      // Should be called once with the last arguments
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('arg3');
    });

    it('handles immediate execution option', () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 100, true);
      
      debouncedFn('immediate');
      
      // Should be called immediately
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('immediate');
    });

    it('resets debounce timer on subsequent calls', () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 100);
      
      debouncedFn('first');
      vi.advanceTimersByTime(50);
      
      debouncedFn('second');
      vi.advanceTimersByTime(50);
      
      // Should not be called yet (timer was reset)
      expect(mockFn).not.toHaveBeenCalled();
      
      vi.advanceTimersByTime(50);
      
      // Now should be called
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('second');
    });
  });

  describe('Throttle Utility', () => {
    it('throttles function calls correctly', () => {
      const mockFn = vi.fn();
      const throttledFn = throttle(mockFn, 100);
      
      // Call multiple times rapidly
      throttledFn('call1');
      throttledFn('call2');
      throttledFn('call3');
      
      // Should be called once immediately
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('call1');
      
      // Fast-forward time
      vi.advanceTimersByTime(100);
      
      // Should allow next call
      throttledFn('call4');
      expect(mockFn).toHaveBeenCalledTimes(2);
      expect(mockFn).toHaveBeenCalledWith('call4');
    });

    it('maintains throttle limit correctly', () => {
      const mockFn = vi.fn();
      const throttledFn = throttle(mockFn, 100);
      
      // Call at different intervals
      throttledFn('1');
      expect(mockFn).toHaveBeenCalledTimes(1);
      
      vi.advanceTimersByTime(50);
      throttledFn('2'); // Should be ignored (within throttle period)
      expect(mockFn).toHaveBeenCalledTimes(1);
      
      vi.advanceTimersByTime(60); // Total 110ms
      throttledFn('3'); // Should be allowed
      expect(mockFn).toHaveBeenCalledTimes(2);
    });
  });
});

describe('Performance Integration Tests', () => {
  beforeEach(() => {
    PerformanceMonitor.reset();
  });

  it('measures real component render performance', () => {
    // Simulate component render measurement
    const endMeasurement = PerformanceMonitor.startMeasurement('component-render');
    
    // Simulate React component work
    const mockWork = () => {
      let sum = 0;
      for (let i = 0; i < 1000; i++) {
        sum += i;
      }
      return sum;
    };
    
    mockWork();
    endMeasurement();
    
    const stats = PerformanceMonitor.getStats('component-render');
    expect(stats.count).toBe(1);
    expect(stats.average).toBeGreaterThan(0);
  });

  it('tracks device scanning performance', () => {
    // Simulate device scanning operations
    for (let i = 0; i < 10; i++) {
      const endMeasurement = PerformanceMonitor.startMeasurement('device-scan');
      
      // Simulate scanning work
      setTimeout(() => {
        endMeasurement();
      }, Math.random() * 50);
    }
    
    const stats = PerformanceMonitor.getStats('device-scan');
    expect(stats.count).toBe(10);
  });

  it('monitors WebSocket message processing', () => {
    const messages = [
      { type: 'device_discovered', payload: { id: '1' } },
      { type: 'emergency_alert', payload: { type: 'accident' } },
      { type: 'status_update', payload: { isOnline: true } }
    ];
    
    messages.forEach((message, index) => {
      const endMeasurement = PerformanceMonitor.startMeasurement('websocket-message');
      
      // Simulate message processing
      JSON.stringify(message);
      JSON.parse(JSON.stringify(message));
      
      endMeasurement();
    });
    
    const stats = PerformanceMonitor.getStats('websocket-message');
    expect(stats.count).toBe(3);
  });

  it('provides performance summary for dashboard operations', () => {
    // Simulate various dashboard operations
    const operations = [
      'device-list-update',
      'emergency-alert-broadcast',
      'settings-save',
      'connection-attempt'
    ];
    
    operations.forEach(operation => {
      for (let i = 0; i < 5; i++) {
        const endMeasurement = PerformanceMonitor.startMeasurement(operation);
        // Simulate work
        setTimeout(() => endMeasurement(), Math.random() * 20);
      }
    });
    
    const allStats = PerformanceMonitor.getAllStats();
    operations.forEach(operation => {
      expect(allStats).toHaveProperty(operation);
      expect(allStats[operation].count).toBe(5);
    });
  });
});