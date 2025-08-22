
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { loanSchema } from '@/lib/schemas';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const data = loanSchema.parse(body);

        const newLoan = await prisma.loan.create({
            data: {
                customerId: "1", // Hardcoded customer for now
                providerId: data.providerId,
                productId: data.productId,
                loanAmount: data.loanAmount,
                serviceFee: data.serviceFee,
                penaltyAmount: data.penaltyAmount,
                disbursedDate: data.disbursedDate,
                dueDate: data.dueDate,
                repaymentStatus: data.repaymentStatus,
                repaidAmount: 0,
            }
        });

        // Also update customer's loan history
        const customer = await prisma.customer.findUnique({ where: { id: "1" } });
        if (customer) {
            const loanHistory = JSON.parse(customer.loanHistory);
            loanHistory.totalLoans += 1;
            await prisma.customer.update({
                where: { id: "1" },
                data: { loanHistory: JSON.stringify(loanHistory) }
            });
        }

        return NextResponse.json(newLoan, { status: 201 });

    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.errors }, { status: 400 });
        }
        console.error('Error creating loan:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
