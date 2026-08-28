import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TeacherTown",
  description: "승인된 교사만 이용하는 나눔·소모임·학교정보 커뮤니티",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
