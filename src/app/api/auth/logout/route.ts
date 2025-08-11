
import {NextResponse} from 'next/server';
import {deleteSession} from '@/lib/session';

export async function POST() {
  try {
    deleteSession();
    return NextResponse.json({message: 'Logout successful'}, {status: 200});
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      {error: 'Internal Server Error'},
      {status: 500}
    );
  }
}
