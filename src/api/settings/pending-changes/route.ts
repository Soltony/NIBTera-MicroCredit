

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { z } from 'zod';
import { createAuditLog } from '@/lib/audit-log';

const changeSchema = z.object({
  entityType: z.string(),
  entityId: z.string().optional(),
  changeType: z.enum(['CREATE', 'UPDATE', 'DELETE']),
  payload: z.string(), // JSON string
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = await req.json();
    console.log('[API][pending-changes] Received request to create pending change:', JSON.stringify({ body: body, timestamp: new Date().toISOString() }));

    const { entityType, entityId, changeType, payload } = changeSchema.parse(body);

    // Set the original entity to PENDING_APPROVAL status
    if (entityId && (changeType === 'UPDATE' || changeType === 'DELETE')) {
        console.log(`[API][pending-changes] Setting entity ${entityType}:${entityId} to PENDING_APPROVAL`);
        if (entityType === 'LoanProvider') {
            await prisma.loanProvider.update({ where: { id: entityId }, data: { status: 'PENDING_APPROVAL' }});
        } else if (entityType === 'LoanProduct') {
            await prisma.loanProduct.update({ where: { id: entityId }, data: { status: 'PENDING_APPROVAL' }});
        } else if (entityType === 'Tax') {
            await prisma.tax.update({ where: { id: entityId }, data: { status: 'PENDING_APPROVAL' }});
        }
        // Scoring rules don't have a status on a single entity, it's a collection.
    }

    const newChange = await prisma.pendingChange.create({
      data: {
        entityType,
        entityId,
        changeType,
        payload,
        status: 'PENDING', // Explicitly set the status
        createdById: session.userId,
      },
    });
    
    console.log(`[API][pending-changes] Successfully created PendingChange record with ID: ${newChange.id}`);

    await createAuditLog({
        actorId: session.userId,
        action: 'CHANGE_REQUEST_CREATED',
        entity: entityType,
        entityId: entityId,
        details: { changeRequestId: newChange.id, changeType }
    });

    return NextResponse.json(newChange, { status: 201 });

  } catch (error: any) {
    console.error('[API][pending-changes] Failed to create pending change:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
