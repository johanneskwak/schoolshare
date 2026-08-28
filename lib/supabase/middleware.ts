import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./types";

const PUBLIC_PATHS = ["/login", "/signup", "/auth"];

/**
 * 세션을 갱신하고 승인 상태에 따라 리다이렉트한다. UX용 게이트일 뿐이며,
 * 실제 데이터 접근 차단은 RLS(is_approved())가 담당한다.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublicPath = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!user) {
    if (!isPublicPath) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    return response;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("status, role")
    .eq("id", user.id)
    .single();

  const status = profile?.status ?? "pending";

  if (isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = status === "approved" ? "/share" : status === "rejected" ? "/rejected" : "/pending";
    return NextResponse.redirect(url);
  }

  if (status === "rejected" && pathname !== "/rejected") {
    const url = request.nextUrl.clone();
    url.pathname = "/rejected";
    return NextResponse.redirect(url);
  }

  if (status === "pending" && pathname !== "/pending") {
    const url = request.nextUrl.clone();
    url.pathname = "/pending";
    return NextResponse.redirect(url);
  }

  if (status === "approved" && (pathname === "/pending" || pathname === "/rejected")) {
    const url = request.nextUrl.clone();
    url.pathname = "/share";
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/admin") && profile?.role !== "admin") {
    const url = request.nextUrl.clone();
    url.pathname = "/share";
    return NextResponse.redirect(url);
  }

  return response;
}
