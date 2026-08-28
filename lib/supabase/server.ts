import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "./types";

/** Server Component / Server Action / Route Handler에서 쓰는 세션 클라이언트. RLS가 적용된다. */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Component에서 호출되면 무시한다. middleware가 세션을 갱신한다.
          }
        },
      },
    },
  );
}

/**
 * service_role 키로 만드는 관리자 클라이언트. RLS를 우회한다.
 * 학교 검색 캐시 쓰기(R34), 관리자 승인 처리처럼 신뢰 경계를 서버 코드 자체로 두는
 * 곳에서만 사용한다. 절대 클라이언트로 전달하지 않는다.
 */
export function createServiceRoleClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {
          // service-role 클라이언트는 쿠키 세션을 쓰지 않는다.
        },
      },
    },
  );
}
