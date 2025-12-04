

'use server';

import {SignJWT, jwtVerify} from 'jose';
import {cookies} from 'next/headers';
import prisma from './prisma';

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

export async function createSession(userId: string, superAppToken?: string, permissions?: any) {
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day
  
  // Fetch user role and permissions to store in session
  const userWithRole = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });

  const sessionPayload: { [key: string]: any } = {
    userId,
    expires,
    permissions: userWithRole?.role?.permissions || '{}', // Store permissions JSON string
  };
  
  if (superAppToken) {
    sessionPayload.superAppToken = superAppToken;
  }

  if (permissions) {
    // Store permissions as a JSON string in the token so lightweight runtimes
    // (like middleware) can parse them without DB access.
    sessionPayload.permissions = typeof permissions === 'string' ? permissions : JSON.stringify(permissions);
  }

  const session = await encrypt(sessionPayload);

  cookies().set('session', session, {expires, httpOnly: true});
}

export async function getSession() {
  const sessionCookie = cookies().get('session')?.value;
  if (!sessionCookie) return null;

  return await decrypt(sessionCookie);
}

export async function deleteSession() {
  cookies().set('session', '', {expires: new Date(0), httpOnly: true});
}
