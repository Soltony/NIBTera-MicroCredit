
import { NextRequest, NextResponse } from 'next/server';
import { decryptJwt } from '@/lib/session';
import { allMenuItems } from './lib/menu-items';
import type { Permissions } from '@/lib/types';

// Helper: resolve allowed roles for a given path. First try menu item config,
// then fall back to a small API-prefix -> menu path mapping for common admin APIs.
function getAllowedRolesForPath(path: string): string[] | undefined {
  const route = allMenuItems.find(item => path.startsWith(item.path));
  const maybe = (route as any)?.allowedRoles;
  if (maybe && Array.isArray(maybe) && maybe.length > 0) return maybe.map((r: any) => String(r));

  // Fallback mapping for API prefixes to menu paths (so APIs can inherit menu's allowedRoles)
  const apiPrefixToMenuPath: Record<string, string> = {
    '/api/audit-logs': '/admin/audit-logs',
    '/api/approvals': '/admin/approvals',
    '/api/roles': '/admin/access-control',
    '/api/settings': '/admin/settings',
    '/api/providers': '/admin/providers',
    '/api/users': '/admin/users',
    '/api/reports': '/admin/reports',
  };

  for (const prefix in apiPrefixToMenuPath) {
    if (path.startsWith(prefix)) {
      const menuPath = apiPrefixToMenuPath[prefix];
      const menuItem = allMenuItems.find(item => item.path === menuPath);
      const ar = (menuItem as any)?.allowedRoles;
      if (ar && Array.isArray(ar) && ar.length > 0) return ar.map((r: any) => String(r));
    }
  }

  return undefined;
}

const protectedAdminRoutes = ['/admin', '/api/admin', '/api/audit-logs', '/api/approvals', '/api/roles', '/api/settings', '/api/providers', '/api/users', '/api/reports'];
const publicRoutes = ['/admin/login', '/loan/connect', '/admin/change-password'];

// Only run the middleware for admin UI pages and selected admin API routes.
export const config = {
  matcher: [
    '/admin/:path*',
    '/admin',
    '/api/admin/:path*',
    '/api/admin',
    '/api/audit-logs/:path*',
    '/api/audit-logs',
    '/api/approvals/:path*',
    '/api/approvals',
    '/api/roles/:path*',
    '/api/roles',
    '/api/settings/:path*',
    '/api/settings',
    '/api/providers/:path*',
    '/api/providers',
    '/api/users/:path*',
    '/api/users',
    '/api/reports/:path*',
    '/api/reports',
  ],
};

