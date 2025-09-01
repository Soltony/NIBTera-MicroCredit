import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { createProductSchema, updateProductSchema } from '@/lib/schemas';


// POST a new product
export async function POST(req: NextRequest) {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { providerId, ...productData } = createProductSchema.parse(body);

        const newProduct = await prisma.loanProduct.create({
            data: {
                providerId: providerId,
                name: productData.name,
                description: productData.description || '',
                icon: productData.icon,
                minLoan: productData.minLoan,
                maxLoan: productData.maxLoan,
                duration: productData.duration,
                status: 'Active',
                // Default fee structures
                serviceFee: JSON.stringify({ type: 'percentage', value: 0 }),
                dailyFee: JSON.stringify({ type: 'percentage', value: 0 }),
                penaltyRules: JSON.stringify([]),
                serviceFeeEnabled: false,
                dailyFeeEnabled: false,
                penaltyRulesEnabled: false,
                dataProvisioningEnabled: false,
            }
        });
        
        console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            action: 'PRODUCT_CREATE_SUCCESS',
            actorId: session.userId,
            details: {
                productId: newProduct.id,
                productName: newProduct.name,
                providerId: newProduct.providerId,
            }
        }));

        return NextResponse.json(newProduct, { status: 201 });

    } catch (error) {
        console.error('Error creating product:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// PUT to update a product
export async function PUT(req: NextRequest) {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    try {
        const body = await req.json();
        const parsedData = updateProductSchema.parse(body);
        const { id, ...updateData } = parsedData;
        
        const dataToUpdate: any = { ...updateData };

        // Stringify JSON fields if they are present and are objects/arrays
        if (updateData.serviceFee && typeof updateData.serviceFee === 'object') {
            dataToUpdate.serviceFee = JSON.stringify(updateData.serviceFee);
        }
        if (updateData.dailyFee && typeof updateData.dailyFee === 'object') {
            dataToUpdate.dailyFee = JSON.stringify(updateData.dailyFee);
        }
        if (updateData.penaltyRules && Array.isArray(updateData.penaltyRules)) {
            dataToUpdate.penaltyRules = JSON.stringify(updateData.penaltyRules);
        }
        
        const updatedProduct = await prisma.loanProduct.update({
            where: { id },
            data: dataToUpdate,
        });

        console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            action: 'PRODUCT_UPDATE_SUCCESS',
            actorId: session.userId,
            details: {
                productId: updatedProduct.id,
                updatedFields: Object.keys(dataToUpdate),
            }
        }));

        return NextResponse.json(updatedProduct);

    } catch (error: any) {
        console.error('Error updating product:', error);
        return NextResponse.json({ error: 'Internal Server Error', 'details': error.message }, { status: 500 });
    }
}

// DELETE a product
export async function DELETE(req: NextRequest) {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    try {
        const { id } = await req.json();
        if (!id) {
            return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
        }
        
        // Add check if product has associated loans
        const loanCount = await prisma.loan.count({ where: { productId: id } });
        if (loanCount > 0) {
            return NextResponse.json({ error: 'Cannot delete product. It has associated loans.' }, { status: 400 });
        }
        
        const productToDelete = await prisma.loanProduct.findUnique({ where: { id }});

        await prisma.loanProduct.delete({ where: { id } });

        console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            action: 'PRODUCT_DELETE_SUCCESS',
            actorId: session.userId,
            details: {
                deletedProductId: id,
                deletedProductName: productToDelete?.name,
                providerId: productToDelete?.providerId,
            }
        }));

        return NextResponse.json({ message: 'Product deleted successfully' });

    } catch (error) {
        console.error('Error deleting product:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
