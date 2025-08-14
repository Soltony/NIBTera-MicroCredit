
import { NextResponse } from 'next/server';
import { AppDataSource } from '@/data-source';
import { LoanDetails } from '@/entities/LoanDetails';
import { z } from 'zod';
import type { DataSource } from 'typeorm';

async function getConnectedDataSource(): Promise<DataSource> {
    if (AppDataSource.isInitialized) {
        return AppDataSource;
    } else {
        return await AppDataSource.initialize();
    }
}

const loanSchema = z.object({
    providerId: z.string(),
    productId: z.string(),
    loanAmount: z.number(),
    serviceFee: z.number(),
    interestRate: z.number(),
    disbursedDate: z.string().datetime(),
    dueDate: z.string().datetime(),
    penaltyAmount: z.number(),
    repaymentStatus: z.enum(['Paid', 'Unpaid']),
});

export async function POST(req: Request) {
    let dataSource: DataSource | null = null;
    try {
        dataSource = await getConnectedDataSource();
        const loanRepo = dataSource.getRepository(LoanDetails);

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
    } finally {
        if (dataSource && AppDataSource.options.type !== 'oracle') {
           // await dataSource.destroy();
        }
    }
}
