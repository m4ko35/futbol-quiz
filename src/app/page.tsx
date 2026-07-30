import { searchClubs } from "@/application/use-cases/search-clubs";
import { CommonPlayersQuiz } from "@/components/common-players-quiz";
import { SiteFooter } from "@/components/site-footer";
import { datasets, repositories } from "@/infrastructure/db/repositories";

/**
 * Ortak oyuncu ekranı — MVP'nin tek sayfası.
 *
 * Sunucu bileşeni: ilk kulüp listesini use-case'ten DOĞRUDAN alır, kendi
 * API'sine HTTP isteği atmaz. Kendine ağ üzerinden bağlanmak gereksiz bir
 * gidiş-dönüş, gereksiz bir serileştirme ve hız sınırının kendi sayfamızı
 * kısıtlaması demek olurdu.
 */
export default async function Home() {
  // İkisi birbirinden bağımsız; sırayla beklemek boşuna gecikme olurdu.
  const [initialClubs, dataGeneratedAt] = await Promise.all([
    searchClubs({}, { clubs: repositories.clubs }),
    datasets.getGeneratedAt(),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-10 px-5 py-10 sm:px-6 sm:py-16">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Futbol Quiz
        </h1>
        <p className="mt-2 opacity-70">
          İki kulüp seçin, ikisinde de forma giymiş oyuncuları görün.
        </p>
        {/*
          Kapsam BAŞTA söylenir (§1.3). Ajax veya Porto arayan kullanıcı hiçbir
          şey bulamayacak; bunu keşfetmek için başarısız aramalar yapmak zorunda
          kalırsa siteyi bozuk sanar. Altbilgiye gömülü bir not bu işi görmez.
        */}
        <p className="mt-3 rounded-md border border-current/15 px-3 py-2 text-sm opacity-70">
          Kapsam: İngiltere, İspanya, İtalya, Almanya, Fransa ve
          Türkiye&apos;nin en üst liglerinde oynamış <strong>345 kulüp</strong>{" "}
          — bu liglerin bugünkü takımları ve geçmişteki takımları dâhil.
        </p>
      </header>

      <CommonPlayersQuiz initialClubs={initialClubs} />

      <SiteFooter dataGeneratedAt={dataGeneratedAt} />
    </main>
  );
}
