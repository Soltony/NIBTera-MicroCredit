
import { NextResponse } from 'next/server';
import { AppDataSource } from '@/data-source';
import { User } from '@/entities/User';
import { Role } from '@/entities/Role';
import { LoanProvider } from '@/entities/LoanProvider';
import bcrypt from 'bcryptjs';
import { FindOptionsWhere, Or, DataSource } from 'typeorm';

async function getConnectedDataSource(): Promise<DataSource> {
    if (AppDataSource.isInitialized) {
        return AppDataSource;
    } else {
        return await AppDataSource.initialize();
    }
}

// GET all users
export async function GET() {
    try {
        const dataSource = await getConnectedDataSource();
        const userRepo = dataSource.getRepository(User);
        const users = await userRepo.find({
            relations: ['provider', 'role'],
        });
        
        const usersToReturn = users.map(user => {
            const { password, ...userWithoutPassword } = user;
            return {
                ...userWithoutPassword,
                id: String(user.id),
                providerId: String(user.providerId),
                providerName: user.provider?.name || '',
                role: user.role.name,
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
        const dataSource = await getConnectedDataSource();
        const userRepo = dataSource.getRepository(User);
        const roleRepo = dataSource.getRepository(Role);
        
        const { fullName, email, phoneNumber, password, role, providerId, status } = await req.json();

        if (!fullName || !email || !phoneNumber || !password || !role || !status) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }
        
        const existingUser = await userRepo.findOne({
            where: [{ email }, { phoneNumber }],
        });

        if (existingUser) {
            return NextResponse.json({ error: 'User with this email or phone number already exists.' }, { status: 409 });
        }
        
        const userRole = await roleRepo.findOneBy({ name: role });
        if (!userRole) {
            return NextResponse.json({ error: 'Invalid role specified' }, { status: 400 });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = userRepo.create({
            fullName,
            email,
            phoneNumber,
            password: hashedPassword,
            role: userRole,
            providerId: providerId ? Number(providerId) : null,
            status,
        });
        await userRepo.save(newUser);

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
        const dataSource = await getConnectedDataSource();
        const userRepo = dataSource.getRepository(User);
        const roleRepo = dataSource.getRepository(Role);
        
        const { id, ...updateData } = await req.json();

        if (!id) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }
        
        const dataToUpdate: Partial<User> = { ...updateData };

        if (updateData.role) {
            const userRole = await roleRepo.findOneBy({ name: updateData.role });
            if (!userRole) {
                 return NextResponse.json({ error: 'Invalid role specified' }, { status: 400 });
            }
            dataToUpdate.role = userRole;
            dataToUpdate.roleName = userRole.name;
            delete (dataToUpdate as any).role;
        }
        
        if (Object.prototype.hasOwnProperty.call(dataToUpdate, 'providerId')) {
          dataToUpdate.providerId = dataToUpdate.providerId ? Number(dataToUpdate.providerId) : null;
        }

        await userRepo.update(id, dataToUpdate as any);
        const updatedUser = await userRepo.findOneBy({id: Number(id)});

        const { password, ...userToReturn } = updatedUser!;
        return NextResponse.json(userToReturn);
    } catch (error) {
        console.error('Error updating user:', error);
        return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }
}
