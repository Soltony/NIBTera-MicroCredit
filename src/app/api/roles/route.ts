
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { z } from 'zod';

const permissionsSchema = z.record(z.string(), z.object({
  create: z.boolean(),
  read: z.boolean(),
  update: z.boolean(),
  delete: z.boolean(),
}));

const roleSchema = z.object({
  name: z.string().min(1, 'Role name is required'),
  permissions: permissionsSchema,
});


export async function GET() {
  try {
    const roles = await prisma.role.findMany({
        orderBy: {
            name: 'asc'
        }
    });
    
    // Prisma stores permissions as a JSON string, so we need to parse it.
    const formattedRoles = roles.map(role => ({
        ...role,
        permissions: JSON.parse(role.permissions),
    }));

    return NextResponse.json(formattedRoles);
  } catch (error) {
    console.error('Error fetching roles:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
    const session = await getSession();
    if (!session?.userId) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    try {
        const body = await req.json();
        const { name, permissions } = roleSchema.parse(body);
        
        const newRole = await prisma.role.create({
            data: {
                name,
                permissions: JSON.stringify(permissions),
            },
        });
        
        console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            action: 'ROLE_CREATE_SUCCESS',
            actorId: session.userId,
            details: {
                roleId: newRole.id,
                roleName: newRole.name,
            }
        }));

        return NextResponse.json({ ...newRole, permissions }, { status: 201 });
    } catch (error) {
        console.error('Error creating role:', error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.errors }, { status: 400 });
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    const session = await getSession();
    if (!session?.userId) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    try {
        const body = await req.json();
        const { id, name, permissions } = roleSchema.extend({ id: z.string() }).parse(body);

        const updatedRole = await prisma.role.update({
            where: { id },
            data: {
                name,
                permissions: JSON.stringify(permissions),
            },
        });
        
        console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            action: 'ROLE_UPDATE_SUCCESS',
            actorId: session.userId,
            details: {
                roleId: updatedRole.id,
                roleName: updatedRole.name,
            }
        }));


        return NextResponse.json({ ...updatedRole, permissions });
    } catch (error) {
        console.error('Error updating role:', error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.errors }, { status: 400 });
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    const session = await getSession();
    if (!session?.userId) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    try {
        const { id } = await req.json();
        if (!id) {
            return NextResponse.json({ error: 'Role ID is required' }, { status: 400 });
        }
        
        // Check if any user is assigned to this role
        const usersWithRole = await prisma.user.count({ where: { roleId: id } });
        if (usersWithRole > 0) {
            return NextResponse.json({ error: 'Cannot delete role. It is currently assigned to one or more users.' }, { status: 400 });
        }
        
        const roleToDelete = await prisma.role.findUnique({ where: { id }});

        await prisma.role.delete({
            where: { id },
        });

        console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            action: 'ROLE_DELETE_SUCCESS',
            actorId: session.userId,
            details: {
                deletedRoleId: id,
                deletedRoleName: roleToDelete?.name,
            }
        }));

        return NextResponse.json({ message: 'Role deleted successfully' });

    } catch (error) {
        console.error('Error deleting role:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
