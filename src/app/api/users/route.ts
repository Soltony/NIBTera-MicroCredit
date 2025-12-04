

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { createAuditLog } from '@/lib/audit-log';
import { getUserFromSession } from '@/lib/user';

const userSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  email: z.string().email('Invalid email address'),
  phoneNumber: z.string().min(1, 'Phone number is required'),
  password: z.string().min(6, 'Password must be at least 6 characters long').optional(),
  role: z.string(), // Role name, will be connected by ID
  providerId: z.string().nullable().optional(),
  status: z.enum(['Active', 'Inactive']),
});

export async function GET() {
    const user = await getUserFromSession();
    if (!user || !user.permissions?.['access-control']?.read) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

  try {
    // Horizontal access control: non-super-admins can only see users of their own provider or unassigned users
    const whereClause: any = {};
    if (user.role !== 'Super Admin' && user.loanProviderId) {
        whereClause.OR = [
            { loanProviderId: user.loanProviderId },
            { loanProviderId: null }
        ];
    }


    const users = await prisma.user.findMany({
      where: whereClause,
      include: {
        role: true,
        loanProvider: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const formattedUsers = users.map(user => ({
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: user.role.name,
      providerName: user.loanProvider?.name || 'N/A',
      providerId: user.loanProvider?.id,
      status: user.status,
    }));

    return NextResponse.json(formattedUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
    const user = await getUserFromSession();
    if (!user || !user.permissions?.['access-control']?.create) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const ipAddress = req.ip || req.headers.get('x-forwarded-for') || 'N/A';
    const userAgent = req.headers.get('user-agent') || 'N/A';
  try {

    const body = await req.json();
    const { password, role: roleName, providerId, ...userData } = userSchema.parse(body);

    const logDetails = { userEmail: userData.email, assignedRole: roleName };
    await createAuditLog({ actorId: user.id, action: 'USER_CREATE_INITIATED', entity: 'USER', details: logDetails, ipAddress, userAgent });

    if (!password) {
      throw new Error('Password is required for new users.');
    }

    const role = await prisma.role.findUnique({ where: { name: roleName }});
    if (!role) {
      throw new Error('Invalid role selected.');
    }

    // Vertical Escalation Prevention
    if (user.role !== 'Super Admin' && (role.name === 'Super Admin' || role.name === 'Admin')) {
        return NextResponse.json({ error: 'You cannot create a user with a higher-privileged role.' }, { status: 403 });
    }
    // Horizontal Escalation Prevention
    if (user.role !== 'Super Admin' && providerId && providerId !== user.loanProviderId) {
        return NextResponse.json({ error: 'You can only create users for your own provider.' }, { status: 403 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const dataToCreate: any = {
        ...userData,
        password: hashedPassword,
        roleId: role.id,
    };
    
    // Only assign providerId if the creator is allowed to and the role requires it
    if (user.role === 'Super Admin' || (user.loanProviderId && providerId === user.loanProviderId)) {
       if (providerId) {
            dataToCreate.loanProviderId = providerId;
        }
    }


    const newUser = await prisma.user.create({
      data: dataToCreate,
    });
    
    const successLogDetails = { createdUserId: newUser.id, createdUserEmail: newUser.email, assignedRole: roleName };
    await createAuditLog({ actorId: user.id, action: 'USER_CREATE_SUCCESS', entity: 'USER', entityId: newUser.id, details: successLogDetails, ipAddress, userAgent });


    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
     const errorMessage = (error instanceof z.ZodError) ? error.errors : (error as Error).message;
     const failureLogDetails = { error: errorMessage };
     await createAuditLog({ actorId: user.id, action: 'USER_CREATE_FAILED', entity: 'USER', details: failureLogDetails, ipAddress, userAgent });
     console.error(JSON.stringify({ ...failureLogDetails, action: 'USER_CREATE_FAILED', actorId: user.id }));
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: errorMessage || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
    const user = await getUserFromSession();
    if (!user || !user.permissions?.['access-control']?.update) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const ipAddress = req.ip || req.headers.get('x-forwarded-for') || 'N/A';
    const userAgent = req.headers.get('user-agent') || 'N/A';
  try {

    const body = await req.json();
    const { id, role: roleName, providerId, ...userData } = body;

    if (!id) {
        throw new Error('User ID is required for an update.');
    }
    
    // Horizontal access control: non-super-admins can only edit users in their own provider or unassigned users
    if (user.role !== 'Super Admin' && user.loanProviderId) {
        const userToEdit = await prisma.user.findUnique({ where: { id }});
        if (userToEdit && userToEdit.loanProviderId && userToEdit.loanProviderId !== user.loanProviderId) {
            return NextResponse.json({ error: 'You do not have permission to edit this user.' }, { status: 403 });
        }
    }


    const logDetails = { updatedUserId: id, updatedFields: Object.keys(userData) };
    await createAuditLog({ actorId: user.id, action: 'USER_UPDATE_INITIATED', entity: 'USER', entityId: id, details: logDetails, ipAddress, userAgent });

    let dataToUpdate: any = { ...userData };

    if (roleName) {
        const role = await prisma.role.findUnique({ where: { name: roleName }});
        if (!role) {
            throw new Error('Invalid role selected.');
        }
        
        // Vertical Escalation Prevention
        if (user.role !== 'Super Admin' && (role.name === 'Super Admin' || role.name === 'Admin')) {
            return NextResponse.json({ error: 'You cannot assign a higher-privileged role.' }, { status: 403 });
        }

        dataToUpdate.roleId = role.id;
    }
    
    // Handle providerId relationship
    if (user.role === 'Super Admin') {
        if (providerId === null) {
            dataToUpdate.loanProviderId = null;
        } else if (providerId) {
            dataToUpdate.loanProviderId = providerId;
        }
    } else if (user.loanProviderId) {
        // Non-super-admins can only assign users to their own provider
        if (providerId && providerId !== user.loanProviderId) {
             return NextResponse.json({ error: 'You can only assign users to your own provider.' }, { status: 403 });
        }
        dataToUpdate.loanProviderId = providerId;
    }


    const updatedUser = await prisma.user.update({
      where: { id },
      data: dataToUpdate,
    });
    
    const successLogDetails = { updatedUserId: id, updatedFields: Object.keys(userData) };
    await createAuditLog({ actorId: user.id, action: 'USER_UPDATE_SUCCESS', entity: 'USER', entityId: id, details: successLogDetails, ipAddress, userAgent });

    return NextResponse.json(updatedUser);
  } catch (error) {
    const errorMessage = (error as Error).message;
    const failureLogDetails = { error: errorMessage };
    await createAuditLog({ actorId: user.id, action: 'USER_UPDATE_FAILED', entity: 'USER', details: failureLogDetails, ipAddress, userAgent });
    console.error(JSON.stringify({ ...failureLogDetails, action: 'USER_UPDATE_FAILED', actorId: user.id }));
    return NextResponse.json({ error: errorMessage || 'Internal Server Error' }, { status: 500 });
  }
}
