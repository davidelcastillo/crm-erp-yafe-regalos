import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@/lib/supabase/server';
import { decideBranchAccess } from '@/middleware/branch';
import { getUserRole } from '@/lib/supabase/auth';

export async function proxy(request: NextRequest) {
  // Create a response that we can modify (for setting cookies, etc.)
  const response = NextResponse.next({
    request: {
      // Preserve the original request headers
      headers: request.headers,
    },
  });

  // Get the cookies from the request (and set them on the response via the cookie store)
  const cookieStore = await cookies();

  // Create a Supabase client configured for server use with cookie handling
  const supabase = await createServerClient();

  // Check if the user has a valid session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Define paths that should be excluded from authentication checks
  // /sucursal/* is NOT excluded here: anonymous GET requests pass through the
  // proxy without a session (the catalog action decides visibility), and
  // authenticated requests go through the branch-access guard below. The
  // portal login path no longer exists.
  // /unauthorized is excluded so the error page can always render — an
  // authenticated non-admin must NOT be redirected to /unauthorized again
  // (that caused an infinite redirect loop), and unauthenticated visitors
  // must be able to view it instead of being bounced to /login.
  const isExcluded =
    pathname === '/login' ||
    pathname === '/unauthorized' ||
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/images/') ||
    pathname.startsWith('/public/') ||
    // Assets estáticos de /public servidos desde la raíz (logo, íconos de la
    // plantilla): se sirven sin sesión. Las rutas de la app no llevan extensión
    // y, además, cada acción valida el rol por su cuenta (p. ej. `getBranches`
    // responde «No autorizado» sin admin), así que esto no abre ningún dato.
    /\.[a-z0-9]+$/i.test(pathname);

  // If no user and path is not excluded, redirect to login
  if (!user && !isExcluded) {
    // The external branch portal is public: anonymous visitors reach
    // /sucursal/* directly without a session or a redirect-to cookie.
    if (pathname.startsWith('/sucursal/')) {
      return response;
    }

    // Store the intended URL in an http-only cookie for redirect after login
    const redirectTo = request.nextUrl.pathname + request.nextUrl.search;
    cookieStore.set('redirect-to', redirectTo, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    // Redirect to login page
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // If we have a user, check additional permissions
  if (user) {
    // Check for branch-specific paths (/sucursal/*)
    if (pathname.startsWith('/sucursal/')) {
      // /sucursal/* is public for GET requests (any role or no session); only
      // the HTTP method and the URL shape are validated here.
      const accessDecision = decideBranchAccess({
        pathname,
        method: request.method,
      });

      if (!accessDecision.allowed) {
        // User is not authorized to access this branch
        return NextResponse.redirect(new URL('/unauthorized', request.url));
      }
    } else if (!isExcluded) {
      // Admin gating for internal routes (not /login, not /sucursal/*, not
      // excluded static). NOTE: strict gating depends on the `admin` claim
      // being backfilled to the existing admin user first (order: backfill
      // -> gating) — see scripts/backfill-admin-claim.mjs. Without the
      // backfill, admins without the claim would be locked out.
      const role = await getUserRole();
      if (role !== 'admin') {
        return NextResponse.redirect(new URL('/unauthorized', request.url));
      }
    }
  }

  // If user is present or path is excluded, continue with the request
  // (Note: any cookies set by the Supabase client or our redirect-to cookie will be attached to the response)
  return response;
}

// Configure the middleware to run on all paths
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
    // However, note that we also want to exclude our custom exclusions (/sucursal/*, /images/*, /public/*)
    // but we handle that in the middleware logic above.
    // The matcher above is just to avoid running on static assets that we know are safe.
    // We'll handle the other exclusions in the middleware function.
  ],
};