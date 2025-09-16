
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';

// Helper to convert ArrayBuffer to Base64
const bufferToBase64 = (buffer: ArrayBuffer) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
};

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        const loanApplicationId = formData.get('loanApplicationId') as string | null;
        const requiredDocumentId = formData.get('requiredDocumentId') as string | null;

        if (!file || !loanApplicationId || !requiredDocumentId) {
            return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const fileContentBase64 = bufferToBase64(bytes);

        const uploadedDocument = await prisma.uploadedDocument.upsert({
            where: {
                loanApplicationId_requiredDocumentId: {
                    loanApplicationId,
                    requiredDocumentId
                }
            },
            update: {
                fileName: file.name,
                fileType: file.type,
                fileContent: fileContentBase64,
                status: 'PENDING',
                reviewComment: null,
            },
            create: {
                loanApplicationId,
                requiredDocumentId,
                fileName: file.name,
                fileType: file.type,
                fileContent: fileContentBase64,
            }
        });
        
        // After successful upload, check if all documents are now uploaded and update status
        const application = await prisma.loanApplication.findUnique({
            where: { id: loanApplicationId },
            include: { 
                product: { include: { requiredDocuments: true } },
                uploadedDocuments: true 
            }
        });

        if (application) {
            const allDocsUploaded = application.product.requiredDocuments.every(
                reqDoc => application.uploadedDocuments.some(upDoc => upDoc.requiredDocumentId === reqDoc.id)
            );
            
            if (allDocsUploaded && application.status === 'PENDING_DOCUMENTS') {
                 await prisma.loanApplication.update({
                    where: { id: loanApplicationId },
                    data: { status: 'PENDING_REVIEW' }
                });
            }
        }
        
        const finalApplicationState = await prisma.loanApplication.findUnique({
            where: { id: loanApplicationId },
            include: {
                 product: { include: { requiredDocuments: true } },
                 uploadedDocuments: true
            }
        });

        return NextResponse.json(finalApplicationState, { status: 200 });

    } catch (error: any) {
        console.error('Document upload error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
