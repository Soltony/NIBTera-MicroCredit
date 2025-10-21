
import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomUUID } from 'crypto';
import { format } from 'date-fns';
import { headers } from 'next/headers';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
    // These should be in your .env.local file
    const ACCOUNT_NO = process.env.ACCOUNT_NO;
    const CALLBACK_URL = process.env.CALLBACK_URL;
    const COMPANY_NAME = process.env.COMPANY_NAME;
    const NIB_PAYMENT_KEY = process.env.NIB_PAYMENT_KEY;
    const NIB_PAYMENT_URL = process.env.NIB_PAYMENT_URL;

    if (!ACCOUNT_NO || !CALLBACK_URL || !COMPANY_NAME || !NIB_PAYMENT_KEY || !NIB_PAYMENT_URL) {
        return NextResponse.json({ error: 'Payment gateway environment variables are not configured on the server.' }, { status: 500 });
    }

    try {
        const { amount, loanId } = await req.json();

        // Step 1: Get Authorization token from the incoming request header
        const headersList = headers();
        const authHeader = headersList.get('Authorization');
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
             // This token is required by the NIB payment gateway, passed from the super app.
             // If we are in a pure web context without the super app, this will fail.
             // A real implementation might need a different flow for web-based repayments.
             return NextResponse.json({ error: 'Super App authorization token is missing.' }, { status: 401 });
        }
        const superAppToken = authHeader.substring(7);

        // Step 2: Generate transaction details
        const transactionId = randomUUID();
        const transactionTime = format(new Date(), 'yyyyMMddHHmmss');

        // Step 3: Create the signature string
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
        
        // Step 4: Generate the SHA-256 signature
        const signature = createHash('sha256').update(signatureString, 'utf8').digest('hex');

        // Step 5: Build the final payload
        const payload = {
            accountNo: ACCOUNT_NO,
            amount: String(amount),
            callBackURL: CALLBACK_URL,
            companyName: COMPANY_NAME,
            token: superAppToken,
            transactionId: transactionId,
            transactionTime: transactionTime,
            signature: signature
        };

        // Step 6: Send the request to the payment gateway
        const paymentResponse = await fetch(NIB_PAYMENT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${superAppToken}`
            },
            body: JSON.stringify(payload),
        });

        if (!paymentResponse.ok) {
            const errorData = await paymentResponse.json();
            console.error("Payment Gateway Error:", errorData);
            throw new Error(errorData.message || 'Payment gateway request failed.');
        }

        const responseData = await paymentResponse.json();
        const paymentToken = responseData.token;

        if (!paymentToken) {
            throw new Error('Payment token not received from the gateway.');
        }
        
        // IMPORTANT: Store the transactionId to later verify the payment status via the callback
        await prisma.payment.updateMany({
            where: { loanId: loanId },
            data: {
                // You might need a dedicated field for this
                // For now, let's assume you have a way to link this.
                // e.g., creating a pending payment record here.
            }
        });

        // Step 7: Return the paymentToken to the client
        return NextResponse.json({ paymentToken: paymentToken, transactionId: transactionId });

    } catch (error) {
        console.error('Error initiating payment:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
