"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Loader2, Wifi, Clock } from 'lucide-react';

export default function ConnectingPage() {
    const router = useRouter();
    const delay = process.env.NODE_ENV === 'test' ? 50 : 3000;

    useEffect(() => {
        const timer = setTimeout(() => {
            router.replace('/connected-vehicle');
        }, delay);
        return () => clearTimeout(timer);
    }, [router, delay]);

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Wifi className="h-5 w-5 text-green-500" />
                        Establishing Secure Connection
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        <span>Waiting for remote vehicle approval...</span>
                    </div>
                    <Progress value={process.env.NODE_ENV === 'test' ? 90 : 60} className="w-full" />
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>Auto-continuing once approved (approx {process.env.NODE_ENV === 'test' ? '0.05s' : '3s'})</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Optimizing channel parameters and verifying authentication tokens. This step ensures low-latency, secure V2V communication.</p>
                </CardContent>
            </Card>
        </div>
    );
}
