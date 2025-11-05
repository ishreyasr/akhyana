"use client";
import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useRouter } from 'next/navigation';
import { Car, Lock, Mail } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log('Login form submitted with:', { email, password: password ? '[HIDDEN]' : 'empty' });
        setError(null);
        if (!email || !password) {
            setError('Email and password required');
            return;
        }
        setLoading(true);
        try {
            // Use local authentication instead of Firebase
            const apiBase = process.env.NEXT_PUBLIC_V2V_API || 'http://localhost:3002';
            console.log('Making request to:', `${apiBase}/auth/login-local`);
            const resp = await fetch(`${apiBase}/auth/login-local`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            console.log('Response status:', resp.status);
            if (!resp.ok) {
                const errorData = await resp.json();
                console.log('Error response:', errorData);
                let msg = 'Login failed';
                if (errorData.error === 'invalid_credentials') msg = 'Invalid email or password';
                else if (errorData.error === 'password_login_not_enabled') msg = 'Password login not enabled for this account';
                else if (errorData.error === 'supabase_not_configured') msg = 'Authentication service not configured';
                setError(msg);
                return;
            }

            const data = await resp.json();
            console.log('Login response:', data);
            if (data.status === 'ok' && data.user) {
                const record = {
                    email: data.user.email,
                    fullName: data.user.fullName,
                    vehicle: data.user.vehicle
                };
                sessionStorage.setItem('authUser', JSON.stringify(record));
                document.cookie = `v2v_auth=1; path=/; max-age=${7 * 24 * 60 * 60}`;
                console.log('Login successful, redirecting...');
                router.replace('/');
            } else {
                setError('Login failed - invalid response');
            }
        } catch (err: any) {
            console.error('Login error:', err);
            setError('Login failed - ' + (err.message || 'Network error'));
        } finally {
            setLoading(false);
        }
    };

    const handleGoogle = async () => {
        setError('Google sign-in temporarily disabled. Please use email/password login or register a new account.');
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl">
                        <Car className="h-5 w-5 text-primary" />
                        Akhyana V2V Login
                    </CardTitle>
                    <CardDescription>Access your vehicle communication dashboard</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email" className="flex items-center gap-2 text-sm font-medium">
                                <Mail className="h-4 w-4" /> Email
                            </Label>
                            <Input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password" className="flex items-center gap-2 text-sm font-medium">
                                <Lock className="h-4 w-4" /> Password
                            </Label>
                            <Input id="password" type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
                        </div>
                        {error && <div className="text-xs text-red-600 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-800 rounded px-2 py-1">{error}</div>}
                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full"
                            onClick={(e) => {
                                console.log('Button clicked');
                                // Let the form handle the submission naturally
                            }}
                        >
                            {loading ? 'Signing in...' : 'Login'}
                        </Button>
                    </form>
                    <div className="space-y-4">
                        <div className="relative">
                            <Separator />
                            <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-background px-2 text-xs text-muted-foreground">or</span>
                        </div>
                        <Button variant="outline" disabled={loading} onClick={handleGoogle} className="w-full flex items-center gap-2">
                            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.35 11.1H12v2.9h5.3c-.23 1.5-.92 2.6-1.96 3.4l3.17 2.46c1.85-1.7 2.84-4.2 2.84-7.16 0-.7-.06-1.22-.15-1.6Z" /><path fill="currentColor" d="M12 22c2.43 0 4.47-.8 5.96-2.14l-3.17-2.46c-.85.6-1.94.98-2.79.98-2.14 0-3.96-1.44-4.61-3.38l-3.3 2.56C5.3 20.3 8.4 22 12 22Z" /><path fill="currentColor" d="M7.39 14.99c-.2-.6-.32-1.25-.32-1.99 0-.74.12-1.39.32-1.99L4.09 8.45A9.823 9.823 0 0 0 2 13c0 1.55.37 3.01 1.09 4.55l3.3-2.56Z" /><path fill="currentColor" d="M12 7.5c1.33 0 2.5.46 3.43 1.37l2.57-2.57C16.47 4.82 14.43 4 12 4 8.4 4 5.3 5.7 3.1 8.45l3.3 2.56C8.04 8.94 9.86 7.5 12 7.5Z" /></svg>
                            Continue with Google
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground text-center">No account? <Link href="/auth/register" className="text-primary underline">Register</Link></p>
                </CardContent>
            </Card>
        </div>
    );
}
