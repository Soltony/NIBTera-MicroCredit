
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const providerSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    icon: z.string().min(1, 'Icon is required'),
    colorHex: z.string().min(1, 'Color is required'),
});

const updateProviderSchema = providerSchema.extend({
    id: z.string(),
});

// POST a new provider
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const validation = providerSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ error: validation.error.format() }, { status: 400 });
        }

        const newProvider = await prisma.loanProvider.create({
            data: validation.data,
            include: { products: true }
        });

        return NextResponse.json(newProvider, { status: 201 });
    } catch (error) {
        console.error('Error creating provider:', error);
        return NextResponse.json({ error: 'Failed to create provider' }, { status: 500 });
    }
}

// PUT (update) a provider
export async function PUT(req: Request) {
    try {
        const body = await req.json();
        const validation = updateProviderSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ error: validation.error.format() }, { status: 400 });
        }
        
        const { id, ...updateData } = validation.data;

        const updatedProvider = await prisma.loanProvider.update({
            where: { id },
            data: updateData,
        });

        return NextResponse.json(updatedProvider);
    } catch (error) {
        console.error('Error updating provider:', error);
        return NextResponse.json({ error: 'Failed to update provider' }, { status: 500 });
    }
}


// DELETE a provider
export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        
        if (!id) {
            return NextResponse.json({ error: 'Provider ID is required' }, { status: 400 });
        }

        await prisma.loanProvider.delete({
            where: { id },
        });

        return NextResponse.json({ message: 'Provider deleted successfully' }, { status: 200 });
    } catch (error) {
        console.error('Error deleting provider:', error);
        return NextResponse.json({ error: 'Failed to delete provider' }, { status: 500 });
    }
}
