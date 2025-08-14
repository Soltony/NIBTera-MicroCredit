
import { NextResponse } from 'next/server';
import { AppDataSource } from '@/data-source';
import { LoanProvider } from '@/entities/LoanProvider';
import { LoanProduct } from '@/entities/LoanProduct';
import { In } from 'typeorm';
import { z } from 'zod';

const providerSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    icon: z.string().min(1, 'Icon is required'),
    colorHex: z.string().min(1, 'Color is required'),
    displayOrder: z.number().int(),
});

const updateProviderSchema = providerSchema.extend({
    id: z.string(),
});

// POST a new provider
export async function POST(req: Request) {
    try {
        if (!AppDataSource.isInitialized) await AppDataSource.initialize();
        const providerRepo = AppDataSource.getRepository(LoanProvider);
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
        if (!AppDataSource.isInitialized) await AppDataSource.initialize();
        const providerRepo = AppDataSource.getRepository(LoanProvider);
        const body = await req.json();
        const validation = updateProviderSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ error: validation.error.format() }, { status: 400 });
        }
        
        const { id, ...updateData } = validation.data;

        await providerRepo.update(id, updateData);
        const updatedProvider = await providerRepo.findOneBy({id: Number(id)});

        return NextResponse.json(updatedProvider);
    } catch (error) {
        console.error('Error updating provider:', error);
        return NextResponse.json({ error: 'Failed to update provider' }, { status: 500 });
    }
}


// DELETE a provider
export async function DELETE(req: Request) {
    try {
        if (!AppDataSource.isInitialized) await AppDataSource.initialize();
        const providerRepo = AppDataSource.getRepository(LoanProvider);
        const productRepo = AppDataSource.getRepository(LoanProduct);
        
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        
        if (!id) {
            return NextResponse.json({ error: 'Provider ID is required' }, { status: 400 });
        }

        const provider = await providerRepo.findOne({
            where: { id: Number(id) },
            relations: ['products']
        });

        if (!provider) {
             return NextResponse.json({ error: 'Provider not found.' }, { status: 404 });
        }

        if (provider.products && provider.products.length > 0) {
            return NextResponse.json({ error: `Cannot delete provider. It has ${provider.products.length} associated product(s). Please delete them first.` }, { status: 400 });
        }

        await providerRepo.delete(id);

        return NextResponse.json({ message: 'Provider deleted successfully' }, { status: 200 });
    } catch (error) {
        console.error('Error deleting provider:', error);
        return NextResponse.json({ error: 'Failed to delete provider' }, { status: 500 });
    }
}
