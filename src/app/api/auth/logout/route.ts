
import { deleteSession } from '@/lib/session';
import { NextResponse, NextRequest } from 'next/server';
import { createAuditLog } from '@/lib/audit-log';
import { requireValidCsrf } from '@/lib/csrf';

export async function POST(req: NextRequest) {
  const check = await requireValidCsrf(req, { requireSession: true });
  if (!check.ok) return check.response;

  const session = await (await import('@/lib/session')).getSession();
  const ipAddress = req.ip || req.headers.get('x-forwarded-for') || 'N/A';
  const userAgent = req.headers.get('user-agent') || 'N/A';
  if (session?.userId) {
    await createAuditLog({ actorId: session.userId, action: 'USER_LOGOUT_SUCCESS', ipAddress, userAgent });
  }
  await deleteSession();
  return NextResponse.json({ success: true });
}
