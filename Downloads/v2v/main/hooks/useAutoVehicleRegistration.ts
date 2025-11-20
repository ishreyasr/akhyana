import { useEffect, useCallback, useState } from 'react';
import { useV2VBackend } from './useV2VBackend';
import { useLocationService } from './useLocationService';

interface AutoRegistrationState {
  isRegistering: boolean;
  isRegistered: boolean;
  registrationError: string | null;
  locationPermissionRequested: boolean;
}

export function useAutoVehicleRegistration() {
  const [state, setState] = useState<AutoRegistrationState>({
    isRegistering: false,
    isRegistered: false,
    registrationError: null,
    locationPermissionRequested: false,
  });

  const { connect, register, connected, registered } = useV2VBackend();
  const { permissionState, startTracking, requestPermission } = useLocationService(true);

  const performAutoRegistration = useCallback(async () => {
    try {
      // Get user data from session storage
      const authUserRaw = typeof window !== 'undefined' ? sessionStorage.getItem('authUser') : null;
      if (!authUserRaw) {
        console.log('[AutoRegistration] No auth user found, skipping auto registration');
        return;
      }

      const authUser = JSON.parse(authUserRaw);
      const vehicle = authUser.vehicle;

      if (!vehicle?.vehicleId) {
        setState(prev => ({
          ...prev,
          registrationError: 'No vehicle information found in user profile',
        }));
        return;
      }

      setState(prev => ({ ...prev, isRegistering: true, registrationError: null }));

      // 1. Connect to V2V backend
      console.log('[AutoRegistration] Connecting to V2V backend...');
      const connectSuccess = await connect();
      if (!connectSuccess) {
        throw new Error('Failed to connect to V2V backend');
      }

      // 2. Register vehicle
      console.log('[AutoRegistration] Registering vehicle:', vehicle.vehicleId);
      const registerResult = await register({
        vehicleId: vehicle.vehicleId,
        driverName: authUser.fullName,
        vehicleInfo: {
          licensePlate: vehicle.licensePlate,
          model: `${vehicle.brand} ${vehicle.model}`,
          color: vehicle.color || 'Unknown',
        },
      });

      if (!registerResult) {
        throw new Error('Vehicle registration failed');
      }

      // 3. Request location permission and start tracking
      console.log('[AutoRegistration] Requesting location permission...');
      setState(prev => ({ ...prev, locationPermissionRequested: true }));

      try {
        const locationGranted = await requestPermission();
        if (locationGranted) {
          console.log('[AutoRegistration] Starting location tracking...');
          const trackingStarted = await startTracking();
          if (!trackingStarted) {
            console.warn('[AutoRegistration] Location tracking failed to start');
          }
        } else {
          console.warn('[AutoRegistration] Location permission denied, proximity features will be limited');
        }
      } catch (locationError) {
        console.warn('[AutoRegistration] Location setup failed:', locationError);
        // Don't fail the entire registration for location issues
      }

      setState(prev => ({
        ...prev,
        isRegistering: false,
        isRegistered: true,
      }));

      console.log('[AutoRegistration] Vehicle registration completed successfully');

    } catch (error) {
      console.error('[AutoRegistration] Registration failed:', error);
      setState(prev => ({
        ...prev,
        isRegistering: false,
        registrationError: error instanceof Error ? error.message : 'Registration failed',
      }));
    }
  }, [connect, register, requestPermission, startTracking]);

  // Auto-register when component mounts and we have auth user
  useEffect(() => {
    const authUserRaw = typeof window !== 'undefined' ? sessionStorage.getItem('authUser') : null;
    if (authUserRaw && !state.isRegistered && !state.isRegistering && !registered) {
      // Small delay to ensure components are mounted
      const timer = setTimeout(() => {
        performAutoRegistration();
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [state.isRegistered, state.isRegistering, registered, performAutoRegistration]);

  // Update registration state based on backend state
  useEffect(() => {
    if (registered && !state.isRegistered) {
      setState(prev => ({ ...prev, isRegistered: true, isRegistering: false }));
    }
  }, [registered, state.isRegistered]);

  const retryRegistration = useCallback(() => {
    setState(prev => ({
      ...prev,
      isRegistering: false,
      isRegistered: false,
      registrationError: null,
      locationPermissionRequested: false,
    }));
    // Will trigger auto-registration on next effect cycle
  }, []);

  return {
    ...state,
    connected,
    registered,
    locationPermission: permissionState.permission,
    locationError: permissionState.error,
    retryRegistration,
  };
}
