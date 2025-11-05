import { NextRequest, NextResponse } from 'next/server';
import { upsertUserSetting } from '@/utils/supabaseClient';

export async function POST(request: NextRequest) {
  try {
    const { userId, key, value } = await request.json();
    
    if (!userId || !key) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, key' },
        { status: 400 }
      );
    }

    await upsertUserSetting(userId, key, value);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving user setting:', error);
    return NextResponse.json(
      { error: 'Failed to save user setting' },
      { status: 500 }
    );
  }
}