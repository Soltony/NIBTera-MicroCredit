
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';

// GET the active eligibility list upload for a product
export async function GET(req: NextRequest, { params }: { params: { productId: string } }) {
    const session = await getSession();
    if (!session?.userId) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { productId } = params;

    if (!productId) {
        return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    try {
        const product = await prisma.loanProduct.findUnique({
            where: { id: productId },
            select: { eligibilityUpload: true }
        });
        
        if (!product || !product.eligibilityUpload) {
            return NextResponse.json(null);
        }

        return NextResponse.json(product.eligibilityUpload);
    } catch (error) {
        console.error('Error fetching eligibility list:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
