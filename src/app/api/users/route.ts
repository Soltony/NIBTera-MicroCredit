
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getSession } from '@/lib/session';

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
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await req.json();
    const { password, role: roleName, providerId, ...userData } = userSchema.parse(body);

    if (!password) {
      return NextResponse.json({ error: 'Password is required for new users.' }, { status: 400 });
    }

    const role = await prisma.role.findUnique({ where: { name: roleName }});
    if (!role) {
      return NextResponse.json({ error: 'Invalid role selected.' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const dataToCreate: any = {
        ...userData,
        password: hashedPassword,
        roleId: role.id,
    };
    
    if (providerId) {
        dataToCreate.loanProvider = {
            connect: { id: providerId }
        };
    }

    const newUser = await prisma.user.create({
      data: dataToCreate,
    });

    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await req.json();
    const { id, role: roleName, ...userData } = body;

    if (!id) {
        return NextResponse.json({ error: 'User ID is required for an update.' }, { status: 400 });
    }

    let dataToUpdate: any = { ...userData };
    delete dataToUpdate.providerId;


    if (roleName) {
        const role = await prisma.role.findUnique({ where: { name: roleName }});
        if (!role) {
            return NextResponse.json({ error: 'Invalid role selected.' }, { status: 400 });
        }
        dataToUpdate.roleId = role.id;
    }
    
    // Handle providerId relationship
    if (userData.providerId === null) {
        dataToUpdate.loanProvider = {
            disconnect: true
        }
    } else if (userData.providerId) {
        dataToUpdate.loanProvider = {
            connect: { id: userData.providerId }
        }
    }


    const updatedUser = await prisma.user.update({
      where: { id },
      data: dataToUpdate,
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
