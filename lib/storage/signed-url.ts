import { createServiceRoleClient } from "@/lib/supabase/server";

const SIGNED_URL_TTL_SECONDS = 60 * 60;

/** 비공개 버킷의 서명 URL을 서버에서 일괄 발급한다. 화면 렌더링은 이미 RLS로 걸러진 뒤라 안전하다. */
export async function signImageUrls(bucket: string, paths: string[]): Promise<Map<string, string>> {
  if (paths.length === 0) return new Map();
  const service = createServiceRoleClient();
  const { data, error } = await service.storage.from(bucket).createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return new Map();
  const entries: [string, string][] = [];
  for (const d of data) {
    if (d.signedUrl) entries.push([d.path ?? "", d.signedUrl]);
  }
  return new Map(entries);
}
