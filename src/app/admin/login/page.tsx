
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useEffect } from 'react';

export default function AdminLoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const { toast } = useToast();
  const [csrfReady, setCsrfReady] = useState<boolean | null>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      try {
        const detail = (e as CustomEvent).detail;
        setCsrfReady(Boolean(detail?.ok));
        setCsrfToken(detail?.token || null);
      } catch {
        setCsrfReady(false);
        setCsrfToken(null);
      }
    };
    window.addEventListener('csrf-ready', handler as EventListener);
    // If nothing has produced the event, attempt to fetch ourselves by
    // calling the CSRF endpoint (FetchCsrfOnMount will also do this;
    // this is a noop fallback).
    (async () => {
      if (csrfReady === null) {
        try {
          const r = await fetch('/api/auth/csrf');
          if (r.ok) {
            const j = await r.json();
            setCsrfReady(true);
            setCsrfToken(j?.csrfToken || null);
          } else {
            setCsrfReady(false);
            setCsrfToken(null);
          }
        } catch (e) {
          setCsrfReady(false);
          setCsrfToken(null);
        }
      }
    })();

    return () => window.removeEventListener('csrf-ready', handler as EventListener);
  }, []);
  
  const nibBankColor = '#fdb913';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    // Ensure CSRF cookie/token was fetched earlier on page load
    if (!csrfReady) {
      setError('CSRF token missing. Refresh the page to obtain a session token.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await login(phoneNumber, password, csrfToken);
      router.push('/admin');
      router.refresh(); // This is important to re-fetch server-side data
      toast({
        title: 'Login Successful',
        description: 'Welcome back!',
      });
    } catch (err: any) {
      // If the error includes structured rate-limit info, build a clearer message
      let msg = err.message || 'An unexpected error occurred.';
      if (err.retriesLeft !== undefined) {
        msg = `${msg} — ${err.retriesLeft} attempts left.`;
      }
      if (err.delaySeconds !== undefined && err.delaySeconds > 0) {
        msg = `${msg} (wait ${err.delaySeconds}s)`;
      }
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/40">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
                <Image src="https://play-lh.googleusercontent.com/HR87m6M2_7ZmPGrSp_MSlmfG5uyx94iYthItSzrmWVgFWkJ3FPTOYCLPw0F_ul4mYg" alt="Logo" width={40} height={40} className="h-10 w-10" />
            </div>
          <CardTitle className="text-2xl">Admin Login</CardTitle>
          <CardDescription>
            Enter your credentials to access the admin dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FetchCsrfOnMount />
          <form onSubmit={handleLogin} className="space-y-4">
            {csrfReady === false && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>CSRF Token Missing</AlertTitle>
                <AlertDescription>Unable to obtain CSRF token. Login is disabled until the token is fetched.</AlertDescription>
              </Alert>
            )}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Login Failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <Input
                id="phoneNumber"
                type="tel"
                placeholder="e.g., 0912345678"
                required
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
            </div>
            <div className="space-y-2 relative">
              <Label htmlFor="password">Password</Label>
               <Input
                id="password"
                type={isPasswordVisible ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
              />
               <button
                type="button"
                onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                className="absolute right-3 top-9 h-5 w-5 text-muted-foreground"
              >
                {isPasswordVisible ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
             <Button type="submit" className="w-full text-white" disabled={isLoading || csrfReady === false || csrfReady === null} style={{ backgroundColor: nibBankColor }}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign In
             </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// Fetch CSRF token on page mount so the cookie is set before login attempts.
// This helps the mini-app and prevents logins without an authoritative CSRF cookie.
function FetchCsrfOnMount() {
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/auth/csrf');
        if (!mounted) return;
        if (res.ok) {
          const j = await res.json();
          // token returned and cookie should be set by the API route
          // signal readiness and include the raw token in the event detail
          window.dispatchEvent(new CustomEvent('csrf-ready', { detail: { ok: true, token: j?.csrfToken || null } }));
        } else {
          window.dispatchEvent(new CustomEvent('csrf-ready', { detail: { ok: false, token: null } }));
        }
      } catch (e) {
        if (!mounted) return;
        window.dispatchEvent(new CustomEvent('csrf-ready', { detail: { ok: false, token: null } }));
      }
    })();
    return () => { mounted = false; };
  }, []);
  return null;
}
