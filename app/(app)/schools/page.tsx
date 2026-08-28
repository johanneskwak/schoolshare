import { createClient } from "@/lib/supabase/server";
import { SchoolsSearch } from "./SchoolsSearch";

export default async function SchoolsPage() {
  const supabase = await createClient();
  const { data: schools } = await supabase
    .from("schools")
    .select("id, name, address, lat, lng")
    .order("name")
    .limit(30);

  return (
    <>
      <header className="header">학교정보</header>
      <div className="container">
        <p style={{ marginBottom: 12 }}>어느 학교가 궁금하세요?</p>
        <SchoolsSearch initialSchools={schools ?? []} />
      </div>
    </>
  );
}
