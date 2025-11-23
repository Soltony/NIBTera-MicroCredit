

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { createAuditLog } from '@/lib/audit-log';

// GET all tax configurations
export async function GET(req: NextRequest) {
    try {
        const configs = await prisma.tax.findMany({
            orderBy: {
                name: 'asc'
            }
        });
        
        return NextResponse.json(configs);

    } catch (error) {
        console.error('Error fetching tax configs:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// POST, PUT, and DELETE are now handled via the approvals workflow
// and are no longer needed here for direct database modification.
// Keeping the file for the GET endpoint.
