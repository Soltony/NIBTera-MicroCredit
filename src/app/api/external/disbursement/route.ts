import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import sendSms from '@/lib/sms';
import { areDisbursementsEnabled } from '@/lib/disbursement-control';
import { auditExternalApiError, auditExternalApiRequest, auditExternalApiResponse, newAuditCorrelationId } from '@/lib/audit-log';

type Body = {
  creditAccount: string;
  providerId: string;
  amount: string | number;
}

export async function POST(req: Request) {
  try {
    const ipAddress = req.headers.get('x-forwarded-for') || 'N/A';
    const userAgent = req.headers.get('user-agent') || 'N/A';
    const actorId = 'system';

    const enabled = await areDisbursementsEnabled();
    if (!enabled) {
      return NextResponse.json({ error: 'Disbursements are currently disabled.' }, { status: 503 });
    }

    const body: Body = await req.json();
    const { creditAccount, providerId, amount } = body;
    // For testing: force the provider id to PRO0001 unless overridden by env
    const forcedProviderId = process.env.FORCE_PROVIDER_ID ?? 'PRO0001';
    const sendProviderId = forcedProviderId;
    if (!creditAccount || !providerId || !amount) return NextResponse.json({ error: 'creditAccount, providerId and amount are required' }, { status: 400 });

    const apiUrl = process.env.EXTERNAL_DISBURSEMENT_URL;
    const user = process.env.EXTERNAL_API_USERNAME;
    const pass = process.env.EXTERNAL_API_PASSWORD;

    const auth = user && pass ? 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64') : undefined;

    // Log outgoing request details (mask password)
    try {
      const maskedAuth = auth ? auth.replace(/:(.*)@/, ':*****@') : undefined;
    } catch (e) {
      // ignore logging errors
    }

    if (!apiUrl) {
      const errMsg = 'Missing EXTERNAL_DISBURSEMENT_URL env var';

      await auditExternalApiError(
        { actorId, ipAddress, userAgent, integration: 'DISBURSEMENT', entity: 'DisbursementTransaction' },
        errMsg,
        {
          request: {
            method: 'POST',
            url: 'EXTERNAL_DISBURSEMENT_URL',
            body: { creditAccount, providerId: sendProviderId, amount },
          },
        },
      ).catch(() => null);

      try {
        await prisma.disbursementTransaction.create({
          data: {
            providerId: sendProviderId,
            originalProviderId: providerId ?? undefined,
            creditAccount: String(creditAccount),
            amount: typeof amount === 'number' ? amount : (Number(String(amount)) || undefined),
            requestPayload: JSON.stringify({ creditAccount, providerId: sendProviderId, amount }),
            responsePayload: JSON.stringify({ error: errMsg }),
            rawResponse: errMsg,
            statusCode: null,
          },
        });
      } catch (_) {
        // ignore DB save errors
      }
      return NextResponse.json({ error: errMsg }, { status: 500 });
    }

    let res;
    const correlationId = newAuditCorrelationId();
    const startedAt = Date.now();
    try {
      await auditExternalApiRequest(
        {
          actorId,
          ipAddress,
          userAgent,
          integration: 'DISBURSEMENT',
          entity: 'DisbursementTransaction',
          correlationId,
        },
        {
          method: 'POST',
          url: apiUrl,
          headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: auth } : {}) },
          body: { creditAccount, providerId: sendProviderId, amount },
        },
      ).catch(() => null);

      res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: auth } : {}) },
        body: JSON.stringify({ creditAccount, providerId: sendProviderId, amount }),
      });

      const durationMs = Date.now() - startedAt;
      // We'll log the response body later once parsed.
      (res as any).__audit = { correlationId, durationMs };
    } catch (fetchErr: any) {
      const details = String(fetchErr?.message ?? fetchErr);

      await auditExternalApiError(
        { actorId, ipAddress, userAgent, integration: 'DISBURSEMENT', entity: 'DisbursementTransaction', correlationId },
        fetchErr,
        {
          durationMs: Date.now() - startedAt,
          request: {
            method: 'POST',
            url: apiUrl,
            headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: auth } : {}) },
            body: { creditAccount, providerId: sendProviderId, amount },
          },
        },
      ).catch(() => null);

      try {
        await prisma.disbursementTransaction.create({
          data: {
            providerId: sendProviderId,
            originalProviderId: providerId ?? undefined,
            creditAccount: String(creditAccount),
            amount: typeof amount === 'number' ? amount : (Number(String(amount)) || undefined),
            requestPayload: JSON.stringify({ creditAccount, providerId: sendProviderId, amount }),
            responsePayload: JSON.stringify({ error: 'Upstream fetch failed', details }),
            rawResponse: details,
            statusCode: null,
          },
        });
      } catch (_) {
        // ignore DB save errors
      }

      return NextResponse.json({ error: 'Upstream fetch failed', details }, { status: 502 });
    }

    const txt = await res.text().catch(() => null);
    // Try to parse JSON, fallback to text
    let payload: any = null;
    try { payload = txt ? JSON.parse(txt) : null; } catch (e) { payload = txt; }

    try {
      const auditMeta = (res as any).__audit as { correlationId?: string; durationMs?: number } | undefined;
      const correlationId = auditMeta?.correlationId ?? newAuditCorrelationId();
      await auditExternalApiResponse(
        {
          actorId,
          ipAddress,
          userAgent,
          integration: 'DISBURSEMENT',
          entity: 'DisbursementTransaction',
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
          body: payload,
          durationMs: auditMeta?.durationMs,
        },
      );
    } catch {
      // ignore audit failures
    }

    // Log upstream response for debugging
    try {
      const headersObj: Record<string, string> = {};
      try {
        // Response headers may be iterable
        for (const [k, v] of (res.headers as any).entries()) {
          headersObj[k] = v;
        }
      } catch (e) {
        // ignore
      }
    } catch (e) {
      // ignore logging errors
    }

    // Persist disbursement transaction to DB for audit/reconciliation
    try {
      // extract transactionId if present
      let upstreamTransactionId: string | null = null;
      if (payload && typeof payload === 'object') {
        upstreamTransactionId = payload.transactionId ?? payload.transactionid ?? payload.transaction_id ?? null;
      } else if (typeof txt === 'string') {
        const m = txt.match(/transactionId['"]?\s*[:=]\s*['"]?([A-Za-z0-9_-]+)['"]?/i) || txt.match(/'transactionId'\s*:\s*'([^']+)'/i);
        if (m) upstreamTransactionId = m[1];
      }

      await prisma.disbursementTransaction.create({ data: {
        transactionId: upstreamTransactionId ?? undefined,
        providerId: sendProviderId,
        originalProviderId: providerId ?? undefined,
        creditAccount: String(creditAccount),
        amount: typeof amount === 'number' ? amount : (Number(String(amount)) || undefined),
        requestPayload: JSON.stringify({ creditAccount, providerId: sendProviderId, amount }),
        responsePayload: typeof payload === 'string' ? payload : (payload ? JSON.stringify(payload) : undefined),
        rawResponse: txt ?? undefined,
        statusCode: typeof res.status === 'number' ? res.status : undefined,
      } });
    } catch (e) {
      // ignore saving errors
    }

    // Attempt to send SMS notification to the phone tied to the credited account (fire-and-forget)
    (async () => {
      try {
        // Find phone by account mapping
        const phoneMap = await prisma.phoneAccount.findFirst({ where: { accountNumber: String(creditAccount) } });
        const phoneNumber = phoneMap?.phoneNumber ?? null;
        if (!phoneNumber) {
          // No mapping found; nothing to notify
          return;
        }

        // Compose message based on upstream result
        let message = '';
        if (res.ok) {
          const amt = amount ?? '';
          message = `Your account ${creditAccount} has received a disbursement of ${amt}.`;
        } else {
          const reason = (payload && typeof payload === 'object' && (payload.message || payload.Message)) ? (payload.message || payload.Message) : (typeof payload === 'string' ? payload : (txt ?? 'Unknown error'));
          message = `Disbursement to account ${creditAccount} failed: ${reason}`;
        }
    const smsRes = await sendSms(phoneNumber, message);
    if (!smsRes.ok) {
      // ignore SMS send failures
    }
      } catch (e) {
        // ignore sms notify errors
      }
    })();

    if (!res.ok) {
      return NextResponse.json({ error: 'Upstream error', status: res.status, body: payload }, { status: 502 });
    }

    return NextResponse.json(payload ?? { status: 'OK', status_code: res.status }, { status: res.status });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}

