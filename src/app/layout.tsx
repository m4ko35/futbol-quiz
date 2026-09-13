import type { Metadata } from "next";
import { Barlow, Barlow_Condensed, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { connection } from "next/server";
import { Analytics } from "@vercel/analytics/next";
import { FeedbackLink } from "@/components/feedback-link";
import { SiteHeader } from "@/components/site-header";
import {
  accountsEnabled,
  feedbackEmailEnabled,
  serverEnv,
} from "@/infrastructure/config/env";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";

import "./globals.css";

/**
 * `latin-ext` ZORUNLU, tercih değil — PROJECT.md §7.12.
 *
 * Türkçenin `ı`, `İ`, `ğ`, `ş` harfleri Latin Extended-A'dadır (U+0100–017F)
 * ve `latin` alt kümesi onları İÇERMEZ. Yalnızca `latin` istendiğinde tarayıcı
 * o dört harfi yedek bir sistem fontundan tamamlıyor: Türkçe metnin çoğu
 * kelimesi iki ayrı fontla çiziliyor. Kusur uzun süre gözden kaçtı çünkü
 * sayfa "çalışıyor" görünüyor — bozulan şey yalnızca harflerin biçimi.
 */
const bodyFont = Barlow({
  variable: "--font-body",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
});

/**
 * Başlık fontu AYRI bir rol. Sıkıştırılmış bir gramotesk, spor basınının
 * kendi dilidir: aynı genişlikte daha çok harf, daha güçlü bir dikey ritim.
 * Gövdede kullanılmaz — dar harfler uzun metinde okumayı yavaşlatır.
 */
const displayFont = Barlow_Condensed({
  // Ad `--font-display` DEĞİL: Tailwind'in `@theme` bloğu o adı kendi
  // belirteci için kullanıyor ve `--font-display: var(--font-display)`
  // kendine referans verip sessizce çökerdi.
  variable: "--font-condensed",
  subsets: ["latin", "latin-ext"],
  weight: ["600", "700"],
});

/** Tek yerde kullanılıyor: hata kimliği (`error.tsx`). Değişmedi. */
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
});

/** Tek satırda kalması için ayrı: lint istisnası yalnızca o satırı kapsıyor. */
const bootScript = { __html: THEME_BOOT_SCRIPT };

const TITLE = "Futbol Challenge — Ortak Oyuncular";
const DESCRIPTION =
  "Ortak oyuncu bulucu: iki futbol kulübü seçin, ikisinde de forma giymiş " +
  "futbolcuları görün. Yirmi dört üst ligin tarihsel kadroları — Avrupa, MLS " +
  "ve Suudi Pro Lig. Ücretsiz Türkçe futbol oyunu.";

/** Paylaşım tabanı ve JSON-LD adresleri aynı kaynaktan; iki kez okumamak için. */
const SITE_URL = serverEnv().SITE_URL;

/**
 * Site geneli yapılandırılmış veri (JSON-LD) — PROJECT.md §7.11.
 *
 * Yalnızca DOĞRULANABİLİR olgular: ad, adres, dil (`tr-TR`), ücretsiz erişim.
 * Uydurma alan (puan, yazar, sahte kuruluş) yazılmaz — yanlış yapılandırılmış
 * veri, hiç olmamasından kötüdür.
 *
 * `<` karakteri Unicode kaçışına çevrilir: içerik statik olsa da Next'in resmi
 * kalıbı budur ve bir gün bir değere `<` girse bile `</script>` kaçışını
 * imkânsız kılar. `type="application/ld+json"` bir VERİ bloğudur; tarayıcı onu
 * çalıştırmaz, dolayısıyla CSP `script-src`/`strict-dynamic` denetlemez (§7.2).
 */
