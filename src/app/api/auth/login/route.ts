
import {NextResponse} from 'next/server';
import {prisma} from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import {createSession} from '@/lib/session';

export async function POST(req: Request) {
  try {
    const {phoneNumber, password} = await req.json();

    if (!phoneNumber || !password) {
      return NextResponse.json(
        {error: 'Phone number and password are required.'},
        {status: 400}
      );
    }

    const user = await prisma.user.findUnique({
      where: {phoneNumber},
    });

    if (!user) {
      return NextResponse.json(
        {error: 'Invalid phone number or password.'},
        {status: 401}
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return NextResponse.json(
        {error: 'Invalid phone number or password.'},
        {status: 401}
      );
    }

    await createSession(user.id);

    return NextResponse.json({message: 'Login successful'}, {status: 200});
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      {error: 'Internal Server Error'},
      {status: 500}
    );
  }
}
