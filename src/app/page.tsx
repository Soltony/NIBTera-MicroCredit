
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Always redirect to the eligibility check, which will handle the default provider
    router.replace('/check-eligibility');
  }, [router]);

  return (
    <div className="flex flex-col min-h-screen bg-background items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <h2 className="text-xl font-semibold">Loading...</h2>
        <p className="text-muted-foreground">Please wait a moment.</p>
      </div>
    </div>
  );
}
