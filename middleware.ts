import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // newforeignpolicy / habitussim: clean rewritten URLs with no extension, so each
    // needs an exact exclusion (the .html group below doesn't match them, since rewrites
    // resolve after middleware, not before). Any classroom-game .html file under public/
    // is public by design (join-code access, no account), so .html joins the
    // asset-extension exclusion group rather than being listed one file at a time.
    "/((?!_next/static|_next/image|favicon.ico|api/schools/search|newforeignpolicy|habitussim|.*\\.(?:svg|png|jpg|jpeg|gif|webp|html)$).*)",
  ],
};
