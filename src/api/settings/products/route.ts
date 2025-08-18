
import { NextResponse } from 'next/server';
import { getConnectedDataSource } from '@/data-source';
import { LoanProduct } from '@/entities/LoanProduct';
import { LoanDetails } from '@/entities/LoanDetails';
import { createProductSchema, updateProductSchema } from '@/lib/schemas';
import type { DataSource } from 'typeorm';
import { z } from 'zod';

// POST a new product
export async function POST(req: Request) {
    try {
        const dataSource = await getConnectedDataSource();
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
            // Initialize fee/penalty structures as empty/default JSON strings
            serviceFee: JSON.stringify({ type: 'percentage', value: 0 }),
            dailyFee: JSON.stringify({ type: 'percentage', value: 0 }),
            penaltyRules: '[]',
            serviceFeeEnabled: false,
            dailyFeeEnabled: false,
            penaltyRulesEnabled: false,
            dataProvisioningEnabled: false,
            dataProvisioningConfigId: null,
        });
        await productRepo.save(newProduct);
        
        // Parse JSON for the response object
        const responseProduct = {
            ...newProduct,
            serviceFee: JSON.parse(newProduct.serviceFee),
            dailyFee: JSON.parse(newProduct.dailyFee),
            penaltyRules: JSON.parse(newProduct.penaltyRules)
        };

        return NextResponse.json(responseProduct, { status: 201 });
    } catch (error) {
        console.error('Error creating product:', error);
        return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
    }
}

// PUT (update) a product
export async function PUT(req: Request) {
     try {
        const dataSource = await getConnectedDataSource();
        const productRepo = dataSource.getRepository(LoanProduct);

        const body = await req.json();
        // Allow partial updates for just fees or status
        const validation = updateProductSchema.partial().extend({ id: z.string() }).safeParse(body);
         if (!validation.success) {
            return NextResponse.json({ error: validation.error.format() }, { status: 400 });
        }
        
        const { id, ...updateData } = validation.data;
        const dataToUpdate: any = { ...updateData };

        // Stringify JSON fields before updating
        if (updateData.serviceFee) {
            dataToUpdate.serviceFee = JSON.stringify(updateData.serviceFee);
        }
        if (updateData.dailyFee) {
            dataToUpdate.dailyFee = JSON.stringify(updateData.dailyFee);
        }
        if (updateData.penaltyRules) {
            dataToUpdate.penaltyRules = JSON.stringify(updateData.penaltyRules);
        }

        // Handle the case where data provisioning is disabled
        if (updateData.dataProvisioningEnabled === false) {
            dataToUpdate.dataProvisioningConfigId = null;
        }

        if (updateData.dataProvisioningConfigId) {
             dataToUpdate.dataProvisioningConfigId = Number(updateData.dataProvisioningConfigId);
        }

        await productRepo.update(id, dataToUpdate);
        const updatedProduct = await productRepo.findOneBy({ id: Number(id) });
        
        if (!updatedProduct) {
             return NextResponse.json({ error: 'Product not found after update.' }, { status: 404 });
        }
        
        // Parse JSON fields for the response
        const responseProduct = {
            ...updatedProduct,
            serviceFee: JSON.parse(updatedProduct.serviceFee),
            dailyFee: JSON.parse(updatedProduct.dailyFee),
            penaltyRules: JSON.parse(updatedProduct.penaltyRules)
        };


        return NextResponse.json(responseProduct);
    } catch (error) {
        console.error('Error updating product:', error);
        return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
    }
}

// DELETE a product
export async function DELETE(req: Request) {
    try {
        const dataSource = await getConnectedDataSource();
        const productRepo = dataSource.getRepository(LoanProduct);
        const { id } = await req.json();

        if (!id) {
            return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
        }

        // Let the database foreign key constraint handle the check for associated loans.
        await productRepo.delete(id);

        return NextResponse.json({ message: 'Product deleted successfully' }, { status: 200 });
    } catch (error: any) {
        // ORA-02292 is the Oracle error code for an integrity constraint violation (foreign key).
        if (error.code === 'ORA-02292' || (error.message && error.message.includes('ORA-02292'))) {
             return NextResponse.json({ error: 'Cannot delete product. It has associated loans.' }, { status: 400 });
        }
        console.error('Error deleting product:', error);
        return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
    }
}
