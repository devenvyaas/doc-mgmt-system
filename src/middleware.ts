import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { logger } from '@/lib/logger';
import { getSanitizedSupabaseConfig } from '@/lib/supabase/config';

export async function middleware(request: NextRequest) {
  const startTime = Date.now();
  const pathname = request.nextUrl.pathname;
  const method = request.method;

  let supabaseResponse = NextResponse.next({
    request,
  });

  const { url, anonKey } = getSanitizedSupabaseConfig();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Refresh auth session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Route classifications
  const isPublicOrAuthRoute =
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register');

  const isProtectedRoute =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/documents') ||
    pathname.startsWith('/profile') ||
    pathname.startsWith('/admin');

  const isAdminRoute = pathname.startsWith('/admin');

  let finalResponse = supabaseResponse;

  // 1. If user IS logged in and attempts to access public landing page / login / register -> Redirect to /dashboard
  if (user && isPublicOrAuthRoute) {
    finalResponse = NextResponse.redirect(new URL('/dashboard', request.url));
  }
  // 2. If user IS NOT logged in and attempts to access protected app routes -> Redirect to /
  else if (!user && isProtectedRoute) {
    finalResponse = NextResponse.redirect(new URL('/', request.url));
  }
  // 3. If user IS logged in and attempts to access admin route -> Verify admin role
  else if (user && isAdminRoute) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      logger.error({
        method,
        route: pathname,
        status: 403,
        durationMs: Date.now() - startTime,
        error: 'Forbidden: Non-admin user attempted to access admin route',
      });
      finalResponse = NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  const durationMs = Date.now() - startTime;
  const status = finalResponse.status;

  if (status >= 400) {
    logger.error({
      method,
      route: pathname,
      status,
      durationMs,
      error: `HTTP ${status} Response`,
    });
  } else {
    logger.info({
      method,
      route: pathname,
      status,
      durationMs,
    });
  }

  return finalResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|icons|assets|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
