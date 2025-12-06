
import { NextRequest, NextResponse } from 'next/server';

// SignalR negotiation endpoint removed

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
