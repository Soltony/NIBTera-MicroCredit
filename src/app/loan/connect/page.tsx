
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';


// This should be an environment variable in a real application
const TOKEN_VALIDATION_API_URL = 'https://api.example.com/validate-token';

async function validateTokenAndGetPhone(authHeader: string | null): Promise<{phone?: string, error?: string}> {
  if (!authHeader) {
    // For local development, if no header is present, we can simulate a successful login.
    if (process.env.NODE_ENV === 'development') {
        console.log("Development mode: No auth header found, using mock borrower ID.");
        // In development, we return a hardcoded phone number to simulate a successful login
        return { phone: 'borrower-123' };
    }
    return { error: 'Authorization header is missing.' };
  }

  if (!authHeader.startsWith('Bearer ')) {
    return { error: 'Authorization header is malformed. It must start with "Bearer ".' };
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
        const errorBody = await externalResponse.json().catch(() => ({ message: 'Invalid or expired token.' }));
        return { error: `Token validation failed: ${errorBody.message}` };
    }

    const responseData = await externalResponse.json();
    const phoneNumber = responseData.phone;

    if (!phoneNumber) {
        return { error: 'Phone number not found in validation response.'};
    }
    
    return { phone: phoneNumber };

  } catch (error: any) {
    console.error('Token validation fetch error:', error);
    // If the external API call fails during development, simulate success to allow testing.
     if (process.env.NODE_ENV === 'development') {
        console.log("Development mode: Simulating successful login after failed API call.");
        return { phone: 'borrower-123' };
    }
    return { error: 'Could not connect to the authentication service.' };
  }
}

export default async function ConnectPage() {
  const headersList = headers();
  const authHeader = headersList.get('Authorization');
  
  const { phone, error } = await validateTokenAndGetPhone(authHeader);

  if (phone) {
    // The phone number from the super app is used as the borrowerId
    redirect(`/loan?borrowerId=${phone}`);
  }

  // If there's an error, display it to the user.
  return (
     <div className="flex items-center justify-center min-h-screen bg-muted/40">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Connection Failed</CardTitle>
          <CardDescription>
            There was a problem securely connecting you to the loan service.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Authentication Error</AlertTitle>
              <AlertDescription>{error || 'An unknown error occurred.'}</AlertDescription>
            </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
