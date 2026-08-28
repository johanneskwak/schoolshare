"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/share", icon: "📦", label: "나눔" },
  { href: "/clubs", icon: "👥", label: "소모임" },
  { href: "/schools", icon: "🏫", label: "학교정보" },
  { href: "/me", icon: "👤", label: "내설정" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav">
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link key={tab.href} href={tab.href} className={active ? "active" : ""}>
            <span className="icon">{tab.icon}</span>
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
