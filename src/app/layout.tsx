import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { connection } from "next/server";
import { SiteHeader } from "@/components/site-header";
import { serverEnv } from "@/infrastructure/config/env";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Tek satırda kalması için ayrı: lint istisnası yalnızca o satırı kapsıyor. */
const bootScript = { __html: THEME_BOOT_SCRIPT };

const TITLE = "Futbol Quiz — Ortak Oyuncular";
const DESCRIPTION =
  "İki futbol kulübü seçin, ikisinde de forma giymiş oyuncuları görün. " +
  "Yirmi dört üst ligin tarihsel kadroları: Avrupa, MLS ve Suudi Pro Lig.";

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

  // Açılış script'i CSP'nin nonce'unu taşımak ZORUNDA (§7.3): `'strict-dynamic'`
  // nonce'suz her script'i bloklar. Nonce'u `proxy.ts` istek başlığına yazıyor.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    /*
      `suppressHydrationWarning`: `data-theme` özniteliğini React'ten ÖNCE,
      aşağıdaki açılış script'i basıyor. Uyarı bastırılmasaydı React bunu bir
      hidrasyon hatası sayar, en yakın sınırdan itibaren istemcide yeniden
      render eder ve tam da kaçınmaya çalıştığımız yanıp sönme oluşurdu.
    */
    <html
      lang="tr"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/*
          YANIP SÖNMEYİ (FOUC) KAPATAN TEK YER — §7.12.

          Script HTML ayrıştırılırken, İLK BOYAMADAN ÖNCE çalışır. `useEffect`
          boyamadan sonra çalışır (kullanıcı yanlış temayı görür),
          `useLayoutEffect` hidrasyondan sonra çalışır (yavaş bağlantıda
          tarayıcı sunucu HTML'ini çoktan boyamıştır).

          `dangerouslySetInnerHTML` bu projede kural olarak yasak (§7.2) ve
          burada TEK istisnası var: içerik derleme zamanı bir SABİT
          (`THEME_BOOT_SCRIPT`), hiçbir kullanıcı girdisi içermiyor ve script
          depodan okuduğu değeri de körlemesine yazmıyor — yalnızca iki bilinen
          dizeyi kabul ediyor. Kural genel olarak kapatılmadı; yalnızca bu satır.

          `suppressHydrationWarning` BURADA DA GEREKLİ ve sebebi `data-theme`
          ile aynı değil: nonce'u TARAYICI siliyor. CSP'nin "nonce gizleme"
          kuralı gereği, etiket ayrıştırıldıktan sonra `nonce` İÇERİK
          ÖZNİTELİĞİ boşaltılır (değer yalnızca DOM özelliğinde kalır) — yoksa
          bir saldırgan nonce'u öznitelik seçicisiyle sızdırabilirdi. React
          hidrasyonda o boşaltılmış özniteliği okuyup uyuşmazlık bildiriyordu.

          Ölçülerek doğrulandı: nonce hem sunulan HTML'de hem istemci yükünde
          DOĞRU duruyor, script de çalışıyor (§7.3 denetimi 80/80). Bastırılan
          şey gerçek bir kusur değil, tarayıcının kasıtlı davranışı.
        */}
        <script
          nonce={nonce}
          suppressHydrationWarning
          // eslint-disable-next-line react/no-danger -- Sabit içerik, kullanıcı girdisi yok (§7.2, §7.12).
          dangerouslySetInnerHTML={bootScript}
        />
      </head>
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
