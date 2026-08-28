import { BottomNav } from "@/components/BottomNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="page">
      {children}
      <BottomNav />
    </div>
  );
}
