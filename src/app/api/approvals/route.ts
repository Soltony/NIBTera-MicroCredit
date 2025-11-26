
'use server';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { z } from 'zod';
import { createAuditLog } from '@/lib/audit-log';
import * as XLSX from 'xlsx';
import { toCamelCase } from '@/lib/utils';

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


async function applyDataProvisioningUpload(change: any, data: any) {
    const { fileContent, fileName, configId } = data.created;
    const user = await getSession();

    const config = await prisma.dataProvisioningConfig.findUnique({
        where: { id: configId }
    });
    if (!config) throw new Error('Data Provisioning Config not found.');

    const buffer = Buffer.from(fileContent, 'base64');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    
    const originalHeaders = jsonData.length > 0 ? jsonData[0].map(h => String(h)) : [];
    const camelCaseHeaders = originalHeaders.map(toCamelCase);
    const rows = jsonData.length > 1 ? jsonData.slice(1) : [];

    await prisma.$transaction(async (tx) => {
        const newUpload = await tx.dataProvisioningUpload.create({
            data: {
                configId: configId,
                fileName: fileName,
                rowCount: rows.length,
                uploadedBy: change.createdById, // User who requested the change
            }
        });

        const idColumnConfig = JSON.parse(config.columns as string).find((c: any) => c.isIdentifier);
        if (!idColumnConfig) throw new Error('No identifier column found in config');
        const idColumnCamelCase = toCamelCase(idColumnConfig.name);

        for (const row of rows) {
            const newRowData: { [key: string]: any } = {};
            camelCaseHeaders.forEach((header, index) => { newRowData[header] = row[index]; });
            
            const borrowerId = String(newRowData[idColumnCamelCase]);
            if (!borrowerId) continue;

            await tx.borrower.upsert({ where: { id: borrowerId }, update: {}, create: { id: borrowerId } });

            const existingData = await tx.provisionedData.findUnique({
                // find within the same upload so we preserve older uploads
                where: { borrowerId_configId_uploadId: { borrowerId: borrowerId, configId: configId, uploadId: newUpload.id } },
            });
            
            let mergedData = newRowData;
            if (existingData?.data) {
                mergedData = { ...JSON.parse(existingData.data as string), ...newRowData };
            }

            await tx.provisionedData.upsert({
                where: { borrowerId_configId_uploadId: { borrowerId: borrowerId, configId: configId, uploadId: newUpload.id } },
                update: { data: JSON.stringify(mergedData), uploadId: newUpload.id },
                create: { borrowerId: borrowerId, configId: configId, data: JSON.stringify(mergedData), uploadId: newUpload.id }
            });
        }
    });
}


async function applyEligibilityList(change: any, data: any) {
    const { productId, fileContent, configId, fileName } = data.created;
    
    const config = await prisma.dataProvisioningConfig.findUnique({ where: { id: configId } });
    if (!config) throw new Error('Data Provisioning Config not found.');

    const buffer = Buffer.from(fileContent, 'base64');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

    const originalHeaders = jsonData.length > 0 ? jsonData[0].map(h => String(h)) : [];
    const rows = jsonData.length > 1 ? jsonData.slice(1) : [];
    
    const idColumnConfig = JSON.parse(config.columns as string).find((c: any) => c.isIdentifier);
    if (!idColumnConfig) throw new Error('No identifier column found in config');
    
    const idColumnName = idColumnConfig.name;
    const idColumnIndex = originalHeaders.findIndex(h => h === idColumnName);
    if (idColumnIndex === -1) throw new Error(`Identifier column "${idColumnName}" not found in uploaded file.`);
    
    const borrowerIds = rows.map(row => String(row[idColumnIndex]).trim()).filter(Boolean);

    if (borrowerIds.length === 0) {
        throw new Error("No identifiers found in the uploaded file.");
    }
    
    const filterString = idList.join(',');
    // Store the filter as JSON mapping of identifier column -> CSV string
    // so the eligibility check can parse and apply filters consistently.
    const filterObject = JSON.stringify({ [idColumnName]: filterString });

    await prisma.$transaction(async (tx) => {
        // Create the upload record for history, and now include file content
        const newUpload = await tx.dataProvisioningUpload.create({
            data: {
                configId: configId,
                fileName: fileName,
                fileContent: fileContent, // Save the file content
                rowCount: rows.length,
                uploadedBy: change.createdById,
            }
        });

        // Now, iterate through the file and save the data for viewing later.
        for (const row of rows) {
             const rowData: { [key: string]: any } = {};
             originalHeaders.forEach((header, index) => {
                 rowData[header] = row[index];
             });

            const borrowerId = String(rowData[idColumnName]);
            if (!borrowerId) continue;
            
             // Ensure the borrower exists before linking data
             await tx.borrower.upsert({
                 where: { id: borrowerId },
                 update: {},
                 create: { id: borrowerId }
             });

            // Using upsert to prevent unique constraint errors if the same list is uploaded again
            // NOTE: The `ProvisionedData` model has a compound unique on [borrowerId, configId]
            // so we upsert on that compound key (not including uploadId) and set uploadId in update/create
            await tx.provisionedData.upsert({
                where: { borrowerId_configId_uploadId: { borrowerId, configId, uploadId: newUpload.id } },
                update: { data: JSON.stringify(rowData), uploadId: newUpload.id },
                create: {
                    borrowerId,
                    configId,
                    uploadId: newUpload.id,
                    data: JSON.stringify(rowData)
                }
            });
        }
        
        // Update the product with the link to the historic upload
        await tx.loanProduct.update({
            where: { id: productId },
            data: {
                eligibilityUploadId: newUpload.id,
                eligibilityFilter: filterObject,
            }
        });
    });
}


