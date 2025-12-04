
 'use server';

import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import crypto from 'crypto';

const secretKey = process.env.SESSION_SECRET || 'your-super-secret-key-change-me';
const key = new TextEncoder().encode(secretKey);

const ACCESS_TOKEN_EXP = '15m'; // access token expiry
const REFRESH_TOKEN_DAYS = 7; // refresh token expiry days

function isProd() {
  return process.env.NODE_ENV === 'production';
}

export async function encryptJwt(payload: any, expiresIn: string) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key);
}

export async function decryptJwt(token: string): Promise<any | null> {
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
    return payload;
  } catch (err) {
    return null;
  }
}

function expiryDateFromDays(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function expiryDateFromMinutes(minutes: number) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

export async function createSession(userId: string, superAppToken?: string, permissions?: any) {
  // Create a DB session (refresh token storage) and issue access + refresh tokens.
  const refreshExpiresAt = expiryDateFromDays(REFRESH_TOKEN_DAYS);

  // create a random opaque refresh token (safer than storing long-lived JWTs client-side)
  const refreshToken = await encryptJwt({ userId, t: 'refresh' }, `${REFRESH_TOKEN_DAYS}d`);

  // CSRF is issued and managed by the `/api/auth/csrf` endpoint as a signed cookie.

  const { default: prisma } = await import('./prisma');
  const sessionRecord = await prisma.session.create({
    data: {
      userId,
      refreshToken,
      // Do NOT store csrfToken in the DB per new requirement.
      expiresAt: refreshExpiresAt,
      revoked: false,
    },
  });

  // Build access token payload including session id so we can track activity
  const userWithRole = await (await import('./prisma')).default.user.findUnique({ where: { id: userId }, include: { role: true } });
  const accessPayload: any = {
    userId,
    sessionId: sessionRecord.id,
    permissions: userWithRole?.role?.permissions || '{}',
  };
  if (superAppToken) accessPayload.superAppToken = superAppToken;
  if (permissions) accessPayload.permissions = typeof permissions === 'string' ? permissions : JSON.stringify(permissions);

  const accessToken = await encryptJwt(accessPayload, ACCESS_TOKEN_EXP);

  // set cookies: access token short-lived, refresh token long-lived
  const accessExpires = expiryDateFromMinutes(15);
  const refreshExpires = refreshExpiresAt;

  // Mark cookies HttpOnly and Secure to reduce client-side access to tokens
  cookies().set('accessToken', accessToken, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', expires: accessExpires });
  cookies().set('refreshToken', refreshToken, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', expires: refreshExpires });
  // Do not set a raw CSRF cookie here; the client should call `/api/auth/csrf`
  // to receive the signed CSRF assertion and raw token if needed.

  return { accessToken, refreshToken, sessionId: sessionRecord.id };
}

export async function getSession() {
  const access = cookies().get('accessToken')?.value;
  const refresh = cookies().get('refreshToken')?.value;

  // Try access token first
  if (access) {
    const payload = await decryptJwt(access);
    if (payload && payload.userId && payload.sessionId) {
      // Update lastActivity on session record (idle timeout reset)
      try {
        const { default: prisma } = await import('./prisma');
        await prisma.session.update({ where: { id: payload.sessionId }, data: { lastActivity: new Date() } });
      } catch (e) {
        // ignore DB errors here; session may not exist
      }
      return payload;
    }
  }

  // Access token missing or invalid/expired -> attempt refresh
  if (refresh) {
    // Find session by refresh token
    const { default: prisma } = await import('./prisma');
    const sessionRecord = await prisma.session.findUnique({ where: { refreshToken: refresh } });
    if (!sessionRecord) return null;
    if (sessionRecord.revoked) return null;
    if (sessionRecord.expiresAt < new Date()) return null;

    // Issue new access token (rotate refresh token as well)
    const userWithRole = await prisma.user.findUnique({ where: { id: sessionRecord.userId }, include: { role: true } });
    const newRefreshToken = await encryptJwt({ userId: sessionRecord.userId, t: 'refresh' }, `${REFRESH_TOKEN_DAYS}d`);
    const refreshExpiresAt = expiryDateFromDays(REFRESH_TOKEN_DAYS);

    // update DB session with rotated refresh token and activity
    // preserve existing csrf token if present
    await prisma.session.update({ where: { id: sessionRecord.id }, data: { refreshToken: newRefreshToken, expiresAt: refreshExpiresAt, lastActivity: new Date() } });

    const accessPayload: any = {
      userId: sessionRecord.userId,
      sessionId: sessionRecord.id,
      permissions: userWithRole?.role?.permissions || '{}',
    };
    const newAccessToken = await encryptJwt(accessPayload, ACCESS_TOKEN_EXP);

    const accessExpires = expiryDateFromMinutes(15);

    cookies().set('accessToken', newAccessToken, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', expires: accessExpires });
    cookies().set('refreshToken', newRefreshToken, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', expires: refreshExpiresAt });
    // NOTE: CSRF is managed via the signed `csrfSig` cookie issued by
    // `/api/auth/csrf`. We do not set a raw `csrfToken` cookie here.

    return accessPayload;
  }

  return null;
}

export async function deleteSession() {
  // Revoke session by refresh token in DB and clear cookies
  const refresh = cookies().get('refreshToken')?.value;
  const access = cookies().get('accessToken')?.value;
  if (refresh) {
    try {
      const { default: prisma } = await import('./prisma');
      const sessionRecord = await prisma.session.findUnique({ where: { refreshToken: refresh } });
      if (sessionRecord) {
        await prisma.session.update({ where: { id: sessionRecord.id }, data: { revoked: true } });
      }
    } catch (e) {
      // ignore
    }
  } else if (access) {
    // try to decode access token to find session id
    const payload = await decryptJwt(access);
    if (payload?.sessionId) {
      try {
        const { default: prisma } = await import('./prisma');
        await prisma.session.update({ where: { id: payload.sessionId }, data: { revoked: true } });
      } catch (e) { }
    }
  }

  // clear cookies
  const expired = new Date(0);
  cookies().set('accessToken', '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', expires: expired });
  cookies().set('refreshToken', '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', expires: expired });
  // Do not clear a raw csrfToken cookie because we don't set it anymore.
  // The signed `csrfSig` cookie is cleared by the CSRF endpoint or left to expire.
}
