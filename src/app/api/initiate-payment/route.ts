
import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomUUID } from 'crypto';
import { format } from 'date-fns';
import prisma from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit-log';
import { getSession } from '@/lib/session';

export async function POST(req: NextRequest) {
    // initiate payment request received
    console.log('[initiate-payment] POST called; incoming headers:', Object.fromEntries(req.headers.entries()));

    // --- Step 1: Environment Validation ---
    const DEFAULT_ACCOUNT_NO = process.env.ACCOUNT_NO;
    const CALLBACK_URL = process.env.CALLBACK_URL;
    const COMPANY_NAME = process.env.COMPANY_NAME;
    const NIB_PAYMENT_KEY = process.env.NIB_PAYMENT_KEY;
    const NIB_PAYMENT_URL = process.env.NIB_PAYMENT_URL;

    console.log('[initiate-payment] env:', {
        ACCOUNT_NO: DEFAULT_ACCOUNT_NO ? '***SET***' : null,
        CALLBACK_URL,
        COMPANY_NAME,
        NIB_PAYMENT_KEY: NIB_PAYMENT_KEY ? '***SET***' : null,
        NIB_PAYMENT_URL,
    });

    if (!CALLBACK_URL || !COMPANY_NAME || !NIB_PAYMENT_KEY || !NIB_PAYMENT_URL) {
        console.error('[initiate-payment] ❌ Missing payment gateway environment variables.');
        return NextResponse.json(
            { error: 'Payment gateway is not configured on the server.' },
            { status: 500 }
        );
    }

    try {
        // --- Step 2: Parse Request ---
        const body = await req.json();
        console.log('[initiate-payment] request body:', body);

        const { amount, loanId } = body;
        if (!amount || !loanId) {
            console.error('[initiate-payment] ❌ Missing amount or loanId in the request.');
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
                            select: {
                                id: true,
                                collectionAccount: true,
                            },
                        },
                    },
                },
            },
        });
        console.log('[initiate-payment] loan fetched:', loan ?? null);

        if (!loan) {
            console.error('[initiate-payment] loan not found for id:', loanId);
            return NextResponse.json({ error: 'Loan not found.' }, { status: 404 });
        }

        const providerCollectionAccount = loan.product?.provider?.collectionAccount || null;
        console.log('[initiate-payment] provider.collectionAccount:', providerCollectionAccount);
        const accountNo = (providerCollectionAccount || DEFAULT_ACCOUNT_NO || '').trim();
        console.log('[initiate-payment] resolved accountNo (provider -> env fallback):', accountNo ? '***SET***' : null);
        if (!accountNo) {
            console.error('[initiate-payment] ❌ Missing collection account: provider.collectionAccount and env ACCOUNT_NO are both empty.');
            return NextResponse.json(
                { error: 'Collection account is not configured for the loan provider.' },
                { status: 500 }
            );
        }

        // --- Step 4: Retrieve Session ---
        const session = await getSession();
        console.log('[initiate-payment] session:', session ?? null);

        const superAppToken = session?.superAppToken;
        console.log('[initiate-payment] superAppToken present:', !!superAppToken);

        if (!superAppToken) {
            console.error('[initiate-payment] ❌ Super App authorization token is missing or malformed.');
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

        // --- Step 5: Generate Transaction Info ---
        const transactionId = randomUUID();
        const transactionTime = format(new Date(), 'yyyyMMddHHmmss');
        console.log('[initiate-payment] transactionId, transactionTime:', transactionId, transactionTime);

        const signatureString = [
            `accountNo=${accountNo}`,
            `amount=${amount}`,
            `callBackURL=${CALLBACK_URL}`,
            `companyName=${COMPANY_NAME}`,
            `Key=${NIB_PAYMENT_KEY}`,
            `token=${token}`,
            `transactionId=${transactionId}`,
            `transactionTime=${transactionTime}`,
        ].join('&');

        // signature string built (log removed to reduce console noise)

        console.log('[initiate-payment] signatureString:', signatureString);
        const signature = createHash('sha256').update(signatureString, 'utf8').digest('hex');
        console.log('[initiate-payment] signature:', signature);
        // generated signature (log removed to reduce console noise)

        const payload = {
            accountNo: accountNo,
            amount: String(amount),
            callBackURL: CALLBACK_URL,
            companyName: COMPANY_NAME,
            token: token,
            transactionId,
            transactionTime,
            signature,
        };
        console.log('[initiate-payment] payload prepared for gateway:', payload);
        // final payload prepared for payment gateway (log removed to reduce console noise)

        // --- Step 6: Save Pending Payment ---
        const pending = await prisma.pendingPayment.create({
            data: {
                transactionId,
                loanId,
                borrowerId: loan.borrowerId,
                amount,
                status: 'PENDING',
            },
        });
        console.log('[initiate-payment] pendingPayment saved:', pending);

        await createAuditLog({
            actorId: loan.borrowerId,
            action: 'PAYMENT_GATEWAY_REQUEST',
            entity: 'LOAN',
            entityId: loanId,
            details: { transactionId, amount },
        });
        console.log('[initiate-payment] audit log created for payment request');

        // --- Step 7: Send to Payment Gateway ---
        console.log('[initiate-payment] sending request to payment gateway URL:', NIB_PAYMENT_URL);
        const paymentResponse = await fetch(NIB_PAYMENT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${superAppToken}`,
            },
            body: JSON.stringify(payload),
        });
        console.log('[initiate-payment] payment gateway response status:', paymentResponse.status);

        if (!paymentResponse.ok) {
            const errorData = await paymentResponse.text();
            console.error('[initiate-payment] ❌ PAYMENT GATEWAY ERROR RESPONSE:', errorData);
            throw new Error(`Payment gateway request failed: ${errorData}`);
        }

        const responseData = await paymentResponse.json();
        console.log('[initiate-payment] payment gateway response data:', responseData);

        const paymentToken = responseData.token;
        console.log('[initiate-payment] paymentToken received:', paymentToken ? '***SET***' : null);

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
