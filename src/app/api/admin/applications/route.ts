
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { z } from 'zod';
import { createAuditLog } from '@/lib/audit-log';

// GET all applications pending review
export async function GET(req: NextRequest) {
    const session = await getSession();
    if (!session?.userId) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    try {
        const applications = await prisma.loanApplication.findMany({
            where: {
                status: 'PENDING_REVIEW'
            },
            include: {
                product: {
                    include: {
                        provider: true,
                    }
                },
                borrower: {
                   include: {
                        provisionedData: {
                            orderBy: {
                                createdAt: 'desc'
                            },
                            take: 1
                        }
                    }
                },
                uploadedDocuments: {
                    include: {
                        requiredDocument: true,
                    }
                },
            },
            orderBy: {
                createdAt: 'asc'
            }
        });

        // Add borrower name to application
        const applicationsWithBorrowerName = applications.map(app => {
            let borrowerName = `B-${app.borrowerId.slice(0, 8)}`;
            if (app.borrower.provisionedData.length > 0) {
                 try {
                    const data = JSON.parse(app.borrower.provisionedData[0].data as string);
                    const nameKey = Object.keys(data).find(k => k.toLowerCase() === 'fullname' || k.toLowerCase() === 'full name');
                    if (nameKey) {
                        borrowerName = data[nameKey];
                    }
                } catch(e) { /* ignore */}
            }
            return {
                ...app,
                borrowerName
            }
        });
        

        return NextResponse.json(applicationsWithBorrowerName);

    } catch (error) {
        console.error('Error fetching applications for review:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

const updateStatusSchema = z.object({
  applicationId: z.string(),
  status: z.enum(['APPROVED', 'REJECTED']),
});

// PUT to update an application's status
export async function PUT(req: NextRequest) {
    const session = await getSession();
    if (!session?.userId) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    try {
        const body = await req.json();
        const { applicationId, status } = updateStatusSchema.parse(body);

        const updatedApplication = await prisma.loanApplication.update({
            where: { id: applicationId },
            data: { status: status }
        });
        
        const auditAction = status === 'APPROVED' ? 'LOAN_APPLICATION_APPROVED' : 'LOAN_APPLICATION_REJECTED';
        await createAuditLog({
            actorId: session.userId,
            action: auditAction,
            entity: 'LOAN_APPLICATION',
            entityId: applicationId,
            details: { borrowerId: updatedApplication.borrowerId }
        });

        return NextResponse.json(updatedApplication);

    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.errors }, { status: 400 });
        }
        console.error('Error updating application status:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
