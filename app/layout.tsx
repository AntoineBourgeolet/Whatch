import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Whatch — Duel de séries",
  description: "Choisis ta série préférée en duel et découvre des recommandations personnalisées.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className="dark">
      <body className="min-h-screen bg-[#050816] text-slate-100 antialiased">{children}</body>
    </html>
  );
}
