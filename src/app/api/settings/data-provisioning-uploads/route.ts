
import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getConnectedDataSource } from '@/data-source';
import { DataProvisioningUpload } from '@/entities/DataProvisioningUpload';
import { DataProvisioningConfig } from '@/entities/DataProvisioningConfig';
import { ProvisionedData } from '@/entities/ProvisionedData';
import { Customer } from '@/entities/Customer';
import { getUserFromSession } from '@/lib/user';
import type { NextRequest } from 'next/server';
import { In } from 'typeorm';

export async function POST(req: NextRequest) {
    const currentUser = await getUserFromSession();
    if (!currentUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dataSource = await getConnectedDataSource();
    const manager = dataSource.manager;

    try {
        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        const configId = formData.get('configId') as string;

        if (!file || !configId) {
            return NextResponse.json({ error: 'Missing file or configId.' }, { status: 400 });
        }
        
        const config = await manager.findOneBy(DataProvisioningConfig, { id: Number(configId) });
        if (!config) {
            return NextResponse.json({ error: 'Data Provisioning Config not found.' }, { status: 404 });
        }
        const configColumns = JSON.parse(config.columns);
        const customerIdentifierColumn = configColumns.find((c: any) => c.isIdentifier);
        if (!customerIdentifierColumn) {
             return NextResponse.json({ error: 'The selected data type does not have a customer identifier column defined.' }, { status: 400 });
        }

        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

        if (jsonData.length === 0) {
            return NextResponse.json({ error: 'Uploaded file is empty.' }, { status: 400 });
        }
        
        const headers = Object.keys(jsonData[0]);
        const expectedHeaders = configColumns.map((c: any) => c.name);
        const hasAllHeaders = expectedHeaders.every((h: string) => headers.includes(h));
        if (!hasAllHeaders) {
            return NextResponse.json({ error: `Header mismatch. Expected headers: ${expectedHeaders.join(', ')}` }, { status: 400 });
        }


        const savedUpload = await manager.transaction(async (transactionalEntityManager) => {
            const uploadRepo = transactionalEntityManager.getRepository(DataProvisioningUpload);
            const dataRepo = transactionalEntityManager.getRepository(ProvisionedData);
            const customerRepo = transactionalEntityManager.getRepository(Customer);

            const newUpload = uploadRepo.create({
                configId: Number(configId),
                fileName: file.name,
                rowCount: jsonData.length,
                uploadedByUserId: Number(currentUser.id),
            });
            await uploadRepo.save(newUpload);

            // Fetch existing customers to avoid N+1 queries
            const identifiers = jsonData.map(row => String(row[customerIdentifierColumn.name])).filter(Boolean);
            
            const dbFieldName = customerIdentifierColumn.dbField;
            const whereClause = { [dbFieldName]: In(identifiers) };
            
            const customers = await customerRepo.find({ where: whereClause });
            
            const customerMap = new Map(customers.map(c => [c[dbFieldName as keyof Customer], c]));

            const dataToInsert: ProvisionedData[] = [];
            for (const row of jsonData) {
                const identifierValue = row[customerIdentifierColumn.name];
                if (!identifierValue) continue;

                const customer = customerMap.get(String(identifierValue) as any);
                if (customer) {
                    const data = dataRepo.create({
                        uploadId: newUpload.id,
                        customerId: customer.ID,
                        data: JSON.stringify(row),
                    });
                    dataToInsert.push(data);
                }
            }

            // Batch insert for performance
            await dataRepo.save(dataToInsert, { chunk: 100 });
            
            return newUpload;
        });

        // Fetch the user to include their name in the response
        const user = await manager.getRepository('User').findOneBy({ id: Number(currentUser.id) });

        return NextResponse.json({
            ...savedUpload,
            id: String(savedUpload.id),
            configId: String(savedUpload.configId),
            uploadedAt: savedUpload.uploadedAt.toISOString(),
            uploadedBy: user?.fullName || 'Unknown User',
        }, { status: 201 });

    } catch (error: any) {
        console.error('Error uploading file record:', error);
        return NextResponse.json({ error: error.message || 'Failed to record file upload' }, { status: 500 });
    }
}
