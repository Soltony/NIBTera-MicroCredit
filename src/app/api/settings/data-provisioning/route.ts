
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';

// GET all configs for a provider
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const providerId = searchParams.get('providerId');

    if (!providerId) {
        return NextResponse.json({ error: 'Provider ID is required' }, { status: 400 });
    }
    
    try {
        const configs = await prisma.dataProvisioningConfig.findMany({
            where: { providerId },
             include: {
                uploads: {
                    orderBy: {
                        uploadedAt: 'desc',
                    }
                }
            }
        });
        return NextResponse.json(configs);
    } catch (error) {
        console.error('Error fetching data provisioning configs:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}


// POST a new config
export async function POST(req: NextRequest) {
    const session = await getSession();
    if (!session?.userId) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { providerId, name, columns } = body;
        
        const newConfig = await prisma.dataProvisioningConfig.create({
            data: {
                providerId,
                name,
                columns: JSON.stringify(columns)
            }
        });

        return NextResponse.json({ ...newConfig, columns }, { status: 201 });
    } catch (error) {
        console.error('Error creating data provisioning config:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// PUT to update a config
export async function PUT(req: NextRequest) {
    const session = await getSession();
    if (!session?.userId) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { id, name, columns } = body;

        const updatedConfig = await prisma.dataProvisioningConfig.update({
            where: { id },
            data: {
                name,
                columns: JSON.stringify(columns)
            }
        });
        
        return NextResponse.json({ ...updatedConfig, columns });
    } catch (error) {
        console.error('Error updating data provisioning config:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}


// DELETE a config
export async function DELETE(req: NextRequest) {
    const session = await getSession();
    if (!session?.userId) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'Config ID is required' }, { status: 400 });
    }
    
    try {
        // You might want to add a check here to ensure no products are using this config before deleting
        await prisma.dataProvisioningConfig.delete({
            where: { id },
        });
        return NextResponse.json({ message: 'Config deleted successfully' });
    } catch (error) {
        console.error('Error deleting data provisioning config:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
