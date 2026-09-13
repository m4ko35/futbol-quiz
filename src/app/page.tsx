import type { Metadata } from "next";
import { listLeagues, searchClubs } from "@/application/use-cases/search-clubs";
import { CommonPlayersQuiz } from "@/components/common-players-quiz";
import { PageShell } from "@/components/page-shell";
import { SiteFooter } from "@/components/site-footer";
import { datasets, repositories } from "@/infrastructure/db/repositories";

/**
 * Başlık ve açıklama kök düzenden miras alınır (ana sayfa onların konusu);
 * burada yalnızca kanonik adres verilir — §7.11 gereği SAYFA BAŞINA.
 */
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

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
    <PageShell>
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

      {/*
        SEO/TANITIM BÖLÜMÜ (§7.11). Oyunun ALTINDA, ikincil tonda: etkileşim
        üstte kalır, buradaki metin Google'a indekslenecek içerik ve kullanıcıya
        kısa rehber verir. Anahtar sözcükler işlevseldir (marka değil).
      */}
      <section className="flex flex-col gap-3 border-t border-line pt-8">
        <h2 className="text-lg font-semibold">Ortak oyuncu nedir?</h2>
        <p className="max-w-prose text-sm text-muted">
          Ortak oyuncular, iki farklı kulüpte de forma giymiş futbolculardır.
          İki takım seçin; kariyeri boyunca her ikisinde de oynamış futbolcuları
          anında listeleyin. Avrupa&apos;nın büyük liglerinden MLS ve Suudi Pro
          Lig&apos;e, yirmi dört üst ligin tarihsel kadroları taranır.
        </p>
        <p className="max-w-prose text-sm text-muted">
          Bir futbol bilgi oyunu ve ortak oyuncu bulucu: &quot;bu iki takımda da
          kim oynadı?&quot; sorusunu saniyeler içinde yanıtlar. Hesap gerekmez,
          ücretsizdir; ilerlemeniz yalnızca tarayıcınızda tutulur.
        </p>
      </section>

      <SiteFooter dataGeneratedAt={dataGeneratedAt} />
    </PageShell>
  );
}
