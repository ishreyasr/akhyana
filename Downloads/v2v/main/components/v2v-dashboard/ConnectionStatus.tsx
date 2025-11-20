import React from 'react';
import { Badge } from '../ui/badge';
import { Wifi, WifiOff, RotateCw, AlertCircle } from 'lucide-react';
import { useIsClient } from '../../hooks/useIsClient';

interface ConnectionStatusProps {
  connectionState: string;
  className?: string;
}

export function ConnectionStatus({ connectionState, className = '' }: ConnectionStatusProps) {
  const isClient = useIsClient();

  // Don't render anything during SSR to prevent hydration mismatch
  if (!isClient) {
    return (
      <Badge variant="outline" className={`flex items-center gap-1 bg-gray-500 text-white ${className}`}>
        <WifiOff className="w-3 h-3" />
        <span className="text-xs">Loading...</span>
      </Badge>
    );
  }
  const getStatusInfo = () => {
    switch (connectionState) {
      case 'connected':
        return {
          icon: <Wifi className="w-3 h-3" />,
          text: 'Connected',
          variant: 'default' as const,
          className: 'bg-green-500 text-white'
        };
      case 'connecting':
        return {
          icon: <RotateCw className="w-3 h-3 animate-spin" />,
          text: 'Connecting',
          variant: 'secondary' as const,
          className: 'bg-yellow-500 text-white'
        };
      case 'reconnecting':
        return {
          icon: <RotateCw className="w-3 h-3 animate-spin" />,
          text: 'Reconnecting',
          variant: 'secondary' as const,
          className: 'bg-yellow-600 text-white'
        };
      case 'disconnected':
        return {
          icon: <WifiOff className="w-3 h-3" />,
          text: 'Disconnected',
          variant: 'destructive' as const,
          className: 'bg-red-500 text-white'
        };
      case 'error':
        return {
          icon: <AlertCircle className="w-3 h-3" />,
          text: 'Connection Error',
          variant: 'destructive' as const,
          className: 'bg-red-600 text-white'
        };
      default:
        return {
          icon: <WifiOff className="w-3 h-3" />,
          text: 'Idle',
          variant: 'outline' as const,
          className: 'bg-gray-500 text-white'
        };
    }
  };

  const status = getStatusInfo();

  return (
    <Badge
      variant={status.variant}
      className={`flex items-center gap-1 ${status.className} ${className}`}
    >
      {status.icon}
      <span className="text-xs">{status.text}</span>
    </Badge>
  );
}
