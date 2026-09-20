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
        STITCH DÜZENİ: marka solda, mod şeridi ORTADA, sağda tek bir küme
        (Lider Tablosu + görünüm). Bileşen İKİ KEZ BASILMIYOR (aynı adı taşıyan
        iki radyo/nav grubu erişilebilirlik ağacında kalabalık yapardı);
        yerleşim yalnızca `order` ve `mx-auto` ile değişiyor:

          dar : [marka] [sağ küme] / [modlar — tam genişlik]
          geniş: [marka] [modlar — orta] [sağ küme]

        KAYNAK SIRASI marka → küme → şerit: dar ekranda odak sırası görünümle
        birebir uyar (küme üstte, şerit altta). Geniş ekranda şerit görsel
        olarak ortaya alınır (`sm:mx-auto`) — bu tek satırlık reflow'un doğal
        bedeli, önceki düzende de vardı.
      */}
      <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center gap-x-4 gap-y-3 px-5 py-3 sm:px-6">
        <Link
          href="/"
          className="order-1 flex items-center gap-2 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          <BrandMark className="h-7 w-7 shrink-0 text-accent" />
          <span className="font-display text-xl font-bold tracking-tight uppercase">
            Futbol Challenge
          </span>
        </Link>

        {/*
          SAĞ KÜME — Lider Tablosu + görünüm TEK GRUP (Stitch gibi). Dar ekranda
          `ms-auto` ile markanın karşısına, geniş ekranda mod şeridinin sağına
          yaslanır. Görünüm seçicisinin 44px dokunma hedefi KORUNUR
          (erişilebilirlik); küme yalnızca hizasıyla derli toplu görünür.

          LİDER TABLOSU mod ŞERİDİNE değil bu kümeye konuyor ve bu bilinçli:
          şerit dört OYUN MODUNU taşır, tablo bir mod değil — beşinci öğe hem
          yerleşimi bozar (§7.17) hem "beşinci oyun" diye okunurdu.
        */}
        <div className="order-2 ms-auto flex items-center gap-1.5 sm:order-3 sm:ms-0">
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

        {/* Mod şeridi geniş ekranda ORTALANIR (`sm:mx-auto`); dar ekranda tam
            genişlikte alt satıra iner (`order-3 w-full`). */}
        <ModeNav
          current={modeFromPath(pathname)}
          className="order-3 w-full justify-center sm:order-2 sm:mx-auto sm:w-auto"
        />
      </div>
    </header>
  );
}
