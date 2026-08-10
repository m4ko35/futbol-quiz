/**
 * Sayfa altbilgisi: veri kaynağı, kapsam ve güncellik tarihi.
 *
 * NEDEN GÜNCELLİK TARİHİ GÖSTERİLİYOR (§1.3). Veri kümesi yılda iki kez, transfer
 * dönemleri kapandıktan sonra tazeleniyor. Bu tarih gösterilmezse geçen haftaki
 * bir transferi arayan kullanıcı sitenin BOZUK olduğunu düşünür. Tarihi
 * göstermek aynı durumu bir beklentiye çevirir.
 */

import { formatTurkishDate } from "@/lib/format-date";

export interface SiteFooterProps {
  /** ETL koşusunun bittiği an; bilinmiyorsa `null` (§5.2). */
  readonly dataGeneratedAt: Date | null;
}

/**
 * Tarihi Türkçe ve UTC'ye sabitlenmiş biçimde yazar.
 *
 * Gövde `@/lib/format-date`'e taşındı: aynı biçimlendirici üç yerde ayrı ayrı
 * yazılmıştı. Ad burada KORUNUYOR çünkü altbilginin sözleşmesi ve testi bu
 * adı kullanıyor; gerekçenin tamamı ortak dosyada.
 */
export function formatDataDate(date: Date): string {
  return formatTurkishDate(date);
}

export function SiteFooter({ dataGeneratedAt }: SiteFooterProps) {
  return (
    <footer className="mt-auto flex flex-col gap-1 border-t border-line pt-6 text-sm text-muted">
      <p>
        Veriler{" "}
        <a
          href="https://www.wikidata.org"
          className="font-medium text-accent underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          rel="noreferrer noopener"
          target="_blank"
        >
          Wikidata
        </a>
        &apos;dan ve{" "}
        <a
          href="https://tr.wikipedia.org"
          className="font-medium text-accent underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          rel="noreferrer noopener"
          target="_blank"
        >
          Vikipedi
        </a>
        &apos;den derlenmiştir.{" "}
        {/*
          ARMA ATFI BURADAN BAĞLANIR (§7.3, BR-34). Armaların bir kısmı
          CC BY / CC BY-SA lisanslı ve bu lisanslar yazarın anılmasını ŞART
          koşuyor. Bağlantı her sayfada duruyor çünkü atıf, görselin
          gösterildiği yerden ulaşılabilir olmalı.
        */}
        <a
          href="/kaynaklar"
          className="font-medium text-accent underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Arma kaynakları ve lisanslar
        </a>
        .
      </p>

      {dataGeneratedAt !== null && (
        <p>
          Veri son güncelleme:{" "}
          <time dateTime={dataGeneratedAt.toISOString()}>
            {formatDataDate(dataGeneratedAt)}
          </time>
          . Kadrolar transfer dönemleri kapandıktan sonra, yılda iki kez
          tazelenir.
        </p>
      )}
    </footer>
  );
}
