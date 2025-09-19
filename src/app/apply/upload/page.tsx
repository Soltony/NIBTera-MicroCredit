
// This file can be a placeholder for now.
// We will implement the client component in the next step.

import { Loader2 } from "lucide-react";

export default function UploadDocumentsPage() {
    return (
        <div className="flex flex-col min-h-screen bg-background items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <h2 className="text-xl font-semibold">Loading Application...</h2>
                <p className="text-muted-foreground">Preparing your document upload checklist.</p>
            </div>
        </div>
    );
}
