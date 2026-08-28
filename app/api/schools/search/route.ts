import { NextResponse, type NextRequest } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { normalizeSchoolQuery, SCHOOL_SEARCH_CACHE_TTL_DAYS } from "@/lib/schools/normalize";

interface KakaoDocument {
  id: string;
  place_name: string;
  road_address_name: string;
  address_name: string;
  x: string; // 경도
  y: string; // 위도
}

interface KakaoKeywordResponse {
  documents: KakaoDocument[];
}

export interface SchoolSearchResult {
  id: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
}

const KAKAO_SEARCH_URL = "https://dapi.kakao.com/v2/local/search/keyword.json";
const SCHOOL_CATEGORY_GROUP_CODE = "SC4";

/**
 * 카카오 로컬 API를 호출하는 유일한 위치. 다른 곳에서 카카오를 호출하면 캐시가 새고
 * 호출 횟수 검증(AC18~AC20)이 불가능해진다.
 */
async function fetchFromKakao(query: string): Promise<KakaoDocument[]> {
  const url = new URL(KAKAO_SEARCH_URL);
  url.searchParams.set("query", query);
  url.searchParams.set("category_group_code", SCHOOL_CATEGORY_GROUP_CODE);

  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}` },
  });

  if (!res.ok) {
    throw new Error(`kakao search failed: ${res.status}`);
  }

  const body = (await res.json()) as KakaoKeywordResponse;
  return body.documents;
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  if (q.trim().length === 0) {
    return NextResponse.json({ results: [] satisfies SchoolSearchResult[] });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { data: profile } = await supabase.from("profiles").select("status").eq("id", user.id).single();
  if (profile?.status !== "approved") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const queryKey = normalizeSchoolQuery(q);
  const service = createServiceRoleClient();

  const { data: cacheRow } = await service
    .from("school_search_cache")
    .select("id, fetched_at")
    .eq("query_key", queryKey)
    .maybeSingle();

  const isFresh =
    cacheRow != null &&
    Date.now() - new Date(cacheRow.fetched_at).getTime() < SCHOOL_SEARCH_CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;

  if (cacheRow && isFresh) {
    const { data: items } = await service
      .from("school_search_cache_items")
      .select("school_id, rank")
      .eq("cache_id", cacheRow.id)
      .order("rank", { ascending: true });

    const schoolIds = (items ?? []).map((i) => i.school_id);
    const { data: schoolRows } = await service
      .from("schools")
      .select("id, name, address, lat, lng")
      .in("id", schoolIds.length > 0 ? schoolIds : ["00000000-0000-0000-0000-000000000000"]);

    const byId = new Map((schoolRows ?? []).map((s) => [s.id, s]));
    const results: SchoolSearchResult[] = (items ?? [])
      .map((i) => byId.get(i.school_id))
      .filter((s): s is NonNullable<typeof s> => s != null);

    return NextResponse.json({ results });
  }

  const documents = await fetchFromKakao(q);

  const upsertRows = documents.map((doc) => ({
    kakao_place_id: doc.id,
    name: doc.place_name,
    address: doc.road_address_name || doc.address_name || null,
    lat: doc.y ? Number(doc.y) : null,
    lng: doc.x ? Number(doc.x) : null,
  }));

  let schoolsByPlaceId = new Map<string, SchoolSearchResult>();
  if (upsertRows.length > 0) {
    const { data: upserted, error: upsertError } = await service
      .from("schools")
      .upsert(upsertRows, { onConflict: "kakao_place_id" })
      .select("id, kakao_place_id, name, address, lat, lng");

    if (upsertError) {
      return NextResponse.json({ error: "failed to store schools" }, { status: 500 });
    }

    schoolsByPlaceId = new Map(
      (upserted ?? []).map((s) => [
        s.kakao_place_id,
        { id: s.id, name: s.name, address: s.address, lat: s.lat, lng: s.lng },
      ]),
    );
  }

  const orderedResults: SchoolSearchResult[] = documents
    .map((doc) => schoolsByPlaceId.get(doc.id))
    .filter((s): s is SchoolSearchResult => s != null);

  const { data: cacheHeader } = await service
    .from("school_search_cache")
    .upsert({ query_key: queryKey, fetched_at: new Date().toISOString() }, { onConflict: "query_key" })
    .select("id")
    .single();

  if (cacheHeader) {
    await service.from("school_search_cache_items").delete().eq("cache_id", cacheHeader.id);
    if (orderedResults.length > 0) {
      await service.from("school_search_cache_items").insert(
        orderedResults.map((s, idx) => ({
          cache_id: cacheHeader.id,
          school_id: s.id,
          rank: idx,
        })),
      );
    }
  }

  return NextResponse.json({ results: orderedResults });
}
