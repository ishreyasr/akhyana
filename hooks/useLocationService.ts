import { useState, useEffect, useCallback, useRef } from 'react';
import { useV2VBackend } from './useV2VBackend';

interface LocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number | null;
}

interface LocationPermissionState {
  permission: 'granted' | 'denied' | 'prompt' | 'unknown';
  isRequesting: boolean;
  error: string | null;
}

export function useLocationService(autoStart = false) {
  const [location, setLocation] = useState<LocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    heading: null,
    speed: null,
    timestamp: null,
  });

  const [permissionState, setPermissionState] = useState<LocationPermissionState>({
    permission: 'unknown',
    isRequesting: false,
    error: null,
  });

  const [isTracking, setIsTracking] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const watchIdRef = useRef<number | null>(null);
  const { updateLocation } = useV2VBackend();

  // Check if geolocation is supported
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (!navigator.geolocation) {
        setIsSupported(false);
        setPermissionState(prev => ({
          ...prev,
          permission: 'denied',
          error: 'Geolocation is not supported by this browser',
        }));
      }
    }
  }, []);

  // Check initial permission state
  useEffect(() => {
    if (typeof window !== 'undefined' && 'permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' as PermissionName }).then((result) => {
        setPermissionState(prev => ({
          ...prev,
          permission: result.state as 'granted' | 'denied' | 'prompt',
        }));
      }).catch(() => {
        // Permissions API not supported, will need to request directly
      });
    }
  }, []);

  // Auto-start location tracking if enabled and permission granted
  useEffect(() => {
    if (autoStart && isSupported && permissionState.permission === 'granted' && !isTracking) {
      startTracking();
    }
  }, [autoStart, isSupported, permissionState.permission, isTracking]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setPermissionState(prev => ({
        ...prev,
        permission: 'denied',
        error: 'Geolocation is not supported by this browser',
      }));
      return false;
    }

    setPermissionState(prev => ({
      ...prev,
      isRequesting: true,
      error: null,
    }));

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setPermissionState(prev => ({
            ...prev,
            permission: 'granted',
            isRequesting: false,
          }));

          // Update initial location
          const newLocation: LocationState = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            heading: position.coords.heading,
            speed: position.coords.speed,
            timestamp: position.timestamp,
          };
          setLocation(newLocation);

          // Send to backend
          updateLocation(position.coords.latitude, position.coords.longitude);

          resolve(true);
        },
        (error) => {
          let permission: 'denied' | 'prompt' = 'denied';
          let errorMessage = 'Location permission denied';

          if (error && typeof error === 'object' && error.code) {
            switch (error.code) {
              case error.PERMISSION_DENIED:
                permission = 'denied';
                errorMessage = 'Location permission denied by user';
                break;
              case error.POSITION_UNAVAILABLE:
                permission = 'prompt'; // May still be able to request again
                errorMessage = 'Location information unavailable';
                break;
              case error.TIMEOUT:
                permission = 'prompt';
                errorMessage = 'Location request timed out';
                break;
              default:
                errorMessage = `Location error (code: ${error.code})`;
                break;
            }
          } else if (error && error.message) {
            errorMessage = error.message;
          } else if (typeof error === 'string') {
            errorMessage = error;
          } else {
            errorMessage = 'Unknown location error occurred';
          }

          setPermissionState(prev => ({
            ...prev,
            permission,
            isRequesting: false,
            error: errorMessage,
          }));

          resolve(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        }
      );
    });
  }, [updateLocation]);

  const startTracking = useCallback(async () => {
    try {
      if (typeof window === 'undefined' || !navigator.geolocation) {
        console.warn('Geolocation not available');
        return false;
      }

      // Request permission if not already granted
      if (permissionState.permission !== 'granted') {
        const granted = await requestPermission();
        if (!granted) return false;
      }

      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }

      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          try {
            const newLocation: LocationState = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              heading: position.coords.heading,
              speed: position.coords.speed,
              timestamp: position.timestamp,
            };

            setLocation(newLocation);

            // Send to V2V backend
            updateLocation(position.coords.latitude, position.coords.longitude);
          } catch (updateError) {
            console.error('Error processing location update:', updateError);
          }
        },
        (error) => {
          let errorMessage = 'Unknown location error';

          try {
            if (error && typeof error === 'object' && error !== null) {
              if ('code' in error && typeof error.code === 'number') {
                switch (error.code) {
                  case 1: // PERMISSION_DENIED
                    errorMessage = 'Location permission denied';
                    break;
                  case 2: // POSITION_UNAVAILABLE
                    errorMessage = 'Location information unavailable';
                    break;
                  case 3: // TIMEOUT
                    errorMessage = 'Location request timed out';
                    break;
                  default:
                    errorMessage = `Location error (code: ${error.code})`;
                    break;
                }
              } else if ('message' in error && typeof error.message === 'string') {
                errorMessage = error.message;
              } else if (Object.keys(error).length === 0) {
                errorMessage = 'Empty location error object - possibly browser compatibility issue';
              } else {
                errorMessage = 'Location error: ' + JSON.stringify(error);
              }
            } else if (typeof error === 'string') {
              errorMessage = error;
            } else {
              errorMessage = 'Location error: ' + String(error);
            }
          } catch (parseError) {
            errorMessage = 'Location error parsing failed';
            console.error('Error parsing location error:', parseError);
          }

          console.warn('Location tracking error:', errorMessage);

          setPermissionState(prev => ({
            ...prev,
            error: `Location tracking error: ${errorMessage}`,
          }));
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 5000, // Allow cached positions up to 5 seconds old
        }
      );

      setIsTracking(true);
      return true;
    } catch (error) {
      console.error('Error starting location tracking:', error);
      setPermissionState(prev => ({
        ...prev,
        error: `Failed to start location tracking: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }));
      return false;
    }
  }, [permissionState.permission, requestPermission, updateLocation]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return {
    location,
    permissionState,
    isTracking,
    isSupported,
    requestPermission,
    startTracking,
    stopTracking,
  };
}