// Main function to apply an approved change
async function applyChange(change: any) {
  const { entityType, entityId, changeType, payload } = change;
  const data = JSON.parse(payload);

  switch (entityType) {
    case 'EligibilityList':
        if (changeType === 'CREATE') {
            await applyEligibilityList(change, data);
        }
        break;
    case 'DataProvisioningConfig':
        if (changeType === 'UPDATE') {
            await prisma.dataProvisioningConfig.update({
                where: { id: entityId },
                data: {
                    name: data.updated.name,
                    columns: JSON.stringify(data.updated.columns),
                }
            });
        } else if (changeType === 'CREATE') {
            await prisma.dataProvisioningConfig.create({
                data: {
                    ...data.created,
                    providerId: data.created.providerId,
                    columns: JSON.stringify(data.created.columns),
                }
            });
        } else if (changeType === 'DELETE') {
            await prisma.dataProvisioningConfig.delete({ where: { id: entityId } });
        }
      break;
    case 'DataProvisioningUpload':
        if (changeType === 'CREATE') {
            await applyDataProvisioningUpload(change, data);
        }
      break;
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
            const { loanAmountTiers, eligibilityUpload, ...restOfUpdateData } = data.updated;
            const updateData = { ...restOfUpdateData, status: 'ACTIVE' };

            if (updateData.serviceFee && typeof updateData.serviceFee === 'object') {
                updateData.serviceFee = JSON.stringify(updateData.serviceFee);
            }
            if (updateData.dailyFee && typeof updateData.dailyFee === 'object') {
                updateData.dailyFee = JSON.stringify(updateData.dailyFee);
            }
            if (updateData.penaltyRules && Array.isArray(updateData.penaltyRules)) {
                updateData.penaltyRules = JSON.stringify(updateData.penaltyRules);
            }
            
            await prisma.$transaction(async (tx) => {
                await tx.loanProduct.update({
                    where: { id: entityId },
                    data: updateData,
                });

                await tx.loanAmountTier.deleteMany({ where: { productId: entityId } });
                if (loanAmountTiers && Array.isArray(loanAmountTiers) && loanAmountTiers.length > 0) {
                    await tx.loanAmountTier.createMany({
                        data: loanAmountTiers.map((tier: any) => ({
                            productId: entityId,
                            fromScore: parseInt(String(tier.fromScore), 10),
                            toScore: parseInt(String(tier.toScore), 10),
                            loanAmount: parseInt(String(tier.loanAmount), 10),
                        })),
                    });
                }
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
     case 'TermsAndConditions':
        await prisma.$transaction(async (tx) => {
            const { providerId, content } = data.updated;
            // Deactivate previous versions
            await tx.termsAndConditions.updateMany({
                where: { providerId },
                data: { isActive: false },
            });

            // Get the latest version number
            const latestVersion = await tx.termsAndConditions.findFirst({
                where: { providerId },
                orderBy: { version: 'desc' },
            });
            const newVersionNumber = (latestVersion?.version || 0) + 1;

            // Create the new active version
            await tx.termsAndConditions.create({
                data: {
                    providerId,
                    content,
                    version: newVersionNumber,
                    isActive: true,
                    publishedAt: new Date(),
                },
            });
        });
        break;
    case 'Tax':
        if (changeType === 'UPDATE') {
             await prisma.tax.update({
                where: { id: entityId },
                data: { ...data.updated, status: 'ACTIVE' }
            });
        } else if (changeType === 'CREATE') {
            const { id, ...creationData } = data.created;
            await prisma.tax.create({
                data: { ...creationData, status: 'ACTIVE' }
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
            }
             else if (change.entityType === 'Tax' && change.changeType !== 'CREATE') {
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
