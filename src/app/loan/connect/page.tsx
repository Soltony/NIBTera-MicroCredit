
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { Logo } from '@/components/icons';
import { createSession } from '@/lib/session';

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
    const TOKEN_VALIDATION_API_URL = process.env.TOKEN_VALIDATION_API_URL;
    const headersList = headers();
    const authHeader = headersList.get('Authorization');

    if (!TOKEN_VALIDATION_API_URL) {
        return <ErrorDisplay title="Configuration Error" message="The application is not configured correctly." />;
    }

    if (!authHeader) {
        return <ErrorDisplay title="Authentication Error" message="Authorization header is missing from the request." />;
    }
    
    if (!authHeader.startsWith('Bearer ')) {
        return <ErrorDisplay title="Authentication Error" message="Authorization header is malformed. It must start with Bearer." />;
    }

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
        let phone = responseData.phone;
        
        if (!phone) {
            return <ErrorDisplay title="Authentication Error" message="Phone number not found in validation response." />;
        }
        
        if (typeof phone === 'string' && phone.startsWith('251') && phone.length === 12) {
            phone = phone.substring(3);
        }

        // Create the session and set the cookie
        await createSession(phone, authHeader);
        
        // Redirect the user
        redirect(`/loan?borrowerId=${phone}`);

    } catch (error: any) {
        // A redirect call can throw an error, which we don't want to catch.
        // We rethrow it to let Next.js handle it.
        if (error.digest?.startsWith('NEXT_REDIRECT')) {
            throw error;
        }
        return <ErrorDisplay title="Connection Error" message={`An internal error occurred. Details: ${error.message}`} />;
    }
}
