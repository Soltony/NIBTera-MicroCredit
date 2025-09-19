
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';

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
