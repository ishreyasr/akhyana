"use client";
import { Suspense, useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { useRouter, useSearchParams } from 'next/navigation';
import { Car, User, Wrench } from 'lucide-react';
import { auth, googleProvider } from '@/lib/firebase';
import { createUserWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import Link from 'next/link';

interface PersonalDetails {
    fullName: string;
    email: string;
    password: string;
}

interface VehicleDetails {
    vehicleId: string;
    licensePlate: string;
    vehicleType: string;
    brand: string;
    model: string;
}

function RegisterForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [step, setStep] = useState(1); // 1 personal, 2 vehicle
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [personal, setPersonal] = useState<PersonalDetails>({ fullName: '', email: '', password: '' });
    const [vehicle, setVehicle] = useState<VehicleDetails>({ vehicleId: '', licensePlate: '', vehicleType: '', brand: '', model: '' });
    const [googleLinked, setGoogleLinked] = useState(false);

    const totalSteps = 2;
    const progress = (step / totalSteps) * 100;

    // Prefill if redirected from Google sign-in
    useEffect(() => {
        const prefillEmail = searchParams.get('prefillEmail');
        const isGoogle = searchParams.get('google') === '1';
        if (isGoogle) {
            try {
                const pendingRaw = sessionStorage.getItem('pendingGoogleUser');
                if (pendingRaw) {
                    const pending = JSON.parse(pendingRaw);
                    setPersonal(p => ({ ...p, email: pending.email || prefillEmail || '', fullName: pending.fullName || p.fullName }));
                    setGoogleLinked(true);
                }
            } catch { }
        } else if (prefillEmail) {
            setPersonal(p => ({ ...p, email: prefillEmail }));
        }
    }, [searchParams]);

    const next = () => setStep(s => Math.min(totalSteps, s + 1));
    const back = () => setStep(s => Math.max(1, s - 1));

    const handleGoogle = async () => {
        if (!auth || !googleProvider) {
            setError('Firebase authentication not configured');
            return;
        }
        setError(null); setLoading(true);
        try {
            await signInWithPopup(auth, googleProvider);
            setGoogleLinked(true);
        } catch (e: any) {
            setError(e.message || 'Google linking failed');
        } finally { setLoading(false); }
    };

    const canContinuePersonal = personal.fullName && personal.email && personal.password;
    const canContinueVehicle = vehicle.vehicleId && vehicle.licensePlate && vehicle.vehicleType && vehicle.brand && vehicle.model;

    const finish = async () => {
        setError(null); setLoading(true);
        try {
            // Try to create account in Firebase (prototype tolerant of existing)
            if (auth) {
                try {
                    await createUserWithEmailAndPassword(auth, personal.email, personal.password);
                } catch {
                    // ignore if exists
                }
            }
            // Persist user centrally (Supabase) via backend proxy to enforce uniqueness
            const record = { email: personal.email, fullName: personal.fullName, vehicle, password: personal.password };
            const apiBase = process.env.NEXT_PUBLIC_V2V_API || 'http://localhost:3002';
            const url = apiBase.replace(/\/$/, '') + '/user';
            let lastErr: any = null;
            for (let attempt = 1; attempt <= 2; attempt++) {
                try {
                    const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(record) });
                    if (!resp.ok) {
                        const detail = await resp.text();
                        throw new Error('upsert_failed_status_' + resp.status + ' ' + detail);
                    }
                    // success
                    lastErr = null;
                    break;
                } catch (e: any) {
                    lastErr = e;
                    console.error('[register] central save attempt', attempt, 'failed:', e);
                    await new Promise(r => setTimeout(r, 300));
                }
            }
            if (lastErr) { setError('Central profile save failed: ' + (lastErr.message || lastErr.toString())); return; }
            // Local session only (no local registry persistence)
            sessionStorage.setItem('authUser', JSON.stringify(record));
            document.cookie = `v2v_auth=1; path=/; max-age=${7 * 24 * 60 * 60}`;

            // Set flag to trigger auto vehicle registration on dashboard
            sessionStorage.setItem('pendingVehicleRegistration', 'true');

            router.replace('/');
        } catch (e: any) {
            setError(e.message || 'Registration failed');
        } finally { setLoading(false); }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
            <Card className="w-full max-w-xl">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl">
                        <Car className="h-5 w-5 text-primary" />
                        Create Akhyana V2V Account
                    </CardTitle>
                    <CardDescription>Step {step} of {totalSteps}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <Progress value={progress} className="h-2" />

                    {step === 1 && (
                        <div className="space-y-6">
                            <h2 className="font-semibold text-sm flex items-center gap-2"><User className="h-4 w-4" /> Personal Details</h2>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2 sm:col-span-2">
                                    <Label htmlFor="fullName">Full Name</Label>
                                    <Input id="fullName" value={personal.fullName} onChange={e => setPersonal(p => ({ ...p, fullName: e.target.value }))} placeholder="Jane Doe" required />
                                </div>
                                <div className="space-y-2 sm:col-span-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input id="email" type="email" value={personal.email} onChange={e => setPersonal(p => ({ ...p, email: e.target.value }))} placeholder="you@example.com" required />
                                </div>
                                <div className="space-y-2 sm:col-span-2">
                                    <Label htmlFor="password">Password</Label>
                                    <Input id="password" type="password" value={personal.password} onChange={e => setPersonal(p => ({ ...p, password: e.target.value }))} placeholder="••••••••" required />
                                </div>
                            </div>
                            <div className="flex justify-between pt-2">
                                <div />
                                <Button onClick={next} disabled={!canContinuePersonal}>Continue</Button>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6">
                            <h2 className="font-semibold text-sm flex items-center gap-2"><Wrench className="h-4 w-4" /> Vehicle Details</h2>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="vehicleId">Vehicle ID</Label>
                                    <Input id="vehicleId" value={vehicle.vehicleId} onChange={e => setVehicle(v => ({ ...v, vehicleId: e.target.value }))} placeholder="veh-1234" required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="licensePlate">License Plate</Label>
                                    <Input id="licensePlate" value={vehicle.licensePlate} onChange={e => setVehicle(v => ({ ...v, licensePlate: e.target.value }))} placeholder="KA-05-AB-1312" required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="vehicleType">Vehicle Type</Label>
                                    <Input id="vehicleType" value={vehicle.vehicleType} onChange={e => setVehicle(v => ({ ...v, vehicleType: e.target.value }))} placeholder="Emergency / Sedan / Truck" required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="brand">Brand</Label>
                                    <Input id="brand" value={vehicle.brand} onChange={e => setVehicle(v => ({ ...v, brand: e.target.value }))} placeholder="Brand (e.g. Tesla)" required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="model">Model</Label>
                                    <Input id="model" value={vehicle.model} onChange={e => setVehicle(v => ({ ...v, model: e.target.value }))} placeholder="Model (e.g. Model 3)" required />
                                </div>
                            </div>
                            <Separator className="my-4" />
                            <div className="space-y-4">
                                <h3 className="font-semibold text-sm">Link Google Account (Optional)</h3>
                                <p className="text-xs text-muted-foreground">Optionally link your Google account for seamless sign-in and synchronization.</p>
                                <Button variant={googleLinked ? 'secondary' : 'outline'} disabled={loading || googleLinked} onClick={handleGoogle} className="w-full flex items-center gap-2 justify-center">
                                    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.35 11.1H12v2.9h5.3c-.23 1.5-.92 2.6-1.96 3.4l3.17 2.46c1.85-1.7 2.84-4.2 2.84-7.16 0-.7-.06-1.22-.15-1.6Z" /><path fill="currentColor" d="M12 22c2.43 0 4.47-.8 5.96-2.14l-3.17-2.46c-.85.6-1.94.98-2.79.98-2.14 0-3.96-1.44-4.61-3.38l-3.3 2.56C5.3 20.3 8.4 22 12 22Z" /><path fill="currentColor" d="M7.39 14.99c-.2-.6-.32-1.25-.32-1.99 0-.74.12-1.39.32-1.99L4.09 8.45A9.823 9.823 0 0 0 2 13c0 1.55.37 3.01 1.09 4.55l3.3-2.56Z" /><path fill="currentColor" d="M12 7.5c1.33 0 2.5.46 3.43 1.37l2.57-2.57C16.47 4.82 14.43 4 12 4 8.4 4 5.3 5.7 3.1 8.45l3.3 2.56C8.04 8.94 9.86 7.5 12 7.5Z" /></svg>
                                    {googleLinked ? 'Google Linked' : 'Continue with Google'}
                                </Button>
                                {googleLinked && (
                                    <div className="text-xs text-green-600 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-800 rounded px-2 py-1 text-center">Google account linked</div>
                                )}
                            </div>
                            <div className="flex justify-between pt-4">
                                <Button variant="outline" onClick={back}>Back</Button>
                                <Button onClick={finish} disabled={!canContinueVehicle || loading}>{loading ? 'Creating...' : 'Finish & Go to Dashboard'}</Button>
                            </div>
                        </div>
                    )}

                    {error && <div className="text-xs text-red-600 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-800 rounded px-2 py-1">{error}</div>}

                    <p className="text-xs text-muted-foreground text-center">
                        Already have an account? <Link href="/auth/login" className="text-primary underline">Login</Link>
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}

export default function RegisterPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <div className="text-center">Loading...</div>
            </div>
        }>
            <RegisterForm />
        </Suspense>
    );
}
