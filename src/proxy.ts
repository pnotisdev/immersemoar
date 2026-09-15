import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Optimistic auth redirect based on cookie presence only (no DB hit).
// Real authorization happens in requireUser() on the server.
const PUBLIC_AUTH_PAGES = ["/login", "/signup"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(getSessionCookie(request));

  // Signed-in users never see the marketing page or the auth forms.
  if (pathname === "/" || PUBLIC_AUTH_PAGES.includes(pathname)) {
    if (hasSession) return NextResponse.redirect(new URL("/dashboard", request.url));
    return NextResponse.next();
  }

  if (!hasSession) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Everything except API routes, Next internals, and static files.
    "/((?!api|_next/static|_next/image|favicon.ico|.*\..*).*)",
  ],
};
