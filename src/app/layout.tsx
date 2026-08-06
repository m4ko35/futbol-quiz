import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { connection } from "next/server";
import { SiteHeader } from "@/components/site-header";
import { serverEnv } from "@/infrastructure/config/env";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const TITLE = "Futbol Quiz — Ortak Oyuncular";
const DESCRIPTION =
  "İki futbol kulübü seçin, ikisinde de forma giymiş oyuncuları görün. " +
  "Avrupa'nın yirmi iki üst liginin tarihsel kadroları.";

/**
 * Sayfa meta verisi — PROJECT.md §7.11.
 *
 * `metadataBase` OLMADAN paylaşım alanları göreli kalır ve hiçbir sohbet
 * uygulaması onları çözemez; bağlantı başlıksız gri bir kutu olarak görünür.
 *
 * `robots` alanı `SITE_INDEXABLE` ile aynı kaynaktan okunur (`robots.ts` de
 * öyle). Siteyi aramaya açmak tek bir ortam değişkenini değiştirmektir.
 */
export const metadata: Metadata = {
  metadataBase: new URL(serverEnv().SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "Futbol Quiz",
  robots: serverEnv().SITE_INDEXABLE
    ? { index: true, follow: true }
    : { index: false, follow: false, nocache: true },
  openGraph: {
    type: "website",
    locale: "tr_TR",
    siteName: "Futbol Quiz",
    title: TITLE,
    description: DESCRIPTION,
    url: "/",
  },
  twitter: {
    // Görsel üretilmiyor; görselsiz kartın doğru türü budur. "summary_large_image"
    // vermek, olmayan bir görseli vaat edip boş bir kart üretirdi.
    card: "summary",
    title: TITLE,
    description: DESCRIPTION,
  },
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
      <body className="flex min-h-full flex-col">
        {/* Başlık DÜZENDE: üç sayfada birebir tekrarlanıyordu ve her biri
            bulunduğu modu elle bildiriyordu. Burada yol adresinden türetiliyor
            ve 404 ile hata ekranı da gezinmeye kavuşuyor. */}
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
