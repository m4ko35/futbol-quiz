import { listLeagues, searchClubs } from "@/application/use-cases/search-clubs";
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
  // Hepsi birbirinden bağımsız; sırayla beklemek boşuna gecikme olurdu.
  const [initialClubs, dataGeneratedAt, selectableClubs, playerCount, leagues] =
    await Promise.all([
      searchClubs({}, { clubs: repositories.clubs }),
      datasets.getGeneratedAt(),
      datasets.countSelectableClubs(),
      datasets.countPlayers(),
      // BR-37 — lig listesi sunucuda hazırlanır; ayrı bir API ucu açmak yeni
      // bir hız sınırı yüzeyi ve ilk açılışta fazladan bir istek demekti (§6.1).
      listLeagues({ clubs: repositories.clubs }),
    ]);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-5 py-10 sm:px-6 sm:py-14">
      {/*
        KÜNYE VE KAPSAM BANDI BİLEŞENİN İÇİNDE (§7.15). Tabela, sonuç
        geldiğinde veri kümesi sayılarından sonucun kendisine geçiyor; yani
        canlı. Sunucuda render edilen sabit bir başlık bunu yapamazdı ve
        ikinci bir sayaç eklemek aynı sayıyı iki yerde göstermek olurdu.
      */}
      <CommonPlayersQuiz
        initialClubs={initialClubs}
        leagues={leagues}
        clubCount={selectableClubs}
        playerCount={playerCount}
      />

      <SiteFooter dataGeneratedAt={dataGeneratedAt} />
    </main>
  );
}
