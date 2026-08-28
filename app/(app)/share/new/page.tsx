import { createClient } from "@/lib/supabase/server";
import { NewSharePostForm } from "./NewSharePostForm";

export default async function NewSharePostPage() {
  const supabase = await createClient();
  const { data: itemTypes } = await supabase.from("item_types").select("id, label, carbon_g").order("label");

  return (
    <>
      <header className="header">나눔 글쓰기</header>
      <div className="container">
        <NewSharePostForm itemTypes={itemTypes ?? []} />
      </div>
    </>
  );
}
