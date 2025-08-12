
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// GET all users
export async function GET() {
    try {
        const users = await prisma.user.findMany({
            include: {
                provider: true,
            },
        });
        const usersToReturn = users.map(user => {
            const { password, ...userWithoutPassword } = user;
            return {
                ...userWithoutPassword,
                providerName: user.provider?.name || '',
                role: user.roleName,
            };
        });
        return NextResponse.json(usersToReturn);
    } catch (error) {
        console.error('Error fetching users:', error);
        return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }
}

// POST a new user
export async function POST(req: Request) {
    try {
        const { fullName, email, phoneNumber, password, role, providerId, status } = await req.json();

        if (!fullName || !email || !phoneNumber || !password || !role || !status) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }
        
        const existingUser = await prisma.user.findFirst({
            where: { OR: [{ email }, { phoneNumber }] },
        });

        if (existingUser) {
            return NextResponse.json({ error: 'User with this email or phone number already exists.' }, { status: 409 });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await prisma.user.create({
            data: {
                fullName,
                email,
                phoneNumber,
                password: hashedPassword,
                roleName: role,
                providerId: providerId ? providerId : null, // Ensure empty string becomes null
                status,
            },
        });

        const { password: _, ...userToReturn } = newUser;
        return NextResponse.json(userToReturn, { status: 201 });
    } catch (error) {
        console.error('Error creating user:', error);
        return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }
}

// PUT (update) a user
export async function PUT(req: Request) {
     try {
        const { id, ...updateData } = await req.json();

        if (!id) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }
        
        if (updateData.role) {
            updateData.roleName = updateData.role;
            delete updateData.role;
        }
        
        if (Object.prototype.hasOwnProperty.call(updateData, 'providerId')) {
          updateData.providerId = updateData.providerId ? updateData.providerId : null;
        }

        const updatedUser = await prisma.user.update({
            where: { id },
            data: updateData,
        });

        const { password, ...userToReturn } = updatedUser;
        return NextResponse.json(userToReturn);
    } catch (error) {
        console.error('Error updating user:', error);
        return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }
}
