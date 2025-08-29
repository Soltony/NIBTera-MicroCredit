
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';

// Note: GET method is in /api/providers/route.ts to be public

const defaultLedgerAccounts = [
    // Assets (Receivables)
    { name: 'Principal Receivable', type: 'Receivable', category: 'Principal' },
    { name: 'Interest Receivable', type: 'Receivable', category: 'Interest' },
    { name: 'Service Fee Receivable', type: 'Receivable', category: 'ServiceFee' },
    { name: 'Penalty Receivable', type: 'Receivable', category: 'Penalty' },
    // Cash / Received
    { name: 'Principal Received', type: 'Received', category: 'Principal' },
    { name: 'Interest Received', type: 'Received', category: 'Interest' },
    { name: 'Service Fee Received', type: 'Received', category: 'ServiceFee' },
    { name: 'Penalty Received', type: 'Received', category: 'Penalty' },
    // Income
    { name: 'Interest Income', type: 'Income', category: 'Interest' },
    { name: 'Service Fee Income', type: 'Income', category: 'ServiceFee' },
    { name: 'Penalty Income', type: 'Income', category: 'Penalty' },
];


export async function POST(req: NextRequest) {
    const session = await getSession();
    if (!session?.userId) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { startingCapital, ...restOfBody } = body;
        
        // Use a transaction to create the provider and its ledger accounts
        const newProvider = await prisma.$transaction(async (tx) => {
            const provider = await tx.loanProvider.create({
                data: {
                    ...restOfBody,
                    startingCapital: startingCapital,
                    initialBalance: startingCapital, // Both start with the same value
                },
            });

            const accountsToCreate = defaultLedgerAccounts.map(acc => ({
                ...acc,
                providerId: provider.id,
            }));

            await tx.ledgerAccount.createMany({
                data: accountsToCreate,
            });

            return provider;
        });

        return NextResponse.json(newProvider, { status: 201 });
    } catch (error) {
        console.error('Error creating provider:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
     const session = await getSession();
    if (!session?.userId) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { id, ...dataToUpdate } = body;
        
        if (!id) {
            return NextResponse.json({ error: 'Provider ID is required for update.' }, { status: 400 });
        }

        const updatedProvider = await prisma.loanProvider.update({
            where: { id },
            data: dataToUpdate,
        });
        return NextResponse.json(updatedProvider);
    } catch (error) {
        console.error('Error updating provider:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
     const session = await getSession();
    if (!session?.userId) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'Provider ID is required' }, { status: 400 });
    }
    
    try {
        const productCount = await prisma.loanProduct.count({ where: { providerId: id } });
        if (productCount > 0) {
            return NextResponse.json({ error: 'Cannot delete provider with associated products.' }, { status: 400 });
        }
        await prisma.loanProvider.delete({
            where: { id: id },
        });
        return NextResponse.json({ message: 'Provider deleted successfully' });
    } catch (error) {
        console.error('Error deleting provider:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
