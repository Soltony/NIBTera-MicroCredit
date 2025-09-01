
import { deleteSession, getSession } from '@/lib/session';
import { NextResponse } from 'next/server';

export async function POST() {
  const session = await getSession();
  if (session?.userId) {
    console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        action: 'USER_LOGOUT_SUCCESS',
        userId: session.userId,
    }));
  }
  
  deleteSession();
  return NextResponse.json({ success: true });
}
