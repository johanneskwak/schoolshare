"use client";

import { useEffect, useRef, useState } from "react";
import type { SchoolSearchResult } from "@/app/api/schools/search/route";

interface SchoolPickerProps {
  onSelect: (school: SchoolSearchResult) => void;
  placeholder?: string;
}

/** 카카오 학교 검색 디바운스 입력창. 선택 여부와 무관하게 검색 결과는 서버에서 전부 저장된다. */
export function SchoolPicker({ onSelect, placeholder = "학교명을 검색하세요" }: SchoolPickerProps) {
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

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
      />
      {loading && <p className="muted">검색 중...</p>}
      {results.length > 0 && (
        <div className="card" style={{ marginTop: 8, padding: 4 }}>
          {results.map((school) => (
            <button
              key={school.id}
              type="button"
              onClick={() => {
                onSelect(school);
                setQuery(school.name);
                setResults([]);
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "10px 8px",
                background: "none",
                border: "none",
                borderBottom: "1px solid var(--color-border)",
                cursor: "pointer",
              }}
            >
              <div style={{ fontWeight: 600 }}>{school.name}</div>
              {school.address && <div className="muted">{school.address}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
