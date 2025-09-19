

'use client';

import React, { useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { LoanApplication, RequiredDocument, UploadedDocument } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, CheckCircle, Clock, File, FileCheck, Loader2, Upload, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';


interface UploadClientProps {
    application: LoanApplication;
}

interface UploadStatus {
    [key: string]: {
        isUploading: boolean;
        fileName?: string;
        status?: 'PENDING' | 'APPROVED' | 'REJECTED';
    };
}

export function UploadClient({ application }: UploadClientProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    
    const [uploadedDocs, setUploadedDocs] = useState<UploadedDocument[]>(application.uploadedDocuments || []);
    const [uploadStatus, setUploadStatus] = useState<UploadStatus>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);

    const requiredDocs = useMemo(() => application.product.requiredDocuments || [], [application]);

    const allDocumentsUploaded = useMemo(() => {
        return requiredDocs.every(reqDoc => 
            uploadedDocs.some(upDoc => upDoc.requiredDocumentId === reqDoc.id)
        );
    }, [requiredDocs, uploadedDocs]);
    
    const providerColor = application.product.provider.colorHex || '#fdb913';

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>, requiredDocId: string) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setUploadStatus(prev => ({ ...prev, [requiredDocId]: { isUploading: true } }));

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('applicationId', application.id);
            formData.append('requiredDocId', requiredDocId);

            const response = await fetch('/api/applications/documents', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Upload failed');
            }

            const newUpload: UploadedDocument = await response.json();
            setUploadedDocs(prev => {
                const otherDocs = prev.filter(d => d.requiredDocumentId !== requiredDocId);
                return [...otherDocs, newUpload];
            });

            toast({ title: 'Success', description: `${file.name} uploaded successfully.` });
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setUploadStatus(prev => ({ ...prev, [requiredDocId]: { isUploading: false } }));
        }
    };
    
    const handleSubmitForReview = async () => {
         setIsSubmitting(true);
        try {
            const response = await fetch('/api/applications/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ applicationId: application.id }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to submit application.');
            }
            
            toast({
                title: 'Application Submitted',
                description: 'Your application is now pending review.',
            });
            
            // Redirect to a confirmation/status page
            const params = new URLSearchParams(searchParams.toString());
            params.delete('applicationId');
            router.push(`/loan?${params.toString()}`);

        } catch (error: any) {
             toast({ title: 'Submission Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
            setIsConfirming(false);
        }
    };


    const handleBack = () => {
        const params = new URLSearchParams(searchParams.toString());
        params.delete('applicationId');
        router.push(`/loan?${params.toString()}`);
    };

    return (
        <div className="flex flex-col min-h-screen bg-background">
            <header className="sticky top-0 z-40 w-full border-b" style={{ backgroundColor: providerColor }}>
                <div className="container flex h-16 items-center">
                    <div className="flex items-center">
                        <Button variant="ghost" size="icon" onClick={handleBack} className="mr-2 text-primary-foreground hover:bg-white/20">
                            <ArrowLeft className="h-6 w-6" />
                        </Button>
                        <h1 className="text-lg font-semibold tracking-tight text-primary-foreground">Upload Documents</h1>
                    </div>
                </div>
            </header>
            <main className="flex-1">
                <div className="container py-8 md:py-12 max-w-3xl mx-auto">
                    <Card>
                        <CardHeader>
                            <CardTitle>Required Documents for {application.product.name}</CardTitle>
                            <CardDescription>
                                Please upload all the required documents listed below to proceed with your application.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {requiredDocs.map(doc => {
                                const uploadedDoc = uploadedDocs.find(ud => ud.requiredDocumentId === doc.id);
                                const currentStatus = uploadStatus[doc.id];
                                
                                return (
                                    <div key={doc.id} className="border p-4 rounded-lg flex items-center justify-between">
                                        <div className="space-y-1">
                                            <p className="font-medium">{doc.name}</p>
                                            <p className="text-sm text-muted-foreground">{doc.description}</p>
                                            {uploadedDoc && !currentStatus?.isUploading && (
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground pt-1">
                                                    <FileCheck className="h-4 w-4 text-green-600"/>
                                                    <span>{uploadedDoc.fileName}</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                             {currentStatus?.isUploading ? (
                                                <Loader2 className="h-5 w-5 animate-spin" />
                                            ) : uploadedDoc ? (
                                                <div className="flex items-center gap-1 text-sm text-green-600 font-medium">
                                                    <CheckCircle className="h-5 w-5"/>
                                                    <span>Uploaded</span>
                                                </div>
                                            ) : (
                                                <Button asChild variant="outline" size="sm">
                                                    <label htmlFor={`file-upload-${doc.id}`} className="cursor-pointer">
                                                        <Upload className="h-4 w-4 mr-2"/>
                                                        Upload File
                                                        <input 
                                                            id={`file-upload-${doc.id}`} 
                                                            type="file" 
                                                            className="hidden" 
                                                            onChange={(e) => handleFileChange(e, doc.id)}
                                                        />
                                                    </label>
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            {requiredDocs.length === 0 && (
                                <p className="text-center text-muted-foreground py-8">No documents are required for this loan product.</p>
                            )}
                        </CardContent>
                        <CardFooter>
                            <Button 
                                className="w-full text-white" 
                                style={{backgroundColor: providerColor}}
                                disabled={!allDocumentsUploaded || isSubmitting}
                                onClick={() => setIsConfirming(true)}
                            >
                                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin"/>}
                                Submit for Review
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            </main>
             <AlertDialog open={isConfirming} onOpenChange={setIsConfirming}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Submit Application?</AlertDialogTitle>
                        <AlertDialogDescription>
                            You have uploaded all the required documents. Are you sure you want to submit your application for review? You won't be able to change the documents after this point.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleSubmitForReview} style={{ backgroundColor: providerColor }} className="text-white">
                            Confirm & Submit
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}


    