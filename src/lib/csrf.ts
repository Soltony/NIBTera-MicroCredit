import { NextRequest, NextResponse } from 'next/server';
import { getSession, deleteSession, decryptJwt } from './session';
import { createAuditLog } from './audit-log';

type CsrfResult = { ok: true } | { ok: false; response: NextResponse };

// We no longer store CSRF in the DB. Validation uses the signed `csrfSig` JWT cookie.

/**
 * Require a valid CSRF token for modifying actions.
 * - If a session exists, header must match the session.csrfToken (or payload csrf).
 * - If no session and requireSession === false, header must match the csrf cookie value.
 * On mismatch the session will be revoked and a 403 response returned.
 */
export async function requireValidCsrf(req: NextRequest, opts?: { requireSession?: boolean }): Promise<CsrfResult> {
  const header = req.headers.get('x-csrf-token');
  const sessionPayload = await getSession();
  const ipAddress = req.ip || req.headers.get('x-forwarded-for') || 'N/A';
  const userAgent = req.headers.get('user-agent') || 'N/A';

  if (sessionPayload && (sessionPayload as any).userId) {
    // For logged-in sessions we require the signed `csrfSig` cookie and
    // the header to match the signed value. Any mismatch will revoke the session.
    const csrfSig = req.cookies.get('csrfSig')?.value;
    if (!header || !csrfSig) {
      try { await createAuditLog({ actorId: (sessionPayload as any).userId || 'unknown', action: 'CSRF_MISSING', ipAddress, userAgent, details: { reason: 'Missing signed csrf cookie or header' } }); } catch (e) {}
      try { await deleteSession(); } catch (e) {}
      return { ok: false, response: NextResponse.json({ error: 'Invalid CSRF token. Session revoked.' }, { status: 403 }) };
    }

    const signed = await decryptJwt(csrfSig);
    if (!signed || (signed as any).t !== 'csrf' || (signed as any).csrf !== header) {
      try { await createAuditLog({ actorId: (sessionPayload as any).userId || 'unknown', action: 'CSRF_MISMATCH', ipAddress, userAgent, details: { reason: 'Signed CSRF invalid or mismatch' } }); } catch (e) {}
      try { await deleteSession(); } catch (e) {}
      return { ok: false, response: NextResponse.json({ error: 'Invalid CSRF token. Session revoked.' }, { status: 403 }) };
    }

    return { ok: true };
  }

  // no session
  if (opts?.requireSession) {
    return { ok: false, response: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) };
  }

  // Compare header to csrf cookie (useful for login path where no session exists yet)
  // No session: compare header to signed cookie
  const cookieSig = req.cookies.get('csrfSig')?.value;
  if (!header || !cookieSig) {
    try { await createAuditLog({ actorId: 'anonymous', action: 'CSRF_MISMATCH_NO_SESSION', ipAddress, userAgent, details: { reason: 'CSRF header or signed cookie missing' } }); } catch (e) {}
    return { ok: false, response: NextResponse.json({ error: 'Invalid CSRF token.' }, { status: 403 }) };
  }
  const unsigned = await decryptJwt(cookieSig);
  if (!unsigned || (unsigned as any).t !== 'csrf' || (unsigned as any).csrf !== header) {
    try { await createAuditLog({ actorId: 'anonymous', action: 'CSRF_MISMATCH_NO_SESSION', ipAddress, userAgent, details: { reason: 'Signed CSRF invalid or mismatch' } }); } catch (e) {}
    return { ok: false, response: NextResponse.json({ error: 'Invalid CSRF token.' }, { status: 403 }) };
  }

  return { ok: true };
}

export default requireValidCsrf;
