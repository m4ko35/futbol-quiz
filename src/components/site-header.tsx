"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "./brand-mark";
import { ModeNav, type ModeId } from "./mode-nav";
import { ThemeToggle } from "./theme-toggle";

/**
 * Site başlığı — marka işareti ve oyun modları (§7.12).
 *
 * NEDEN DÜZENDE (`layout.tsx`), SAYFALARDA DEĞİL. Aynı gezinme üç sayfada
 * birebir tekrarlanıyordu ve her sayfa `current` değerini elle geçiyordu:
 * yeni bir mod eklendiğinde dört ayrı yerin güncellenmesi gerekirdi. Burada
 * yol adresinden TÜRETİLİYOR, tek kaynak var.
 *
 * NEDEN İSTEMCİ BİLEŞENİ. `usePathname` istemci kancasıdır. Bedeli küçük:
 * başlık veri okumaz, yalnızca mod bağlantılarını çizer.
 *
 * ALTBİLGİ BURAYA TAŞINMADI ve bu bilinçli. Altbilgi veri kümesinin tarihini
 * gösteriyor, yani veritabanına gidiyor. Düzene konsaydı HATA SAYFASI da o
 * sorguya bağımlı olurdu — veritabanı bozulduğunda hata ekranının kendisi de
 * çökerdi. Başlığın böyle bir bağımlılığı yok.
 */

/** Yol adresi → mod. Bilinmeyen yollarda (404) `null`. */
function modeFromPath(pathname: string): ModeId | null {
  if (pathname === "/") return "common-players";
  if (pathname.startsWith("/izgara")) return "grid";
  if (pathname.startsWith("/istatistik")) return "stat-match";
  if (pathname.startsWith("/hangisi-daha")) return "which-more";
  return null;
}

export interface SiteHeaderProps {
  /**
   * Lider tablosu bağlantısı gösterilsin mi — §11.11.
   *
   * KOŞULSUZDU VE BU BİR KUSURDU: hesap değişkenleri tanımsız bir dağıtımda
   * sayfa 404 döner (§11), yani başlık HER SAYFADA kırık bir bağlantı
   * taşırdı. Üretime ilk çıkışta tam olarak bu durum geçerli olacaktı.
   *
   * Karar DÜZENDEN gelir çünkü başlık istemci bileşenidir ve yapılandırmayı
   * okuyamaz; okuyabilseydi de gizli anahtarların adları istemci paketine
   * sızardı.
   */
  readonly showLeaderboard: boolean;
}

export function SiteHeader({ showLeaderboard }: SiteHeaderProps) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/85 backdrop-blur-md">
      {/*
        İKİ SATIR, HER GENİŞLİKTE: üst satır marka (sol) + sağ küme (Lider
        Tablosu + görünüm, SAĞ ÜST); mod şeridi tam genişlikte ALT SATIR.

          [marka] .......... [sağ küme]
          [modlar — tam genişlik]

        Tek satıra sığdırmaya çalışmıyoruz: dört mod etiketi + marka + küme
        birlikte dar/orta ekranlarda taşıp çirkin sarıyordu. Ayrı bir mod
        şeridi satırı hem her genişlikte dengeli durur hem odak sırası
        (marka → küme → şerit) görünümle birebir uyar.

        Bileşen İKİ KEZ BASILMIYOR (aynı adı taşıyan iki nav/radyo grubu
        erişilebilirlik ağacında kalabalık yapardı) — `order` ile tek kopya.
      */}
      <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center gap-x-4 gap-y-3 px-5 py-3 sm:px-6">
        <Link
          href="/"
          className="order-1 flex items-center gap-2 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          <BrandMark className="h-7 w-7 shrink-0 text-accent" />
          {/* İki tonlu kelime markası (Stitch dili): "Futbol" ön planda,
              "Challenge" accent. Marka kimliğinin iki-renk ritmi; tek satır
              kalıyor (başlık düzeni sıkı). */}
          <span className="font-display text-xl font-bold tracking-tight uppercase">
            Futbol <span className="text-accent">Challenge</span>
          </span>
        </Link>

        {/*
          SAĞ KÜME — Lider Tablosu + görünüm TEK GRUP, her genişlikte SAĞ ÜSTTE
          (`ms-auto` markanın karşısına yaslar). Görünüm seçicisinin 44px
          dokunma hedefi KORUNUR (erişilebilirlik).

          LİDER TABLOSU mod ŞERİDİNE değil bu kümeye konuyor ve bu bilinçli:
          şerit dört OYUN MODUNU taşır, tablo bir mod değil — beşinci öğe hem
          yerleşimi bozar (§7.17) hem "beşinci oyun" diye okunurdu.
        */}
        <div className="order-2 ms-auto flex items-center gap-1.5">
          {showLeaderboard && (
            <Link
              href="/lider-tablosu"
              className="font-display inline-flex items-center gap-1.5 rounded-md px-2.5 py-2.5 text-sm font-semibold tracking-wide text-muted uppercase transition-colors hover:bg-surface hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {/* Kupa — satır içi SVG (§7.12: glif değil SVG; Material Symbols
                  harici fontu CSP `font-src 'self'` ile engellenir). */}
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                focusable="false"
                className="h-4 w-4 text-accent"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" />
                <path d="M7 5H5v2a3 3 0 0 0 3 3" />
                <path d="M17 5h2v2a3 3 0 0 1-3 3" />
                <path d="M12 13v4" />
                <path d="M8.5 20h7l-.5-3h-6l-.5 3Z" />
              </svg>
              <span>Lider Tablosu</span>
            </Link>
          )}
          <ThemeToggle />
        </div>

        {/* Mod şeridi HER GENİŞLİKTE tam genişlikte alt satırda ve ortalı
            (`order-3 w-full justify-center`). */}
        <ModeNav
          current={modeFromPath(pathname)}
          className="order-3 w-full justify-center"
        />
      </div>
    </header>
  );
}
