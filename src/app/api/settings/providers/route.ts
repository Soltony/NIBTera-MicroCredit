
import { NextResponse } from 'next/server';
import { getConnectedDataSource } from '@/data-source';
import { LoanProvider } from '@/entities/LoanProvider';
import { z } from 'zod';

const providerSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    icon: z.string().min(1, 'Icon is required'),
    colorHex: z.string().min(1, 'Color is required'),
    displayOrder: z.number().int(),
    accountNumber: z.string().optional().nullable(),
    allowMultipleProviderLoans: z.boolean(),
    allowCrossProviderLoans: z.boolean(),
});

const updateProviderSchema = providerSchema.partial().extend({
  id: z.string().transform((val) => Number(val)),
});

// Helper to normalize accountNumber
function normalizeAccountNumber(value?: string | null) {
    if (!value || value.trim() === '') return null;
    return value.trim();
}

// POST a new provider
export async function POST(req: Request) {
    try {
        const dataSource = await getConnectedDataSource();
        const providerRepo = dataSource.getRepository(LoanProvider);
        const body = await req.json();

        console.log('[DEBUG] API POST /api/settings/providers - Received body:', body);

        const validation = providerSchema.safeParse(body);
        if (!validation.success) {
            console.error('[DEBUG] API POST Validation Error:', validation.error.format());
            return NextResponse.json({ error: validation.error.format() }, { status: 400 });
        }

        const payload = {
            ...validation.data,
            accountNumber: normalizeAccountNumber(validation.data.accountNumber),
        };

        console.log('[DEBUG] API POST /api/settings/providers - Validated payload:', payload);

        const newProvider = providerRepo.create(payload);
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

        console.log('[DEBUG] API PUT /api/settings/providers - Received body:', body);

        const validation = updateProviderSchema.safeParse(body);
        if (!validation.success) {
            console.error('[DEBUG] API PUT Validation Error:', validation.error.format());
            return NextResponse.json({ error: validation.error.format() }, { status: 400 });
        }
        
        const { id, ...validatedData } = validation.data;
        
        console.log('[DEBUG] API PUT /api/settings/providers - Validated data:', validatedData);

        const existingProvider = await providerRepo.findOneBy({ id });
        if (!existingProvider) {
            return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
        }

        // Normalize accountNumber
        if (Object.prototype.hasOwnProperty.call(validatedData, 'accountNumber')) {
            (validatedData as Partial<LoanProvider>).accountNumber = normalizeAccountNumber(validatedData.accountNumber);
        }

        const updatedProvider = providerRepo.merge(existingProvider, validatedData);
        await providerRepo.save(updatedProvider);

        return NextResponse.json(updatedProvider);
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

        await providerRepo.delete(id);

        return NextResponse.json({ message: 'Provider deleted successfully' }, { status: 200 });
    } catch (error: any) {
        if (error.code === 'ORA-02292' || (error.message && error.message.includes('ORA-02292'))) {
             return NextResponse.json({ error: 'Cannot delete provider. It has associated product(s). Please delete them first.' }, { status: 400 });
        }
        console.error('Error deleting provider:', error);
        return NextResponse.json({ error: 'Failed to delete provider' }, { status: 500 });
    }
}
