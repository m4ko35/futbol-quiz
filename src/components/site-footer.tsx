/**
 * Sayfa altbilgisi: veri kaynağı, kapsam ve güncellik tarihi.
 *
 * NEDEN GÜNCELLİK TARİHİ GÖSTERİLİYOR (§1.3). Veri kümesi yılda iki kez, transfer
 * dönemleri kapandıktan sonra tazeleniyor. Bu tarih gösterilmezse geçen haftaki
 * bir transferi arayan kullanıcı sitenin BOZUK olduğunu düşünür. Tarihi
 * göstermek aynı durumu bir beklentiye çevirir.
 */

export interface SiteFooterProps {
  /** ETL koşusunun bittiği an; bilinmiyorsa `null` (§5.2). */
  readonly dataGeneratedAt: Date | null;
}

/**
 * Tarihi Türkçe ve UTC'ye sabitlenmiş biçimde yazar.
 *
 * Zaman dilimi bilerek UTC: sunucu bileşeni olarak burası sunucunun saatinde
 * render edilir ve sunucunun yerel dilimi bir ürün kararı değil, bir dağıtım
 * tesadüfüdür. Gün hassasiyetinde gösterilen bir tarihte dilim kayması,
 * kullanıcıya bir gün önceki tarihi gösterebilirdi.
 */
export function formatDataDate(date: Date): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
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
        &apos;dan derlenmiştir.
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
