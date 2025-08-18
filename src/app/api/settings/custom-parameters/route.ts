
import { NextResponse } from 'next/server';
import { getConnectedDataSource } from '@/data-source';
import { CustomParameter } from '@/entities/CustomParameter';
import { getUserFromSession } from '@/lib/user';
import { z } from 'zod';
import type { DataSource } from 'typeorm';

const paramSchema = z.object({
  name: z.string().min(2, 'Parameter name must be at least 2 characters long.'),
  providerId: z.string(),
});

// GET all custom parameters for a provider
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const providerId = searchParams.get('providerId');

        if (!providerId) {
            return NextResponse.json({ error: 'Provider ID is required' }, { status: 400 });
        }

        const dataSource = await getConnectedDataSource();
        const paramRepo = dataSource.getRepository(CustomParameter);
        const parameters = await paramRepo.find({ where: { providerId: Number(providerId) }, order: { name: 'ASC' } });
        
        return NextResponse.json(parameters.map(p => ({...p, id: String(p.id)})));
    } catch (error) {
        console.error('Error fetching custom parameters:', error);
        return NextResponse.json({ error: 'Failed to fetch custom parameters' }, { status: 500 });
    }
}

// POST a new custom parameter
export async function POST(req: Request) {
    try {
        const currentUser = await getUserFromSession();
        if (!currentUser || (currentUser.role !== 'Super Admin' && currentUser.role !== 'Admin')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const validation = paramSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ error: validation.error.format() }, { status: 400 });
        }

        const dataSource = await getConnectedDataSource();
        const paramRepo = dataSource.getRepository(CustomParameter);
        
        const { name, providerId } = validation.data;
        
        const newParam = paramRepo.create({
            name,
            providerId: Number(providerId),
        });

        await paramRepo.save(newParam);
        
        return NextResponse.json(newParam, { status: 201 });
    } catch (error: any) {
        if (error.code === 'ORA-00001') { // Unique constraint violation
             return NextResponse.json({ error: `A parameter named "${error.detail}" already exists for this provider.` }, { status: 409 });
        }
        console.error('Error creating custom parameter:', error);
        return NextResponse.json({ error: 'Failed to create custom parameter' }, { status: 500 });
    }
}

// DELETE a custom parameter
export async function DELETE(req: Request) {
    try {
        const currentUser = await getUserFromSession();
        if (!currentUser || (currentUser.role !== 'Super Admin' && currentUser.role !== 'Admin')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Parameter ID is required' }, { status: 400 });
        }
        
        const dataSource = await getConnectedDataSource();
        const paramRepo = dataSource.getRepository(CustomParameter);
        
        // TODO: Add a check to prevent deletion if the parameter is in use by a scoring rule.
        
        await paramRepo.delete(id);

        return NextResponse.json({ message: 'Parameter deleted successfully' }, { status: 200 });

    } catch (error) {
        console.error('Error deleting custom parameter:', error);
        return NextResponse.json({ error: 'Failed to delete custom parameter' }, { status: 500 });
    }
}
