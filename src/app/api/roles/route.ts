
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET all roles
export async function GET() {
    try {
        const roles = await prisma.role.findMany();
        return NextResponse.json(roles);
    } catch (error) {
        console.error('Error fetching roles:', error);
        return NextResponse.json({ error: 'Failed to fetch roles' }, { status: 500 });
    }
}

// POST a new role
export async function POST(req: Request) {
    try {
        const { name, permissions } = await req.json();

        if (!name || !permissions) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }
        
        const existingRole = await prisma.role.findUnique({
            where: { name },
        });

        if (existingRole) {
            return NextResponse.json({ error: 'Role with this name already exists.' }, { status: 409 });
        }

        const newRole = await prisma.role.create({
            data: {
                name,
                permissions,
            },
        });

        return NextResponse.json(newRole, { status: 201 });
    } catch (error) {
        console.error('Error creating role:', error);
        return NextResponse.json({ error: 'Failed to create role' }, { status: 500 });
    }
}

// PUT (update) a role
export async function PUT(req: Request) {
     try {
        const { id, ...updateData } = await req.json();

        if (!id) {
            return NextResponse.json({ error: 'Role ID is required' }, { status: 400 });
        }
        
        const updatedRole = await prisma.role.update({
            where: { id },
            data: updateData,
        });

        return NextResponse.json(updatedRole);
    } catch (error) {
        console.error('Error updating role:', error);
        return NextResponse.json({ error: 'Failed to update role' }, { status: 500 });
    }
}

// DELETE a role
export async function DELETE(req: Request) {
    try {
        const { id } = await req.json();

        if (!id) {
            return NextResponse.json({ error: 'Role ID is required' }, { status: 400 });
        }

        await prisma.role.delete({
            where: { id },
        });

        return NextResponse.json({ message: 'Role deleted successfully' }, { status: 200 });
    } catch (error) {
        console.error('Error deleting role:', error);
        return NextResponse.json({ error: 'Failed to delete role' }, { status: 500 });
    }
}
