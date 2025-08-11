
'use server';

import {SignJWT, jwtVerify} from 'jose';
import {cookies} from 'next/headers';
import {NextRequest, NextResponse} from 'next/server';
import {prisma} from './prisma';

const secretKey = process.env.SESSION_SECRET || 'your-super-secret-key-change-me';
const key = new TextEncoder().encode(secretKey);

export async function encrypt(payload: any) {
  return await new SignJWT(payload)
    .setProtectedHeader({alg: 'HS256'})
    .setIssuedAt()
    .setExpirationTime('1d') // Set token to expire in 1 day
    .sign(key);
}

export async function decrypt(input: string): Promise<any> {
  try {
    const {payload} = await jwtVerify(input, key, {
      algorithms: ['HS256'],
    });
    return payload;
  } catch (error) {
    // This could be due to an expired token or invalid signature
    console.error('JWT Decryption Error:', error);
    return null;
  }
}

export async function createSession(userId: string) {
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day
  const session = await encrypt({userId, expires});

  cookies().set('session', session, {expires, httpOnly: true});
}

export async function getSession() {
  const sessionCookie = cookies().get('session')?.value;
  if (!sessionCookie) return null;

  const sessionPayload = await decrypt(sessionCookie);
  if (!sessionPayload?.userId) return null;

  return sessionPayload;
}

export async function getCurrentUser() {
    const session = await getSession();
    if (!session?.userId) return null;
    
    const user = await prisma.user.findUnique({
        where: { id: session.userId },
        include: {
            role: true,
            provider: true
        }
    });

    if (!user) return null;

    const { password, ...userWithoutPassword } = user;

    return {
        ...userWithoutPassword,
        role: user.role.name,
        providerName: user.provider?.name || '',
    };
}


export async function deleteSession() {
  cookies().set('session', '', {expires: new Date(0)});
}
