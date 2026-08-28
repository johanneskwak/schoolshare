import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buildMonthGrid, monthParamKey, parseMonthParam, shiftMonth, WEEKDAY_LABELS } from "@/lib/calendar";
import { DeleteEventButton } from "./DeleteEventButton";

export default async function MeetupsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const { year, month } = parseMonthParam(monthParam);
  const weeks = buildMonthGrid(year, month);
  const rangeStart = weeks[0]![0]!.date;
  const rangeEnd = weeks[weeks.length - 1]![6]!.date;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: events } = await supabase
    .from("club_events")
    .select("id, title, event_date, location, description, author_id")
    .gte("event_date", rangeStart)
    .lte("event_date", rangeEnd)
    .order("event_date");

  const authorIds = Array.from(new Set((events ?? []).map((e) => e.author_id)));
  const { data: authors } = authorIds.length
    ? await supabase.from("public_profiles").select("id, nickname").in("id", authorIds)
    : { data: [] };
  const nicknameById = new Map((authors ?? []).map((a) => [a.id, a.nickname]));

  const eventsByDate = new Map<string, typeof events>();
  for (const e of events ?? []) {
    const list = eventsByDate.get(e.event_date) ?? [];
    list.push(e);
    eventsByDate.set(e.event_date, list);
  }

  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);

  return (
    <>
      <header className="header">번개모임</header>
      <div className="container" style={{ paddingTop: 0 }}>
        <div style={{ display: "flex", gap: 8, padding: "12px 0" }}>
          <Link href="/clubs" style={{ flex: 1 }}>
            <button className="btn btn-secondary">모집글</button>
          </Link>
          <Link href="/clubs/meetups" style={{ flex: 1 }}>
            <button className="btn">번개모임</button>
          </Link>
        </div>

        <Link href="/clubs/meetups/new">
          <button className="btn" style={{ marginBottom: 16 }}>번개모임 등록</button>
        </Link>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <Link href={`/clubs/meetups?month=${monthParamKey(prev.year, prev.month)}`} className="muted">◀ 이전달</Link>
          <span className="title" style={{ fontSize: 16 }}>{year}년 {month}월</span>
          <Link href={`/clubs/meetups?month=${monthParamKey(next.year, next.month)}`} className="muted">다음달 ▶</Link>
        </div>

        <div className="calendar-grid">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="calendar-weekday">{label}</div>
          ))}
          {weeks.flat().map((cell) => (
            <div key={cell.date} className={`calendar-cell ${cell.inMonth ? "" : "calendar-cell-outside"}`}>
              <span>{cell.day}</span>
              {eventsByDate.has(cell.date) && <span className="calendar-dot" />}
            </div>
          ))}
        </div>

        <h2 className="title" style={{ fontSize: 16, marginTop: 24 }}>이번 달 번개모임</h2>
        {(events ?? []).length === 0 && <div className="empty">이번 달 등록된 번개모임이 없어요.</div>}
        {events?.map((e) => (
          <div key={e.id} className="meetup-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <p className="muted">{e.event_date} · {e.location}</p>
                <p className="title" style={{ marginTop: 2 }}>{e.title}</p>
                {e.description && <p style={{ marginTop: 4 }}>{e.description}</p>}
                <p className="muted" style={{ marginTop: 4 }}>{nicknameById.get(e.author_id) ?? "교사"}</p>
              </div>
              {user?.id === e.author_id && <DeleteEventButton eventId={e.id} />}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
