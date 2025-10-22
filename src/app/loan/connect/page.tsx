
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { Logo } from '@/components/icons';

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
    const headersList = headers();
    const authHeader = headersList.get('Authorization');

    if (!authHeader) {
        return <ErrorDisplay title="Authentication Error" message="Authorization header is missing from the request." />;
    }
    
    try {
        // We need to use the absolute URL for the API route when fetching from a Server Component
        const host = headersList.get('host');
        const protocol = host?.includes('localhost') ? 'http' : 'https';
        const absoluteUrl = `${protocol}://${host}/api/auth/connect`;

        const connectResponse = await fetch(absoluteUrl, {
            method: 'POST',
            headers: {
                'Authorization': authHeader,
            },
            cache: 'no-store'
        });

        if (!connectResponse.ok) {
            const errorData = await connectResponse.json();
            return <ErrorDisplay title="Authentication Error" message={errorData.error || 'Session creation failed.'} />;
        }

        const { borrowerId } = await connectResponse.json();
        
        if (borrowerId) {
            redirect(`/loan?borrowerId=${borrowerId}`);
        } else {
             return <ErrorDisplay title="Processing Error" message="Borrower ID not found after authentication." />;
        }

    } catch (error: any) {
        if (error.digest?.startsWith('NEXT_REDIRECT')) {
            throw error;
        }
        return <ErrorDisplay title="Connection Error" message={`An internal error occurred. Details: ${error.message}`} />;
    }
}
