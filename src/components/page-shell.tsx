import type { ReactNode } from "react";

/**
 * Sayfa kabı — PROJECT.md §7.12.
 *
 * NEDEN BİLEŞEN. Aynı `<main>` sınıf dizesi on sayfada birebir tekrarlanıyordu
 * ve tekrar ettiği için de AYRIŞMIŞTI: sekiz sayfa `max-w-3xl`, ikisi
 * `max-w-4xl` taşıyordu. Site başlığı ise `max-w-4xl` — yani sekiz sayfada
 * marka işareti, sayfa başlığının 64 piksel SOLUNDA duruyordu. Kimse böyle
 * karar vermedi; genişlik kopyalandıkça kaydı.
 *
 * ÖLÇÜ 4XL'DE BİRLEŞTİ, 3XL'DE DEĞİL. Bu bir oyun: ızgaranın hücreleri ve
 * anasayfadaki yan yana iki seçici geniş kaptan kazanıyor. Uzun metnin ölçüsü
 * kabın değil BLOĞUN işidir — `max-w-prose` bu depoda zaten yerleşik bir
 * alışkanlık (gizlilik bildiriminde 23 paragrafın 23'ünde).
 *
 * HATA VE 404 EKRANLARI BUNU KULLANMAZ ve bu bilinçli: onlar dikeyde
 * ortalanmış dar birer mesaj, gezinilen bir sayfa değil.
 */
export function PageShell({ children }: { readonly children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-5 py-10 sm:px-6 sm:py-14">
      {children}
    </main>
  );
}
