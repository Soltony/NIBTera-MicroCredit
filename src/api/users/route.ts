
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getSession } from '@/lib/session';
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
  try {
    const users = await prisma.user.findMany({
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
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const ipAddress = req.ip || req.headers.get('x-forwarded-for') || 'N/A';
    const userAgent = req.headers.get('user-agent') || 'N/A';
  try {
    const currentUser = await getUserFromSession();
    const body = await req.json();
    const { password, role: roleName, providerId, ...userData } = userSchema.parse(body);

    const logDetails = { userEmail: userData.email, assignedRole: roleName };
    await createAuditLog({ actorId: session.userId, action: 'USER_CREATE_INITIATED', entity: 'USER', details: logDetails, ipAddress, userAgent });

    if (!password) {
      throw new Error('Password is required for new users.');
    }
    
    // Determine the providerId for the role lookup.
    // Super Admins can assign roles from any provider, others are restricted.
    const roleProviderId = currentUser?.role === 'Super Admin' ? providerId : currentUser?.providerId;

    const role = await prisma.role.findFirst({ 
        where: { 
            name: roleName,
            providerId: roleProviderId || null
        }
    });

    if (!role) {
      throw new Error('Invalid role selected for this provider context.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const dataToCreate: any = {
        ...userData,
        password: hashedPassword,
        roleId: role.id,
    };
    
    // Assign providerId to the user if the role requires it and it's provided
    if (providerId) {
        dataToCreate.loanProviderId = providerId;
    }

    const newUser = await prisma.user.create({
      data: dataToCreate,
    });
    
    const successLogDetails = { createdUserId: newUser.id, createdUserEmail: newUser.email, assignedRole: roleName };
    await createAuditLog({ actorId: session.userId, action: 'USER_CREATE_SUCCESS', entity: 'USER', entityId: newUser.id, details: successLogDetails, ipAddress, userAgent });


    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
     const errorMessage = (error instanceof z.ZodError) ? error.errors : (error as Error).message;
     const failureLogDetails = { error: errorMessage };
     await createAuditLog({ actorId: session.userId, action: 'USER_CREATE_FAILED', entity: 'USER', details: failureLogDetails, ipAddress, userAgent });
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: errorMessage || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const ipAddress = req.ip || req.headers.get('x-forwarded-for') || 'N/A';
    const userAgent = req.headers.get('user-agent') || 'N/A';
  try {

    const body = await req.json();
    const { id, role: roleName, providerId, ...userData } = body;

    if (!id) {
        throw new Error('User ID is required for an update.');
    }

    const logDetails = { updatedUserId: id, updatedFields: Object.keys(userData) };
    await createAuditLog({ actorId: session.userId, action: 'USER_UPDATE_INITIATED', entity: 'USER', entityId: id, details: logDetails, ipAddress, userAgent });

    let dataToUpdate: any = { ...userData };

    if (roleName) {
        // Find the role based on its name and potential provider association
        const userToUpdate = await prisma.user.findUnique({ where: { id }});
        const roleProviderId = userToUpdate?.loanProviderId;

        const role = await prisma.role.findFirst({ 
            where: {
                name: roleName,
                // A bit tricky: if the user belongs to a provider, look for provider-specific roles first.
                // This logic might need refinement based on exact business rules.
                providerId: roleProviderId || null
            }
        });

        if (!role) {
            throw new Error('Invalid role selected for this context.');
        }
        dataToUpdate.roleId = role.id;
    }
    
    // Handle providerId relationship
    if (providerId === null) {
        dataToUpdate.loanProviderId = null;
    } else if (providerId) {
        dataToUpdate.loanProviderId = providerId;
    }


    const updatedUser = await prisma.user.update({
      where: { id },
      data: dataToUpdate,
    });
    
    const successLogDetails = { updatedUserId: id, updatedFields: Object.keys(userData) };
    await createAuditLog({ actorId: session.userId, action: 'USER_UPDATE_SUCCESS', entity: 'USER', entityId: id, details: successLogDetails, ipAddress, userAgent });

    return NextResponse.json(updatedUser);
  } catch (error) {
    const errorMessage = (error as Error).message;
    const failureLogDetails = { error: errorMessage };
    await createAuditLog({ actorId: session.userId, action: 'USER_UPDATE_FAILED', entity: 'USER', details: failureLogDetails, ipAddress, userAgent });
    return NextResponse.json({ error: errorMessage || 'Internal Server Error' }, { status: 500 });
  }
}
