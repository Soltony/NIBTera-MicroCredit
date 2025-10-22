
import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomUUID } from 'crypto';
import { format } from 'date-fns';
import prisma from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit-log';
import { getSession } from '@/lib/session';

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

        const session = await getSession();
        const token = session?.superAppToken;

        if (!token) {
            console.error("Super App authorization token is missing or malformed in the user session.");
            return NextResponse.json({ error: "Your session has expired or is invalid. Please reconnect from the main app." }, { status: 401 });
        }
        
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
            `token=${token}`,
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
            token: token,
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
                'Authorization': `Bearer ${token}`,
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
