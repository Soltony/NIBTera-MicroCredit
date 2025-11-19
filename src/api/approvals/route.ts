

'use server';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { z } from 'zod';
import { createAuditLog } from '@/lib/audit-log';

const approvalSchema = z.object({
  changeId: z.string(),
  approved: z.boolean(),
  rejectionReason: z.string().optional(),
});

const defaultLedgerAccounts = [
    // Assets (Receivables)
    { name: 'Principal Receivable', type: 'Receivable', category: 'Principal' },
    { name: 'Interest Receivable', type: 'Receivable', category: 'Interest' },
    { name: 'Service Fee Receivable', type: 'Receivable', category: 'ServiceFee' },
    { name: 'Penalty Receivable', type: 'Receivable', category: 'Penalty' },
    { name: 'Tax Receivable', type: 'Receivable', category: 'Tax' },
    // Cash / Received
    { name: 'Principal Received', type: 'Received', category: 'Principal' },
    { name: 'Interest Received', type: 'Received', category: 'Interest' },
    { name: 'Service Fee Received', type: 'Received', category: 'ServiceFee' },
    { name: 'Penalty Received', type: 'Received', category: 'Penalty' },
    { name: 'Tax Received', type: 'Received', category: 'Tax' },
    // Income
    { name: 'Interest Income', type: 'Income', category: 'Interest' },
    { name: 'Service Fee Income', type: 'Income', category: 'ServiceFee' },
    { name: 'Penalty Income', type: 'Income', category: 'Penalty' },
];

// Main function to apply an approved change
async function applyChange(change: any) {
  console.log('[applyChange] Applying change:', JSON.stringify(change, null, 2));
  const { entityType, entityId, changeType, payload } = change;
  const data = JSON.parse(payload);

  switch (entityType) {
    case 'LoanProvider':
        console.log(`[applyChange] Handling LoanProvider change of type: ${changeType}`);
        if (changeType === 'UPDATE') {
            const { id, products, dataProvisioningConfigs, ...providerData } = data.updated;
            console.log(`[applyChange] Updating LoanProvider ${entityId} with data:`, JSON.stringify(providerData, null, 2));
            await prisma.loanProvider.update({
                where: { id: entityId },
                data: { ...providerData, status: 'ACTIVE' }
            });
            console.log(`[applyChange] Successfully updated LoanProvider ${entityId}`);
        } else if (changeType === 'CREATE') {
            console.log('[applyChange] Starting CREATE LoanProvider transaction...');
             await prisma.$transaction(async (tx) => {
                const { startingCapital, ...restOfBody } = data.created;
                const providerCreationData = {
                    ...restOfBody,
                    startingCapital: startingCapital,
                    initialBalance: startingCapital,
                    status: 'ACTIVE',
                };
                console.log('[applyChange] Provider data for creation:', JSON.stringify(providerCreationData, null, 2));
                
                const newProvider = await tx.loanProvider.create({
                    data: providerCreationData,
                });
                console.log(`[applyChange] Created new provider with ID: ${newProvider.id}`);

                const accountsToCreate = defaultLedgerAccounts.map(acc => ({
                    ...acc,
                    providerId: newProvider.id,
                }));

                console.log(`[applyChange] Creating ${accountsToCreate.length} ledger accounts for provider ${newProvider.id}...`);
                await tx.ledgerAccount.createMany({
                    data: accountsToCreate,
                });
                console.log(`[applyChange] Successfully created ledger accounts for provider ${newProvider.id}`);
            });
            console.log('[applyChange] CREATE LoanProvider transaction completed successfully.');
        } else if (changeType === 'DELETE') {
            console.log(`[applyChange] Deleting LoanProvider ${entityId}`);
            await prisma.loanProvider.delete({
                where: { id: entityId }
            });
            console.log(`[applyChange] Successfully deleted LoanProvider ${entityId}`);
        }
      break;
    case 'LoanProduct':
        console.log(`[applyChange] Handling LoanProduct change of type: ${changeType}`);
        if (changeType === 'UPDATE') {
             console.log(`[applyChange] Updating LoanProduct ${entityId}`);
             await prisma.loanProduct.update({
                where: { id: entityId },
                data: { ...data.updated, status: 'ACTIVE' }
            });
        } else if (changeType === 'CREATE') {
            const productToCreate = {
                ...data.created,
                status: 'ACTIVE',
                serviceFee: JSON.stringify(data.created.serviceFee || { type: 'percentage', value: 0 }),
                dailyFee: JSON.stringify(data.created.dailyFee || { type: 'percentage', value: 0, calculationBase: 'principal' }),
                penaltyRules: JSON.stringify(data.created.penaltyRules || []),
            };
            console.log('[applyChange] Creating new LoanProduct with data:', JSON.stringify(productToCreate, null, 2));
            await prisma.loanProduct.create({
                data: productToCreate
            });
        } else if (changeType === 'DELETE') {
            console.log(`[applyChange] Deleting LoanProduct ${entityId}`);
            await prisma.loanProduct.delete({ where: { id: entityId } });
        }
      break;
    case 'ScoringRules':
      await prisma.$transaction(async (tx) => {
        await tx.scoringParameter.deleteMany({ where: { providerId: entityId } });
        for (const param of data.updated) {
            await tx.scoringParameter.create({
                data: {
                    providerId: entityId,
                    name: param.name,
                    weight: param.weight,
                    rules: {
                        create: param.rules.map((rule: any) => ({
                            field: rule.field,
                            condition: rule.condition,
                            value: String(rule.value),
                            score: rule.score,
                        })),
                    },
                },
            });
        }
      });
      break;
    case 'Tax':
        if (changeType === 'UPDATE') {
             await prisma.tax.update({
                where: { id: entityId },
                data: { ...data.updated, status: 'ACTIVE' }
            });
        } else if (changeType === 'CREATE') {
            await prisma.tax.create({
                data: { ...data.created, status: 'ACTIVE' }
            });
        } else if (changeType === 'DELETE') {
            await prisma.tax.delete({ where: { id: entityId } });
        }
      break;
    default:
      console.error(`[applyChange] Unknown entity type for approval: ${entityType}`);
      throw new Error(`Unknown entity type for approval: ${entityType}`);
  }
}


