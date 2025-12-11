import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/register'];
  const isPublicRoute = publicRoutes.some(route => request.nextUrl.pathname.startsWith(route));

  // Note: We can't access localStorage in middleware (server-side)
  // So we only check cookies/headers, but the main auth check happens client-side
  const token = request.cookies.get('token')?.value;

  // If accessing a protected route without token in cookie, let client-side handle it
  // (Client-side will check localStorage and redirect if needed)
  if (!isPublicRoute && !token && request.nextUrl.pathname !== '/') {
    // Don't redirect here - let client-side Layout component handle it
    // This prevents redirect loops
  }

  // If accessing login/register with token in cookie, redirect to dashboard
  if (isPublicRoute && token) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};

