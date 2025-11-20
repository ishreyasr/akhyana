"use client"

import { useState, useEffect } from "react"
import { Car, MapPin, Phone, PhoneOff, Navigation, Signal, Battery, Wifi } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"

interface Vehicle {
  id: string
  name: string
  lat: number
  lng: number
  speed: number
  heading: number
  battery: number
  signal: number
}

export default function Component() {
  const [vehicle1, setVehicle1] = useState<Vehicle>({
    id: "V001",
    name: "Vehicle Alpha",
    lat: 37.7749,
    lng: -122.4194,
    speed: 45,
    heading: 90,
    battery: 85,
    signal: 92,
  })

  const [vehicle2, setVehicle2] = useState<Vehicle>({
    id: "V002",
    name: "Vehicle Beta",
    lat: 37.7849,
    lng: -122.4094,
    speed: 52,
    heading: 270,
    battery: 73,
    signal: 88,
  })

  const [isCallActive, setIsCallActive] = useState(false)
  const [callDuration, setCallDuration] = useState(0)
  const [distance, setDistance] = useState(0)

  // Calculate distance between two GPS coordinates
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371 // Earth's radius in kilometers
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLng = ((lng2 - lng1) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  // Simulate vehicle movement and updates
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate slight GPS coordinate changes
      setVehicle1((prev) => ({
        ...prev,
        lat: prev.lat + (Math.random() - 0.5) * 0.001,
        lng: prev.lng + (Math.random() - 0.5) * 0.001,
        speed: Math.max(0, prev.speed + (Math.random() - 0.5) * 5),
        heading: (prev.heading + (Math.random() - 0.5) * 10) % 360,
        battery: Math.max(0, Math.min(100, prev.battery + (Math.random() - 0.5) * 2)),
        signal: Math.max(0, Math.min(100, prev.signal + (Math.random() - 0.5) * 5)),
      }))

      setVehicle2((prev) => ({
        ...prev,
        lat: prev.lat + (Math.random() - 0.5) * 0.001,
        lng: prev.lng + (Math.random() - 0.5) * 0.001,
        speed: Math.max(0, prev.speed + (Math.random() - 0.5) * 5),
        heading: (prev.heading + (Math.random() - 0.5) * 10) % 360,
        battery: Math.max(0, Math.min(100, prev.battery + (Math.random() - 0.5) * 2)),
        signal: Math.max(0, Math.min(100, prev.signal + (Math.random() - 0.5) * 5)),
      }))
    }, 2000)

    return () => clearInterval(interval)
  }, [])

  // Update distance calculation
  useEffect(() => {
    const dist = calculateDistance(vehicle1.lat, vehicle1.lng, vehicle2.lat, vehicle2.lng)
    setDistance(dist)
  }, [vehicle1.lat, vehicle1.lng, vehicle2.lat, vehicle2.lng])

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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const formatCoordinate = (coord: number, isLat: boolean) => {
    const direction = isLat ? (coord >= 0 ? "N" : "S") : coord >= 0 ? "E" : "W"
    return `${Math.abs(coord).toFixed(6)}° ${direction}`
  }

  const VehicleCard = ({ vehicle, color }: { vehicle: Vehicle; color: string }) => (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Car className={`h-5 w-5 text-${color}-600`} />
          {vehicle.name}
          <Badge variant="outline" className="ml-auto">
            {vehicle.id}
          </Badge>
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
            <Progress value={vehicle.battery} className="h-2" />
            <div className="text-xs text-muted-foreground">{vehicle.battery.toFixed(0)}%</div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Signal className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Signal</span>
            </div>
            <Progress value={vehicle.signal} className="h-2" />
            <div className="text-xs text-muted-foreground">{vehicle.signal.toFixed(0)}%</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">V2V Communication Dashboard</h1>
          <p className="text-muted-foreground">Real-time vehicle-to-vehicle communication monitoring</p>
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center space-y-2">
                <div className="text-2xl font-bold text-green-600">{distance.toFixed(2)} km</div>
                <div className="text-sm text-muted-foreground">Distance Between Vehicles</div>
              </div>

              <div className="text-center space-y-2">
                <div className="flex justify-center">
                  <Badge
                    variant={distance < 5 ? "default" : distance < 10 ? "secondary" : "outline"}
                    className="text-sm"
                  >
                    {distance < 5 ? "Strong Signal" : distance < 10 ? "Good Signal" : "Weak Signal"}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">Connection Quality</div>
              </div>

              <div className="text-center space-y-2">
                <Button
                  onClick={() => setIsCallActive(!isCallActive)}
                  variant={isCallActive ? "destructive" : "default"}
                  className="w-full sm:w-auto"
                >
                  {isCallActive ? (
                    <>
                      <PhoneOff className="h-4 w-4 mr-2" />
                      End Call
                    </>
                  ) : (
                    <>
                      <Phone className="h-4 w-4 mr-2" />
                      Start Call
                    </>
                  )}
                </Button>
                {isCallActive && (
                  <div className="text-sm text-muted-foreground">Duration: {formatTime(callDuration)}</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Vehicle Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <VehicleCard vehicle={vehicle1} color="emerald" />
          <VehicleCard vehicle={vehicle2} color="orange" />
        </div>

        {/* Status Indicators */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="text-center p-4">
            <div className="space-y-2">
              <div className="w-3 h-3 bg-green-500 rounded-full mx-auto animate-pulse"></div>
              <div className="text-sm font-medium">V2V Active</div>
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
              <div className="w-3 h-3 bg-green-500 rounded-full mx-auto"></div>
              <div className="text-sm font-medium">GPS Lock</div>
            </div>
          </Card>

          <Card className="text-center p-4">
            <div className="space-y-2">
              <div className={`w-3 h-3 rounded-full mx-auto ${distance < 10 ? "bg-green-500" : "bg-yellow-500"}`}></div>
              <div className="text-sm font-medium">Range OK</div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
