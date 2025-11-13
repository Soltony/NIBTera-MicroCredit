
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { createAuditLog } from '@/lib/audit-log';

// GET all tax configurations
export async function GET(req: NextRequest) {
    try {
        const configs = await prisma.tax.findMany({
            orderBy: {
                name: 'asc'
            }
        });
        
        return NextResponse.json(configs);

    } catch (error) {
        console.error('Error fetching tax configs:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// POST a new tax configuration
export async function POST(req: NextRequest) {
    const session = await getSession();
    if (!session?.userId) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    try {
        const body = await req.json();
        const { name, rate, appliedTo } = body;
        
        const dataToSave = {
            name: name,
            rate: parseFloat(rate),
            appliedTo: appliedTo // expecting JSON string
        };

        const newConfig = await prisma.tax.create({
            data: dataToSave,
        });
        
        await createAuditLog({
            actorId: session.userId,
            action: 'TAX_CONFIG_CREATE',
            entity: 'SYSTEM',
            details: { newConfig: dataToSave, taxId: newConfig.id }
        });

        return NextResponse.json(newConfig, { status: 201 });

    } catch (error) {
        console.error('Error creating tax config:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// PUT to update an existing tax configuration
export async function PUT(req: NextRequest) {
    const session = await getSession();
    if (!session?.userId) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { id, name, rate, appliedTo } = body;

        if (!id) {
            return NextResponse.json({ error: 'Tax ID is required for update.' }, { status: 400 });
        }

        const dataToSave = {
            name: name,
            rate: parseFloat(rate),
            appliedTo: appliedTo,
        };

        const updatedConfig = await prisma.tax.update({
            where: { id },
            data: dataToSave,
        });

        await createAuditLog({
            actorId: session.userId,
            action: 'TAX_CONFIG_UPDATE',
            entity: 'SYSTEM',
            details: { updatedConfig: dataToSave, taxId: updatedConfig.id }
        });

        return NextResponse.json(updatedConfig, { status: 200 });

    } catch (error) {
        console.error('Error updating tax config:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// DELETE a tax configuration
export async function DELETE(req: NextRequest) {
    const session = await getSession();
    if (!session?.userId) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'Tax ID is required.' }, { status: 400 });
    }

    try {
        const taxToDelete = await prisma.tax.findUnique({ where: { id }});
        if (!taxToDelete) {
             return NextResponse.json({ error: 'Tax configuration not found.' }, { status: 404 });
        }

        await prisma.tax.delete({
            where: { id }
        });
        
        await createAuditLog({
            actorId: session.userId,
            action: 'TAX_CONFIG_DELETE',
            entity: 'SYSTEM',
            details: { deletedTax: taxToDelete }
        });

        return NextResponse.json({ message: 'Tax configuration deleted successfully.' }, { status: 200 });

    } catch (error) {
        console.error('Error deleting tax config:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
