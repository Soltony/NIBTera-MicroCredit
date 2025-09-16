
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { LoanProvider, LoanProduct, LoanApplication, UploadedDocument, RequiredDocument } from '@/lib/types';
import { ArrowLeft, Loader2, Upload, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

export function ApplyUploadClient({ provider, product, borrowerId }: { provider: LoanProvider, product: LoanProduct, borrowerId: string }) {
    const router = useRouter();
    const { toast } = useToast();
    const [application, setApplication] = useState<LoanApplication | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const fileInputRefs = React.useRef<Record<string, React.RefObject<HTMLInputElement>>>({});

    const createOrFetchApplication = useCallback(async () => {
        try {
            const response = await fetch('/api/applications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ borrowerId, productId: product.id }),
            });
            if (!response.ok) throw new Error('Failed to create or fetch loan application.');
            const appData = await response.json();
            setApplication(appData);
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    }, [borrowerId, product.id, toast]);

    useEffect(() => {
        createOrFetchApplication();
    }, [createOrFetchApplication]);
    
    if (product.requiredDocuments) {
        product.requiredDocuments.forEach(doc => {
            if (!fileInputRefs.current[doc.id]) {
                fileInputRefs.current[doc.id] = React.createRef<HTMLInputElement>();
            }
        });
    }
    
    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, requiredDocId: string) => {
        const file = event.target.files?.[0];
        if (!file || !application) return;

        setIsSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('loanApplicationId', application.id);
            formData.append('requiredDocumentId', requiredDocId);

            const response = await fetch('/api/applications/documents', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to upload document.');
            }
            
            const newApplicationState = await response.json();
            setApplication(newApplicationState);
            toast({ title: 'Success', description: `Document "${file.name}" uploaded successfully.`});

        } catch(error: any) {
             toast({ title: 'Upload Failed', description: error.message, variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
            if (event.target) event.target.value = ''; // Reset file input
        }
    };
    
    const handleBack = () => {
        router.back();
    };

    const uploadedDocsMap = useMemo(() => {
        if (!application?.uploadedDocuments) return {};
        return application.uploadedDocuments.reduce((acc, doc) => {
            acc[doc.requiredDocumentId] = doc;
            return acc;
        }, {} as Record<string, UploadedDocument>);
    }, [application]);

    const allDocumentsUploaded = product.requiredDocuments?.every(doc => !!uploadedDocsMap[doc.id]);

    const progressPercentage = useMemo(() => {
        if (!product.requiredDocuments || product.requiredDocuments.length === 0) return 100;
        const uploadedCount = Object.keys(uploadedDocsMap).length;
        return (uploadedCount / product.requiredDocuments.length) * 100;
    }, [product.requiredDocuments, uploadedDocsMap]);

    if (isLoading) {
        return (
             <div className="flex flex-col min-h-screen bg-background items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="mt-4 text-muted-foreground">Preparing your application...</p>
            </div>
        )
    }
    
    const handleSubmitApplication = async () => {
        if (!application) return;
        setIsSubmitting(true);
        try {
             const response = await fetch(`/api/applications?id=${application.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'PENDING_REVIEW' }),
             });
             if (!response.ok) throw new Error('Failed to submit application.');
             const updatedApp = await response.json();
             setApplication(updatedApp);
             toast({ title: 'Application Submitted', description: 'Your application is now pending review.' });
        } catch(error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    }


    return (
        <div className="flex flex-col min-h-screen bg-background">
            <header className="sticky top-0 z-40 w-full border-b" style={{ backgroundColor: provider?.colorHex || 'hsl(var(--primary))' }}>
                <div className="container flex h-16 items-center">
                    <div className="flex items-center">
                        <Button variant="ghost" size="icon" onClick={handleBack} className="mr-2 text-primary-foreground hover:bg-white/20">
                            <ArrowLeft className="h-6 w-6" />
                        </Button>
                        <h1 className="text-lg font-semibold tracking-tight text-primary-foreground">SME Loan Application</h1>
                    </div>
                </div>
            </header>
            <main className="flex-1">
                <div className="container py-8 md:py-12">
                   <Card className="max-w-3xl mx-auto">
                       <CardHeader>
                            <CardTitle>{product.name}</CardTitle>
                            <CardDescription>Please upload all required documents to proceed with your application for a loan from {provider.name}.</CardDescription>
                       </CardHeader>
                       <CardContent>
                           <div className="mb-6 space-y-2">
                               <Progress value={progressPercentage} style={{'--primary': provider.colorHex} as React.CSSProperties}/>
                               <p className="text-sm text-muted-foreground text-center">{Math.round(progressPercentage)}% Complete</p>
                           </div>

                           <div className="space-y-4">
                                {product.requiredDocuments?.map(doc => {
                                    const uploadedDoc = uploadedDocsMap[doc.id];
                                    return (
                                        <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg">
                                            <div>
                                                <p className="font-medium">{doc.name}</p>
                                                {uploadedDoc ? (
                                                    <div className="flex items-center gap-2 text-sm text-green-600">
                                                        <CheckCircle2 className="h-4 w-4" />
                                                        <span>{uploadedDoc.fileName}</span>
                                                    </div>
                                                ) : (
                                                     <p className="text-sm text-muted-foreground">Pending Upload</p>
                                                )}
                                            </div>
                                            <Button 
                                                variant="outline"
                                                size="sm"
                                                onClick={() => fileInputRefs.current[doc.id]?.current?.click()}
                                                disabled={isSubmitting || application?.status !== 'PENDING_DOCUMENTS'}
                                            >
                                                <Upload className="h-4 w-4 mr-2" />
                                                {uploadedDoc ? 'Re-upload' : 'Upload'}
                                            </Button>
                                             <input
                                                type="file"
                                                ref={fileInputRefs.current[doc.id]}
                                                className="hidden"
                                                onChange={(e) => handleFileUpload(e, doc.id)}
                                            />
                                        </div>
                                    )
                                })}
                           </div>
                           
                           {application?.status === 'PENDING_REVIEW' && (
                                <div className="mt-6 p-4 bg-yellow-100 border border-yellow-300 text-yellow-800 rounded-lg text-center">
                                    <p className="font-semibold">Your application is currently under review.</p>
                                    <p className="text-sm">You will be notified once the review is complete.</p>
                                </div>
                           )}
                           
                       </CardContent>
                       {application?.status === 'PENDING_DOCUMENTS' && (
                            <CardContent>
                                <Button 
                                    className="w-full text-white" 
                                    style={{backgroundColor: provider.colorHex}}
                                    disabled={!allDocumentsUploaded || isSubmitting}
                                    onClick={handleSubmitApplication}
                                >
                                    {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                                    Submit Application for Review
                                </Button>
                            </CardContent>
                       )}
                   </Card>
                </div>
            </main>
        </div>
    );
}
