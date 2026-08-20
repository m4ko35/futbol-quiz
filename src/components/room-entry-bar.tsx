import Link from "next/link";

/**
 * Odaya çağrı şeridi — PROJECT.md §12.7.
 *
 * NEDEN ŞERİT, NEDEN KART DEĞİL. İlk hâli sayfanın en altında duran bir
 * karttı ve orada **görünmüyordu**: altı istatistik satırı ve sayı doğrularıyla
 * birlikte yaklaşık 1.200 piksel aşağıda kalıyordu. Yukarı taşınınca ölçü
 * değişmek zorunda kaldı — başlıklı, paragraflı bir kart oyunun önüne
 * geçerdi. Asıl iş hâlâ günün turu; bu bir alternatif, bir duyuru değil.
 *
 * ODA MOD ŞERİDİNE KONMADI ve kararı değişmedi (§7.17): oda beşinci bir oyun
 * modu değil, İSTATİSTİK MODUNUN bir oynanış biçimi — aynı oyun, aynı
 * kurallar, tek fark karşında birinin olması. Bu yüzden doğal yeri aynı oyunu
 * tek başına oynadığın sayfa.
 *
 * SUNUCU BİLEŞENİ: durum yok, yalnızca bir bağlantı. Girişin yapılıp
 * yapılmadığı sayfada biliniyor ve `href` oradan geliyor.
 */

export interface RoomEntryBarProps {
  /**
   * Giriş yapılmış mı — hedef adres buna göre değişir.
   *
   * GİRİŞSİZ KULLANICI DOĞRUDAN `/oda`'YA GÖNDERİLMİYOR: orası girişe
   * yönlendiriyor ve arada bir sıçrama görünürdü. Metin de değişiyor, çünkü
   * "Oda kur" deyip giriş ekranı açmak sözünü tutmayan bir düğmedir.
   */
  readonly signedIn: boolean;
}

export function RoomEntryBar({ signedIn }: RoomEntryBarProps) {
  return (
    <section className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-xl border border-accent bg-accent-soft px-4 py-3">
      <p className="max-w-prose text-sm">
        <strong className="font-semibold">Arkadaşına karşı oyna.</strong>{" "}
        <span className="text-muted">
          Bir oda kur, kodu gönder — aynı futbolcu ikinize açılır, çok puan
          toplayan kazanır.
        </span>
      </p>

      <Link
        href={signedIn ? "/oda" : "/giris"}
        className="rounded-lg bg-accent px-4 py-3 text-sm font-semibold whitespace-nowrap text-accent-fg transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {signedIn ? "Oda kur" : "Giriş yap ve oda kur"}
      </Link>
    </section>
  );
}
