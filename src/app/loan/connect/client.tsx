'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

interface ConnectClientProps {
  token: string | null;
  validationApiUrl: string;
}

export function ConnectClient({ token, validationApiUrl }: ConnectClientProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('Initializing...');

  useEffect(() => {
    const connectUser = async () => {
      if (!token) {
        setError('Authorization token is missing.');
        setStatus('Authentication Failed');
        return;
      }

      try {
        // STEP 02. VALIDATE API TOKEN
        setStatus('Validating session...');
        const response = await fetch(validationApiUrl, {
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Session validation failed.');
        }

        const data = await response.json();
        const phoneNumber = data.phone;

        if (!phoneNumber) {
          throw new Error('Phone number not found in validation response.');
        }
        
        // Find borrower by phone number in our system
        setStatus('Finding user profile...');
        const borrowerResponse = await fetch(`/api/ussd/borrowers?phoneNumber=${phoneNumber}`);
        if (!borrowerResponse.ok) {
            throw new Error('Could not find a matching user profile in our system.');
        }

        const borrowerData = await borrowerResponse.json();
        const borrowerId = borrowerData.id;

        if (!borrowerId) {
            throw new Error('User profile is incomplete.');
        }

        // Redirect to the main loan dashboard
        setStatus('Redirecting...');
        router.replace(`/loan?borrowerId=${borrowerId}`);

      } catch (err: any) {
        setError(err.message || 'An unknown error occurred.');
        setStatus('Authentication Failed');
      }
    };

    connectUser();
  }, [token, router, validationApiUrl]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/40">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Secure Connection</CardTitle>
          <CardDescription>
            Please wait while we securely connect you to the loan service.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">{status}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}