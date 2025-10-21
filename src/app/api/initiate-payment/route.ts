
import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomUUID } from 'crypto';
import { format } from 'date-fns';
import { headers } from 'next/headers';
import prisma from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit-log';

export async function POST(req: NextRequest) {
    // These should be in your .env file
    const ACCOUNT_NO = process.env.ACCOUNT_NO;
    const CALLBACK_URL = process.env.CALLBACK_URL;
    const COMPANY_NAME = process.env.COMPANY_NAME;
    const NIB_PAYMENT_KEY = process.env.NIB_PAYMENT_KEY;
    const NIB_PAYMENT_URL = process.env.NIB_PAYMENT_URL;

    if (!ACCOUNT_NO || !CALLBACK_URL || !COMPANY_NAME || !NIB_PAYMENT_KEY || !NIB_PAYMENT_URL) {
        console.error("Payment gateway environment variables are not configured.");
        return NextResponse.json({ error: 'Payment gateway is not configured on the server.' }, { status: 500 });
    }

    try {
        const { amount, loanId } = await req.json();
        
        const loan = await prisma.loan.findUnique({ where: { id: loanId }, select: { borrowerId: true }});
        if (!loan) {
            return NextResponse.json({ error: 'Loan not found.' }, { status: 404 });
        }


        // This token is required by the NIB payment gateway, passed from the super app.
        // It's retrieved during the initial connection at /loan/connect and should be passed from the client.
        // For this flow, we assume the SuperApp provides a fresh token or the client can fetch one.
        // Since we cannot get it from the header here (it's a client API call),
        // we'll rely on the one passed during connection for now. A more robust solution might
        // involve a session store for this super-app token.
        // A real implementation needs to clarify how this token is managed across sessions.
        
        // For now, let's assume we can't get it from the header and we proceed without it for the signature,
        // as the final request might have it injected by a proxy or the super app's webview itself.
        // We will log that the token is missing for the signature.
        console.warn("Super App token is not available in this context for signature generation. The payment gateway may reject the request if it's required in the signature.");
        const superAppToken = "TOKEN_NOT_AVAILABLE_IN_SIGNATURE"; // Placeholder


        // Generate transaction details
        const transactionId = randomUUID();
        const transactionTime = format(new Date(), 'yyyyMMddHHmmss');

        // Create the signature string
        const signatureString = [
            `accountNo=${ACCOUNT_NO}`,
            `amount=${amount}`,
            `callBackURL=${CALLBACK_URL}`,
            `companyName=${COMPANY_NAME}`,
            `Key=${NIB_PAYMENT_KEY}`,
            `token=${superAppToken}`,
            `transactionId=${transactionId}`,
            `transactionTime=${transactionTime}`
        ].join('&');
        
        // Generate the SHA-256 signature
        const signature = createHash('sha256').update(signatureString, 'utf8').digest('hex');

        // Build the final payload
        const payload = {
            accountNo: ACCOUNT_NO,
            amount: String(amount),
            callBackURL: CALLBACK_URL,
            companyName: COMPANY_NAME,
            token: superAppToken, // This might be overridden by the Super App webview
            transactionId: transactionId,
            transactionTime: transactionTime,
            signature: signature
        };

        // Before sending, create a pending payment record
        await prisma.pendingPayment.create({
            data: {
                transactionId,
                loanId,
                borrowerId: loan.borrowerId,
                amount,
                status: 'PENDING'
            }
        });
        
        await createAuditLog({ actorId: loan.borrowerId, action: 'PAYMENT_GATEWAY_REQUEST', entity: 'LOAN', entityId: loanId, details: { transactionId, amount } });

        // Send the request to the payment gateway
        const paymentResponse = await fetch(NIB_PAYMENT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // The actual Authorization bearer token is expected to be added by the SuperApp environment
                // or a proxy. We cannot access it directly from the client's original request here.
            },
            body: JSON.stringify(payload),
        });

        if (!paymentResponse.ok) {
            const errorData = await paymentResponse.text();
            console.error("Payment Gateway Error:", errorData);
            throw new Error(`Payment gateway request failed: ${errorData}`);
        }

        const responseData = await paymentResponse.json();
        const paymentToken = responseData.token;

        if (!paymentToken) {
            throw new Error('Payment token not received from the gateway.');
        }

        // Return the paymentToken and our internal transactionId to the client
        return NextResponse.json({ paymentToken, transactionId });

    } catch (error) {
        console.error('Error initiating payment:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
