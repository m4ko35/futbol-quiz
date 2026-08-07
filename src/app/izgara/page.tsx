import type { Metadata } from "next";
import { CURATED_CLUB_QIDS } from "@/application/curated-clubs";
import { toClubDto } from "@/application/dto/club-dto";
import { getDailyGrid } from "@/application/use-cases/daily-grid";
import { GridQuiz } from "@/components/grid-quiz";
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
  title: "3×3 Izgara — Futbol Quiz",
  description:
    "Her gün yeni bir 3×3 ızgara. Satır ve sütun ölçütlerinin ikisini birden " +
    "sağlayan futbolcuları bulun.",
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
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-5 py-10 sm:px-6 sm:py-14">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          3×3 Izgara
        </h1>
        <p className="mt-3 text-lg text-muted">
          Günün ızgarası —{" "}
          <time dateTime={grid.date} className="font-medium text-foreground">
            {formatGridDate(grid.date)}
          </time>
          . Herkes aynı ızgarayı görür.
        </p>
      </header>

      <GridQuiz grid={grid} curatedClubs={curatedClubs} />

      <SiteFooter dataGeneratedAt={dataGeneratedAt} />
    </main>
  );
}

/**
 * `YYYY-MM-DD` metnini Türkçe tarihe çevirir.
 *
 * `new Date("2026-07-31")` UTC gece yarısı olarak ayrıştırılır; biçimlendirme
 * de UTC'ye sabitlenmezse sunucunun yerel dilimi tarihi bir gün geriye
 * kaydırabilir (§ `site-footer.tsx` ile aynı gerekçe).
 */
function formatGridDate(isoDate: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(isoDate));
}
