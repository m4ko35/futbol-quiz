import type { Metadata } from "next";
import { CURATED_CLUB_QIDS } from "@/application/curated-clubs";
import { toClubDto } from "@/application/dto/club-dto";
import { getDailyGrid } from "@/application/use-cases/daily-grid";
import { GridQuiz } from "@/components/grid-quiz";
import { PageShell } from "@/components/page-shell";
import { SiteFooter } from "@/components/site-footer";
import { datasets, repositories } from "@/infrastructure/db/repositories";

/**
 * 3×3 ızgara ekranı — PROJECT.md §9.1.
 *
 * Sunucu bileşeni: günün ızgarasını use-case'ten DOĞRUDAN alır, kendi API'sine
 * HTTP isteği atmaz. Kendine ağ üzerinden bağlanmak gereksiz bir gidiş-dönüş
 * ve hız sınırının kendi sayfamızı kısıtlaması demek olurdu.
 *
 * Izgara üretilemezse (`GridUnavailableError`) sayfa hata sınırına düşer:
 * §2.7 gereği sessizce boş bir ızgara göstermek YANLIŞTIR — kullanıcı oyunun
 * bozuk olduğunu değil, kendisinin bir şey yapamadığını sanardı.
 */

export const metadata: Metadata = {
  title: "3×3 Izgara — Futbol Challenge",
  alternates: { canonical: "/izgara" },
  description:
    "Futbol ızgara oyunu: her gün yeni bir 3×3 bulmaca. Satır ve sütun " +
    "ölçütlerini (kulüp, ülke, ödül) birden karşılayan futbolcuları bulun. " +
    "Ücretsiz Türkçe futbol bilgi oyunu.",
};

export default async function GridPage() {
  // Üçü birbirinden bağımsız; sırayla beklemek boşuna gecikme olurdu.
  const [grid, dataGeneratedAt, curated] = await Promise.all([
    getDailyGrid(new Date(), repositories),
    datasets.getGeneratedAt(),
    /*
     * "Sen kur" sütun seçicisinin ARAMASIZ ilk listesi (§9.1).
     *
     * Sunucuda hazırlanıyor çünkü istemci bunu ancak bir gidiş-dönüşle
     * alabilirdi ve alfabetik ilk sayfa tanınmayan kulüplerle açılıyordu.
     * Havuz bir SINIR DEĞİL: kullanıcı yazdığı anda 906 seçilebilir kulübün
     * tamamı aranır.
     */
    repositories.clubs.findByWikidataIds(CURATED_CLUB_QIDS),
  ]);

  const curatedClubs = curated
    .map(toClubDto)
    .sort((a, b) => a.shortName.localeCompare(b.shortName, "tr"));

  return (
    <PageShell>
      <GridQuiz grid={grid} curatedClubs={curatedClubs} />

      {/* SEO/tanıtım bölümü — §7.11. Oyunun altında, ikincil tonda. */}
      <section className="flex flex-col gap-3 border-t border-line pt-8">
        <h2 className="text-lg font-semibold">
          Futbol ızgara oyunu nasıl oynanır?
        </h2>
        <p className="max-w-prose text-sm text-muted">
          Her gün yeni bir 3×3 ızgara. Her satırın ve her sütunun bir ölçütü
          (bir kulüp, ülke ya da ödül) vardır. Bir hücreyi doldurmak için, o
          satır ile sütunun ikisini birden karşılayan bir futbolcu yazın —
          örneğin belirli bir kulüpte oynamış ve belirli bir ülkeden olan bir
          isim.
        </p>
        <p className="max-w-prose text-sm text-muted">
          Dokuz hücreyi de doğru isimlerle doldurmaya çalışın. Izgara her gün
          yenilenir ve herkes aynı bulmacayı oynar; ne kadar çok futbolcu
          biliyorsanız o kadar çok hücre açarsınız.
        </p>
      </section>

      <SiteFooter dataGeneratedAt={dataGeneratedAt} />
    </PageShell>
  );
}