export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = await req.json();
    console.log('[API][approvals] Received approval request:', JSON.stringify({ body: body, timestamp: new Date().toISOString() }));

    const { changeId, approved, rejectionReason } = approvalSchema.parse(body);

    const change = await prisma.pendingChange.findUnique({
      where: { id: changeId },
    });

    if (!change) {
      console.error(`[API][approvals] Change request with ID ${changeId} not found.`);
      return NextResponse.json({ error: 'Change request not found.' }, { status: 404 });
    }

    console.log('[API][approvals] Found PendingChange record:', JSON.stringify(change, null, 2));


    if (change.createdById === session.userId) {
      console.warn(`[API][approvals] User ${session.userId} attempted to approve their own change.`);
      return NextResponse.json({ error: 'You cannot approve or reject your own changes.' }, { status: 403 });
    }
    
    if (change.status !== 'PENDING') {
      console.warn(`[API][approvals] Change ${changeId} has already been processed. Status: ${change.status}`);
      return NextResponse.json({ error: 'This change has already been processed.' }, { status: 409 });
    }

    if (approved) {
      console.log(`[API][approvals] Change ${changeId} is being APPROVED. Applying changes...`);
      await applyChange(change);
      console.log(`[API][approvals] Changes applied successfully for ${changeId}.`);

      await prisma.pendingChange.update({
        where: { id: changeId },
        data: {
          status: 'APPROVED',
          approvedById: session.userId,
          approvedAt: new Date(),
        },
      });
      console.log(`[API][approvals] Updated PendingChange ${changeId} status to APPROVED.`);

      await createAuditLog({
        actorId: session.userId,
        action: 'CHANGE_APPROVED',
        entity: change.entityType,
        entityId: change.entityId,
        details: { changeId },
      });

    } else { // Rejected
      console.log(`[API][approvals] Change ${changeId} is being REJECTED.`);
      if (!rejectionReason) {
        return NextResponse.json({ error: 'A reason is required for rejection.' }, { status: 400 });
      }

      await prisma.pendingChange.update({
        where: { id: changeId },
        data: {
          status: 'REJECTED',
          approvedById: session.userId,
          approvedAt: new Date(),
          rejectionReason,
        },
      });
       console.log(`[API][approvals] Updated PendingChange ${changeId} status to REJECTED.`);

      // Also revert the status of the underlying entity if it was pending
       if (change.entityId) {
            console.log(`[API][approvals] Reverting status for entity ${change.entityType}:${change.entityId} to ACTIVE.`);
            if (change.entityType === 'LoanProvider') {
                await prisma.loanProvider.update({ where: { id: change.entityId }, data: { status: 'ACTIVE' } });
            } else if (change.entityType === 'LoanProduct') {
                await prisma.loanProduct.update({ where: { id: change.entityId }, data: { status: 'ACTIVE' } });
            } else if (change.entityType === 'Tax' && change.changeType !== 'CREATE') {
                 await prisma.tax.update({ where: { id: change.entityId }, data: { status: 'ACTIVE' } });
            }
        }
      
      await createAuditLog({
        actorId: session.userId,
        action: 'CHANGE_REJECTED',
        entity: change.entityType,
        entityId: change.entityId,
        details: { changeId, reason: rejectionReason },
      });
    }

    console.log(`[API][approvals] Successfully processed request for change ${changeId}.`);
    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("[API][approvals] Critical error processing change request:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
