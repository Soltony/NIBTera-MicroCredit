
import { NextRequest, NextResponse } from 'next/server';
import { createSession, createLegacySession } from '@/lib/session';

function normalizeBearerAuthHeader(input: string): { authHeader: string; token: string } | null {
    const trimmed = String(input || '').trim();
    if (!trimmed) return null;

    // Expect Bearer; tolerate case.
    if (!trimmed.toLowerCase().startsWith('bearer ')) return null;

    let tokenPart = trimmed.slice(7).trim();
    if (!tokenPart) return null;

    // Some clients mistakenly embed JSON in the Bearer portion, e.g. Bearer {"token":"..."}
    const jsonTokenMatch = tokenPart.match(/"token"\s*:\s*"([^"]+)"/);
    if (jsonTokenMatch?.[1]) {
        tokenPart = jsonTokenMatch[1];
    }

    // Strip wrapping quotes if present.
    if (
        (tokenPart.startsWith('"') && tokenPart.endsWith('"')) ||
        (tokenPart.startsWith("'") && tokenPart.endsWith("'"))
    ) {
        tokenPart = tokenPart.slice(1, -1).trim();
    }

    if (!tokenPart) return null;

    return { authHeader: `Bearer ${tokenPart}`, token: tokenPart };
}

function snippet(text: string, maxLen = 300) {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLen) return normalized;
    return normalized.slice(0, maxLen) + '…';
}

export async function POST(req: NextRequest) {
    const TOKEN_VALIDATION_API_URL = process.env.TOKEN_VALIDATION_API_URL;
    
    if (!TOKEN_VALIDATION_API_URL) {
        return NextResponse.json({ error: "The token validation URL is not configured on the server." }, { status: 500 });
    }

    try {
        const { superAppToken } = await req.json();

        if (!superAppToken || typeof superAppToken !== 'string') {
            return NextResponse.json({ error: "Super App Token is missing or malformed." }, { status: 400 });
        }

        const normalized = normalizeBearerAuthHeader(superAppToken);
        if (!normalized) {
            return NextResponse.json({ error: "Super App Token is missing or malformed." }, { status: 400 });
        }

        const { authHeader, token } = normalized;

        let externalResponse: Response;
        try {
            externalResponse = await fetch(TOKEN_VALIDATION_API_URL, {
                method: 'GET',
                headers: {
                    Authorization: authHeader,
                    Accept: 'application/json',
                },
                cache: 'no-store',
            });
        } catch (err: any) {
            const message = err?.message || String(err);
            return NextResponse.json(
                { error: `Token validation request failed: ${message}` },
                { status: 502 },
            );
        }

        if (!externalResponse.ok) {
            const contentType = externalResponse.headers.get('content-type') || '';
            const wwwAuthenticate = externalResponse.headers.get('www-authenticate') || '';
            const rawBody = await externalResponse.text().catch(() => '');

            let errorMessage = `Token validation failed (status ${externalResponse.status}).`;
            try {
                const maybeJson = JSON.parse(rawBody || '{}');
                if (maybeJson?.message && typeof maybeJson.message === 'string') {
                    errorMessage = maybeJson.message;
                } else if (rawBody) {
                    errorMessage = `${errorMessage} Upstream response: ${snippet(rawBody)}`;
                }
            } catch {
                if (rawBody) {
                    errorMessage = `${errorMessage} Upstream response: ${snippet(rawBody)}`;
                } else if (contentType) {
                    errorMessage = `${errorMessage} Upstream content-type: ${contentType}`;
                }
            }

            return NextResponse.json(
                {
                    error: errorMessage,
                    upstreamStatus: externalResponse.status,
                    upstreamContentType: contentType,
                    upstreamWwwAuthenticate: wwwAuthenticate || undefined,
                },
                { status: externalResponse.status },
            );
        }

        const responseData = await externalResponse.json();
        let phone = responseData.phone;
        
        if (!phone) {
            return NextResponse.json({ error: "Phone number not found in validation response." }, { status: 400 });
        }
        
        // if (typeof phone === 'string' && phone.startsWith('251') && phone.length === 12) {
        //     phone = phone.substring(3);
        // }

        // Resolve the phone to a local DB user and create a DB-backed session
        const { default: prisma } = await import('@/lib/prisma');
        const user = await prisma.user.findUnique({ where: { phoneNumber: phone } });

        if (!user) {
            // No local user exists — create a legacy session cookie so the mini-app
            // can log in using only the super app token (no provisioning required).
            await createLegacySession(phone, token);
            return NextResponse.json({ borrowerId: phone, userId: null, legacy: true }, { status: 200 });
        }

        await createSession(user.id, token); // Pass DB user id and raw token to session

        return NextResponse.json({ borrowerId: phone, userId: user.id }, { status: 200 });

    } catch (error: any) {
        return NextResponse.json({ error: `An internal error occurred: ${error.message}` }, { status: 500 });
    }
}
