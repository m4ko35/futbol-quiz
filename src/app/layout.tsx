import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { connection } from "next/server";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Futbol Quiz — Ortak Oyuncular",
  description:
    "İki futbol kulübü seçin, ikisinde de forma giymiş oyuncuları görün.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Nonce tabanlı CSP (PROJECT.md §7.3) yalnızca dinamik render'da çalışır:
  // Next, nonce'u istek başlığından okuyup kendi script etiketlerine ekler.
  // Statik üretimde istek yoktur → nonce da yoktur → 'strict-dynamic' yüzünden
  // sayfadaki TÜM script'ler tarayıcıda bloklanır ve uygulama açılmaz.
  //
  // `connection()` bu ağacı isteğe bağlı render'a zorlayarak sorunu çözer.
  // Bedeli statik optimizasyon ve CDN önbelleklemesinin kaybıdır; bu uygulama
  // zaten her isteği veritabanından karşıladığı için kayıp önemsizdir (§10.2).
  await connection();

  return (
    <html
      lang="tr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
