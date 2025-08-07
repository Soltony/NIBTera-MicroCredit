
'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function AdminSettingsPage() {
  return (
    <div>
        <div className="mb-4">
            <h1 className="text-2xl font-semibold">Loan Product Settings</h1>
            <p className="text-muted-foreground">Configure loan products for different providers.</p>
        </div>
        <Card>
            <CardHeader>
                <CardTitle>Manage Products</CardTitle>
                <CardDescription>
                Create, edit, or deactivate loan products for each provider.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <p>
                    Product configuration options will be available here. You will be able to set minimum and maximum loan amounts, interest rates, service fees, and penalty fees for each product.
                </p>
                <Button className="mt-4">Add New Product</Button>
            </CardContent>
        </Card>
    </div>
  );
}
