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
  const [initialClubs, dataGeneratedAt, selectableClubs] = await Promise.all([
    searchClubs({}, { clubs: repositories.clubs }),
    datasets.getGeneratedAt(),
    datasets.countSelectableClubs(),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-5 py-10 sm:px-6 sm:py-14">
      <header>
        {/*
          Başlık artık "Futbol Quiz" DEĞİL: marka adı site başlığında duruyor
          ve burada tekrarlanması, sayfanın hangi mod olduğunu söyleyen tek
          yeri harcıyordu. Diğer iki sayfayla da aynı kalıba giriyor.
        */}
        <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          Ortak Oyuncular
        </h1>
        <p className="mt-3 max-w-prose text-lg text-muted">
          İki kulüp seçin, ikisinde de forma giymiş oyuncuları görün.
        </p>
        {/*
          Kapsam BAŞTA söylenir (§1.3). Ajax veya Porto arayan kullanıcı hiçbir
          şey bulamayacak; bunu keşfetmek için başarısız aramalar yapmak zorunda
          kalırsa siteyi bozuk sanar. Altbilgiye gömülü bir not bu işi görmez.
        */}
        <p className="mt-5 rounded-xl border border-line bg-surface p-4 text-sm text-muted shadow-card">
          <span className="font-semibold text-foreground">Kapsam:</span>{" "}
          Avrupa&apos;nın on dokuz üst liginde — İngiltere, İspanya, İtalya,
          Almanya, Fransa, Türkiye, Hollanda, Portekiz, İskoçya, Belçika,
          Yunanistan, İsviçre, Rusya, Polonya, Çekya, Hırvatistan, Danimarka,
          İsveç ve Norveç — oynamış{" "}
          <strong className="font-semibold text-accent">
            {selectableClubs} kulüp
          </strong>{" "}
          — bu liglerin bugünkü takımları ve geçmişteki takımları dâhil.
        </p>
      </header>

      <CommonPlayersQuiz initialClubs={initialClubs} />

      <SiteFooter dataGeneratedAt={dataGeneratedAt} />
    </main>
  );
}
