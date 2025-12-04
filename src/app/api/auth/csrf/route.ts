import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { encryptJwt } from '@/lib/session';

function isProd() {
  return process.env.NODE_ENV === 'production';
}

export async function GET(req: NextRequest) {
  // Generate a one-time-visible CSRF token and set it as a non-httpOnly cookie
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days
  // Issue a short-lived signed CSRF assertion cookie. The server will validate
  // this signed cookie against the header during login and other state-changing
  // requests. We intentionally do NOT store the raw token in the database.
  const signed = await encryptJwt({ csrf: token, t: 'csrf' }, '10m');
  const sigExpires = new Date(Date.now() + 10 * 60 * 1000);
  cookies().set('csrfSig', signed, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', expires: sigExpires });

  // Return the raw token in the response body so client-side JS can set the
  // `X-CSRF-Token` header. We only keep the signed cookie server-side.
  return NextResponse.json({ csrfToken: token });
}
