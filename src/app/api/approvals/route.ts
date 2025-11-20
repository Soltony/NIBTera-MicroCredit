
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
            const providerToCreate = {
                ...data.created,
                initialBalance: data.created.startingCapital, // Set initialBalance from startingCapital
                status: 'ACTIVE',
            };
            await prisma.loanProvider.create({
                data: providerToCreate,
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
             const updateData = { ...data.updated, status: 'ACTIVE' };

            // Ensure JSON fields are stringified before saving
            if (updateData.serviceFee && typeof updateData.serviceFee === 'object') {
                updateData.serviceFee = JSON.stringify(updateData.serviceFee);
            }
            if (updateData.dailyFee && typeof updateData.dailyFee === 'object') {
                updateData.dailyFee = JSON.stringify(updateData.dailyFee);
            }
            if (updateData.penaltyRules && Array.isArray(updateData.penaltyRules)) {
                updateData.penaltyRules = JSON.stringify(updateData.penaltyRules);
            }

            // Prisma's update method doesn't accept nested relations directly.
            // We need to remove them before updating.
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
                // Ensure fee/penalty fields have default JSON values if they don't exist
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
      // This is a more complex one as it involves deleting and creating
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
       if (change.entityId && change.changeType !== 'CREATE') {
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

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Error processing change request:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
