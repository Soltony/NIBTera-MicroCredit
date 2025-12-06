
 'use server';

import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const secretKey = process.env.SESSION_SECRET;
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

  const { default: prisma } = await import('./prisma');
  const sessionRecord = await prisma.session.create({
    data: {
      userId,
      refreshToken,
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

  const cookiesStore = await cookies();
  cookiesStore.set('accessToken', accessToken, { httpOnly: true, secure: isProd(), sameSite: 'lax', path: '/', expires: accessExpires });
  cookiesStore.set('refreshToken', refreshToken, { httpOnly: true, secure: isProd(), sameSite: 'lax', path: '/', expires: refreshExpires });

  // Backwards-compat: if a super app token is provided (used by the mini-app connect flow),
  // create a legacy `session` cookie with the userId and the superAppToken inside so the
  // mini-app can continue to read a single `session` cookie as before.
  if (superAppToken) {
    const sessionExpires = expiryDateFromDays(1);
    const legacySessionPayload = { userId, expires: sessionExpires, superAppToken };
    const legacySessionJwt = await encryptJwt(legacySessionPayload, '1d');
    cookiesStore.set('session', legacySessionJwt, { httpOnly: true, secure: isProd(), sameSite: 'lax', path: '/', expires: sessionExpires });
  }

  return { accessToken, refreshToken, sessionId: sessionRecord.id };
}

// Create a legacy-only session cookie for flows where the external token
// should log the user into the mini-app without creating a DB-backed session.
export async function createLegacySession(phone: string, superAppToken: string) {
  const cookiesStore = await cookies();
  const sessionExpires = expiryDateFromDays(1);
  const legacySessionPayload = { userId: phone, expires: sessionExpires, superAppToken };
  const legacySessionJwt = await encryptJwt(legacySessionPayload, '1d');
  cookiesStore.set('session', legacySessionJwt, { httpOnly: true, secure: isProd(), sameSite: 'lax', path: '/', expires: sessionExpires });
  return { session: legacySessionJwt };
}

export async function getSession() {
  const cookiesStore = await cookies();
  const access = cookiesStore.get('accessToken')?.value;
  const refresh = cookiesStore.get('refreshToken')?.value;

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
    await prisma.session.update({ where: { id: sessionRecord.id }, data: { refreshToken: newRefreshToken, expiresAt: refreshExpiresAt, lastActivity: new Date() } });

    const accessPayload: any = {
      userId: sessionRecord.userId,
      sessionId: sessionRecord.id,
      permissions: userWithRole?.role?.permissions || '{}',
    };
    const newAccessToken = await encryptJwt(accessPayload, ACCESS_TOKEN_EXP);

    const accessExpires = expiryDateFromMinutes(15);

    const cookiesStore = await cookies();
    cookiesStore.set('accessToken', newAccessToken, { httpOnly: true, secure: isProd(), sameSite: 'lax', path: '/', expires: accessExpires });
    cookiesStore.set('refreshToken', newRefreshToken, { httpOnly: true, secure: isProd(), sameSite: 'lax', path: '/', expires: refreshExpiresAt });

    return accessPayload;
  }

  return null;
}

export async function deleteSession() {
  // Revoke session by refresh token in DB and clear cookies
  const cookiesStore = await cookies();
  const refresh = cookiesStore.get('refreshToken')?.value;
  const access = cookiesStore.get('accessToken')?.value;
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
  cookiesStore.set('accessToken', '', { httpOnly: true, secure: isProd(), sameSite: 'lax', path: '/', expires: expired });
  cookiesStore.set('refreshToken', '', { httpOnly: true, secure: isProd(), sameSite: 'lax', path: '/', expires: expired });
  // clear legacy session cookie for backwards compatibility
  cookiesStore.set('session', '', { httpOnly: true, secure: isProd(), sameSite: 'lax', path: '/', expires: expired });
}
