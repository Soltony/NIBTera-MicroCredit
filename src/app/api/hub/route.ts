import { NextRequest, NextResponse } from 'next/server';

// This is a placeholder for a real SignalR hub negotiation endpoint.
// In a real application, this would be handled by a server that supports SignalR,
// like an ASP.NET Core application.
// For the purpose of this example, we'll return a mock negotiation response
// to satisfy the client, although real-time communication won't be functional
// without a proper SignalR server.

export async function POST(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    if (searchParams.has('negotiateVersion')) {
        // A minimal mock response for the negotiation phase.
        return NextResponse.json({
            negotiateVersion: 1,
            connectionId: 'mock-connection-id',
            availableTransports: [
                {
                    transport: "WebSockets",
                    transferFormats: ["Text", "Binary"]
                }
            ]
        });
    }
    
    // For other POST requests to the hub that are not negotiation
    return new NextResponse(null, { status: 204 });
}

export async function GET(req: NextRequest) {
    // SignalR clients may sometimes use GET for connection attempts
    return new NextResponse('SignalR hub is running.', { status: 200 });
}
