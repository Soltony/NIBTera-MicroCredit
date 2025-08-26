
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const loanSchema = z.object({
    providerId: z.string(),
    productId: z.string(),
    borrowerId: z.string(),
    loanAmount: z.number(),
    serviceFee: z.number(),
    penaltyAmount: z.number(),
    disbursedDate: z.string().datetime(),
    dueDate: z.string().datetime(),
    repaymentStatus: z.enum(['Paid', 'Unpaid']),
});


export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const data = loanSchema.parse(body);

        const newLoan = await prisma.loan.create({
            data: {
                borrowerId: data.borrowerId,
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

        return NextResponse.json(newLoan, { status: 201 });

    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.errors }, { status: 400 });
        }
        console.error('Error creating loan:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
