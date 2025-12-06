'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { V2VMainDashboard } from '../components/v2v-dashboard/V2VMainDashboard';

export default function Page() {
  const router = useRouter();

  useEffect(() => {
    // Check auth cookie on client side
    const hasAuth = document.cookie.includes('v2v_auth=1');
    if (!hasAuth) {
      router.replace('/auth/login');
    }
  }, [router]);

  return <V2VMainDashboard />;
}
