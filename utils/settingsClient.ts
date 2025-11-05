// Thin client -> server proxy for user settings (avoids direct Supabase writes from browser)
export async function saveUserSettingViaApi(userId: string, key: string, value: any) {
  try {
    const res = await fetch('/user-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, key, value })
    });
    if (!res.ok) throw new Error('server_error');
  } catch (e) {
    // swallow for now; caller handles UI error
    throw e;
  }
}