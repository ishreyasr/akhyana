'use client'

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import {
    Car,
    Truck,
    Building,
    Clock,
    CheckCircle,
    XCircle,
    AlertTriangle
} from 'lucide-react';
import { useToast } from '../ui/use-toast';

interface ConnectionRequest {
    requesterId: string;
    targetId: string;
    purpose?: string;
    timestamp: number;
}

interface ConnectionApprovalDialogProps {
    isOpen: boolean;
    request: ConnectionRequest | null;
    onApprove: () => void;
    onDecline: (reason?: string) => void;
    onTimeout: () => void;
}

export function ConnectionApprovalDialog({
    isOpen,
    request,
    onApprove,
    onDecline,
    onTimeout
}: ConnectionApprovalDialogProps) {
    const { toast } = useToast();
    const [timeLeft, setTimeLeft] = useState(30);
    const [autoDeclineReason, setAutoDeclineReason] = useState<string>('user_declined');

    // Countdown timer
    useEffect(() => {
        if (!isOpen || !request) {
            setTimeLeft(30);
            return;
        }

        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    // Auto-decline when time runs out
                    onTimeout();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [isOpen, request, onTimeout]);

    // Reset timer when dialog opens
    useEffect(() => {
        if (isOpen && request) {
            setTimeLeft(30);
        }
    }, [isOpen, request]);

    const handleApprove = () => {
        toast({
            title: 'Connection Approved',
            description: `Approved connection from ${request?.requesterId}. Redirecting to communication interface...`
        });
        onApprove();
    };

    const handleDecline = () => {
        toast({
            title: 'Connection Declined',
            description: `Declined connection from ${request?.requesterId}`
        });
        onDecline(autoDeclineReason);
    };

    // Get device type icon (we don't have full device info, so default to vehicle)
    const getDeviceIcon = () => {
        return <Car className="h-5 w-5 text-blue-500" />;
    };

    // Format time remaining
    const formatTimeLeft = (seconds: number) => {
        return `${seconds}s remaining`;
    };

    // Get urgency color based on time left
    const getUrgencyColor = (seconds: number) => {
        if (seconds <= 10) return 'text-red-500';
        if (seconds <= 20) return 'text-orange-500';
        return 'text-green-500';
    };

    if (!request) return null;

    return (
        <Dialog open={isOpen} onOpenChange={() => onDecline('dialog_closed')}>
            <DialogContent className="sm:max-w-md" showCloseButton={false}>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {getDeviceIcon()}
                        Incoming Connection Request
                    </DialogTitle>
                    <DialogDescription>
                        A nearby vehicle wants to establish V2V communication
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Connection Request Info */}
                    <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
                        <CardContent className="pt-4">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">Requesting Vehicle</span>
                                    <span className="text-sm font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded">
                                        {request.requesterId}
                                    </span>
                                </div>

                                {request.purpose && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium">Purpose</span>
                                        <Badge variant="outline">{request.purpose}</Badge>
                                    </div>
                                )}

                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">Request Time</span>
                                    <span className="text-sm text-muted-foreground">
                                        {new Date(request.timestamp).toLocaleTimeString()}
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Countdown Warning */}
                    <Alert className={`border-2 ${timeLeft <= 10 ? 'border-red-200 bg-red-50 dark:bg-red-950' : 'border-orange-200 bg-orange-50 dark:bg-orange-950'}`}>
                        <Clock className={`h-4 w-4 ${getUrgencyColor(timeLeft)}`} />
                        <AlertDescription className="flex items-center justify-between">
                            <span>
                                {timeLeft <= 10
                                    ? 'Request expires soon!'
                                    : 'This request will auto-decline if not responded to'
                                }
                            </span>
                            <span className={`font-medium ${getUrgencyColor(timeLeft)}`}>
                                {formatTimeLeft(timeLeft)}
                            </span>
                        </AlertDescription>
                    </Alert>

                    {/* Connection Benefits */}
                    <div className="space-y-2">
                        <h4 className="text-sm font-medium">Connection Features:</h4>
                        <ul className="text-xs text-muted-foreground space-y-1 pl-4">
                            <li>• Real-time voice communication</li>
                            <li>• Text messaging</li>
                            <li>• Location sharing</li>
                            <li>• Emergency alerts</li>
                        </ul>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-2">
                        <Button
                            variant="outline"
                            onClick={handleDecline}
                            className="flex-1 flex items-center gap-2"
                        >
                            <XCircle className="h-4 w-4" />
                            Decline
                        </Button>

                        <Button
                            onClick={handleApprove}
                            className="flex-1 flex items-center gap-2 bg-green-600 hover:bg-green-700"
                        >
                            <CheckCircle className="h-4 w-4" />
                            Approve & Connect
                        </Button>
                    </div>

                    {/* Security Notice */}
                    <div className="text-xs text-muted-foreground text-center pt-2 border-t">
                        <AlertTriangle className="h-3 w-3 inline mr-1" />
                        Only approve connections from trusted vehicles in your vicinity
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
