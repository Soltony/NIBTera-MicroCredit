
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { Logo } from '@/components/icons';

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

        redirect(`/loan?borrowerId=${phoneNumber}`);

    } catch (error: any) {
        return <ErrorDisplay title="Network Error" message={`Could not connect to the authentication service. Please try again later. Details: ${error.message}`} />;
    }
}