const STRUCTURED_DATA = {
  __html: JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: "Futbol Challenge",
        url: SITE_URL,
        inLanguage: "tr-TR",
        description: DESCRIPTION,
      },
      {
        "@type": "WebApplication",
        name: "Futbol Challenge",
        url: SITE_URL,
        applicationCategory: "GameApplication",
        operatingSystem: "Web",
        inLanguage: "tr-TR",
        isAccessibleForFree: true,
        description: DESCRIPTION,
      },
    ],
  }).replaceAll("<", "\\u003c"),
};

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
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "Futbol Challenge",
  robots: serverEnv().SITE_INDEXABLE
    ? { index: true, follow: true }
    : { index: false, follow: false, nocache: true },
  openGraph: {
    type: "website",
    locale: "tr_TR",
    siteName: "Futbol Challenge",
    title: TITLE,
    description: DESCRIPTION,
    url: "/",
  },
  twitter: {
    // Paylaşım görseli var (`opengraph-image.tsx`, §7.11), o yüzden büyük
    // kart. Ayrı bir `twitter:image` VERİLMEZ: Twitter, o yokken `og:image`'e
    // düşer — tek görseli iki meta etiketinde tutmak ikisinin ayrışması demek.
    card: "summary_large_image",
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
      className={`${bodyFont.variable} ${displayFont.variable} ${geistMono.variable} h-full antialiased`}
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
        {/*
          Site geneli yapılandırılmış veri (JSON-LD) — §7.11. İçerik derleme
          zamanı bir SABİT (`STRUCTURED_DATA`), `<` kaçışlı; `type` bir veri
          bloğu olduğu için tarayıcı çalıştırmaz. Nonce ve `suppressHydrationWarning`
          gerekçesi açılış script'iyle birebir aynı (§7.3 nonce gizleme).
        */}
        <script
          type="application/ld+json"
          nonce={nonce}
          suppressHydrationWarning
          // eslint-disable-next-line react/no-danger -- Sabit yapılandırılmış veri, kullanıcı girdisi yok; veri bloğu, çalıştırılmaz (§7.2, §7.11).
          dangerouslySetInnerHTML={STRUCTURED_DATA}
        />
      </head>
      <body className="flex min-h-full flex-col">
        {/* Başlık DÜZENDE: üç sayfada birebir tekrarlanıyordu ve her biri
            bulunduğu modu elle bildiriyordu. Burada yol adresinden türetiliyor
            ve 404 ile hata ekranı da gezinmeye kavuşuyor. */}
        <SiteHeader showLeaderboard={accountsEnabled()} />
        {children}
        {/*
          ÖNERİ/ŞİKAYET DÜZENDE, HER SAYFADA — sağ altta yüzen bir düğme.
          Altbilgi hata/404 ekranlarında yok (veri kümesine bağlı, sayfa
          başına); bu düğme yalnız `CONTACT_EMAIL`'e bağlı, o yüzden burada
          güvenle durur ve gerçekten her sayfada görünür. `fixed` olduğu için
          düzenin flex akışını etkilemez. Adres tanımsızsa bileşen hiç çizilmez.
        */}
        <FeedbackLink
          email={serverEnv().CONTACT_EMAIL}
          formEnabled={feedbackEmailEnabled()}
        />
        {/*
          ZİYARET ÖLÇÜMÜ — Vercel Web Analytics (§7.18, 13 Eylül 2026).

          Çerezsiz, anonim, birinci taraf: yalnızca toplu sayımlar (sayfa
          görüntüleme, ülke, cihaz, referrer) üretir; ziyaretçiyi bağlamaz,
          kişisel veri toplamaz. Gizlilik beyanı `/gizlilik`'te.

          CSP'YE DOKUNMADI (§7.3): bu bileşen sunucuda `null` render eder
          (SSR HTML'ine script eklemez, nonce denetimi değişmez) ve script'i
          yalnızca tarayıcıda `createElement` ile enjekte eder — Next'in
          nonce'lu bundle'ından yüklendiği için `'strict-dynamic'` onu chunk
          yükleyicisiyle aynı biçimde kapsar. Beacon aynı kökene
          (`/_vercel/insights/*`) gider, `connect-src 'self'` altında kalır;
          bu yüzden §7.4'ün adres listesi de değişmez (istemci beacon'ı,
          sunucu çıkışı değil).
        */}
        <Analytics />
      </body>
    </html>
  );
}
