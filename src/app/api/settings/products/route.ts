
import { NextResponse } from 'next/server';
import { AppDataSource } from '@/data-source';
import { LoanProduct } from '@/entities/LoanProduct';
import { LoanDetails } from '@/entities/LoanDetails';
import { z } from 'zod';
import type { DataSource } from 'typeorm';

async function getConnectedDataSource(): Promise<DataSource> {
    if (AppDataSource.isInitialized) {
        return AppDataSource;
    } else {
        return await AppDataSource.initialize();
    }
}

const productSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  icon: z.string().min(1, 'Icon is required'),
  minLoan: z.number().positive(),
  maxLoan: z.number().positive(),
  serviceFee: z.string(),
  dailyFee: z.string(),
  penaltyFee: z.string(),
});

const createProductSchema = productSchema.extend({
    providerId: z.string()
});

const updateProductSchema = productSchema.extend({
  id: z.string(),
  status: z.enum(['Active', 'Disabled']),
});

// POST a new product
export async function POST(req: Request) {
    let dataSource: DataSource | null = null;
    try {
        dataSource = await getConnectedDataSource();
        const productRepo = dataSource.getRepository(LoanProduct);

        const body = await req.json();
        const validation = createProductSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ error: validation.error.format() }, { status: 400 });
        }
        
        const { providerId, ...productData } = validation.data;

        const newProduct = productRepo.create({
            ...productData,
            providerId: Number(providerId),
            status: 'Active',
        });
        await productRepo.save(newProduct);

        return NextResponse.json(newProduct, { status: 201 });
    } catch (error) {
        console.error('Error creating product:', error);
        return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
    } finally {
         if (dataSource && AppDataSource.options.type !== 'oracle') {
           // await dataSource.destroy();
        }
    }
}

// PUT (update) a product
export async function PUT(req: Request) {
    let dataSource: DataSource | null = null;
     try {
        dataSource = await getConnectedDataSource();
        const productRepo = dataSource.getRepository(LoanProduct);

        const body = await req.json();
        const validation = updateProductSchema.safeParse(body);
         if (!validation.success) {
            return NextResponse.json({ error: validation.error.format() }, { status: 400 });
        }
        
        const { id, ...updateData } = validation.data;

        await productRepo.update(id, updateData);
        const updatedProduct = await productRepo.findOneBy({ id: Number(id) });


        return NextResponse.json(updatedProduct);
    } catch (error) {
        console.error('Error updating product:', error);
        return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
    } finally {
        if (dataSource && AppDataSource.options.type !== 'oracle') {
           // await dataSource.destroy();
        }
    }
}

// DELETE a product
export async function DELETE(req: Request) {
    let dataSource: DataSource | null = null;
    try {
        dataSource = await getConnectedDataSource();
        const productRepo = dataSource.getRepository(LoanProduct);
        const loanRepo = dataSource.getRepository(LoanDetails);

        const { id } = await req.json();

        if (!id) {
            return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
        }

        // Check for associated loans
        const loanCount = await loanRepo.count({ where: { productId: Number(id) } });
        if (loanCount > 0) {
            return NextResponse.json({ error: `Cannot delete product. It has ${loanCount} associated loan(s).` }, { status: 400 });
        }

        await productRepo.delete(id);

        return NextResponse.json({ message: 'Product deleted successfully' }, { status: 200 });
    } catch (error) {
        console.error('Error deleting product:', error);
        return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
    } finally {
        if (dataSource && AppDataSource.options.type !== 'oracle') {
            // await dataSource.destroy();
        }
    }
}
