
import { NextRequest, NextResponse } from 'next/server';
import { createSession } from '@/lib/session';

export async function POST(req: NextRequest) {
    const TOKEN_VALIDATION_API_URL = process.env.TOKEN_VALIDATION_API_URL;
    
    if (!TOKEN_VALIDATION_API_URL) {
        return NextResponse.json({ error: "The token validation URL is not configured on the server." }, { status: 500 });
    }

    try {
        const { superAppToken } = await req.json();

        if (!superAppToken) {
            return NextResponse.json({ error: "Super App Token is missing." }, { status: 400 });
        }
        
        const authHeader = `Bearer ${superAppToken}`;

        const externalResponse = await fetch(TOKEN_VALIDATION_API_URL, {
            method: 'GET',
            headers: {
                Authorization: authHeader,
                Accept: 'application/json',
            },
            cache: 'no-store',
        });

        if (!externalResponse.ok) {
            let errorMessage = 'Token validation failed with an unknown error.';
            try {
                const errorData = await externalResponse.json();
                errorMessage = errorData.message || `Token validation failed with status: ${externalResponse.status}`;
            } catch (e) {
                // Ignore if response is not JSON
            }
            return NextResponse.json({ error: errorMessage }, { status: externalResponse.status });
        }

        const responseData = await externalResponse.json();
        let phone = responseData.phone;
        
        if (!phone) {
            return NextResponse.json({ error: "Phone number not found in validation response." }, { status: 400 });
        }
        
        if (typeof phone === 'string' && phone.startsWith('251') && phone.length === 12) {
            phone = phone.substring(3);
        }

        // Create the session and set the cookie
        await createSession(phone, superAppToken);
        
        return NextResponse.json({ borrowerId: phone }, { status: 200 });

    } catch (error: any) {
        return NextResponse.json({ error: `An internal error occurred: ${error.message}` }, { status: 500 });
    }
}
