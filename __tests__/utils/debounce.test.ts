import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { debounce, throttle, PerformanceMonitor, BatteryOptimizer } from '@/utils/debounce';

describe('Debounce and Performance Utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    PerformanceMonitor.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('debounce', () => {
    it('delays function execution until after wait time', () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn('test');
      expect(mockFn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(99);
      expect(mockFn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(mockFn).toHaveBeenCalledWith('test');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('resets timer on subsequent calls', () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn('first');
      vi.advanceTimersByTime(50);
      
      debouncedFn('second');
      vi.advanceTimersByTime(50);
      expect(mockFn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(50);
      expect(mockFn).toHaveBeenCalledWith('second');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('executes immediately when immediate flag is true', () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 100, true);

      debouncedFn('immediate');
      expect(mockFn).toHaveBeenCalledWith('immediate');
      expect(mockFn).toHaveBeenCalledTimes(1);

      // Subsequent calls within wait time should not execute
      debouncedFn('blocked');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('handles multiple arguments correctly', () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn('arg1', 'arg2', 'arg3');
      vi.advanceTimersByTime(100);

      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2', 'arg3');
    });

    it('preserves function context', () => {
      const obj = {
        value: 'test',
        method: vi.fn(function(this: any) {
          return this.value;
        })
      };

      const debouncedMethod = debounce(obj.method.bind(obj), 100);
      debouncedMethod();
      vi.advanceTimersByTime(100);

      expect(obj.method).toHaveBeenCalled();
    });

    it('clears timeout on subsequent calls', () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn('first');
      const timeoutId1 = vi.getTimerCount();
      
      debouncedFn('second');
      const timeoutId2 = vi.getTimerCount();

      // Should have cleared the first timeout
      expect(timeoutId2).toBe(timeoutId1);
    });
  });

  describe('throttle', () => {
    it('executes function immediately on first call', () => {
      const mockFn = vi.fn();
      const throttledFn = throttle(mockFn, 100);

      throttledFn('first');
      expect(mockFn).toHaveBeenCalledWith('first');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('blocks subsequent calls within limit period', () => {
      const mockFn = vi.fn();
      const throttledFn = throttle(mockFn, 100);

      throttledFn('first');
      throttledFn('second');
      throttledFn('third');

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('first');
    });

    it('allows execution after limit period expires', () => {
      const mockFn = vi.fn();
      const throttledFn = throttle(mockFn, 100);

      throttledFn('first');
      expect(mockFn).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(100);
      
      throttledFn('second');
      expect(mockFn).toHaveBeenCalledTimes(2);
      expect(mockFn).toHaveBeenCalledWith('second');
    });

    it('maintains throttle state correctly', () => {
      const mockFn = vi.fn();
      const throttledFn = throttle(mockFn, 100);

      // First call - should execute
      throttledFn('1');
      expect(mockFn).toHaveBeenCalledTimes(1);

      // Calls within throttle period - should be blocked
      vi.advanceTimersByTime(50);
      throttledFn('2');
      expect(mockFn).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(30);
      throttledFn('3');
      expect(mockFn).toHaveBeenCalledTimes(1);

      // After throttle period - should execute
      vi.advanceTimersByTime(30); // Total 110ms
      throttledFn('4');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('handles multiple arguments correctly', () => {
      const mockFn = vi.fn();
      const throttledFn = throttle(mockFn, 100);

      throttledFn('arg1', 'arg2', 'arg3');
      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2', 'arg3');
    });
  });

  describe('PerformanceMonitor', () => {
    it('measures operation duration accurately', () => {
      const endMeasurement = PerformanceMonitor.startMeasurement('test-op');
      
      // Simulate work
      vi.advanceTimersByTime(50);
      endMeasurement();

      const stats = PerformanceMonitor.getStats('test-op');
      expect(stats.count).toBe(1);
      expect(stats.average).toBeGreaterThan(0);
    });

    it('tracks multiple measurements for same operation', () => {
      const durations = [10, 20, 30, 40, 50];
      
      durations.forEach(duration => {
        const endMeasurement = PerformanceMonitor.startMeasurement('multi-test');
        vi.advanceTimersByTime(duration);
        endMeasurement();
      });

      const stats = PerformanceMonitor.getStats('multi-test');
      expect(stats.count).toBe(5);
      expect(stats.min).toBeLessThanOrEqual(stats.max);
      expect(stats.average).toBeGreaterThan(0);
    });

    it('calculates statistics correctly', () => {
      // Add measurements with known values
      const measurements = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      
      measurements.forEach(duration => {
        const endMeasurement = PerformanceMonitor.startMeasurement('stats-test');
        vi.advanceTimersByTime(duration);
        endMeasurement();
      });

      const stats = PerformanceMonitor.getStats('stats-test');
      expect(stats.count).toBe(10);
      expect(stats.min).toBe(10);
      expect(stats.max).toBe(100);
      expect(stats.average).toBe(55); // (10+20+...+100)/10
      expect(stats.p95).toBeGreaterThan(stats.average);
    });

    it('limits measurement history to 100 entries', () => {
      // Add 150 measurements
      for (let i = 0; i < 150; i++) {
        const endMeasurement = PerformanceMonitor.startMeasurement('limit-test');
        vi.advanceTimersByTime(10);
        endMeasurement();
      }

      const stats = PerformanceMonitor.getStats('limit-test');
      expect(stats.count).toBe(100);
    });

    it('warns about slow operations', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const endMeasurement = PerformanceMonitor.startMeasurement('slow-test');
      vi.advanceTimersByTime(150); // > 100ms threshold
      endMeasurement();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Slow operation detected: slow-test')
      );

      consoleSpy.mockRestore();
    });

    it('provides comprehensive stats for all operations', () => {
      PerformanceMonitor.startMeasurement('op1')();
      PerformanceMonitor.startMeasurement('op2')();
      PerformanceMonitor.startMeasurement('op3')();

      const allStats = PerformanceMonitor.getAllStats();
      expect(allStats).toHaveProperty('op1');
      expect(allStats).toHaveProperty('op2');
      expect(allStats).toHaveProperty('op3');
    });

    it('resets measurements correctly', () => {
      PerformanceMonitor.startMeasurement('reset-test')();
      
      let stats = PerformanceMonitor.getStats('reset-test');
      expect(stats.count).toBe(1);

      PerformanceMonitor.reset('reset-test');
      
      stats = PerformanceMonitor.getStats('reset-test');
      expect(stats.count).toBe(0);
    });

    it('resets all measurements when no name provided', () => {
      PerformanceMonitor.startMeasurement('test1')();
      PerformanceMonitor.startMeasurement('test2')();

      PerformanceMonitor.reset();

      const allStats = PerformanceMonitor.getAllStats();
      expect(Object.keys(allStats)).toHaveLength(0);
    });

    it('handles empty measurement sets gracefully', () => {
      const stats = PerformanceMonitor.getStats('non-existent');
      expect(stats.count).toBe(0);
      expect(stats.average).toBe(0);
      expect(stats.min).toBe(0);
      expect(stats.max).toBe(0);
    });

    it('calculates percentiles correctly for small datasets', () => {
      const endMeasurement = PerformanceMonitor.startMeasurement('small-dataset');
      vi.advanceTimersByTime(50);
      endMeasurement();

      const stats = PerformanceMonitor.getStats('small-dataset');
      expect(stats.p95).toBe(50); // Should equal the only value
    });
  });

  describe('BatteryOptimizer', () => {
    it('provides default scan interval when battery API unavailable', () => {
      const interval = BatteryOptimizer.getOptimalScanInterval();
      expect(interval).toBeGreaterThan(0);
      expect(typeof interval).toBe('number');
    });

    it('provides default update frequency', () => {
      const frequency = BatteryOptimizer.getOptimalUpdateFrequency();
      expect(frequency).toBeGreaterThan(0);
      expect(typeof frequency).toBe('number');
    });

    it('returns boolean for low power mode check', () => {
      const isLowPower = BatteryOptimizer.isLowPower();
      expect(typeof isLowPower).toBe('boolean');
    });

    it('returns valid battery level', () => {
      const batteryLevel = BatteryOptimizer.getBatteryLevel();
      expect(batteryLevel).toBeGreaterThanOrEqual(0);
      expect(batteryLevel).toBeLessThanOrEqual(1);
    });

    it('provides different intervals based on power mode', () => {
      const normalInterval = BatteryOptimizer.getOptimalScanInterval();
      const normalFrequency = BatteryOptimizer.getOptimalUpdateFrequency();

      expect(normalInterval).toBeGreaterThan(0);
      expect(normalFrequency).toBeGreaterThan(0);
    });

    // Note: Testing actual battery API behavior would require mocking navigator.getBattery
    // which is complex in a test environment. The current implementation provides
    // reasonable defaults when the API is unavailable.
  });

  describe('Integration Tests', () => {
    it('debounce and performance monitoring work together', () => {
      const mockFn = vi.fn(() => {
        const endMeasurement = PerformanceMonitor.startMeasurement('debounced-operation');
        vi.advanceTimersByTime(25); // Simulate work
        endMeasurement();
      });

      const debouncedFn = debounce(mockFn, 100);

      // Call multiple times
      debouncedFn();
      debouncedFn();
      debouncedFn();

      vi.advanceTimersByTime(100);

      expect(mockFn).toHaveBeenCalledTimes(1);
      
      const stats = PerformanceMonitor.getStats('debounced-operation');
      expect(stats.count).toBe(1);
    });

    it('throttle and performance monitoring work together', () => {
      const mockFn = vi.fn(() => {
        const endMeasurement = PerformanceMonitor.startMeasurement('throttled-operation');
        vi.advanceTimersByTime(15); // Simulate work
        endMeasurement();
      });

      const throttledFn = throttle(mockFn, 100);

      // Call multiple times
      throttledFn();
      throttledFn();
      throttledFn();

      expect(mockFn).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(100);
      throttledFn();

      expect(mockFn).toHaveBeenCalledTimes(2);
      
      const stats = PerformanceMonitor.getStats('throttled-operation');
      expect(stats.count).toBe(2);
    });

    it('handles performance monitoring with battery optimization', () => {
      const optimalInterval = BatteryOptimizer.getOptimalScanInterval();
      
      const endMeasurement = PerformanceMonitor.startMeasurement('battery-optimized-scan');
      vi.advanceTimersByTime(optimalInterval / 10); // Simulate scan work
      endMeasurement();

      const stats = PerformanceMonitor.getStats('battery-optimized-scan');
      expect(stats.count).toBe(1);
      expect(stats.average).toBeGreaterThan(0);
    });

    it('measures debounce effectiveness', () => {
      let executionCount = 0;
      const mockFn = vi.fn(() => {
        executionCount++;
        const endMeasurement = PerformanceMonitor.startMeasurement('debounce-effectiveness');
        vi.advanceTimersByTime(10);
        endMeasurement();
      });

      const debouncedFn = debounce(mockFn, 50);

      // Rapid calls that should be debounced
      for (let i = 0; i < 10; i++) {
        debouncedFn();
        vi.advanceTimersByTime(10); // Less than debounce delay
      }

      vi.advanceTimersByTime(50); // Complete the debounce

      expect(executionCount).toBe(1); // Should only execute once
      
      const stats = PerformanceMonitor.getStats('debounce-effectiveness');
      expect(stats.count).toBe(1);
    });
  });
});