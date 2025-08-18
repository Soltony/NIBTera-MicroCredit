
import { NextResponse } from 'next/server';
import { getConnectedDataSource } from '@/data-source';
import { DataProvisioningConfig } from '@/entities/DataProvisioningConfig';
import { getUserFromSession } from '@/lib/user';
import { z } from 'zod';
import type { DataSource } from 'typeorm';


const columnSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Column name cannot be empty.'),
  type: z.enum(['string', 'number', 'date']),
});

const configSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  providerId: z.string(),
  columns: z.array(columnSchema),
});

const updateConfigSchema = configSchema.extend({
  id: z.string(),
});

// GET all configs for a provider
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const providerId = searchParams.get('providerId');

        if (!providerId) {
            return NextResponse.json({ error: 'Provider ID is required' }, { status: 400 });
        }

        const dataSource = await getConnectedDataSource();
        const configRepo = dataSource.getRepository(DataProvisioningConfig);
        const configs = await configRepo.find({ where: { providerId: Number(providerId) }, order: { name: 'ASC' } });
        
        return NextResponse.json(configs.map(c => ({...c, id: String(c.id), columns: JSON.parse(c.columns) })));
    } catch (error) {
        console.error('Error fetching data provisioning configs:', error);
        return NextResponse.json({ error: 'Failed to fetch configs' }, { status: 500 });
    }
}


// POST a new config
export async function POST(req: Request) {
    try {
        const currentUser = await getUserFromSession();
        if (!currentUser || (currentUser.role !== 'Super Admin' && currentUser.role !== 'Admin')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const validation = configSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ error: validation.error.format() }, { status: 400 });
        }

        const dataSource = await getConnectedDataSource();
        const configRepo = dataSource.getRepository(DataProvisioningConfig);
        
        const { name, providerId, columns } = validation.data;
        
        const newConfig = configRepo.create({
            name,
            providerId: Number(providerId),
            columns: JSON.stringify(columns)
        });

        await configRepo.save(newConfig);
        
        return NextResponse.json({
            ...newConfig,
            id: String(newConfig.id),
            columns: JSON.parse(newConfig.columns),
        }, { status: 201 });

    } catch (error: any) {
        if (error.code === 'ORA-00001') { // Unique constraint violation
             return NextResponse.json({ error: `A data type named "${error.detail}" already exists for this provider.` }, { status: 409 });
        }
        console.error('Error creating data provisioning config:', error);
        return NextResponse.json({ error: 'Failed to create config' }, { status: 500 });
    }
}

// PUT (update) a config
export async function PUT(req: Request) {
    try {
        const currentUser = await getUserFromSession();
        if (!currentUser || (currentUser.role !== 'Super Admin' && currentUser.role !== 'Admin')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const validation = updateConfigSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ error: validation.error.format() }, { status: 400 });
        }

        const dataSource = await getConnectedDataSource();
        const configRepo = dataSource.getRepository(DataProvisioningConfig);
        
        const { id, name, columns } = validation.data;
        
        const updatedConfig = await configRepo.save({
            id: Number(id),
            name,
            columns: JSON.stringify(columns)
        });
        
        return NextResponse.json({
            ...updatedConfig,
            id: String(updatedConfig.id),
            columns: JSON.parse(updatedConfig.columns),
        });

    } catch (error: any) {
        if (error.code === 'ORA-00001') { // Unique constraint violation
             return NextResponse.json({ error: `A data type named "${error.detail}" already exists for this provider.` }, { status: 409 });
        }
        console.error('Error updating data provisioning config:', error);
        return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
    }
}


// DELETE a config
export async function DELETE(req: Request) {
    try {
        const currentUser = await getUserFromSession();
        if (!currentUser || (currentUser.role !== 'Super Admin' && currentUser.role !== 'Admin')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Config ID is required' }, { status: 400 });
        }
        
        const dataSource = await getConnectedDataSource();
        const configRepo = dataSource.getRepository(DataProvisioningConfig);
        
        await configRepo.delete(id);

        return NextResponse.json({ message: 'Data type deleted successfully' }, { status: 200 });

    } catch (error: any) {
         if (error.code === 'ORA-02292' || (error.message && error.message.includes('ORA-02292'))) {
             return NextResponse.json({ error: 'Cannot delete this data type. It is currently in use by one or more loan products.' }, { status: 400 });
        }
        console.error('Error deleting data provisioning config:', error);
        return NextResponse.json({ error: 'Failed to delete config' }, { status: 500 });
    }
}
