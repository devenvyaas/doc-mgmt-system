import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { logger } from '@/lib/logger';

export async function middleware(request: NextRequest) {
  const startTime = Date.now();
  const pathname = request.nextUrl.pathname;
  const method = request.method;

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/+$/, ''),
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim(),
    {
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
    }
  );

  // Refresh auth session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protected routes check
  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/register');
  const isProtectedRoute =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/documents') ||
    pathname.startsWith('/profile') ||
    pathname.startsWith('/admin');
  const isAdminRoute = pathname.startsWith('/admin');

  let finalResponse = supabaseResponse;

  if (user && isAuthRoute) {
    finalResponse = NextResponse.redirect(new URL('/dashboard', request.url));
  } else if (!user && isProtectedRoute) {
    const url = new URL('/login', request.url);
    url.searchParams.set('redirectTo', pathname);
    finalResponse = NextResponse.redirect(url);
  } else if (user && isAdminRoute) {
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
      return NextResponse.redirect(new URL('/dashboard', request.url));
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
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
