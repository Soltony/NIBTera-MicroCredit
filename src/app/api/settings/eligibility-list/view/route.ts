
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import * as XLSX from 'xlsx';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const uploadId = searchParams.get('uploadId');

    if (!uploadId) {
        return NextResponse.json({ error: 'Upload ID is required' }, { status: 400 });
    }

    try {
        const upload = await prisma.dataProvisioningUpload.findUnique({
            where: { id: uploadId },
        });

        if (!upload || !upload.fileContent) {
            return NextResponse.json({ error: 'Upload not found or file content is missing.' }, { status: 404 });
        }

        const buffer = Buffer.from(upload.fileContent, 'base64');
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        return NextResponse.json({
            data: jsonData,
        });
        
    } catch (error) {
        console.error('Failed to fetch and parse eligibility list:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
