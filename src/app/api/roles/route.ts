
import { NextResponse } from 'next/server';
import { AppDataSource } from '@/data-source';
import { Role } from '@/entities/Role';
import { User } from '@/entities/User';
import { In, DataSource } from 'typeorm';

async function getConnectedDataSource(): Promise<DataSource> {
    if (AppDataSource.isInitialized) {
        return AppDataSource;
    } else {
        return await AppDataSource.initialize();
    }
}

// GET all roles
export async function GET() {
    let dataSource: DataSource | null = null;
    try {
        dataSource = await getConnectedDataSource();
        const roleRepo = dataSource.getRepository(Role);
        const roles = await roleRepo.find();
        return NextResponse.json(roles.map(r => ({...r, id: String(r.id), permissions: JSON.parse(r.permissions) })));
    } catch (error) {
        console.error('Error fetching roles:', error);
        return NextResponse.json({ error: 'Failed to fetch roles' }, { status: 500 });
    } finally {
        if (dataSource && AppDataSource.options.type !== 'oracle') {
           // await dataSource.destroy();
        }
    }
}

// POST a new role
export async function POST(req: Request) {
    let dataSource: DataSource | null = null;
    try {
        dataSource = await getConnectedDataSource();
        const roleRepo = dataSource.getRepository(Role);
        const { name, permissions } = await req.json();

        if (!name || !permissions) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }
        
        const existingRole = await roleRepo.findOne({
            where: { name },
        });

        if (existingRole) {
            return NextResponse.json({ error: 'Role with this name already exists.' }, { status: 409 });
        }

        const newRole = roleRepo.create({
            name,
            permissions: JSON.stringify(permissions),
        });
        await roleRepo.save(newRole);

        return NextResponse.json(newRole, { status: 201 });
    } catch (error) {
        console.error('Error creating role:', error);
        return NextResponse.json({ error: 'Failed to create role' }, { status: 500 });
    } finally {
        if (dataSource && AppDataSource.options.type !== 'oracle') {
            // await dataSource.destroy();
        }
    }
}

// PUT (update) a role
export async function PUT(req: Request) {
    let dataSource: DataSource | null = null;
     try {
        dataSource = await getConnectedDataSource();
        const roleRepo = dataSource.getRepository(Role);
        const { id, ...updateData } = await req.json();

        if (!id) {
            return NextResponse.json({ error: 'Role ID is required' }, { status: 400 });
        }
        
        if (updateData.permissions) {
            updateData.permissions = JSON.stringify(updateData.permissions);
        }

        await roleRepo.update(id, updateData);
        const updatedRole = await roleRepo.findOneBy({id: Number(id)});


        return NextResponse.json(updatedRole);
    } catch (error) {
        console.error('Error updating role:', error);
        return NextResponse.json({ error: 'Failed to update role' }, { status: 500 });
    } finally {
        if (dataSource && AppDataSource.options.type !== 'oracle') {
            // await dataSource.destroy();
        }
    }
}

// DELETE a role
export async function DELETE(req: Request) {
    let dataSource: DataSource | null = null;
    try {
        dataSource = await getConnectedDataSource();
        const roleRepo = dataSource.getRepository(Role);
        const userRepo = dataSource.getRepository(User);
        const { id } = await req.json();

        if (!id) {
            return NextResponse.json({ error: 'Role ID is required' }, { status: 400 });
        }
        
        const roleToDelete = await roleRepo.findOneBy({id: Number(id)});
        if (!roleToDelete) {
             return NextResponse.json({ error: 'Role not found' }, { status: 404 });
        }

        // Check if any users are assigned to this role
        const usersInRole = await userRepo.count({
            where: { roleName: roleToDelete.name },
        });

        if (usersInRole > 0) {
            return NextResponse.json({ error: 'Cannot delete role. It is currently assigned to one or more users.' }, { status: 400 });
        }


        await roleRepo.delete(id);

        return NextResponse.json({ message: 'Role deleted successfully' }, { status: 200 });
    } catch (error) {
        console.error('Error deleting role:', error);
        return NextResponse.json({ error: 'Failed to delete role' }, { status: 500 });
    } finally {
        if (dataSource && AppDataSource.options.type !== 'oracle') {
            // await dataSource.destroy();
        }
    }
}
