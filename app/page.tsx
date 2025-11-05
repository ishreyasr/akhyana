import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { V2VMainDashboard } from '../components/v2v-dashboard/V2VMainDashboard';

// Ensure this page is always rendered per-request so auth cookie is checked.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Page() {
  const store = await cookies();
  const hasAuth = store.get('v2v_auth');
  if (!hasAuth) redirect('/auth/login');
  return <V2VMainDashboard />;
}
