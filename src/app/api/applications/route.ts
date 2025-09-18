
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const createApplicationSchema = z.object({
  borrowerId: z.string(),
  productId: z.string(),
});

// This API creates a loan application record.
// For SME loans, it tries to find an existing, incomplete application to allow resuming.
// For PERSONAL loans, it always creates a new one.
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { borrowerId, productId } = createApplicationSchema.parse(body);

        const product = await prisma.loanProduct.findUnique({ where: { id: productId } });
        if (!product) {
            return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
        }

        // For SME loans, check if there's an active application to resume
        if (product.productType === 'SME') {
             const existingApplication = await prisma.loanApplication.findFirst({
                where: {
                    borrowerId,
                    productId,
                    status: { in: ['PENDING_DOCUMENTS', 'PENDING_REVIEW'] }
                },
                 orderBy: {
                    createdAt: 'desc'
                }
            });

            if (existingApplication) {
                return NextResponse.json(existingApplication, { status: 200 });
            }
        }
        
        // For PERSONAL loans, or if no active SME application exists, create a new one.
        const application = await prisma.loanApplication.create({
            data: {
                borrowerId,
                productId,
                status: product.productType === 'SME' ? 'PENDING_DOCUMENTS' : 'APPROVED', // Personal loans are auto-approved for calculation
            }
        });

        return NextResponse.json(application, { status: 201 });

    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.errors }, { status: 400 });
        }
        console.error("Error in POST /api/applications:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
