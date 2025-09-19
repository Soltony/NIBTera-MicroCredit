
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { z } from 'zod';
import { createAuditLog } from '@/lib/audit-log';
import { handleSmeLoan } from '@/app/api/loans/route';
import { addDays } from 'date-fns';

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
  rejectionReason: z.string().optional(),
});

// PUT to update an application's status
export async function PUT(req: NextRequest) {
    const session = await getSession();
    if (!session?.userId) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    try {
        const body = await req.json();
        const { applicationId, status, rejectionReason } = updateStatusSchema.parse(body);
        
        const application = await prisma.loanApplication.findUnique({
            where: { id: applicationId },
            include: { product: true }
        });

        if (!application) {
            return NextResponse.json({ error: 'Application not found.' }, { status: 404 });
        }
        
        if (application.status !== 'PENDING_REVIEW') {
             return NextResponse.json({ error: `Application is not pending review. Current status: ${application.status}` }, { status: 409 });
        }

        if (status === 'APPROVED') {
            // Automatically disburse the loan
            const disbursementDate = new Date();
            const loanData = {
                borrowerId: application.borrowerId,
                productId: application.productId,
                loanApplicationId: application.id,
                loanAmount: application.loanAmount!,
                disbursedDate: disbursementDate.toISOString(),
                dueDate: addDays(disbursementDate, application.product.duration || 30).toISOString(),
            };
            
            // This will create the loan, update the application status, and handle all ledger entries.
            const newLoan = await handleSmeLoan(loanData);
            
            await createAuditLog({
                actorId: session.userId,
                action: 'LOAN_APPLICATION_APPROVED',
                entity: 'LOAN_APPLICATION',
                entityId: applicationId,
                details: { borrowerId: application.borrowerId, loanId: newLoan.id }
            });
            
            return NextResponse.json(newLoan);

        } else if (status === 'REJECTED') {
            if (!rejectionReason) {
                return NextResponse.json({ error: 'Rejection reason is required.' }, { status: 400 });
            }
            const updatedApplication = await prisma.loanApplication.update({
                where: { id: applicationId },
                data: { 
                    status: 'REJECTED',
                    rejectionReason: rejectionReason,
                }
            });

            await createAuditLog({
                actorId: session.userId,
                action: 'LOAN_APPLICATION_REJECTED',
                entity: 'LOAN_APPLICATION',
                entityId: applicationId,
                details: { borrowerId: updatedApplication.borrowerId, reason: rejectionReason }
            });

            return NextResponse.json(updatedApplication);
        }

        return NextResponse.json({ error: 'Invalid status provided.' }, { status: 400 });

    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.errors }, { status: 400 });
        }
        console.error('Error updating application status:', error);
        const errorMessage = (error as Error).message || 'Internal Server Error';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
