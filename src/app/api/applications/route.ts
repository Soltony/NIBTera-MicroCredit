
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const appSchema = z.object({
  borrowerId: z.string(),
  productId: z.string(),
  status: z.enum(['PENDING_DOCUMENTS', 'PENDING_REVIEW', 'REJECTED', 'APPROVED', 'DISBURSED']).optional(),
  loanAmount: z.number().optional(),
});

// GET or CREATE a loan application
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { borrowerId, productId, status, loanAmount } = appSchema.parse(body);

        const product = await prisma.loanProduct.findUnique({ where: { id: productId }});
        if (!product) {
            return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
        }
        
        // For SME loans, try to find an existing, incomplete application to allow resuming.
        if (product.productType === 'SME') {
             let application = await prisma.loanApplication.findFirst({
                where: {
                    borrowerId,
                    productId,
                    status: { notIn: ['DISBURSED', 'REJECTED'] }
                },
                include: {
                    product: { include: { requiredDocuments: true } },
                    uploadedDocuments: true,
                }
            });

            if (application) {
                 return NextResponse.json(application, { status: 200 });
            }
        }
        
        // For PERSONAL loans, or if no active SME application exists, create a new one.
        const application = await prisma.loanApplication.create({
            data: {
                borrowerId,
                productId,
                status: status || (product.productType === 'SME' ? 'PENDING_DOCUMENTS' : 'APPROVED'),
                loanAmount: loanAmount || 0,
            },
            include: {
                product: { include: { requiredDocuments: true } },
                uploadedDocuments: true,
            }
        });


        return NextResponse.json(application, { status: 201 });

    } catch (error) {
         if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.errors }, { status: 400 });
        }
        console.error('Error in POST /api/applications:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

const updateAppSchema = z.object({
  status: z.enum(['PENDING_DOCUMENTS', 'PENDING_REVIEW', 'REJECTED', 'APPROVED', 'DISBURSED']),
});


// Update an application's status
export async function PUT(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'Application ID is required' }, { status: 400 });
    }

    try {
        const body = await req.json();
        const { status } = updateAppSchema.parse(body);

        const updatedApplication = await prisma.loanApplication.update({
            where: { id },
            data: { status },
        });

        return NextResponse.json(updatedApplication, { status: 200 });
    } catch(error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.errors }, { status: 400 });
        }
        console.error(`Error updating application ${id}:`, error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
