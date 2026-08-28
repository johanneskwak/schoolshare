"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { SchoolSearchResult } from "@/app/api/schools/search/route";

interface SchoolsSearchProps {
  initialSchools: SchoolSearchResult[];
}

/** 검색어가 없으면 등록된 학교 목록을, 입력하면 카카오 검색 결과를 보여준다. */
export function SchoolsSearch({ initialSchools }: SchoolsSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SchoolSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length === 0) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/schools/search?q=${encodeURIComponent(query)}`);
        const body = await res.json();
        setResults(body.results ?? []);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const isSearching = query.trim().length > 0;
  const list = isSearching ? results : initialSchools;

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="학교명을 검색하세요"
      />
      {loading && <p className="muted" style={{ marginTop: 8 }}>검색 중...</p>}
      {!isSearching && initialSchools.length > 0 && (
        <p className="muted" style={{ marginTop: 12 }}>등록된 학교</p>
      )}
      <div style={{ marginTop: 8 }}>
        {list.map((school) => (
          <Link key={school.id} href={`/schools/${school.id}`} className="card-link">
            <div className="card">
              <p className="title">{school.name}</p>
              {school.address && <p className="muted">{school.address}</p>}
            </div>
          </Link>
        ))}
        {!loading && isSearching && results.length === 0 && (
          <div className="empty">검색 결과가 없어요.</div>
        )}
        {!isSearching && initialSchools.length === 0 && (
          <div className="empty">아직 등록된 학교가 없어요. 학교명을 검색해 보세요.</div>
        )}
      </div>
    </div>
  );
}
