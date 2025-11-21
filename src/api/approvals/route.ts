

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
  const { entityType, entityId, changeType, payload } = change;
  const data = JSON.parse(payload);

  switch (entityType) {
    case 'LoanProvider':
        if (changeType === 'UPDATE') {
            const { id, products, dataProvisioningConfigs, ...providerData } = data.updated;
            await prisma.loanProvider.update({
                where: { id: entityId },
                data: { ...providerData, status: 'ACTIVE' }
            });
        } else if (changeType === 'CREATE') {
            await prisma.$transaction(async (tx) => {
                const providerToCreate = {
                    ...data.created,
                    initialBalance: data.created.startingCapital,
                    status: 'ACTIVE',
                };
                const newProvider = await tx.loanProvider.create({
                    data: providerToCreate,
                });
                
                const accountsToCreate = defaultLedgerAccounts.map(acc => ({
                    ...acc,
                    providerId: newProvider.id,
                }));

                await tx.ledgerAccount.createMany({
                    data: accountsToCreate,
                });

                return newProvider;
            });
        }
        else if (changeType === 'DELETE') {
            await prisma.loanProvider.delete({
                where: { id: entityId }
            });
        }
      break;
    case 'LoanProduct':
        if (changeType === 'UPDATE') {
             const updateData = { ...data.updated, status: data.updated.status || 'ACTIVE' };

            if (updateData.serviceFee && typeof updateData.serviceFee === 'object') {
                updateData.serviceFee = JSON.stringify(updateData.serviceFee);
            }
            if (updateData.dailyFee && typeof updateData.dailyFee === 'object') {
                updateData.dailyFee = JSON.stringify(updateData.dailyFee);
            }
            if (updateData.penaltyRules && Array.isArray(updateData.penaltyRules)) {
                updateData.penaltyRules = JSON.stringify(updateData.penaltyRules);
            }

            delete updateData.loanAmountTiers;
            delete updateData.eligibilityUpload;


            await prisma.loanProduct.update({
                where: { id: entityId },
                data: updateData,
            });
        } else if (changeType === 'CREATE') {
            const productToCreate = {
                ...data.created,
                status: 'ACTIVE',
                serviceFee: JSON.stringify(data.created.serviceFee || { type: 'percentage', value: 0 }),
                dailyFee: JSON.stringify(data.created.dailyFee || { type: 'percentage', value: 0, calculationBase: 'principal' }),
                penaltyRules: JSON.stringify(data.created.penaltyRules || []),
            };
            await prisma.loanProduct.create({
                data: productToCreate
            });
        } else if (changeType === 'DELETE') {
            await prisma.loanProduct.delete({ where: { id: entityId } });
        }
      break;
    case 'ScoringRules':
        await prisma.$transaction(async (tx) => {
            const historyRecord = await tx.scoringConfigurationHistory.create({
                data: {
                    providerId: entityId,
                    parameters: JSON.stringify(data.updated),
                },
            });

            if (data.appliedProductIds && data.appliedProductIds.length > 0) {
                await tx.scoringConfigurationProduct.createMany({
                    data: data.appliedProductIds.map((productId: string) => ({
                        configId: historyRecord.id,
                        productId: productId,
                        assignedBy: change.createdById, 
                    })),
                });
            }

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
    const { changeId, approved, rejectionReason } = approvalSchema.parse(body);

    const change = await prisma.pendingChange.findUnique({
      where: { id: changeId },
    });

    if (!change) {
      return NextResponse.json({ error: 'Change request not found.' }, { status: 404 });
    }

    if (change.createdById === session.userId) {
      return NextResponse.json({ error: 'You cannot approve or reject your own changes.' }, { status: 403 });
    }
    
    if (change.status !== 'PENDING') {
      return NextResponse.json({ error: 'This change has already been processed.' }, { status: 409 });
    }

    if (approved) {
      // Apply the change
      await applyChange(change);

      // Update the status of the change request
      await prisma.pendingChange.update({
        where: { id: changeId },
        data: {
          status: 'APPROVED',
          approvedById: session.userId,
          approvedAt: new Date(),
        },
      });

      await createAuditLog({
        actorId: session.userId,
        action: 'CHANGE_APPROVED',
        entity: change.entityType,
        entityId: change.entityId,
        details: { changeId },
      });

    } else { // Rejected
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

      // Also revert the status of the underlying entity if it was pending
      const entityId = change.entityId;
       if (entityId && change.changeType !== 'CREATE') {
            if (change.entityType === 'LoanProvider') {
                await prisma.loanProvider.update({ where: { id: entityId }, data: { status: 'ACTIVE' } });
            } else if (change.entityType === 'LoanProduct') {
                await prisma.loanProduct.update({ where: { id: entityId }, data: { status: 'ACTIVE' } });
            } else if (change.entityType === 'Tax' && change.changeType !== 'CREATE') {
                 await prisma.tax.update({ where: { id: entityId }, data: { status: 'ACTIVE' } });
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

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Error processing change request:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
