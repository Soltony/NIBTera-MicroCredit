
import { NextResponse } from 'next/server';
import { getConnectedDataSource } from '@/data-source';
import { loanSchema } from '@/lib/schemas';
import type { LoanDetails } from '@/entities/LoanDetails';

export async function POST(req: Request) {
    try {
        const dataSource = await getConnectedDataSource();
        const loanRepo = dataSource.getRepository('LoanDetails');

        const body = await req.json();
        const validation = loanSchema.safeParse(body);

        if (!validation.success) {
            console.error('Loan validation error:', validation.error.format());
            return NextResponse.json({ error: 'Invalid loan data provided.' }, { status: 400 });
        }
        
        const { providerId, productId, ...loanData } = validation.data;

        const newLoan = loanRepo.create({
            ...loanData,
            providerId: Number(providerId),
            productId: Number(productId),
            disbursedDate: new Date(loanData.disbursedDate),
            dueDate: new Date(loanData.dueDate),
            repaidAmount: 0, // Initialize repaidAmount
        });

        const savedLoan = await loanRepo.save(newLoan);
        
        return NextResponse.json(savedLoan, { status: 201 });

    } catch (error) {
        console.error('Error creating loan:', error);
        return NextResponse.json({ error: 'Failed to create loan' }, { status: 500 });
    }
}