export default async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  // ✅ Edge-safe nonce using Web Crypto
  const nonce = btoa(self.crypto.randomUUID()); // base64 encode UUID

  // Build CSP header
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic';
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    font-src 'self' https://fonts.gstatic.com;
    img-src 'self' data: blob: https://placehold.co https://play-lh.googleusercontent.com https://github.com;
    connect-src 'self';
    frame-ancestors 'self';
    media-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    worker-src 'self';
    manifest-src 'self';
  `.replace(/\s{2,}/g, ' ').trim();

  // Clone request headers and add nonce
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', cspHeader);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  // Set security headers
  response.headers.set('Content-Security-Policy', cspHeader);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');

  // --- START PERMISSION-BASED ROUTE PROTECTION ---
  const isProtected = protectedAdminRoutes.some((prefix) => path.startsWith(prefix));

  if (isProtected && !publicRoutes.includes(path)) {
    // Fetch authoritative session info from server API (for permissions & state)
    const cookieHeader = req.headers.get('cookie') || '';
    let sessionResp: Response | null = null;
    try {
      sessionResp = await fetch(new URL('/api/auth/session', req.nextUrl.origin).toString(), { headers: { cookie: cookieHeader } });
    } catch (e) {
      console.error('Failed to fetch session in middleware:', e);
      if (path.startsWith('/api/')) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/admin/login', req.nextUrl.origin).toString());
    }

    if (!sessionResp || !sessionResp.ok) {
      if (path.startsWith('/api/')) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/admin/login', req.nextUrl.origin).toString());
    }

    const session = await sessionResp.json();

    // 2. If password change is required, force redirect to change password page
    if (session.passwordChangeRequired && path !== '/admin/change-password' && !path.startsWith('/api/auth/change-password')) {
        return NextResponse.redirect(new URL('/admin/change-password', req.nextUrl.origin).toString());
    }
    if (!session.passwordChangeRequired && path === '/admin/change-password') {
         return NextResponse.redirect(new URL('/admin', req.nextUrl.origin).toString());
    }

    // Permissions are returned from the session API as an authoritative source
    let permissions: Permissions = {};
    try {
      permissions = session.permissions || {};
    } catch (e) {
      console.error('Failed to parse permissions in middleware', e);
      if (path.startsWith('/api/')) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/admin/login', req.nextUrl.origin).toString());
    }

    // Derive a permission map from menu items: pathPrefix -> moduleKey
    const PERMISSION_MAP: Record<string, string> = {};
    const ORDERED_ADMIN_PAGES: string[] = [];
    for (const item of allMenuItems) {
      const moduleKey = item.label.toLowerCase().replace(/\s+/g, '-');
      PERMISSION_MAP[item.path] = moduleKey;
      ORDERED_ADMIN_PAGES.push(item.path);
    }

    // Build a set of permission keys the user has (any truthy action)
    const userPermissions = new Set<string>();
    try {
      for (const [k, v] of Object.entries(permissions || {})) {
        if (v && Object.values(v as any).some(Boolean)) {
          userPermissions.add(k.toLowerCase());
        }
      }
    } catch (e) {
      // ignore malformed permissions; leave set empty
    }

    // Find the menu item that corresponds to the path being accessed.
    const currentRouteConfig = allMenuItems.find(item => path.startsWith(item.path));

    // If user is not a Super Admin, enforce page-level access using the PERMISSION_MAP
    try {
      const isSuperAdmin = session?.role === 'Super Admin';
      if (!isSuperAdmin) {
        // Find required permission by longest-matching path prefix in PERMISSION_MAP
        let requiredPermission: string | undefined;
        let longestMatch = '';
        for (const [prefix, perm] of Object.entries(PERMISSION_MAP)) {
          if (path.startsWith(prefix) && prefix.length >= longestMatch.length) {
            longestMatch = prefix;
            requiredPermission = perm;
          }
        }

        if (requiredPermission && !userPermissions.has(requiredPermission.toLowerCase())) {
          // Find first allowed page for this user
          const firstAllowedPage = ORDERED_ADMIN_PAGES.find((pagePath) => {
            const perm = PERMISSION_MAP[pagePath];
            return perm && userPermissions.has(perm.toLowerCase());
          });

          if (path.startsWith('/api/')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
          }

          const redirectUrl = new URL((firstAllowedPage && firstAllowedPage !== '') ? firstAllowedPage : '/admin', req.nextUrl.origin);
          redirectUrl.searchParams.set('error', 'Access Denied');
          return NextResponse.redirect(redirectUrl);
        }
      }
    } catch (e) {
      console.error('Error enforcing page-permission map in middleware', e);
      // fall through to existing permission logic
    }
    // --- Dynamic role enforcement: if the menu item defines `allowedRoles`, ensure
    // the current user's role is included. `session.role` is expected to be a string
    // such as 'Logger', 'Admin', etc. If not allowed, block the request.
    try {
      const userRole = (session && session.role) ? String(session.role) : undefined;
      const allowedRoles: string[] | undefined = (currentRouteConfig as any)?.allowedRoles;
      if (allowedRoles && allowedRoles.length > 0) {
        // Normalize role strings for comparison
        const normalizedAllowed = allowedRoles.map(r => String(r).trim().toLowerCase());
        const normalizedUserRole = userRole ? userRole.trim().toLowerCase() : undefined;
        const roleAllowed = !!(normalizedUserRole && normalizedAllowed.includes(normalizedUserRole));
        if (!roleAllowed) {
          if (path.startsWith('/api/')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
          }
          return NextResponse.redirect(new URL('/admin', req.nextUrl.origin).toString());
        }
      }
    } catch (e) {
      console.error('Error enforcing allowedRoles in middleware', e);
      // Fall through to existing permission checks; do not block on failure here.
    }
    
    // If the path is a defined route in our menu system, check permissions.
    if (currentRouteConfig) {
      const moduleName = currentRouteConfig.label.toLowerCase().replace(/\s+/g, '-');
      const hasPermission = !!permissions[moduleName]?.read;

      if (!hasPermission) {
        if (path.startsWith('/api/')) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        return NextResponse.redirect(new URL('/admin', req.nextUrl.origin).toString());
      }
    } else if (path !== '/admin' && !path.startsWith('/api/')) {
      // If the path is not the base '/admin' path and not found in our menu items,
      // it's an invalid UI route, so redirect to the base admin page.
      return NextResponse.redirect(new URL('/admin', req.nextUrl.origin).toString());
    }
  }

  return response;
}
