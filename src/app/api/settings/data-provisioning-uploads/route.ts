
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { getUserFromSession } from '@/lib/user';
import * as XLSX from 'xlsx';

// This is a simplified version and does not handle file storage.
// It parses the file in memory, validates it, and stores the data.
// For large files, a streaming approach and storing the file in a bucket would be better.

export async function POST(req: NextRequest) {
    const session = await getSession();
    const user = await getUserFromSession();
    if (!session?.userId || !user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    try {
        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        const configId = formData.get('configId') as string | null;

        if (!file || !configId) {
            return NextResponse.json({ error: 'File and configId are required' }, { status: 400 });
        }

        const config = await prisma.dataProvisioningConfig.findUnique({
            where: { id: configId }
        });

        if (!config) {
            return NextResponse.json({ error: 'Data Provisioning Config not found' }, { status: 404 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        const headers = jsonData[0];
        const rows = jsonData.slice(1);
        const configColumns = JSON.parse(config.columns as string);
        const idColumnName = configColumns.find((c: any) => c.isIdentifier)?.name;

        if (!idColumnName) {
            return NextResponse.json({ error: 'No identifier column found in config' }, { status: 400 });
        }
        
        // Use transaction to perform all upserts
        await prisma.$transaction(async (tx) => {
            for (const row of rows) {
                const rowData: { [key: string]: any } = {};
                headers.forEach((header, index) => {
                    rowData[String(header)] = row[index];
                });
                
                const customerId = String(rowData[idColumnName]);
                if (!customerId) continue;

                // 1. Upsert the customer record first to ensure it exists
                await tx.customer.upsert({
                    where: { id: customerId },
                    update: {
                        // Map columns from file to customer fields
                        age: rowData['age'] ? Number(rowData['age']) : undefined,
                        gender: rowData['gender'] ? String(rowData['gender']) : undefined,
                        monthlyIncome: rowData['monthlyIncome'] ? Number(rowData['monthlyIncome']) : undefined,
                        educationLevel: rowData['educationLevel'] ? String(rowData['educationLevel']) : undefined,
                        loanHistory: (rowData['totalLoans'] || rowData['onTimeRepayments'])
                            ? JSON.stringify({ 
                                totalLoans: Number(rowData['totalLoans'] || 0), 
                                onTimeRepayments: Number(rowData['onTimeRepayments'] || 0) 
                              })
                            : undefined,
                    },
                    create: {
                        id: customerId,
                        age: Number(rowData['age'] || 0),
                        gender: String(rowData['gender'] || 'Not Specified'),
                        monthlyIncome: Number(rowData['monthlyIncome'] || 0),
                        educationLevel: String(rowData['educationLevel'] || 'Not Specified'),
                        loanHistory: JSON.stringify({ 
                            totalLoans: Number(rowData['totalLoans'] || 0), 
                            onTimeRepayments: Number(rowData['onTimeRepayments'] || 0) 
                        }),
                    }
                });

                // 2. Now upsert the provisioned data which has a relation to Customer
                await tx.provisionedData.upsert({
                    where: {
                        customerId_configId: {
                            customerId: customerId,
                            configId: configId
                        }
                    },
                    update: {
                        data: JSON.stringify(rowData),
                    },
                    create: {
                        customerId: customerId,
                        configId: configId,
                        data: JSON.stringify(rowData)
                    }
                });
            }
        });


        const newUpload = await prisma.dataProvisioningUpload.create({
            data: {
                configId: configId,
                fileName: file.name,
                rowCount: rows.length,
                uploadedBy: user.fullName || user.email,
            }
        });

        return NextResponse.json(newUpload, { status: 201 });

    } catch (error: any) {
        console.error('Error uploading provisioning data:', error);
        if (error.code === 'P2002') { // Handle unique constraint violation if any
             return NextResponse.json({ error: 'Duplicate data entry found in file. Please ensure identifiers are unique within the file.' }, { status: 400 });
        }
        if (error.code === 'P2003') { // Foreign key constraint
            return NextResponse.json({ error: `Foreign key constraint failed. This may be because a customer ID in your file does not exist. The system tried to create it but failed. Please check your data.` }, { status: 400 });
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
