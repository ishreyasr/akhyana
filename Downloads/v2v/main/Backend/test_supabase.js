// Quick test to check Supabase connectivity and see the exact error
const SUPABASE_URL = "https://wnfaxkmpswimmhqagznr.supabase.co";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InduZmF4a21wc3dpbW1ocWFnem5yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjkxMTMxNCwiZXhwIjoyMDcyNDg3MzE0fQ.hWlCNqzYUam0Ue-dpovXU9yf_S7RpnDPpYKhD59p5yI";

async function testSupabase() {
  try {
    console.log('Testing Supabase connection...');
    console.log('URL:', SUPABASE_URL);
    console.log('Service Key length:', SUPABASE_SERVICE_KEY.length);

    const testPayload = [{
      email: 'test@example.com',
      full_name: 'Test User',
      updated_at: new Date().toISOString()
    }];

    console.log('Payload:', JSON.stringify(testPayload, null, 2));

    const resp = await fetch(`${SUPABASE_URL}/rest/v1/v2v_users`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates'
      },
      body: JSON.stringify(testPayload)
    });

    console.log('Response status:', resp.status);
    console.log('Response headers:', Object.fromEntries(resp.headers.entries()));

    const text = await resp.text();
    console.log('Response body:', text);

    if (!resp.ok) {
      console.error('❌ Request failed with status:', resp.status);
    } else {
      console.log('✅ Request succeeded!');
    }
  } catch (error) {
    console.error('❌ Fetch error:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause
    });
  }
}

testSupabase();