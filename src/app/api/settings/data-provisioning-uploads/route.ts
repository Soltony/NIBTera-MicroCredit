
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

        const dataToInsert = rows.map(row => {
            const rowData: { [key: string]: any } = {};
            headers.forEach((header, index) => {
                rowData[String(header)] = row[index];
            });

            return {
                customerId: String(rowData[idColumnName]),
                configId: configId,
                data: JSON.stringify(rowData)
            };
        });
        
        // Batch create provisioned data
        await prisma.provisionedData.createMany({
            data: dataToInsert,
            skipDuplicates: true // This assumes customerId + configId is a unique pair
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

    } catch (error) {
        console.error('Error uploading provisioning data:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
