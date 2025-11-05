"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LogoutPage() {
  const router = useRouter();
  useEffect(() => {
    try {
      document.cookie = 'v2v_auth=; path=/; max-age=0';
      sessionStorage.clear();
    } catch {}
    const timer = setTimeout(() => router.replace('/auth/login'), 300);
    return () => clearTimeout(timer);
  }, [router]);
  return (
    <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
      Logging out...
    </div>
  );
}