
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';

// Note: GET method is in /api/providers/route.ts to be public

export async function POST(req: NextRequest) {
    const session = await getSession();
    if (!session?.userId) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const newProvider = await prisma.loanProvider.create({
            data: body,
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
