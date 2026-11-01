import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// internationalpolicy.vercel.app is a dedicated alias for the nuclear-sim
// classroom game, so its root should land straight on the game instead of
// the TeacherTown login screen. Handled here (not via next.config rewrites)
// because rewrites resolve after middleware, so the auth check below would
// still catch "/" first.
export async function middleware(request: NextRequest) {
  if (
    request.nextUrl.pathname === "/" &&
    request.headers.get("host") === "internationalpolicy.vercel.app"
  ) {
    return NextResponse.redirect(new URL("/newforeignpolicy", request.url));
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    // newforeignpolicy / habitussim: clean rewritten URLs with no extension, so each
    // needs an exact exclusion (the .html group below doesn't match them, since rewrites
    // resolve after middleware, not before). Any classroom-game .html file under public/
    // is public by design (join-code access, no account), so .html joins the
    // asset-extension exclusion group rather than being listed one file at a time.
    "/((?!_next/static|_next/image|favicon.ico|api/schools/search|newforeignpolicy|habitussim|thenewhabitus|.*\\.(?:svg|png|jpg|jpeg|gif|webp|html)$).*)",
  ],
};
