
import { NextResponse } from 'next/server';
import { getConnectedDataSource } from '@/data-source';
import { LoanProvider } from '@/entities/LoanProvider';
import { LoanProduct } from '@/entities/LoanProduct';
import { In, DataSource } from 'typeorm';
import { z } from 'zod';

const providerSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    icon: z.string().min(1, 'Icon is required'),
    colorHex: z.string().min(1, 'Color is required'),
    displayOrder: z.number().int(),
    allowMultipleActiveLoans: z.boolean(),
});

const updateProviderSchema = providerSchema.partial().extend({
    id: z.string(),
});

// POST a new provider
export async function POST(req: Request) {
    try {
        const dataSource = await getConnectedDataSource();
        const providerRepo = dataSource.getRepository(LoanProvider);
        const body = await req.json();
        const validation = providerSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ error: validation.error.format() }, { status: 400 });
        }

        const newProvider = providerRepo.create(validation.data);
        await providerRepo.save(newProvider);
        
        return NextResponse.json({ ...newProvider, products: [] }, { status: 201 });
    } catch (error) {
        console.error('Error creating provider:', error);
        return NextResponse.json({ error: 'Failed to create provider' }, { status: 500 });
    }
}

// PUT (update) a provider
export async function PUT(req: Request) {
    try {
        const dataSource = await getConnectedDataSource();
        const providerRepo = dataSource.getRepository(LoanProvider);
        const body = await req.json();
        const validation = updateProviderSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ error: validation.error.format() }, { status: 400 });
        }
        
        const { id, ...updateData } = validation.data;

        await providerRepo.update(id, updateData);
        
        return NextResponse.json({ message: 'Provider updated successfully' }, { status: 200 });

    } catch (error) {
        console.error('Error updating provider:', error);
        return NextResponse.json({ error: 'Failed to update provider' }, { status: 500 });
    }
}


// DELETE a provider
export async function DELETE(req: Request) {
    try {
        const dataSource = await getConnectedDataSource();
        const providerRepo = dataSource.getRepository(LoanProvider);
        
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        
        if (!id) {
            return NextResponse.json({ error: 'Provider ID is required' }, { status: 400 });
        }

        // The database's foreign key constraint will prevent deletion if products exist.
        // We will catch this specific error and return a user-friendly message.
        await providerRepo.delete(id);

        return NextResponse.json({ message: 'Provider deleted successfully' }, { status: 200 });
    } catch (error: any) {
        // ORA-02292 is the Oracle error code for an integrity constraint violation (foreign key).
        // This is a more robust way to check than querying the products table first.
        if (error.code === 'ORA-02292' || (error.message && error.message.includes('ORA-02292'))) {
             return NextResponse.json({ error: 'Cannot delete provider. It has associated product(s). Please delete them first.' }, { status: 400 });
        }
        console.error('Error deleting provider:', error);
        return NextResponse.json({ error: 'Failed to delete provider' }, { status: 500 });
    }
}
