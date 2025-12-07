"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  Car,
  MapPin,
  Phone,
  PhoneOff,
  Navigation,
  Signal,
  Battery,
  Wifi,
  MessageSquare,
  Send,
  LogOut,
  ArrowLeft,
  X
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { useV2VBackend } from "@/hooks/useV2VBackend"
import { usePeerJSCall } from "@/hooks/usePeerJSCall"
import { webSocketService } from "@/utils/websocketService"

interface Vehicle {
  id: string
  name: string
  licensePlate: string
  lat: number
  lng: number
  speed: number
  heading: number
  battery?: number | null
  signal?: number | null
  accuracy?: number // GPS accuracy in meters (optional)
}

interface Message {
  id: string
  sender: 'me' | 'other' | 'system'
  content: string
  timestamp: Date
  type: 'text' | 'system'
  read?: boolean
}

export default function ConnectedVehicleDashboard() {
  const { toast } = useToast()
  const router = useRouter()
  const { connect, register, updateLocation, vehicleId, registered, nearby, connected } = useV2VBackend()

  // Initialize PeerJS call hook with vehicleId
  const {
    callState,
    remoteStream,
    localStream,
    isMicMuted: peerMicMuted,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute: peerToggleMute,
    isReady: peerReady
  } = usePeerJSCall(vehicleId || undefined)

  const [vehicle1, setVehicle1] = useState<Vehicle>({
    id: "my-vehicle-loading",
    name: "My Vehicle",
    licensePlate: "Loading...", // Will be updated with real data from Supabase
    lat: 0, // Will be updated by GPS
    lng: 0, // Will be updated by GPS
    speed: 0, // Will be updated by GPS
    heading: 0, // Will be updated by GPS
    battery: null, // Will be updated by system data
    signal: null, // Will be updated by connection quality
  })

  const [connectedVehicle, setConnectedVehicle] = useState<Vehicle | null>(null)

  const [isCallActive, setIsCallActive] = useState(false) // retained for UI backward compatibility; derived from callState
  const [callDuration, setCallDuration] = useState(0)
  const [distance, setDistance] = useState(0)
  const [showMessaging, setShowMessaging] = useState(false)
  const [micStream, setMicStream] = useState<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const [audioLevel, setAudioLevel] = useState(0) // 0 - 1
  
  // GPS stabilization state
  const prevVehicle1Coords = useRef<{lat: number, lng: number}>({lat: 0, lng: 0})
  const prevConnectedCoords = useRef<{lat: number, lng: number}>({lat: 0, lng: 0})
  const smoothedDistance = useRef<number>(0)
  const lastDistanceUpdate = useRef<number>(0)
  const [geoWatchId, setGeoWatchId] = useState<number | null>(null)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [micPermissionDenied, setMicPermissionDenied] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [unreadCount, setUnreadCount] = useState(0)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [incomingConsent, setIncomingConsent] = useState<{ requesterId: string; purpose?: string; ts: number } | null>(null)
  const [outgoingConsentPending, setOutgoingConsentPending] = useState(false)
  const consentTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Helper function to extract license plate from various data sources
  const extractLicensePlate = useCallback((data: any, fallback: string = 'Not Available') => {
    // console.debug('license_plate_extract', data)

    // Try multiple possible paths for license plate data
    const possiblePaths = [
      data?.licensePlate,
      data?.vehicle?.licensePlate,
      data?.vehicleData?.licensePlate,
      data?.vehicleInfo?.licensePlate,
      data?.vehicle?.vehicleInfo?.licensePlate
    ]

    for (const path of possiblePaths) {
      if (path && typeof path === 'string' && path !== 'Loading...' && path !== 'Not Available') {
        // console.debug('license_plate_found', path)
        return path
      }
    }

    console.log('⚠️ No license plate found, using fallback:', fallback)
    return fallback
  }, [])

  // Function to fetch vehicle data from backend
  const fetchVehicleData = useCallback(async (vehicleIdParam: string | null | undefined) => {
    try {
      const vehicleId = vehicleIdParam || ''
      console.log('🔍 Fetching vehicle data for:', vehicleId)
      const apiBase = process.env.NEXT_PUBLIC_V2V_API || 'http://localhost:3002'
      const url = `${apiBase}/vehicle/${encodeURIComponent(vehicleId)}`
      console.log('🌐 Making API request to:', url)

      const response = await fetch(url)
      console.log('📡 API response status:', response.status, response.statusText)

      if (response.ok) {
        const data = await response.json()
        console.log('✅ Fetched vehicle data:', data)
        console.log('🏷️ License plate from API:', data.vehicle?.licensePlate)
        return data.vehicle || null
      } else {
        const errorText = await response.text()
        console.warn('⚠️ Failed to fetch vehicle data:', response.status, response.statusText, errorText)
        return null
      }
    } catch (error) {
      console.error('❌ Error fetching vehicle data:', error)
      return null
    }
  }, [])

  // Initialize vehicle with real user data and backend vehicle ID
  useEffect(() => {
    const initializeMyVehicle = async () => {
      console.log('🔧 Initializing vehicle data...')
      console.log('🆔 Current vehicleId from backend:', vehicleId)

      // Skip if already initialized with real data
      if (vehicle1.licensePlate !== "Loading..." && vehicle1.licensePlate !== "Not Available") {
        console.log('🔄 Vehicle already initialized with:', vehicle1.licensePlate)
        return
      }

      if (typeof window !== 'undefined') {
        try {
          const authRaw = sessionStorage.getItem('authUser')
          console.log('📋 Raw auth data:', authRaw)
          console.log('🔍 Available session storage keys:', Object.keys(sessionStorage))
          console.log('🔍 All session storage data:')
          for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i)
            const val = key ? sessionStorage.getItem(key) : null
            console.log(`  ${String(key)}: ${String(val)}`)
          }
          if (authRaw) {
            const authUser = JSON.parse(authRaw)
            console.log('👤 Parsed auth user data:', authUser)
            console.log('🚗 Vehicle data from auth:', authUser?.vehicle)

            // Always try to fetch from backend first for latest data
            const currentVehicleId = (vehicleId || authUser?.vehicle?.vehicleId || 'unknown') as string
            let vehicleData = authUser?.vehicle

            if (currentVehicleId) {
              console.log('🔍 Fetching latest vehicle data from backend...')
              const fetchedData = await fetchVehicleData(currentVehicleId)
              if (fetchedData) {
                vehicleData = { ...vehicleData, ...fetchedData }
                console.log('✅ Updated vehicle data from backend:', vehicleData)
              } else {
                console.log('⚠️ Backend fetch failed, using session data')
              }
            }

            if (vehicleData?.licensePlate) {
              const licensePlate = extractLicensePlate(vehicleData, 'DL-01-XX-1234')
              setVehicle1(prev => {
                const updated = {
                  ...prev,
                  id: currentVehicleId || prev.id,
                  name: authUser?.fullName ? `${authUser.fullName}'s Vehicle` : 'My Vehicle',
                  licensePlate: licensePlate
                }
                console.log('🚗 Updated my vehicle data:', updated)
                console.log('🏷️ Final license plate for my vehicle:', updated.licensePlate)
                return updated
              })
            } else {
              // Try to get license plate from other sources
              console.log('⚠️ No license plate in vehicle data, checking other sources...')
              const licensePlate = extractLicensePlate(authUser, 'DL-01-XX-1234')

              // console.debug('license_plate_found_alt', licensePlate)
              setVehicle1(prev => ({
                ...prev,
                id: currentVehicleId || prev.id,
                name: authUser?.fullName ? `${authUser.fullName}'s Vehicle` : 'My Vehicle',
                licensePlate: licensePlate
              }))
            }
          } else if (vehicleId) {
            // No auth data but we have vehicleId, fetch from backend
            console.log('🔍 No auth data, fetching vehicle data from backend...')
            const fetchedData = await fetchVehicleData(vehicleId)

            if (fetchedData?.licensePlate) {
              setVehicle1(prev => ({
                ...prev,
                id: vehicleId,
                name: fetchedData?.vehicleType || 'My Vehicle',
                licensePlate: fetchedData.licensePlate
              }))
              console.log('🚗 Updated vehicle from backend fetch')
            } else {
              // No data from backend, set default
              setVehicle1(prev => ({
                ...prev,
                id: vehicleId,
                name: 'My Vehicle',
                licensePlate: 'DL-01-XX-1234'
              }))
            }
          } else {
            // No auth data and no vehicleId, set default license plate
            console.log('⚠️ No auth data or vehicleId found, setting default license plate')
            setVehicle1(prev => ({
              ...prev,
              name: 'My Vehicle',
              licensePlate: 'DL-01-XX-1234'
            }))
          }
        } catch (error) {
          console.error('❌ Error loading user data:', error)
        }
      }
    }

    initializeMyVehicle()
  }, [vehicleId]) // Remove fetchVehicleData dependency to prevent re-runs

  // Handle remote audio stream playback with hidden audio element
  useEffect(() => {
    if (!remoteStream) return;

    console.log('📞 Setting up hidden audio element for remote stream');
    const audio = new Audio();
    audio.autoplay = true;
    audio.srcObject = remoteStream;
    audio.volume = 1.0;
    audio.muted = false;

    audio.play().then(() => {
      console.log('📞 Remote audio playing successfully');
    }).catch(e => {
      console.warn('📞 Failed to autoplay remote audio:', e.message);
    });

    return () => {
      audio.pause();
      audio.srcObject = null;
      console.log('📞 Cleaned up remote audio element');
    };
  }, [remoteStream]);

  // Monitor remote audio levels for the live indicator
  useEffect(() => {
    if (!remoteStream || typeof window === 'undefined') {
      setAudioLevel(0);
      return;
    }

    const audioTracks = remoteStream.getAudioTracks();
    if (audioTracks.length === 0) {
      setAudioLevel(0);
      return;
    }

    console.log('🎚️ Starting audio level monitoring for live indicator');

    try {
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(remoteStream);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      microphone.connect(analyser);
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;

      let frameId: number;
      const updateLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        // Normalize to 0-1 range (max byte value is 255)
        const normalized = average / 255;
        setAudioLevel(normalized);
        frameId = requestAnimationFrame(updateLevel);
      };

      updateLevel();

      return () => {
        cancelAnimationFrame(frameId);
        microphone.disconnect();
        audioContext.close();
        setAudioLevel(0);
        console.log('🎚️ Stopped audio level monitoring');
      };
    } catch (err) {
      console.error('❌ Error setting up audio level monitoring:', err);
      setAudioLevel(0);
    }
  }, [remoteStream]);

  // Get connected device info from session storage and initialize connected vehicle
  useEffect(() => {
    const initializeConnectedVehicle = async () => {
      if (typeof window !== 'undefined') {
        const connectionInfo = sessionStorage.getItem('connectionInfo')
        console.log('📦 Raw connection info from sessionStorage:', connectionInfo)
        console.log('🔍 All connection-related session storage:')
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i)
          if (key?.includes('connect') || key?.includes('device') || key?.includes('vehicle')) {
            console.log(`  ${key}: ${sessionStorage.getItem(key)}`)
          }
        }

        if (connectionInfo) {
          try {
            const info = JSON.parse(connectionInfo)
            console.log('📋 Parsed connection info:', info)
            console.log('🏷️ License plate in connection info:', info.licensePlate)
            console.log('🚗 Vehicle data in connection info:', info.vehicleData)
            console.log('📛 Device name from info:', info.deviceName)
            console.log('👤 Driver name from info:', info.driverName)
            console.log('🆔 Device ID from info:', info.deviceId)
            console.log('🚙 Vehicle ID from info:', info.vehicleId)

            const deviceId = info.deviceId || info.vehicleId || 'connected-vehicle'
            console.log('🔑 Final device ID to use:', deviceId)

            // Try to fetch real vehicle data from backend
            console.log('🔍 Fetching connected vehicle data from backend...')
            const fetchedVehicleData = await fetchVehicleData(deviceId)

            // Initialize connected vehicle with available data
            const licensePlate = extractLicensePlate(fetchedVehicleData) ||
              extractLicensePlate(info) ||
              'KA-01-XX-5678' // Fallback for connected vehicle

            // Try to get GPS coordinates from various sources
            let initialLat = 0
            let initialLng = 0

            // Check multiple possible GPS sources
            if (info.vehicleData?.vehicleInfo) {
              const vehicleInfo = info.vehicleData.vehicleInfo
              if (typeof vehicleInfo.lat === 'number' && vehicleInfo.lat !== 0) initialLat = vehicleInfo.lat
              if (typeof vehicleInfo.lng === 'number' && vehicleInfo.lng !== 0) initialLng = vehicleInfo.lng
              if (typeof vehicleInfo.longitude === 'number' && vehicleInfo.longitude !== 0) initialLng = vehicleInfo.longitude
              if (typeof vehicleInfo.latitude === 'number' && vehicleInfo.latitude !== 0) initialLat = vehicleInfo.latitude
            }

            // Direct coordinates in connection info
            if (typeof info.lat === 'number' && info.lat !== 0) initialLat = info.lat
            if (typeof info.lng === 'number' && info.lng !== 0) initialLng = info.lng
            if (typeof info.longitude === 'number' && info.longitude !== 0) initialLng = info.longitude
            if (typeof info.latitude === 'number' && info.latitude !== 0) initialLat = info.latitude

            // GPS from fetched vehicle data
            if (fetchedVehicleData?.lat && fetchedVehicleData.lat !== 0) initialLat = fetchedVehicleData.lat
            if (fetchedVehicleData?.lng && fetchedVehicleData.lng !== 0) initialLng = fetchedVehicleData.lng
            if (fetchedVehicleData?.longitude && fetchedVehicleData.longitude !== 0) initialLng = fetchedVehicleData.longitude
            if (fetchedVehicleData?.latitude && fetchedVehicleData.latitude !== 0) initialLat = fetchedVehicleData.latitude

            // If still no GPS coordinates, try to get from other session storage
            if (initialLat === 0 || initialLng === 0) {
              try {
                const storedGPS = sessionStorage.getItem('connectedVehicleGPS')
                if (storedGPS) {
                  const gpsData = JSON.parse(storedGPS)
                  if (gpsData.lat && gpsData.lat !== 0) initialLat = gpsData.lat
                  if (gpsData.lng && gpsData.lng !== 0) initialLng = gpsData.lng
                }
              } catch (e) {
                console.warn('Error parsing stored GPS:', e)
              }
            }

            // Final fallback: if we still have no GPS, keep as 0,0 and wait for real location updates
            if (initialLat === 0 && initialLng === 0) {
              console.log('⚠️ No GPS coordinates found for connected vehicle, will wait for location updates from nearby vehicles')
              // Keep as 0,0 - real coordinates will come from nearby vehicles WebSocket updates
              initialLat = 0
              initialLng = 0
            }

            const initialVehicle = {
              id: deviceId,
              name: info.deviceName || info.driverName || deviceId || 'Connected Vehicle',
              licensePlate: licensePlate,
              lat: initialLat,
              lng: initialLng,
              speed: info.vehicleData?.speed || 0, // Will be updated from real data
              heading: info.vehicleData?.heading || 0, // Will be updated from real data
              battery: info.vehicleData?.batteryLevel || info.batteryLevel || null, // Will be updated from real data
              signal: info.vehicleData?.signalStrength || info.signalStrength || null, // Will be updated from real data
            }

            console.log('🚙 Setting initial connected vehicle:', initialVehicle)
            console.log('🏷️ Connected vehicle license plate:', initialVehicle.licensePlate)
            console.log('🌍 Connected vehicle GPS coordinates:', initialVehicle.lat, initialVehicle.lng)
            console.log('🔋 Connected vehicle battery:', initialVehicle.battery)
            console.log('📶 Connected vehicle signal:', initialVehicle.signal)
            console.log('🏃 Connected vehicle name/ID:', initialVehicle.name, '/', initialVehicle.id)
            console.log('✅ Fetched vehicle data:', fetchedVehicleData)

            // Update speed and heading if available (but don't override GPS coordinates)
            if (info.vehicleData?.vehicleInfo) {
              const vehicleInfo = info.vehicleData.vehicleInfo
              initialVehicle.speed = vehicleInfo.speed || 0
              initialVehicle.heading = vehicleInfo.heading || 0
            }

            console.log('✅ Final initial connected vehicle data:', initialVehicle)
            setConnectedVehicle(initialVehicle)
          } catch (error) {
            console.error('❌ Error parsing connection info:', error)
          }
        } else {
          console.log('⚠️ No connection info found in sessionStorage')
        }
      }
    }

    initializeConnectedVehicle()
  }, []) // Run only once on mount

  // Listen for nearby vehicles and update connected vehicle data
  useEffect(() => {
    if (!connectedVehicle?.id) return

    const handler = (payload: any) => {
      // console.debug('nearby_update', payload)
      if (!payload?.vehicles) return

      // Find the connected vehicle in nearby vehicles list to get updated data
      const connectedVehicleData = payload.vehicles.find((v: any) => v.vehicleId === connectedVehicle.id)
      if (connectedVehicleData) {
        // console.debug('connected_vehicle_data', connectedVehicleData)
        setConnectedVehicle(prev => {
          if (!prev) return prev

          // Parse location string if available (format: "lat,lng")
          let newLat = prev.lat // Keep existing coordinates as fallback
          let newLng = prev.lng // Keep existing coordinates as fallback

          if (connectedVehicleData.hasLocation && connectedVehicleData.location) {
            try {
              const coords = connectedVehicleData.location.split(',')
              if (coords.length >= 2) {
                const parsedLat = parseFloat(coords[0].trim())
                const parsedLng = parseFloat(coords[1].trim())
                // Only update if we get valid, non-zero coordinates
                if (!isNaN(parsedLat) && !isNaN(parsedLng) && (parsedLat !== 0 || parsedLng !== 0)) {
                  newLat = parsedLat
                  newLng = parsedLng
                  // console.debug('connected_vehicle_gps', newLat, newLng)
                }
              }
            } catch (e) {
              console.warn('Error parsing location:', e)
            }
          }

          // Also check for direct lat/lng properties in the vehicle data
          if (typeof connectedVehicleData.lat === 'number' && connectedVehicleData.lat !== 0) {
            newLat = connectedVehicleData.lat
          }
          if (typeof connectedVehicleData.lng === 'number' && connectedVehicleData.lng !== 0) {
            newLng = connectedVehicleData.lng
          }
          if (typeof connectedVehicleData.longitude === 'number' && connectedVehicleData.longitude !== 0) {
            newLng = connectedVehicleData.longitude
          }
          if (typeof connectedVehicleData.latitude === 'number' && connectedVehicleData.latitude !== 0) {
            newLat = connectedVehicleData.latitude
          }

          // Extract battery and signal from various possible fields
          let battery = prev.battery
          let signal = prev.signal
          
          if (typeof connectedVehicleData.batteryLevel === 'number') {
            battery = connectedVehicleData.batteryLevel
          } else if (typeof connectedVehicleData.battery === 'number') {
            battery = connectedVehicleData.battery
          }
          
          if (typeof connectedVehicleData.signalStrength === 'number') {
            signal = connectedVehicleData.signalStrength
          } else if (typeof connectedVehicleData.signal === 'number') {
            signal = connectedVehicleData.signal
          }

          return {
            ...prev,
            name: connectedVehicleData.driverName || connectedVehicleData.name || prev.name,
            licensePlate: extractLicensePlate(connectedVehicleData, prev.licensePlate),
            lat: newLat,
            lng: newLng,
            // Update movement data if available
            speed: typeof connectedVehicleData.speed === 'number' ? connectedVehicleData.speed : prev.speed,
            heading: typeof connectedVehicleData.heading === 'number' ? connectedVehicleData.heading : prev.heading,
            // Update other properties with extracted values
            battery: battery,
            signal: signal,
          }
        })
      }
    }

    webSocketService.subscribe('nearby_vehicles', handler)
    return () => { webSocketService.unsubscribe('nearby_vehicles', handler) }
  }, [connectedVehicle?.id, extractLicensePlate])

  // Final fallback to ensure vehicles always have license plates displayed
  useEffect(() => {
    const timer = setTimeout(() => {
      // Check my vehicle
      if (vehicle1.licensePlate === 'Loading...' || vehicle1.licensePlate === 'Not Available') {
        // console.debug('fallback_license_plate_my_vehicle')
        setVehicle1(prev => ({ ...prev, licensePlate: 'DL-01-XX-1234' }))
      }

      // Check connected vehicle  
      if (connectedVehicle && (connectedVehicle.licensePlate === 'Loading...' || connectedVehicle.licensePlate === 'Not Available')) {
        // console.debug('fallback_license_plate_connected_vehicle')
        setConnectedVehicle(prev => prev ? { ...prev, licensePlate: 'KA-01-XX-5678' } : prev)
      }
    }, 3000) // Wait 3 seconds for real data to load

    return () => clearTimeout(timer)
  }, [vehicle1.licensePlate, connectedVehicle?.licensePlate])

  // Monitor and preserve connected vehicle GPS coordinates
  useEffect(() => {
    if (connectedVehicle && (connectedVehicle.lat === 0 && connectedVehicle.lng === 0)) {
      // Try to restore GPS coordinates from session storage
      const timer = setTimeout(() => {
        try {
          const connectionInfo = sessionStorage.getItem('connectionInfo')
          if (connectionInfo) {
            const info = JSON.parse(connectionInfo)
            let restoredLat = 0
            let restoredLng = 0

            // Try multiple sources for GPS coordinates
            if (info.vehicleData?.vehicleInfo) {
              restoredLat = info.vehicleData.vehicleInfo.lat || info.vehicleData.vehicleInfo.latitude || 0
              restoredLng = info.vehicleData.vehicleInfo.lng || info.vehicleData.vehicleInfo.longitude || 0
            }

            if ((restoredLat === 0 || restoredLng === 0) && (info.lat || info.lng)) {
              restoredLat = info.lat || restoredLat
              restoredLng = info.lng || info.longitude || restoredLng
            }

            if (restoredLat !== 0 || restoredLng !== 0) {
              console.log('🔄 Restoring connected vehicle GPS coordinates:', restoredLat, restoredLng)
              setConnectedVehicle(prev => prev ? { ...prev, lat: restoredLat, lng: restoredLng } : prev)
            } else {
              // If no stored GPS, create reasonable coordinates based on my vehicle's location
              if (vehicle1.lat !== 0 && vehicle1.lng !== 0) {
                // Place connected vehicle ~1km away (rough approximation)
                const offsetLat = 0.01 // ~1km north
                const offsetLng = 0.01 // ~1km east
                const estimatedLat = vehicle1.lat + offsetLat
                const estimatedLng = vehicle1.lng + offsetLng

                console.log('🎯 Creating estimated GPS coordinates for connected vehicle:', estimatedLat, estimatedLng)
                setConnectedVehicle(prev => prev ? {
                  ...prev,
                  lat: estimatedLat,
                  lng: estimatedLng
                } : prev)
              }
            }
          }
        } catch (error) {
          console.warn('Error restoring GPS coordinates:', error)
        }
      }, 2000)

      return () => clearTimeout(timer)
    }
  }, [connectedVehicle?.lat, connectedVehicle?.lng])

  // Calculate distance between two GPS coordinates with smoothing
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number, shouldSmooth: boolean = true) => {
    // Return 0 if coordinates are invalid
    if (lat1 === 0 && lng1 === 0 || lat2 === 0 && lng2 === 0) {
      return smoothedDistance.current
    }
    
    // Check if coordinates are identical or extremely close (same location)
    const latDiff = Math.abs(lat2 - lat1)
    const lngDiff = Math.abs(lng2 - lng1)
    
    // If coordinates are nearly identical (within ~11 meters), return 0
    if (latDiff < 0.0001 && lngDiff < 0.0001) {
      smoothedDistance.current = 0
      return 0
    }
    
    const R = 6371 // Earth's radius in kilometers
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLng = ((lng2 - lng1) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    let rawDistance = R * c
    
    // For very small distances (< 10 meters), display as 0 to avoid confusion in testing scenarios
    if (rawDistance < 0.01) {
      smoothedDistance.current = 0
      return 0
    }
    
    // Round to 2 decimal places to reduce micro-fluctuations
    rawDistance = Math.round(rawDistance * 100) / 100
    
    if (!shouldSmooth) {
      return rawDistance
    }
    
    // Apply exponential moving average for smooth distance changes
    // alpha = 0.3 means 30% new value, 70% old value (adjust for more/less smoothing)
    const alpha = 0.3
    const smoothed = smoothedDistance.current === 0 
      ? rawDistance 
      : (alpha * rawDistance) + ((1 - alpha) * smoothedDistance.current)
    
    // Round smoothed distance to 2 decimal places
    const roundedSmoothed = Math.round(smoothed * 100) / 100
    smoothedDistance.current = roundedSmoothed
    return roundedSmoothed
  }

  // Smooth GPS coordinates to reduce jitter
  const smoothCoordinates = (newLat: number, newLng: number, prevLat: number, prevLng: number, minChange: number = 0.0001) => {
    // Check if coordinates are valid
    if (newLat === 0 && newLng === 0) {
      return { lat: prevLat, lng: prevLng }
    }
    
    // If this is the first update or coordinates are identical, return as-is
    if (prevLat === 0 && prevLng === 0) {
      return { lat: newLat, lng: newLng }
    }
    
    // Check if coordinates are identical (same location)
    if (newLat === prevLat && newLng === prevLng) {
      return { lat: newLat, lng: newLng }
    }
    
    // Calculate change magnitude
    const latDiff = Math.abs(newLat - prevLat)
    const lngDiff = Math.abs(newLng - prevLng)
    
    // If change is too small (noise/jitter), keep previous value
    if (latDiff < minChange && lngDiff < minChange) {
      return { lat: prevLat, lng: prevLng }
    }
    
    // Apply exponential moving average for larger changes
    const alpha = 0.4 // 40% new value, 60% old value
    const smoothedLat = (alpha * newLat) + ((1 - alpha) * prevLat)
    const smoothedLng = (alpha * newLng) + ((1 - alpha) * prevLng)
    
    return { lat: smoothedLat, lng: smoothedLng }
  }

  // Get real-time battery and system data
  useEffect(() => {
    const updateSystemData = () => {
      // Get real battery level if available
      if ('getBattery' in navigator) {
        (navigator as any).getBattery().then((battery: any) => {
          setVehicle1(prev => ({
            ...prev,
            battery: Math.round(battery.level * 100)
          }))
        }).catch(() => {
          // Fallback: simulate realistic battery level
          setVehicle1(prev => ({
            ...prev,
            battery: Math.floor(Math.random() * 20) + 75 // 75-95%
          }))
        })
      } else {
        // Fallback for browsers without battery API
        setVehicle1(prev => ({
          ...prev,
          battery: Math.floor(Math.random() * 20) + 75 // 75-95%
        }))
      }

      // Get real network connection info for signal strength
      if ('connection' in navigator) {
        const connection = (navigator as any).connection
        let signalStrength = 85 // Default good signal

        if (connection.effectiveType) {
          switch (connection.effectiveType) {
            case '4g': signalStrength = Math.floor(Math.random() * 15) + 85; break // 85-100%
            case '3g': signalStrength = Math.floor(Math.random() * 20) + 65; break // 65-85%
            case '2g': signalStrength = Math.floor(Math.random() * 25) + 40; break // 40-65%
            case 'slow-2g': signalStrength = Math.floor(Math.random() * 20) + 20; break // 20-40%
            default: signalStrength = Math.floor(Math.random() * 15) + 80; // 80-95%
          }
        }

        setVehicle1(prev => ({
          ...prev,
          signal: signalStrength
        }))
      } else {
        // Fallback: simulate realistic signal strength
        setVehicle1(prev => ({
          ...prev,
          signal: Math.floor(Math.random() * 20) + 75 // 75-95%
        }))
      }
    }

    // Update immediately
    updateSystemData()

    // Update every 5 seconds for real-time feel
    const interval = setInterval(updateSystemData, 5000)

    return () => clearInterval(interval)
  }, [])

  // Use nearby vehicles data from V2V backend to update connected vehicle
  useEffect(() => {
    // console.debug('nearby_changed', nearby)
    // console.debug('ids', { connectedVehicleId: connectedVehicle?.id, vehicleId })

    if (!nearby || nearby.length === 0) {
      // console.debug('nearby_empty')
      return
    }

    // Find the connected vehicle in the nearby vehicles list
    let nearbyConnectedVehicle: any = null

    if (connectedVehicle?.id) {
      nearbyConnectedVehicle = nearby.find((v: any) => {
        // console.debug('compare_vehicle', v.vehicleId || v.id, connectedVehicle.id)
        return (v.vehicleId === connectedVehicle.id) || (v.id === connectedVehicle.id)
      })
    }

    // If we don't find the connected vehicle by ID, look for any vehicle that's not us
    if (!nearbyConnectedVehicle && vehicleId) {
      console.log('🔍 Looking for any vehicle that is not me (my ID:', vehicleId + ')')
      nearbyConnectedVehicle = nearby.find((v: any) => {
        const vid = v.vehicleId || v.id
        return vid && vid !== vehicleId
      })

      if (nearbyConnectedVehicle) {
        console.log('✅ Found other vehicle (not me):', nearbyConnectedVehicle)
        // Update the connected vehicle ID to match
        if (connectedVehicle) {
          setConnectedVehicle(prev => prev ? {
            ...prev,
            id: nearbyConnectedVehicle.vehicleId || nearbyConnectedVehicle.id,
            name: nearbyConnectedVehicle.name || nearbyConnectedVehicle.driverName || prev.name
          } : prev)
        }
      }
    }

    // If we still don't have a match and there's only one nearby vehicle, use it
    if (!nearbyConnectedVehicle && nearby.length === 1) {
      console.log('🎯 Only one nearby vehicle exists, using it as connected vehicle.')
      nearbyConnectedVehicle = nearby[0]

      // Update the connected vehicle ID to match
      if (connectedVehicle) {
        setConnectedVehicle(prev => prev ? {
          ...prev,
          id: nearbyConnectedVehicle.vehicleId || nearbyConnectedVehicle.id,
          name: nearbyConnectedVehicle.name || nearbyConnectedVehicle.driverName || prev.name
        } : prev)
      }
    }

    if (nearbyConnectedVehicle) {
      // console.debug('found_connected_in_nearby', nearbyConnectedVehicle)

      setConnectedVehicle(prev => {
        if (!prev) return prev

        // Extract location from the nearby vehicle data
        let rawLat = prev.lat
        let rawLng = prev.lng

        // Check if vehicleInfo has coordinates
        if (nearbyConnectedVehicle.vehicleInfo) {
          // console.debug('vehicle_info', nearbyConnectedVehicle.vehicleInfo)
          const info = nearbyConnectedVehicle.vehicleInfo
          if (typeof info.lat === 'number' && !isNaN(info.lat)) rawLat = info.lat
          if (typeof info.lng === 'number' && !isNaN(info.lng)) rawLng = info.lng
          if (typeof info.longitude === 'number' && !isNaN(info.longitude)) rawLng = info.longitude
          if (typeof info.latitude === 'number' && !isNaN(info.latitude)) rawLat = info.latitude
        }

        // Check direct properties
        if (typeof nearbyConnectedVehicle.lat === 'number' && !isNaN(nearbyConnectedVehicle.lat)) rawLat = nearbyConnectedVehicle.lat
        if (typeof nearbyConnectedVehicle.lng === 'number' && !isNaN(nearbyConnectedVehicle.lng)) rawLng = nearbyConnectedVehicle.lng
        if (typeof nearbyConnectedVehicle.longitude === 'number' && !isNaN(nearbyConnectedVehicle.longitude)) rawLng = nearbyConnectedVehicle.longitude
        if (typeof nearbyConnectedVehicle.latitude === 'number' && !isNaN(nearbyConnectedVehicle.latitude)) rawLat = nearbyConnectedVehicle.latitude
        
        // Apply smoothing to reduce GPS jitter
        const smoothed = smoothCoordinates(rawLat, rawLng, prevConnectedCoords.current.lat, prevConnectedCoords.current.lng)
        prevConnectedCoords.current = smoothed
        const newLat = smoothed.lat
        const newLng = smoothed.lng

        // Extract battery and signal from various possible fields
        let battery = prev.battery
        let signal = prev.signal
        
        if (typeof nearbyConnectedVehicle.batteryLevel === 'number') {
          battery = nearbyConnectedVehicle.batteryLevel
        } else if (typeof nearbyConnectedVehicle.battery === 'number') {
          battery = nearbyConnectedVehicle.battery
        } else if (typeof nearbyConnectedVehicle.vehicleInfo?.battery === 'number') {
          battery = nearbyConnectedVehicle.vehicleInfo.battery
        }
        
        if (typeof nearbyConnectedVehicle.signalStrength === 'number') {
          signal = nearbyConnectedVehicle.signalStrength
        } else if (typeof nearbyConnectedVehicle.signal === 'number') {
          signal = nearbyConnectedVehicle.signal
        } else if (typeof nearbyConnectedVehicle.vehicleInfo?.signal === 'number') {
          signal = nearbyConnectedVehicle.vehicleInfo.signal
        }

        const updated = {
          ...prev,
          id: nearbyConnectedVehicle.vehicleId || nearbyConnectedVehicle.id || prev.id,
          name: nearbyConnectedVehicle.name || nearbyConnectedVehicle.driverName || prev.name,
          licensePlate: nearbyConnectedVehicle.licensePlate || nearbyConnectedVehicle.vehicleInfo?.licensePlate || prev.licensePlate,
          lat: newLat,
          lng: newLng,
          speed: (typeof nearbyConnectedVehicle.vehicleInfo?.speed === 'number') ? nearbyConnectedVehicle.vehicleInfo.speed : prev.speed,
          heading: (typeof nearbyConnectedVehicle.vehicleInfo?.heading === 'number') ? nearbyConnectedVehicle.vehicleInfo.heading : prev.heading,
          battery: battery,
          signal: signal,
        }

        // console.debug('updated_connected_from_nearby', updated)
        return updated
      })
    } else {
      console.log('❌ Connected vehicle not found in nearby list')
    }
  }, [nearby, connectedVehicle?.id, vehicleId])

  // Real-time peer location updates for connected vehicle
  useEffect(() => {
    const handler = (payload: any) => {
      // console.debug('peer_loc_update', payload)
      if (!payload) return

      // If we don't have a connected vehicle yet, or if the IDs don't match,
      // this might be the actual connected vehicle sending location updates
      if (!connectedVehicle || payload.vehicleId !== connectedVehicle.id) {
        // console.debug('peer_location_diff_vehicle_check', { current: connectedVehicle?.id, peer: payload.vehicleId })

        // If we have a connected vehicle but IDs don't match, update the ID
        if (connectedVehicle && payload.vehicleId) {
          // console.debug('update_connected_vehicle_id', { from: connectedVehicle.id, to: payload.vehicleId })
          setConnectedVehicle(prev => prev ? { ...prev, id: payload.vehicleId } : prev)
          return // Let the next update handle the location data
        }

        // If no connected vehicle, this might be it
        if (!connectedVehicle && payload.vehicleId) {
          console.log('🆕 Setting connected vehicle from peer location:', payload.vehicleId)
          setConnectedVehicle({
            id: payload.vehicleId,
            name: payload.vehicleId,
            licensePlate: `MH-${Math.floor(Math.random() * 99).toString().padStart(2, '0')}-XX-${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}`,
            lat: typeof payload.lat === 'number' ? payload.lat : 0,
            lng: typeof payload.lon === 'number' ? payload.lon : 0,
            speed: typeof payload.speed === 'number' ? payload.speed : 0,
            heading: typeof payload.heading === 'number' ? payload.heading : 0,
            battery: null,
            signal: null,
          })
          return
        }

        return // Not our connected vehicle
      }

      // Update the connected vehicle with location data
      setConnectedVehicle(prev => {
        if (!prev) return prev

        const updates: any = { ...prev }
        
        // Get raw coordinates from payload
        let rawLat = prev.lat
        let rawLng = prev.lng

        // Update coordinates if provided
        if (typeof payload.lat === 'number' && !isNaN(payload.lat)) {
          rawLat = payload.lat
        }
        if (typeof payload.lon === 'number' && !isNaN(payload.lon)) {
          rawLng = payload.lon
        }
        
        // Apply smoothing to reduce GPS jitter
        const smoothed = smoothCoordinates(rawLat, rawLng, prevConnectedCoords.current.lat, prevConnectedCoords.current.lng)
        prevConnectedCoords.current = smoothed
        updates.lat = smoothed.lat
        updates.lng = smoothed.lng

        // Update speed and heading if available
        if (typeof payload.speed === 'number' && !isNaN(payload.speed)) {
          updates.speed = payload.speed
        }
        if (typeof payload.heading === 'number' && !isNaN(payload.heading)) {
          updates.heading = payload.heading
        }

        // console.debug('updated_connected_from_peer', {
        //   id: updates.id,
        //   lat: updates.lat,
        //   lng: updates.lng,
        //   speed: updates.speed,
        //   heading: updates.heading
        // })
        return updates
      })
    }

    webSocketService.subscribe('peer_location', handler)
    return () => { webSocketService.unsubscribe('peer_location', handler) }
  }, [connectedVehicle?.id])

  // Update distance calculation if connectedVehicle selected and has coords with throttling
  useEffect(() => {
    if (!connectedVehicle) { 
      setDistance(0)
      smoothedDistance.current = 0
      return 
    }
    
    // Throttle distance updates to every 1000ms (1 second) for stability
    const now = Date.now()
    if (now - lastDistanceUpdate.current < 1000) {
      return
    }
    lastDistanceUpdate.current = now
    
    const dist = calculateDistance(vehicle1.lat, vehicle1.lng, connectedVehicle.lat, connectedVehicle.lng, true)
    setDistance(dist)
  }, [vehicle1.lat, vehicle1.lng, connectedVehicle?.lat, connectedVehicle?.lng, connectedVehicle?.id])

  // Call duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isCallActive) {
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1)
      }, 1000)
    } else {
      setCallDuration(0)
    }
    return () => clearInterval(interval)
  }, [isCallActive])

  // Subscribe to backend text messages
  useEffect(() => {
    const handler = (payload: any) => {
      const { senderId, content, timestamp } = payload || {}
      if (!content) return
      const isFromOther = senderId !== vehicleId
      const newMessage: Message = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        sender: senderId === vehicleId ? 'me' : 'other',
        content,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
        type: 'text',
        read: !isFromOther // Mark as read if it's from me, unread if from others
      }
      setMessages(prev => [...prev, newMessage])

      // Increment unread count if message is from another vehicle and messaging panel is closed
      if (isFromOther && !showMessaging) {
        setUnreadCount(prev => prev + 1)
        toast({
          title: 'New Message',
          description: `${senderId}: ${content}`,
          duration: 3000
        })
      }
    }
    webSocketService.subscribe('receive_message', handler)
    return () => {
      webSocketService.unsubscribe('receive_message', handler)
    }
  }, [vehicleId, showMessaging, toast])

  // Listen for consent request events
  useEffect(() => {
    const onReq = (payload: any) => {
      if (!payload) return
      if (payload.targetId === vehicleId) {
        console.log('CONSENT_REQUEST_RECEIVED', { from: payload.requesterId, to: payload.targetId, purpose: payload.purpose })
        setIncomingConsent({ requesterId: payload.requesterId, purpose: payload.purpose, ts: payload.ts })
        if (consentTimeoutRef.current) clearTimeout(consentTimeoutRef.current)
        consentTimeoutRef.current = setTimeout(() => {
          // Auto-decline after 30s
          if (incomingConsent) {
            webSocketService.respondConnection(incomingConsent.requesterId, false, 'timeout')
            setIncomingConsent(null)
            toast({ title: 'Connection Request Timed Out', description: 'No response sent.' })
          }
        }, 30000)
        toast({ title: 'Connection Request', description: `Vehicle ${payload.requesterId} requests to connect` })
      }
    }
    const onResp = (payload: any) => {
      if (payload?.requesterId === vehicleId) {
        setOutgoingConsentPending(false)
        if (!payload.approved) {
          toast({ title: 'Connection Declined', description: payload.reason || 'Peer declined', variant: 'destructive' })
        } else {
          toast({ title: 'Connection Approved', description: 'Starting call...' })
            // After approval, start mic and initiate call as caller
            ; (async () => {
              try {
                if (!connectedVehicle?.id) return
                console.log('CONSENT_APPROVED_START_CALL', { to: connectedVehicle.id })
                const ok = await startMicrophone()
                if (!ok) return
                await startCall(connectedVehicle.id)
                setIsCallActive(true)
              } catch (e) { /* noop */ }
            })()
        }
      }
    }
    webSocketService.subscribe('connect_request', onReq)
    webSocketService.subscribe('connect_response', onResp)
    return () => {
      webSocketService.unsubscribe('connect_request', onReq)
      webSocketService.unsubscribe('connect_response', onResp)
      if (consentTimeoutRef.current) clearTimeout(consentTimeoutRef.current)
    }
  }, [vehicleId, incomingConsent, toast])

  // Synchronized call and disconnect event handlers
  useEffect(() => {
    const handleSyncEndCall = (payload: any) => {
      console.log('📞 Received synchronized end call request:', payload)
      if (payload?.toVehicleId === vehicleId && payload?.fromVehicleId) {
        // End the call on this vehicle
        if (['active', 'connecting', 'ringing'].includes(callState.status)) {
          endCall();
          setIsCallActive(false);
          toast({
            title: 'Call Ended',
            description: 'Call ended by connected vehicle.',
            variant: 'default'
          });
        }
      }
    }

    const handleSyncDisconnect = (payload: any) => {
      console.log('🔌 Received synchronized disconnect request:', payload)
      if (payload?.toVehicleId === vehicleId && payload?.fromVehicleId) {
        setIsDisconnecting(true)

        // End any active call
        if (['active', 'connecting', 'ringing'].includes(callState.status)) {
          endCall();
          setIsCallActive(false);
        }

        // Clear connection data and messaging state
        setConnectedVehicle(null)
        setMessages([])
        setUnreadCount(0)
        setShowMessaging(false)

        // Clear session storage
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('connectedDeviceId')
          sessionStorage.removeItem('connectionInfo')
        }

        toast({
          title: 'Disconnected',
          description: `Connection ended by ${payload.fromVehicleId || 'peer vehicle'}.`,
          variant: 'default'
        })

        // Navigate back to dashboard
        console.log('🔌 Auto-redirecting to dashboard after peer disconnect')
        setTimeout(() => {
          router.push('/')
        }, 1500) // Slightly longer delay to ensure user sees the notification
      }
    }

    webSocketService.subscribe('sync_end_call', handleSyncEndCall)
    webSocketService.subscribe('sync_disconnect', handleSyncDisconnect)

    return () => {
      webSocketService.unsubscribe('sync_end_call', handleSyncEndCall)
      webSocketService.unsubscribe('sync_disconnect', handleSyncDisconnect)
    }
  }, [vehicleId, callState.status, endCall, toast])

  // Consent request removed - PeerJS handles this automatically
  const sendConsentRequest = () => {
    if (!connectedVehicle?.id) {
      toast({ title: 'No Vehicle', description: 'Select a vehicle first', variant: 'destructive' });
      return;
    }
    // Directly start the call with PeerJS - no consent flow needed
    handleToggleCall();
  }

  const approveConsent = () => {
    if (incomingConsent) {
      console.log('CONSENT_APPROVED_BY_CALLEE', { for: incomingConsent.requesterId })
      webSocketService.respondConnection(incomingConsent.requesterId, true)
      setIncomingConsent(null)
      if (consentTimeoutRef.current) { clearTimeout(consentTimeoutRef.current); consentTimeoutRef.current = null }
      toast({ title: 'Request Approved', description: 'Consent granted.' })
    }
  }
  const declineConsent = (reason?: string) => {
    if (incomingConsent) {
      console.log('CONSENT_DECLINED_BY_CALLEE', { for: incomingConsent.requesterId, reason: reason || 'declined' })
      webSocketService.respondConnection(incomingConsent.requesterId, false, reason || 'declined')
      setIncomingConsent(null)
      if (consentTimeoutRef.current) { clearTimeout(consentTimeoutRef.current); consentTimeoutRef.current = null }
      toast({ title: 'Request Declined', description: 'Consent not granted.' })
    }
  }

  // Initial backend connect + register and force refresh nearby vehicles
  useEffect(() => {
    let cancelled = false

    const initializeBackend = async () => {
      try {
        await connect()
        if (cancelled) return

        const stored = typeof window !== 'undefined' ? sessionStorage.getItem('connectionInfo') : null
        // Derive stable vehicleId from stored profile if present, else random fallback
        let deviceId = 'vehicle-' + Math.random().toString(36).slice(2, 8)
        let deviceName = 'Connected Vehicle'
        let licensePlate = 'DL-XX-XX-XXXX' // Default fallback

        try {
          const authRaw = sessionStorage.getItem('authUser')
          if (authRaw) {
            const u = JSON.parse(authRaw)
            if (u?.vehicle?.vehicleId) deviceId = u.vehicle.vehicleId
            if (u?.fullName) deviceName = u.fullName
            if (u?.vehicle?.licensePlate) licensePlate = u.vehicle.licensePlate
          }
        } catch { /* ignore */ }

        if (stored) {
          try {
            const info = JSON.parse(stored)
            deviceId = info.deviceId || deviceId
            deviceName = info.deviceName || deviceName
          } catch { }
        }

        await register({
          vehicleId: deviceId,
          driverName: deviceName,
          batteryLevel: vehicle1.battery || 85,
          signalStrength: vehicle1.signal || 85,
          vehicleInfo: {
            licensePlate: licensePlate,
            model: 'Connected Vehicle',
            color: 'Unknown'
          }
        })

        // Force a location update to trigger nearby vehicles refresh
        if (!cancelled) {
          // Small delay to ensure registration is complete
          setTimeout(() => {
            if (!cancelled) {
              // Use current vehicle1 position at the time of execution with battery/signal
              updateLocation(vehicle1.lat, vehicle1.lng, vehicle1.battery, vehicle1.signal)
              // Trigger a manual refresh event to force nearby devices update
              window.dispatchEvent(new CustomEvent('v2v-manual-refresh'))
            }
          }, 2000)

          // Set up periodic refresh to ensure we get updated data
          const refreshInterval = setInterval(() => {
            if (!cancelled) {
              updateLocation(vehicle1.lat, vehicle1.lng, vehicle1.battery, vehicle1.signal)
              window.dispatchEvent(new CustomEvent('v2v-manual-refresh'))
            }
          }, 10000) // Refresh every 10 seconds

          // Cleanup interval on component unmount
          return () => {
            clearInterval(refreshInterval)
          }
        }
      } catch (error) {
        console.error('Backend initialization error:', error)
      }
    }

    initializeBackend()
    return () => { cancelled = true }
  }, [connect, register, updateLocation]) // Remove dynamic coordinates from dependency array

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const formatCoordinate = (coord: number, isLat: boolean) => {
    const direction = isLat ? (coord >= 0 ? "N" : "S") : coord >= 0 ? "E" : "W"
    return `${Math.abs(coord).toFixed(6)}° ${direction}`
  }

  // --- Microphone (Audio Capture) ---
  const startMicrophone = async (): Promise<boolean> => {
    if (micStream) return true
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        throw new Error('Microphone not supported')
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      setMicStream(stream)
      setMicPermissionDenied(false)

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
      audioContextRef.current = audioCtx
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 512
      analyserRef.current = analyser
      source.connect(analyser)
      const dataArray = new Uint8Array(analyser.frequencyBinCount)

      const updateLevel = () => {
        analyser.getByteTimeDomainData(dataArray)
        // Compute RMS
        let sum = 0
        for (let i = 0; i < dataArray.length; i++) {
          const v = (dataArray[i] - 128) / 128
          sum += v * v
        }
        const rms = Math.sqrt(sum / dataArray.length)
        setAudioLevel(rms)
        animationFrameRef.current = requestAnimationFrame(updateLevel)
      }
      updateLevel()
      toast({ title: 'Microphone Active', description: 'Voice capture started.' })
      return true
    } catch (err: any) {
      toast({ title: 'Microphone Error', description: err.message || 'Unable to access microphone', variant: 'destructive' })
      setMicPermissionDenied(true)
      setIsCallActive(false)
      return false
    }
  }

  const stopMicrophone = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
    if (micStream) {
      micStream.getTracks().forEach(t => t.stop())
      setMicStream(null)
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close() } catch { /* ignore */ }
      audioContextRef.current = null
    }
    analyserRef.current = null
    setAudioLevel(0)
  }

  // Toggle mute - use PeerJS hook's toggle function
  const toggleMuteMic = () => {
    peerToggleMute();
  }

  // Toggle call using PeerJS
  const handleToggleCall = async () => {
    // If currently in active or connecting call, end it
    if (['active', 'connecting', 'ringing'].includes(callState.status)) {
      endCall();
      setIsCallActive(false);
      toast({ title: 'Call Ended', description: 'Voice call stopped.' });
      return;
    }

    // Start call to connected vehicle
    try {
      if (!connectedVehicle?.id) {
        throw new Error('No target vehicle selected');
      }

      if (!peerReady) {
        throw new Error('PeerJS not ready yet');
      }

      console.log('📞 ==================== CALL DEBUG ====================');
      console.log('📞 My Vehicle ID (caller):', vehicleId);
      console.log('📞 Connected Vehicle ID (receiver):', connectedVehicle.id);
      console.log('📞 Connected Vehicle Name:', connectedVehicle.name);
      console.log('📞 PeerJS Ready:', peerReady);
      console.log('📞 Starting call to peer ID:', connectedVehicle.id);
      console.log('📞 ==================================================');

      await startCall(connectedVehicle.id);
      setIsCallActive(true);
      toast({
        title: 'Calling...',
        description: `Connecting to ${connectedVehicle.name || connectedVehicle.id}`
      });
    } catch (e: any) {
      console.error('Failed to start call:', e);
      toast({
        title: 'Call Failed',
        description: e.message || 'Unable to start call',
        variant: 'destructive'
      });
    }
  }

  // Handle call state changes
  useEffect(() => {
    console.log('📞 Call state changed:', callState.status, 'incomingCall:', callState.incomingCall);

    if (callState.status === 'ended' || callState.status === 'idle') {
      setIsCallActive(false);
    }
    if (callState.status === 'active') {
      setIsCallActive(true);
      toast({
        title: 'Call Connected',
        description: 'Voice call is now active'
      });
    }
    if (callState.status === 'connecting' || callState.status === 'ringing') {
      setIsCallActive(true);

      if (callState.status === 'ringing' && callState.incomingCall) {
        console.log('📞 🔔 INCOMING CALL UI SHOULD BE SHOWING NOW!');
        toast({
          title: 'Incoming Call',
          description: `${callState.remotePeerId} is calling...`,
        });
      }
    }
    if (callState.status === 'error') {
      setIsCallActive(false);
      toast({
        title: 'Call Error',
        description: callState.error || 'Connection failed',
        variant: 'destructive'
      });
    }
  }, [callState.status, callState.error, callState.incomingCall, callState.remotePeerId, toast]);

  // Handle remote stream changes and setup audio playback
  useEffect(() => {
    if (remoteStream) {
      console.log('📞 Remote stream available, tracks:', remoteStream.getTracks().length);
      remoteStream.getTracks().forEach(track => {
        console.log('📞 Remote track:', track.kind, track.id, 'enabled:', track.enabled);
      });

      // Don't create separate hidden audio element - only use the visible UI element
      // This prevents "play() interrupted by new load request" errors
      console.log('📞 Remote stream ready - will play via UI audio element');
    }
  }, [remoteStream])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMicrophone()
      if (geoWatchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(geoWatchId)
      }
    }
  }, [geoWatchId])

  // --- Geolocation (Real-time coordinates) ---
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setGeoError('Geolocation not supported')
      return
    }
    const id = navigator.geolocation.watchPosition(
      pos => {
        setGeoError(null)
        
        // Apply smoothing to my vehicle coordinates
        const smoothed = smoothCoordinates(
          pos.coords.latitude, 
          pos.coords.longitude, 
          prevVehicle1Coords.current.lat, 
          prevVehicle1Coords.current.lng,
          0.00005 // Tighter threshold for my vehicle (more sensitive)
        )
        prevVehicle1Coords.current = smoothed
        
        const newVehicle1 = {
          ...vehicle1,
          lat: smoothed.lat,
          lng: smoothed.lng,
          // Approximate speed if provided (m/s to km/h)
          speed: typeof pos.coords.speed === 'number' && !Number.isNaN(pos.coords.speed) ? Math.max(0, pos.coords.speed * 3.6) : vehicle1.speed,
          heading: typeof pos.coords.heading === 'number' && !Number.isNaN(pos.coords.heading) ? pos.coords.heading : vehicle1.heading,
          accuracy: typeof pos.coords.accuracy === 'number' ? pos.coords.accuracy : vehicle1.accuracy,
        }

        setVehicle1(newVehicle1)

        // console.debug('my_vehicle_location', { lat: pos.coords.latitude, lng: pos.coords.longitude, speed: newVehicle1.speed, heading: newVehicle1.heading })

        // Push to backend with battery and signal data
        if (updateLocation) {
          updateLocation(pos.coords.latitude, pos.coords.longitude, newVehicle1.battery, newVehicle1.signal)
          // console.debug('sent_location_update', pos.coords.latitude, pos.coords.longitude, newVehicle1.battery, newVehicle1.signal)
        }
      },
      err => {
        setGeoError(err.message)
        console.error('Geolocation error:', err.message)
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    )
    setGeoWatchId(id)
  }, []) // Remove updateLocation dependency to prevent restarts

  const handleDisconnect = () => {
    if (isDisconnecting) return // Prevent multiple disconnect attempts

    setIsDisconnecting(true)

    try {
      // Send synchronized disconnect message to connected vehicle
      if (connectedVehicle?.id) {
        webSocketService.sendMessage('sync_disconnect', {
          fromVehicleId: vehicleId,
          toVehicleId: connectedVehicle.id,
          reason: 'user_disconnect',
          timestamp: Date.now()
        })
        console.log('🔌 Sent synchronized disconnect message to:', connectedVehicle.id)
      }

      // End any active call
      if (['active', 'connecting', 'ringing'].includes(callState.status)) {
        endCall();
        setIsCallActive(false);
      }

      // Clear connection-related state
      setConnectedVehicle(null)
      setMessages([])
      setUnreadCount(0)
      setShowMessaging(false)

      // Clear session storage
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('connectedDeviceId')
        sessionStorage.removeItem('connectionInfo')
      }

      toast({
        title: 'Disconnecting...',
        description: connectedVehicle ? `Disconnecting from ${connectedVehicle.name}` : 'Disconnecting from vehicle',
        variant: 'default'
      })

      // Navigate back to main dashboard
      setTimeout(() => {
        router.push('/')
      }, 1000)
    } catch (error) {
      console.error('Disconnect error:', error)
      // Force redirect even if there's an error
      setTimeout(() => {
        router.push('/')
      }, 500)
    }
  }

  const handleSendMessage = () => {
    if (!newMessage.trim()) return
    // Optimistic UI append
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      sender: 'me',
      content: newMessage.trim(),
      timestamp: new Date(),
      type: 'text',
      read: true
    }])
    try {
      if (connectedVehicle?.id) {
        webSocketService.sendText(connectedVehicle.id, newMessage.trim())
      }
      toast({ title: 'Message Sent', description: 'Your message has been delivered' })
    } catch (e: any) {
      toast({ title: 'Send Failed', description: e.message || 'Failed to send', variant: 'destructive' })
    }
    setNewMessage('')
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleOpenMessaging = () => {
    setShowMessaging(true)
    // Mark all unread messages as read when opening messaging panel
    setMessages(prev => prev.map(msg => ({ ...msg, read: true })))
    setUnreadCount(0)
  }

  const handleCloseMessaging = () => {
    setShowMessaging(false)
  }

  // Reset notifications when disconnecting
  useEffect(() => {
    if (!connectedVehicle) {
      setMessages([])
      setUnreadCount(0)
      setShowMessaging(false)
    }
  }, [connectedVehicle])

  // Auto-mark messages as read when messaging panel is open
  useEffect(() => {
    if (showMessaging) {
      setMessages(prev => prev.map(msg => ({ ...msg, read: true })))
      setUnreadCount(0)
    }
  }, [showMessaging, messages.length]);

  // Vehicle Card Component
  const renderVehicleCard = (vehicle: Vehicle, color: string, isMyVehicle?: boolean) => {
    return (
      <Card className="w-full">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Car className={`h-5 w-5 text-${color}-600`} />
            {vehicle.name}
            {isMyVehicle && (
              <Badge variant="secondary" className="text-xs ml-auto">
                Me
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">GPS Coordinates</span>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <div>Lat: {formatCoordinate(vehicle.lat, true)}</div>
                <div>Lng: {formatCoordinate(vehicle.lng, false)}</div>
                {isMyVehicle && vehicle.accuracy !== undefined && (
                  <div>Accuracy: ±{vehicle.accuracy.toFixed(0)} m</div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Navigation className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Movement</span>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <div>Speed: {vehicle.speed.toFixed(1)} km/h</div>
                <div>Heading: {vehicle.heading.toFixed(0)}°</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Battery className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Battery</span>
              </div>
              {typeof vehicle.battery === 'number' ? (
                <>
                  <Progress value={vehicle.battery} className="h-2" />
                  <div className="text-xs text-muted-foreground">{vehicle.battery.toFixed(0)}%</div>
                </>
              ) : (
                <div className="text-xs text-muted-foreground">N/A</div>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Signal className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Signal</span>
              </div>
              {typeof vehicle.signal === 'number' ? (
                <>
                  <Progress value={vehicle.signal} className="h-2" />
                  <div className="text-xs text-muted-foreground">{vehicle.signal.toFixed(0)}%</div>
                </>
              ) : (
                <div className="text-xs text-muted-foreground">N/A</div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col space-y-4 md:space-y-0 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
              <Car className="h-6 w-6 md:h-8 md:w-8 text-primary" />
              {connectedVehicle ? `Akhyana: Connected to ${connectedVehicle.name}` : 'Akhyana: Select a vehicle'}
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Real-time vehicle-to-vehicle communication active
            </p>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              className="flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
            </Button>
          </div>
        </div>

        {/* Communication Status Card */}
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wifi className="h-5 w-5" />
              Communication Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center space-y-2">
                <div className="text-2xl font-bold text-green-600">
                  {connectedVehicle ? (
                    distance < 1 ? (
                      `${(distance * 1000).toFixed(0)} m`
                    ) : (
                      `${distance.toFixed(2)} km`
                    )
                  ) : '—'}
                </div>
                <div className="text-sm text-muted-foreground">{connectedVehicle ? 'Distance Between Vehicles' : 'No vehicle selected'}</div>
              </div>

              <div className="text-center space-y-2">
                <div className="flex justify-center">
                  <Badge
                    variant={distance < 1 ? "default" : distance < 5 ? "secondary" : "outline"}
                    className="text-sm"
                  >
                    {distance < 1 ? "Excellent Signal" : distance < 5 ? "Strong Signal" : distance < 15 ? "Good Signal" : "Weak Signal"}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">Connection Quality</div>
              </div>

              <div className="text-center space-y-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    <Button
                      onClick={handleToggleCall}
                      variant={isCallActive ? "outline" : "default"}
                      className="w-full sm:w-auto relative"
                    >
                      {['active', 'connecting', 'calling', 'ringing'].includes(callState.status) ? (
                        <>
                          <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />
                          <PhoneOff className="h-4 w-4 mr-2" />
                          {callState.status === 'calling' && !callState.incomingCall ? 'Calling...' :
                            callState.status === 'connecting' ? 'Connecting...' :
                              callState.status === 'active' ? 'End Call' : 'Cancel'}
                        </>
                      ) : (
                        <>
                          <Phone className="h-4 w-4 mr-2" />
                          {micPermissionDenied ? 'Turn On Mic' : 'Start Call'}
                        </>
                      )}
                    </Button>
                    {['active', 'connecting', 'calling'].includes(callState.status) && !callState.incomingCall && (
                      <Button
                        onClick={toggleMuteMic}
                        variant={peerMicMuted ? 'secondary' : 'outline'}
                        className="w-full sm:w-auto"
                      >
                        {peerMicMuted ? 'Unmute Mic' : 'Mute Mic'}
                      </Button>
                    )}
                  </div>
                  {outgoingConsentPending && (
                    <div className="text-xs text-muted-foreground text-center">Waiting for approval...</div>
                  )}
                  {callState.status === 'connecting' && (
                    <div className="text-xs text-blue-600 bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-800 rounded px-2 py-1">
                      Establishing connection...
                    </div>
                  )}
                  {callState.status === 'ringing' && callState.incomingCall && (
                    <div className="text-xs space-y-2 border-2 border-green-500 bg-green-50 dark:bg-green-900/20 rounded p-3">
                      <div className="text-sm font-semibold text-green-700 dark:text-green-300 text-center">
                        📞 Incoming Call from {callState.remotePeerId}
                      </div>
                      <div className="flex gap-2 justify-center">
                        <Button
                          onClick={acceptCall}
                          variant="default"
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <Phone className="h-4 w-4 mr-1" />
                          Accept
                        </Button>
                        <Button
                          onClick={rejectCall}
                          variant="destructive"
                          size="sm"
                        >
                          <PhoneOff className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  )}
                  {callState.status === 'calling' && !callState.incomingCall && (
                    <div className="text-xs text-blue-600 bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-800 rounded px-2 py-1">
                      Calling... waiting for answer
                    </div>
                  )}
                  {!isCallActive && micPermissionDenied && (
                    <div className="text-xs text-amber-600 bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-800 rounded px-2 py-1">
                      Microphone permission denied. Please allow mic access and click "Turn On Mic".
                    </div>
                  )}
                </div>
                {isCallActive && (
                  <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
                    <span>Duration: {formatTime(callDuration)}</span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      Live
                    </span>
                    <div className="w-16 h-2 bg-muted rounded overflow-hidden">
                      <div className="h-full bg-green-500 transition-all" style={{ width: `${Math.min(100, Math.round(audioLevel * 160))}%` }} />
                    </div>
                  </div>
                )}
              </div>

              <div className="text-center space-y-2">
                <div className="relative inline-block">
                  <Button
                    onClick={handleOpenMessaging}
                    variant={showMessaging ? "secondary" : "outline"}
                    className="w-full sm:w-auto"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Messages
                  </Button>
                  {unreadCount > 0 && (
                    <Badge
                      variant="destructive"
                      className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center"
                    >
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {messages.filter(m => m.type === 'text').length} messages
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Messaging Panel */}
        {showMessaging && (
          <Card className="w-full">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  {connectedVehicle ? `Messages with ${connectedVehicle.name}` : 'No vehicle selected'}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCloseMessaging}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ScrollArea className="h-64 w-full border rounded-md p-4">
                <div className="space-y-3">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.sender === 'me' ? 'justify-end' : 'justify-start'
                        }`}
                    >
                      <div
                        className={`max-w-xs lg:max-w-md px-3 py-2 rounded-lg text-sm relative ${message.type === 'system'
                          ? 'bg-muted text-muted-foreground text-center w-full'
                          : message.sender === 'me'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                          }`}
                      >
                        {message.sender === 'other' && !message.read && (
                          <div className="absolute -left-1 top-2 h-2 w-2 bg-red-500 rounded-full"></div>
                        )}
                        <div>{message.content}</div>
                        <div className={`text-xs mt-1 ${message.type === 'system' || message.sender === 'me'
                          ? 'text-primary-foreground/70'
                          : 'text-muted-foreground'
                          }`}>
                          {message.timestamp.toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="flex gap-2">
                <Input
                  placeholder="Type your message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="flex-1"
                />
                <Button onClick={handleSendMessage} disabled={!newMessage.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Connected Vehicles Display */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* My Vehicle */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-center">My Vehicle</h3>
            {renderVehicleCard(vehicle1, "emerald", true)}
          </div>

          {/* Connected Vehicle */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-center">
              {connectedVehicle ? 'Connected Vehicle' : 'No Vehicle Connected'}
            </h3>
            {connectedVehicle ? (
              renderVehicleCard(connectedVehicle, "orange")
            ) : (
              <Card className="flex items-center justify-center p-12 text-center">
                <div className="space-y-2">
                  <Car className="h-12 w-12 mx-auto text-muted-foreground" />
                  <div className="text-lg font-medium text-muted-foreground">No Vehicle Connected</div>
                  <div className="text-sm text-muted-foreground">Connect to a vehicle to see their data here</div>
                </div>
              </Card>
            )}
          </div>
        </div>

        {/* Status Indicators */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="text-center p-4">
            <div className="space-y-2">
              <div className={`w-3 h-3 rounded-full mx-auto ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
              <div className="text-sm font-medium">V2V {connected ? 'Active' : 'Offline'}</div>
            </div>
          </Card>

          <Card className="text-center p-4">
            <div className="space-y-2">
              <div
                className={`w-3 h-3 rounded-full mx-auto ${isCallActive ? "bg-green-500 animate-pulse" : "bg-gray-300"}`}
              ></div>
              <div className="text-sm font-medium">Voice Call</div>
            </div>
          </Card>

          <Card className="text-center p-4">
            <div className="space-y-2">
              <div className={`w-3 h-3 rounded-full mx-auto ${!geoError ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <div className="text-sm font-medium">GPS {!geoError ? 'Lock' : 'Error'}</div>
            </div>
          </Card>

          <Card className="text-center p-4">
            <div className="space-y-2">
              <div className={`w-3 h-3 rounded-full mx-auto ${distance < 50 ? "bg-green-500" : distance < 100 ? "bg-yellow-500" : "bg-orange-500"}`}></div>
              <div className="text-sm font-medium">Range {distance < 50 ? 'Excellent' : distance < 100 ? 'Good' : 'Extended'}</div>
            </div>
          </Card>

          {geoError && (
            <Card className="col-span-2 md:col-span-4 text-center p-4 border-destructive/50">
              <div className="space-y-2">
                <div className="w-3 h-3 bg-red-500 rounded-full mx-auto"></div>
                <div className="text-sm font-medium">GPS Error</div>
                <div className="text-xs text-muted-foreground px-2">{geoError}</div>
              </div>
            </Card>
          )}
        </div>

        <Toaster />
        {incomingConsent && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-background border rounded-lg p-6 w-full max-w-sm space-y-4 shadow-xl">
              <h2 className="text-lg font-semibold">Connection Request</h2>
              <p className="text-sm text-muted-foreground">Vehicle <span className="font-mono">{incomingConsent.requesterId}</span> wants to connect {incomingConsent.purpose ? `for ${incomingConsent.purpose}` : ''}.</p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => declineConsent('declined')}>Decline</Button>
                <Button onClick={approveConsent}>Approve</Button>
              </div>
              <div className="text-[10px] text-muted-foreground text-right">Auto-decline in 30s</div>
            </div>
          </div>
        )}
      </div>
    </div >
  )
}