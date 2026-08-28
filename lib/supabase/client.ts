import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

/** 클라이언트 컴포넌트에서 쓰는 브라우저 Supabase 클라이언트. anon 키만 사용한다. */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
