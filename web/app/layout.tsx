import type { Metadata } from "next";
import "./globals.css";
import { TopNav } from "@/components/TopNav";

export const metadata: Metadata = {
  title: "PROV",
  description: "Verifiable proof-of-work hiring: graded assessments, live verification and transparent ranking.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* First tab stop on the page, invisible until focused. */}
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <TopNav />
        <main className="shell" id="main" tabIndex={-1}>
          {children}
        </main>
      </body>
    </html>
  );
}
