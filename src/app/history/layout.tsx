
'use client'

import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";


export default function HistoryLayout({children}: {children: React.ReactNode}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleBack = () => {
    router.push(`/loan?${searchParams.toString()}`)
  }
  
  return (
    <div className="flex flex-col min-h-screen bg-background">
        <header className="sticky top-0 z-40 w-full border-b bg-background">
          <div className="container flex h-16 items-center">
            <div className="flex items-center">
                <Button variant="ghost" size="icon" onClick={handleBack} className="mr-2 text-primary hover:bg-primary/10">
                    <ArrowLeft className="h-6 w-6" />
                </Button>
               <h1 className="text-lg font-semibold tracking-tight text-foreground">
                  Loan Dashboard
              </h1>
            </div>
          </div>
        </header>
        <main className="flex-1">
            {children}
        </main>
    </div>
  );
}
