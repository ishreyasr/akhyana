'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { V2VMainDashboard } from '../components/v2v-dashboard/V2VMainDashboard';

export default function Page() {
  const router = useRouter();

  useEffect(() => {
    // Check auth on client side
    if (typeof window !== 'undefined') {
      const hasAuth = document.cookie.includes('v2v_auth');
      if (!hasAuth) {
        router.push('/auth/login');
      }
    }
  }, [router]);

  return <V2VMainDashboard />;
}
