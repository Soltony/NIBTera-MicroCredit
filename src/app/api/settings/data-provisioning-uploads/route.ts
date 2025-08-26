
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { getUserFromSession } from '@/lib/user';
import * as XLSX from 'xlsx';

// Helper to convert strings to camelCase
const toCamelCase = (str: string) => {
    return str.replace(/[^a-zA-Z0-9]+(.)?/g, (match, chr) => chr ? chr.toUpperCase() : '').replace(/^./, (match) => match.toLowerCase());
};

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
        
        const originalHeaders = jsonData[0].map(h => String(h));
        const camelCaseHeaders = originalHeaders.map(toCamelCase);
        
        const rows = jsonData.slice(1);
        const configColumns = JSON.parse(config.columns as string);
        const idColumnConfig = configColumns.find((c: any) => c.isIdentifier);

        if (!idColumnConfig) {
            return NextResponse.json({ error: 'No identifier column found in config' }, { status: 400 });
        }
        
        const idColumnCamelCase = toCamelCase(idColumnConfig.name);
        
        // Use transaction to perform all upserts
        await prisma.$transaction(async (tx) => {
            for (const row of rows) {
                const rowData: { [key: string]: any } = {};
                camelCaseHeaders.forEach((header, index) => {
                    rowData[header] = row[index];
                });
                
                const borrowerId = String(rowData[idColumnCamelCase]);
                if (!borrowerId) continue;

                // 1. Upsert the borrower record first to ensure it exists
                await tx.borrower.upsert({
                    where: { id: borrowerId },
                    update: {},
                    create: { id: borrowerId }
                });

                // 2. Now upsert the provisioned data which has a relation to Borrower
                await tx.provisionedData.upsert({
                    where: {
                        borrowerId_configId: {
                            borrowerId: borrowerId,
                            configId: configId
                        }
                    },
                    update: {
                        data: JSON.stringify(rowData),
                    },
                    create: {
                        borrowerId: borrowerId,
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
            return NextResponse.json({ error: `Foreign key constraint failed. This may be because a borrower ID in your file does not exist. The system tried to create it but failed. Please check your data.` }, { status: 400 });
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
