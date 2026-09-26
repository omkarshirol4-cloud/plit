import type { Metadata } from "next";
import "./globals.css";
import { TopNav } from "@/components/TopNav";

export const metadata: Metadata = {
  title: "Proof-of-Work Hiring",
  description: "Resume screening + live anti-gaming verification",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <TopNav />
        <main className="shell">{children}</main>
      </body>
    </html>
  );
}
