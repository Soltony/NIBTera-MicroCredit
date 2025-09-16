
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const appSchema = z.object({
  borrowerId: z.string(),
  productId: z.string(),
});

// GET or CREATE a loan application
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { borrowerId, productId } = appSchema.parse(body);

        // Find an existing application that is not yet a real loan
        let application = await prisma.loanApplication.findFirst({
            where: {
                borrowerId,
                productId,
                status: { notIn: ['APPROVED'] } // Or whatever status means "converted to loan"
            },
            include: {
                product: { include: { requiredDocuments: true } },
                uploadedDocuments: true,
            }
        });

        if (!application) {
            application = await prisma.loanApplication.create({
                data: {
                    borrowerId,
                    productId,
                    status: 'PENDING_DOCUMENTS',
                },
                include: {
                    product: { include: { requiredDocuments: true } },
                    uploadedDocuments: true,
                }
            });
        }

        return NextResponse.json(application, { status: 200 });

    } catch (error) {
         if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.errors }, { status: 400 });
        }
        console.error('Error in POST /api/applications:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

const updateAppSchema = z.object({
  status: z.enum(['PENDING_DOCUMENTS', 'PENDING_REVIEW', 'REJECTED', 'APPROVED']),
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
