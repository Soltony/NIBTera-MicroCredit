
import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomUUID } from 'crypto';
import { format } from 'date-fns';
import prisma from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit-log';
import { getSession } from '@/lib/session';

export async function POST(req: NextRequest) {
    
    // initiate payment request received (log removed to reduce console noise)

    // --- Step 1: Environment Validation ---
    // Collection account is provider-specific (LoanProvider.collectionAccount).
    // We keep ACCOUNT_NO as an optional legacy fallback.
    const LEGACY_ACCOUNT_NO = process.env.ACCOUNT_NO;
    const CALLBACK_URL = process.env.CALLBACK_URL;
    const COMPANY_NAME = process.env.COMPANY_NAME;
    const NIB_PAYMENT_KEY = process.env.NIB_PAYMENT_KEY;
    const NIB_PAYMENT_URL = process.env.NIB_PAYMENT_URL;

    // environment variables check (log removed to reduce console noise)

    if (!CALLBACK_URL || !COMPANY_NAME || !NIB_PAYMENT_KEY || !NIB_PAYMENT_URL) {
        console.error('❌ Missing payment gateway environment variables.');
        return NextResponse.json(
            { error: 'Payment gateway is not configured on the server.' },
            { status: 500 }
        );
    }

    try {
        console.info('[initiate-payment] start');
        console.info('[initiate-payment] env:', {
            CALLBACK_URL: !!CALLBACK_URL,
            COMPANY_NAME: COMPANY_NAME || null,
            NIB_PAYMENT_URL: NIB_PAYMENT_URL || null,
            NIB_PAYMENT_KEY_PRESENT: !!NIB_PAYMENT_KEY,
            LEGACY_ACCOUNT_NO_PRESENT: !!LEGACY_ACCOUNT_NO,
        });

        // --- Step 2: Parse Request ---
        const body = await req.json();
        console.info('[initiate-payment] request body received');
        try { console.debug('[initiate-payment] body', JSON.stringify(body)); } catch(e) { console.debug('[initiate-payment] body (non-serializable)'); }

        const { amount, loanId } = body as any;
        if (!amount || !loanId) {
            console.error('❌ Missing amount or loanId in the request.');
            return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
        }

        // --- Step 3: Fetch Loan Data ---
        const loan = await prisma.loan.findUnique({
            where: { id: loanId },
            select: {
                borrowerId: true,
                product: {
                    select: {
                        provider: {
                            select: { collectionAccount: true },
                        },
                    },
                },
            },
        });

        if (!loan) {
            console.error('[initiate-payment] loan not found for loanId:', loanId);
            return NextResponse.json({ error: 'Loan not found.' }, { status: 404 });
        }

        console.info('[initiate-payment] loan fetched', { loanId, borrowerId: loan.borrowerId });
        try { console.debug('[initiate-payment] loan.detail', JSON.stringify(loan)); } catch (e) { console.debug('[initiate-payment] loan.detail (non-serializable)'); }

        const providerCollectionAccount = (loan as any).product?.provider?.collectionAccount || null;
        const ACCOUNT_NO = providerCollectionAccount || LEGACY_ACCOUNT_NO;

        console.info('[initiate-payment] resolved collection account', { providerCollectionAccount: !!providerCollectionAccount, usingLegacy: !!(!providerCollectionAccount && LEGACY_ACCOUNT_NO) });

        if (!ACCOUNT_NO) {
            console.error('[initiate-payment] no collection account configured for provider or legacy fallback');
            return NextResponse.json(
                { error: 'Collection account is not configured for this provider.' },
                { status: 500 }
            );
        }

        // --- Step 4: Retrieve Session ---
        const session = await getSession();
        console.info('[initiate-payment] session loaded', { sessionPresent: !!session, sessionUser: session?.userId || null });

        const superAppToken = session?.superAppToken;

        if (!superAppToken) {
            console.error('❌ Super App authorization token is missing or malformed.');
            return NextResponse.json(
                {
                    error:
                        'Your session has expired or is invalid. Please reconnect from the main app.',
                    sessionData: session,
                },
                { status: 401 }
            );
        }

        const token = superAppToken;
        console.info('[initiate-payment] superAppToken present', { tokenLength: String(token).length });

        // --- Step 5: Generate Transaction Info ---
        const transactionId = randomUUID();
        const transactionTime = format(new Date(), 'yyyyMMddHHmmss');

        const signatureParts: string[] = [
            `accountNo=${ACCOUNT_NO}`,
            `amount=${amount}`,
            `callBackURL=${CALLBACK_URL}`,
            `companyName=${COMPANY_NAME}`,
            `Key=${NIB_PAYMENT_KEY ? '[MASKED]' : ''}`,
            `token=${'[MASKED]'}`,
            `transactionId=${transactionId}`,
            `transactionTime=${transactionTime}`,
        ];
        const signatureStringMasked = signatureParts.join('&');
        const signatureStringForHash = [
            `accountNo=${ACCOUNT_NO}`,
            `amount=${amount}`,
            `callBackURL=${CALLBACK_URL}`,
            `companyName=${COMPANY_NAME}`,
            `Key=${NIB_PAYMENT_KEY || ''}`,
            `token=${token}`,
            `transactionId=${transactionId}`,
            `transactionTime=${transactionTime}`,
        ].join('&');

        console.info('[initiate-payment] signature string (masked)', signatureStringMasked);

        const signature = createHash('sha256').update(signatureStringForHash, 'utf8').digest('hex');
        console.info('[initiate-payment] signature generated', { signature });

        const payload = {
            accountNo: ACCOUNT_NO,
            amount: String(amount),
            callBackURL: CALLBACK_URL,
            companyName: COMPANY_NAME,
            token: '[MASKED]',
            transactionId,
            transactionTime,
            signature,
        };
        try { console.debug('[initiate-payment] payload (masked)', JSON.stringify(payload)); } catch(e) { console.debug('[initiate-payment] payload (masked) non-serializable'); }

        // --- Step 6: Save Pending Payment ---
        await prisma.pendingPayment.create({
            data: {
                transactionId,
                loanId,
                borrowerId: loan.borrowerId,
                amount,
                status: 'PENDING',
            },
        });

        await createAuditLog({
            actorId: loan.borrowerId,
            action: 'PAYMENT_GATEWAY_REQUEST',
            entity: 'LOAN',
            entityId: loanId,
            details: { transactionId, amount },
        });

        // --- Step 7: Send to Payment Gateway ---
        const paymentResponse = await fetch(NIB_PAYMENT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${superAppToken}`,
            },
            body: JSON.stringify(payload),
        });

        // payment gateway response status (log removed)

        if (!paymentResponse.ok) {
            const errorData = await paymentResponse.text();
            console.error('❌ PAYMENT GATEWAY ERROR RESPONSE:', errorData);
            throw new Error(`Payment gateway request failed: ${errorData}`);
        }

        const responseData = await paymentResponse.json();
        // payment gateway response body received (log removed)

        const paymentToken = responseData.token;

        if (!paymentToken) {
            throw new Error('Payment token not received from the gateway.');
        }

        return NextResponse.json({ paymentToken, transactionId });
    } catch (error) {
        console.error('💥 Error initiating payment:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
