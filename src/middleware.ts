import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";

// /api/* routes authenticate themselves (bearer secret, webhook signature).
// /offer/ (singular — NOT /offers/, which is the authenticated agent-facing
// list/detail) is the buyer-facing purchase-offer link: no session, the
// unguessable token in the URL itself is the auth. See OfferRecord's doc
// comment in lib/types.ts and src/app/offer/[token]/page.tsx.
// /remax-logo.png: the middleware's matcher (below) only exempts
// _next/static/_next/image/favicon.ico, not public/ assets in general — an
// anonymous buyer's browser loading this logo <img> on the /offer/ thank-you
// page would otherwise get redirected to /login for the image request itself.
// /r/ is the public referral-response page the WhatsApp invite links to —
// deliberately unauthenticated (see src/app/r/[id]/page.tsx), the opaque
// UUID in the path is its own "auth".
const PUBLIC_PATHS = ["/login", "/api/", "/offer/", "/remax-logo.png", "/r/"];

/** Memorable one-click deep links agents can be sent (WhatsApp, printed,
 *  bookmarked) — always land on the destination, through login first if
 *  there's no session yet. Extend this map for future deep links. */
const DEEP_LINKS: Record<string, string> = {
  "/sikkum": "/deals/new",
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const deepLinkTarget = DEEP_LINKS[pathname];
  if (deepLinkTarget) {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    const session = token ? await verifySession(token) : null;
    const url = request.nextUrl.clone();
    if (session) {
      url.pathname = deepLinkTarget;
      url.search = "";
    } else {
      url.pathname = "/login";
      url.search = `?next=${encodeURIComponent(deepLinkTarget)}`;
    }
    return NextResponse.redirect(url);
  }

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
