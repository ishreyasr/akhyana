'use client';

import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmergencyAlert } from '@/types/v2v.types';
import { AlertTriangle, Car, Construction, Heart, MapPin } from 'lucide-react';

interface EmergencyAlertDialogProps {
    alert: EmergencyAlert | null;
    open: boolean;
    onConnect: () => void;
    onIgnore: () => void;
}

export function EmergencyAlertDialog({ alert, open, onConnect, onIgnore }: EmergencyAlertDialogProps) {
    const [timeAgo, setTimeAgo] = useState('');

    useEffect(() => {
        if (!alert) return;

        const updateTime = () => {
            const diff = Math.floor((Date.now() - alert.timestamp.getTime()) / 1000);
            if (diff < 60) setTimeAgo(`${diff}s ago`);
            else if (diff < 3600) setTimeAgo(`${Math.floor(diff / 60)}m ago`);
            else setTimeAgo(`${Math.floor(diff / 3600)}h ago`);
        };

        updateTime();
        const interval = setInterval(updateTime, 1000);
        return () => clearInterval(interval);
    }, [alert]);

    if (!alert) return null;

    const getAlertIcon = () => {
        switch (alert.type) {
            case 'medical':
                return <Heart className="h-8 w-8 text-red-500" />;
            case 'accident':
                return <Car className="h-8 w-8 text-orange-500" />;
            case 'breakdown':
                return <Construction className="h-8 w-8 text-yellow-500" />;
            case 'hazard':
                return <AlertTriangle className="h-8 w-8 text-amber-500" />;
            default:
                return <AlertTriangle className="h-8 w-8" />;
        }
    };

    const getAlertTitle = () => {
        switch (alert.type) {
            case 'medical':
                return 'Medical Emergency';
            case 'accident':
                return 'Accident Alert';
            case 'breakdown':
                return 'Vehicle Breakdown';
            case 'hazard':
                return 'Road Hazard';
            default:
                return 'Emergency Alert';
        }
    };

    const getSeverityBadge = () => {
        const colors = {
            low: 'bg-yellow-500',
            medium: 'bg-orange-500',
            high: 'bg-red-500',
            critical: 'bg-red-700'
        };
        return (
            <Badge className={`${colors[alert.severity]} text-white`}>
                {alert.severity.toUpperCase()}
            </Badge>
        );
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onIgnore()}>
            <DialogContent className="sm:max-w-[500px] border-2 border-red-500">
                <DialogHeader>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-3 bg-red-50 dark:bg-red-950 rounded-full animate-pulse">
                            {getAlertIcon()}
                        </div>
                        <div className="flex-1">
                            <DialogTitle className="text-xl font-bold text-red-600 dark:text-red-400">
                                {getAlertTitle()}
                            </DialogTitle>
                            <div className="flex items-center gap-2 mt-1">
                                {getSeverityBadge()}
                                <span className="text-xs text-muted-foreground">{timeAgo}</span>
                            </div>
                        </div>
                    </div>
                    <DialogDescription className="text-base">
                        A nearby vehicle needs assistance
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Alert Message */}
                    <div className="p-4 bg-muted rounded-lg">
                        <p className="text-sm font-medium mb-1">Message:</p>
                        <p className="text-base">{alert.message}</p>
                    </div>

                    {/* Vehicle Information */}
                    {alert.senderId && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Car className="h-4 w-4" />
                            <span>Vehicle ID: {alert.senderId}</span>
                        </div>
                    )}

                    {/* Location Information */}
                    {alert.location && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <MapPin className="h-4 w-4" />
                            <span>Location: {alert.location.lat.toFixed(4)}, {alert.location.lng.toFixed(4)}</span>
                        </div>
                    )}

                    {/* Warning Message */}
                    <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
                        <p className="text-sm text-amber-800 dark:text-amber-200">
                            <strong>⚠️ Emergency:</strong> This vehicle requires immediate assistance.
                            Connect to offer help or ignore if you cannot assist.
                        </p>
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                        variant="outline"
                        onClick={onIgnore}
                        className="flex-1"
                    >
                        Ignore
                    </Button>
                    <Button
                        onClick={onConnect}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                        Connect & Help
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
