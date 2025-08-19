
import { NextResponse } from 'next/server';
import { getConnectedDataSource } from '@/data-source';
import { DataProvisioningUpload } from '@/entities/DataProvisioningUpload';
import { getUserFromSession } from '@/lib/user';
import type { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const currentUser = await getUserFromSession();
        if (!currentUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        const configId = formData.get('configId') as string;
        const rowCount = formData.get('rowCount') as string;

        if (!file || !configId || !rowCount) {
            return NextResponse.json({ error: 'Missing file, configId, or rowCount.' }, { status: 400 });
        }

        const dataSource = await getConnectedDataSource();
        const uploadRepo = dataSource.getRepository(DataProvisioningUpload);

        // Here you would typically save the file to a storage service like S3/GCS.
        // For this app, we will just record the upload event in the database.

        const newUpload = uploadRepo.create({
            configId: Number(configId),
            fileName: file.name,
            rowCount: Number(rowCount),
            uploadedByUserId: Number(currentUser.id),
        });

        const savedUpload = await uploadRepo.save(newUpload);

        // Fetch the user to include their name in the response
        const userRepo = dataSource.getRepository('User');
        const user = await userRepo.findOneBy({ id: Number(currentUser.id) });

        return NextResponse.json({
            ...savedUpload,
            id: String(savedUpload.id),
            configId: String(savedUpload.configId),
            uploadedAt: savedUpload.uploadedAt.toISOString(),
            uploadedBy: user?.fullName || 'Unknown User',
        }, { status: 201 });

    } catch (error) {
        console.error('Error uploading file record:', error);
        return NextResponse.json({ error: 'Failed to record file upload' }, { status: 500 });
    }
}
