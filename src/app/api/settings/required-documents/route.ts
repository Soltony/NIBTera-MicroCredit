
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';

// POST a new required document for a product
export async function POST(req: NextRequest) {
    const session = await getSession();
    if (!session?.userId) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    try {
        const { productId, name } = await req.json();
        if (!productId || !name) {
            return NextResponse.json({ error: 'Product ID and document name are required.' }, { status: 400 });
        }
        
        const newDoc = await prisma.requiredDocument.create({
            data: {
                productId,
                name,
            }
        });
        
        return NextResponse.json(newDoc, { status: 201 });

    } catch (error) {
        console.error('Error creating required document:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// DELETE a required document
export async function DELETE(req: NextRequest) {
    const session = await getSession();
    if (!session?.userId) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'Document ID is required.' }, { status: 400 });
    }
    
    try {
        // TODO: Add a check here to prevent deleting if an application is using it
        await prisma.requiredDocument.delete({
            where: { id }
        });
        
        return NextResponse.json({ message: 'Document deleted successfully.' });
    } catch (error) {
         console.error('Error deleting required document:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
