
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { createSession } from '@/lib/session';

export async function POST(req: NextRequest) {
  const ipAddress = req.ip || req.headers.get('x-forwarded-for') || 'N/A';
  const userAgent = req.headers.get('user-agent') || 'N/A';

  try {
    const { phoneNumber, password } = await req.json();

    if (!phoneNumber || !password) {
      return NextResponse.json({ error: 'Phone number and password are required.' }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: { phoneNumber },
      include: { role: true },
    });

    if (!user) {
      console.log(JSON.stringify({
          timestamp: new Date().toISOString(),
          action: 'USER_LOGIN_FAILURE',
          reason: 'User not found',
          attemptedPhoneNumber: phoneNumber,
          ipAddress,
          userAgent,
      }));
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
       console.log(JSON.stringify({
          timestamp: new Date().toISOString(),
          action: 'USER_LOGIN_FAILURE',
          reason: 'Invalid password',
          userId: user.id,
          attemptedPhoneNumber: phoneNumber,
          ipAddress,
          userAgent,
      }));
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }

    // Create a session for the user
    await createSession(user.id);
    
    console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        action: 'USER_LOGIN_SUCCESS',
        userId: user.id,
        role: user.role.name,
        ipAddress,
        userAgent,
    }));

    return NextResponse.json({ message: 'Login successful' }, { status: 200 });

  } catch (error) {
    console.error('Login Error:', error);
    return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
  }
}
