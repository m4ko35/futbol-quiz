import Link from "next/link";
import { buttonClasses } from "./ui/button";

/**
 * Odaya çağrı şeridi — PROJECT.md §12.7 / §12.8.
 *
 * NEDEN ŞERİT, NEDEN KART DEĞİL. İlk hâli sayfanın en altında duran bir
 * karttı ve orada **görünmüyordu**: altı istatistik satırı ve sayı doğrularıyla
 * birlikte yaklaşık 1.200 piksel aşağıda kalıyordu. Yukarı taşınınca ölçü
 * değişmek zorunda kaldı — başlıklı, paragraflı bir kart oyunun önüne
 * geçerdi. Asıl iş hâlâ oyunun kendisi; bu bir alternatif, bir duyuru değil.
 *
 * ODA MOD ŞERİDİNE KONMADI ve kararı değişmedi (§7.17): oda beşinci bir oyun
 * modu değil, İLGİLİ OYUNUN bir oynanış biçimi — aynı oyun, aynı kurallar, tek
 * fark karşında birinin olması. Bu yüzden doğal yeri aynı oyunu tek başına
 * oynadığın sayfa: İstatistik için `/istatistik`, Hangisi Daha için
 * `/hangisi-daha` (§12.8).
 *
 * MODA GÖRE İKİ ŞEY DEĞİŞİR: (1) metin — "aynı futbolcu" yerine "aynı
 * düellolar"; (2) lobiye götüren adres modu önseçili taşır (`/oda?mod=…`), yani
 * Hangisi Daha'dan gelen kullanıcı İstatistik'e ayarlı bir formla karşılaşmaz.
 *
 * SUNUCU BİLEŞENİ: durum yok, yalnızca bir bağlantı. Girişin yapılıp
 * yapılmadığı sayfada biliniyor ve `href` oradan geliyor.
 */

/** Şeridin taşıdığı oda modu — metni ve lobinin önseçimini belirler. */
type EntryMode = "istatistik" | "hangisi-daha" | "izgara";

/** Moda özgü tek cümlelik kural metni (§5.2: uydurma yok, gerçek kural). */
const COPY: Readonly<Record<EntryMode, string>> = {
  istatistik: "aynı futbolcu ikinize açılır, çok puan toplayan kazanır",
  "hangisi-daha": "ikinize aynı düellolar açılır, daha iyi bilen kazanır",
  izgara: "ikinize aynı ızgara açılır, sırayla oynayıp üç taşı dizen kazanır",
};

export interface RoomEntryBarProps {
  /**
   * Hangi oyunun oda biçimi — metin ve lobinin önseçili modu buna göre (§12.8).
   */
  readonly mode: EntryMode;
  /**
   * Giriş yapılmış mı — hedef adres buna göre değişir.
   *
   * GİRİŞSİZ KULLANICI DOĞRUDAN `/oda`'YA GÖNDERİLMİYOR: orası girişe
   * yönlendiriyor ve arada bir sıçrama görünürdü. Metin de değişiyor, çünkü
   * "Oda kur" deyip giriş ekranı açmak sözünü tutmayan bir düğmedir.
   */
  readonly signedIn: boolean;
}

export function RoomEntryBar({ mode, signedIn }: RoomEntryBarProps) {
  return (
    <section className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-xl border border-accent bg-accent-soft px-4 py-3">
      <p className="max-w-prose text-sm">
        <strong className="font-semibold">Arkadaşına karşı oyna.</strong>{" "}
        <span className="text-muted">
          Bir oda kur, kodu gönder — {COPY[mode]}.
        </span>
      </p>

      <Link
        href={signedIn ? `/oda?mod=${mode}` : "/giris"}
        className={buttonClasses({ size: "md" }, "whitespace-nowrap")}
      >
        {signedIn ? "Oda kur" : "Giriş yap ve oda kur"}
      </Link>
    </section>
  );
}
