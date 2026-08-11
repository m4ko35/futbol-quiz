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

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="border-b border-line bg-surface">
      {/*
        SIRA GENİŞLİĞE GÖRE DEĞİŞİYOR, BİLEŞEN İKİ KEZ BASILMIYOR.

        Dar ekranda dört mod etiketi tek başına bir satır dolduruyor; görünüm
        seçicisi de aynı satıra sığmıyordu. Çözüm ikinci bir kopya BASMAK
        değil (aynı adı taşıyan iki radyo grubu erişilebilirlik ağacında
        kalabalık yapardı) — `order` ile yerleşim değişiyor:

          dar : [marka] [görünüm] / [modlar — tam genişlik]
          geniş: [marka] [modlar] [görünüm]
      */}
      <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center gap-x-4 gap-y-3 px-5 py-3 sm:px-6">
        <Link
          href="/"
          className="order-1 flex items-center gap-2 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          <BrandMark className="h-7 w-7 shrink-0 text-accent" />
          <span className="text-base font-semibold tracking-tight">
            Futbol Quiz
          </span>
        </Link>

        <ThemeToggle className="order-2 ms-auto sm:order-3 sm:ms-0" />

        <ModeNav
          current={modeFromPath(pathname)}
          className="order-3 w-full justify-center sm:order-2 sm:ms-auto sm:w-auto"
        />
      </div>
    </header>
  );
}
