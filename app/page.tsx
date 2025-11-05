'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { V2VMainDashboard } from '../components/v2v-dashboard/V2VMainDashboard';

export default function Page() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Check for auth cookie on client side
    const hasAuth = document.cookie.includes('v2v_auth=');
    if (!hasAuth) {
      router.push('/auth/login');
    } else {
      setIsChecking(false);
    }
  }, [router]);

  if (isChecking) {
    return <div>Loading...</div>;
  }

  return <V2VMainDashboard />;
}
