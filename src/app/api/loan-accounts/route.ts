import { NextResponse } from 'next/server';
import { MiniAppAuthError, requireMiniAppAuthContext } from '@/lib/miniapp-auth';
import { auditExternalApiError, auditExternalApiRequest, auditExternalApiResponse, newAuditCorrelationId } from '@/lib/audit-log';

export async function POST(req: Request) {
  try {
    const ctx = await requireMiniAppAuthContext();
    const ipAddress = req.headers.get('x-forwarded-for') || 'N/A';
    const userAgent = req.headers.get('user-agent') || 'N/A';
    const body = await req.json();
    const { phoneNumber } = body;
    if (!phoneNumber) {
      return NextResponse.json({ error: 'phoneNumber is required' }, { status: 400 });
    }

    if (String(phoneNumber) !== String(ctx.borrowerId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const apiUrl = process.env.EXTERNAL_API_URL ?? 'http://192.168.100.56:8280/nibtera-loan/get-accounts';
    const user = process.env.EXTERNAL_API_USERNAME ?? 'nibLoan';
    const pass = process.env.EXTERNAL_API_PASSWORD ?? '123456';
    console.info(`[loan-accounts] proxy request phone=${phoneNumber} -> ${apiUrl}`);
    
    const auth = 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');

    const correlationId = newAuditCorrelationId();
    const startedAt = Date.now();
    await auditExternalApiRequest(
      {
        actorId: String(ctx.borrowerId),
        ipAddress,
        userAgent,
        integration: 'LOAN_ACCOUNTS',
        entity: 'Borrower',
        entityId: String(ctx.borrowerId),
        correlationId,
      },
      {
        method: 'POST',
        url: apiUrl,
        headers: { 'Content-Type': 'application/json', Authorization: auth },
        body: { phoneNumber },
      },
    ).catch(() => null);

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: auth,
      },
      body: JSON.stringify({ phoneNumber }),
    }).catch(async (e) => {
      await auditExternalApiError(
        {
          actorId: String(ctx.borrowerId),
          ipAddress,
          userAgent,
          integration: 'LOAN_ACCOUNTS',
          entity: 'Borrower',
          entityId: String(ctx.borrowerId),
          correlationId,
        },
        e,
        { durationMs: Date.now() - startedAt, request: { method: 'POST', url: apiUrl, body: { phoneNumber } } },
      ).catch(() => null);
      throw e;
    });

    const data = await res.json().catch(() => null);
    await auditExternalApiResponse(
      {
        actorId: String(ctx.borrowerId),
        ipAddress,
        userAgent,
        integration: 'LOAN_ACCOUNTS',
        entity: 'Borrower',
        entityId: String(ctx.borrowerId),
        correlationId,
      },
      {
        status: res.status,
        statusText: (res as any).statusText,
        headers: (() => {
          const headersObj: Record<string, string> = {};
          try {
            for (const [k, v] of (res.headers as any).entries()) {
              headersObj[k] = v;
            }
          } catch {
            // ignore
          }
          return headersObj;
        })(),
        body: data,
        durationMs: Date.now() - startedAt,
      },
    ).catch(() => null);
    try {
      const detailsCount = Array.isArray(data?.details) ? data.details.length : 0;
      console.info(`[loan-accounts] upstream status=${res.status} details=${detailsCount}`);
    } catch (e) {
      // ignore
    }
    return NextResponse.json(data ?? { status: 'Error', status_code: res.status }, { status: res.status });
  } catch (err: any) {
    if (err instanceof MiniAppAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[loan-accounts] error', err);
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}
