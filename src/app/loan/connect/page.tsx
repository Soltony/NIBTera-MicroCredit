
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { Logo } from '@/components/icons';
import { NextRequest } from 'next/server';

const TOKEN_VALIDATION_API_URL = process.env.TOKEN_VALIDATION_API_URL;

const ErrorDisplay = ({ title, message }: { title: string, message: string }) => (
    <div className="flex items-center justify-center min-h-screen bg-muted/40">
        <Card className="w-full max-w-sm">
            <CardHeader className="text-center">
                 <div className="flex justify-center mb-4">
                    <Logo className="h-10 w-10" />
                </div>
                <CardTitle className="text-2xl">Connection Failed</CardTitle>
                <CardDescription>
                    There was a problem authenticating your session.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>{title}</AlertTitle>
                    <AlertDescription>{message}</AlertDescription>
                </Alert>
            </CardContent>
        </Card>
    </div>
);


export default async function ConnectPage() {
    if (!TOKEN_VALIDATION_API_URL) {
        return <ErrorDisplay title="Configuration Error" message="The token validation URL is not configured on the server." />;
    }

    const headersList = headers();
    const authHeader = headersList.get('Authorization');

    if (!authHeader) {
        return <ErrorDisplay title="Authentication Error" message="Authorization header is missing from the request." />;
    }

    if (!authHeader.startsWith('Bearer ')) {
        return <ErrorDisplay title="Authentication Error" message="Authorization header is malformed. It must start with Bearer." />;
    }

    const token = authHeader.substring(7);

    try {
        const externalResponse = await fetch(TOKEN_VALIDATION_API_URL, {
            method: 'GET',
            headers: {
                Authorization: authHeader,
                Accept: 'application/json',
            },
            cache: 'no-store',
        });

        if (!externalResponse.ok) {
            let errorMessage = 'Token validation failed with an unknown error.';
            try {
                const errorData = await externalResponse.json();
                errorMessage = errorData.message || `Token validation failed with status: ${externalResponse.status}`;
            } catch (e) {
                // Ignore if response is not JSON
            }
             return <ErrorDisplay title="Authentication Error" message={errorMessage} />;
        }

        const responseData = await externalResponse.json();
        const phoneNumber = responseData.phone;

        if (!phoneNumber) {
             return <ErrorDisplay title="Authentication Error" message="Phone number not found in validation response." />;
        }

        // Now, find the borrower ID using the phone number by calling our internal API
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
        const internalReqUrl = `${baseUrl}/api/ussd/borrowers?phoneNumber=${phoneNumber}`;

        const internalResponse = await fetch(internalReqUrl, { cache: 'no-store' });
        
        if (!internalResponse.ok) {
             return <ErrorDisplay title="Profile Error" message="Could not find a matching user profile in the system." />;
        }

        const borrowerData = await internalResponse.json();
        const borrowerId = borrowerData.id;

        if (!borrowerId) {
            return <ErrorDisplay title="Profile Error" message="User profile is incomplete or missing a unique ID." />;
        }

        redirect(`/loan?borrowerId=${borrowerId}`);

    } catch (error: any) {
        return <ErrorDisplay title="Network Error" message={`Could not connect to the authentication service. Please try again later. Details: ${error.message}`} />;
    }
}
