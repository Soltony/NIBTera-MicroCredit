import { NextRequest, NextResponse } from 'next/server';

// This is a placeholder for a real SignalR hub negotiation endpoint.
// In a real application, this would be handled by a server that supports SignalR,
// like an ASP.NET Core application.
// For the purpose of this example, we'll return a mock negotiation response
// to satisfy the client, although real-time communication won't be functional
// without a proper SignalR server.

export async function POST(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    // The client will send a POST request to this endpoint for negotiation
    // The negotiateVersion query param is not actually needed for this mock.
    return NextResponse.json({
        negotiateVersion: 1,
        connectionId: 'mock-connection-id-' + Math.random().toString(36).substring(2, 15),
        availableTransports: [
            {
                transport: "WebSockets",
                transferFormats: ["Text", "Binary"]
            }
        ]
    });
}

export async function GET(req: NextRequest) {
    // SignalR clients may sometimes use GET for connection attempts
    return new NextResponse('SignalR hub is running.', { status: 200 });
}
