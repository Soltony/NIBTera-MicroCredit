
import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { createSession } from '@/lib/session';

export async function POST(req: NextRequest) {
    const TOKEN_VALIDATION_API_URL = process.env.TOKEN_VALIDATION_API_URL;

    if (!TOKEN_VALIDATION_API_URL) {
        console.error("Configuration Error: TOKEN_VALIDATION_API_URL is not set.");
        return NextResponse.json({ error: "The application is not configured correctly." }, { status: 500 });
    }

    try {
        const headersList = headers();
        const authHeader = headersList.get('Authorization');
        
        if (!authHeader) {
            return NextResponse.json({ error: 'Authorization header is missing from the request.' }, { status: 400 });
        }
        
        if (!authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Authorization header is malformed. It must start with Bearer.' }, { status: 400 });
        }
        
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
            return NextResponse.json({ error: 'Phone number not found in validation response.' }, { status: 400 });
        }
        
        if (typeof phone === 'string' && phone.startsWith('251') && phone.length === 12) {
            phone = phone.substring(3);
        }

        // This is a valid context to set cookies
        await createSession(phone, authHeader);

        return NextResponse.json({ borrowerId: phone });

    } catch (error: any) {
        console.error("Connect API Error:", error);
        return NextResponse.json({ error: `Could not connect to the authentication service. Details: ${error.message}` }, { status: 500 });
    }
}
