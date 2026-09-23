import type { Metadata } from "next";
import { listLeagues } from "@/application/use-cases/search-clubs";
import { DataLabel } from "@/components/data-label";
import { PageShell } from "@/components/page-shell";
import { SiteFooter } from "@/components/site-footer";
import { WhichMoreQuiz } from "@/components/which-more-quiz";
import { datasets, repositories } from "@/infrastructure/db/repositories";

/**
 * "Hangisi daha" ekranı — PROJECT.md §9.3.
 *
 * Diğer üç sayfanın aksine BURADA SUNUCU VERİ HAZIRLAMAZ. Sebep BR-32: ilk
 * eşleşme de bir tur ve turun içeriği (hangi iki oyuncu) rastgeledir. Sunucu
 * bileşeninde üretilseydi HTML'e gömülür, yani sayfa kaynağında görünürdü —
 * ve bir sonraki tur yine uçtan gelirdi, yani iki ayrı yol olurdu.
 *
 * Künye yine sunucudan geliyor: veri kümesinin tarihi rastgele değil.
 */

export const metadata: Metadata = {
  title: "Hangisi Daha — Futbol Challenge",
  alternates: { canonical: "/hangisi-daha" },
  description:
    "İki futbolcuyu karşılaştır: hangisi daha çok gol, maç veya millî maç " +
    "yaptı? Doğru bildikçe serin uzar. Ücretsiz Türkçe futbol tahmin oyunu.",
};

/**
 * "Nasıl oynanır" kartları — hepsi GERÇEK kural (BR-28/BR-30 + §9.2 kapsam).
 *
 * Stitch iki düz paragrafı yerine üç kart çiziyordu; içeriği ("günün yarışması",
 * sıralama, doğruluk oranı) uydurmaydı (§5.2). Gerçek kurallar kondu. İçerik
 * statik: modül düzeyinde bir sabit (ızgara/istatistikteki `HOW_TO_RULES` deseni).
 */
const HOW_TO_RULES: readonly {
  readonly title: string;
  readonly body: string;
}[] = [
  {
    title: "Metriği İnceleyin",
    body: "Bir istatistik, seviye ve yön seçin; karşınıza gelen iki futbolcudan hangisinin o metrikte kariyer boyu önde olduğunu bulun. Değerler ancak seçtikten sonra açılır.",
  },
  {
    title: "Serinizi Koruyun",
    body: "Her doğru seçtiğiniz oyuncu kalır ve karşısına yeni bir rakip gelir; seriniz +1 uzar. Tek bir yanlış cevap koşuyu bitirir — bu mod kaydedilmez, sıralaması yoktur.",
  },
  {
    title: "Şeffaf Veri",
    body: "Maç, gol ve kulüp sayısı yalnızca kapsamdaki 24 ligi sayar; maç ve gol kulüp kariyerinin tamamı ile A millî takımın toplamıdır. Hazırlık maçları sayılmaz.",
  },
];

export default async function WhichMorePage() {
  // Hepsi birbirinden bağımsız; sırayla beklemek boşuna gecikme olurdu.
  const [dataGeneratedAt, leagues, clubCount, playerCount] = await Promise.all([
    datasets.getGeneratedAt(),
    // "Kapsam" şeridinin GERÇEK sayıları (§5.2): uydurma değil, veri kümesi.
    listLeagues({ clubs: repositories.clubs }),
    datasets.countSelectableClubs(),
    datasets.countPlayers(),
  ]);

  return (
    <PageShell>
      <WhichMoreQuiz />

      {/*
        SEO/tanıtım bölümü — §7.11. Oyunun altında, ikincil tonda. Stitch'in üç
        kartlı düzeni (§9.3): kartlar GERÇEK kurallar (BR-28/BR-30 + kapsam);
        Stitch'in "günün yarışması / sıralama / doğruluk oranı" içeriği modele
        aykırıydı (§5.2). Kapsam şeridi de gerçek sayıları taşır.
      */}
      <section
        id="nasil-oynanir"
        className="flex scroll-mt-24 flex-col gap-5 border-t border-line pt-8"
      >
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <h2 className="text-lg font-semibold">
            &quot;Hangisi daha&quot; nasıl oynanır?
          </h2>
          <DataLabel className="text-muted">Resmî kurallar</DataLabel>
        </div>

        {/* Numara ROZETİ süsleme (aria-hidden): kurallar sıralı adımlar değil,
            üç eş kural — `ul`, `ol` değil. */}
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {HOW_TO_RULES.map((rule, index) => (
            <li
              key={rule.title}
              className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4"
            >
              <span
                aria-hidden="true"
                className="font-display flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-sm font-bold tabular-nums text-accent"
              >
                {index + 1}
              </span>
              <h3 className="font-display text-base font-bold tracking-tight">
                {rule.title}
              </h3>
              <p className="text-sm text-muted">{rule.body}</p>
            </li>
          ))}
        </ul>

        {/* KAPSAM ŞERİDİ — gerçek veri kümesi sayıları (§5.2). */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-surface px-4 py-3">
          <span className="inline-flex items-center gap-2">
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
              className="h-4 w-4 shrink-0 text-accent"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <ellipse cx="12" cy="6" rx="7" ry="3" />
              <path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />
              <path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
            </svg>
            <DataLabel className="text-muted">Kapsam</DataLabel>
          </span>
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
            <span>
              <strong className="font-semibold tabular-nums text-foreground">
                {leagues.length.toLocaleString("tr-TR")}
              </strong>{" "}
              lig
            </span>
            <span aria-hidden="true" className="text-line-strong">
              •
            </span>
            <span>
              <strong className="font-semibold tabular-nums text-foreground">
                {clubCount.toLocaleString("tr-TR")}
              </strong>{" "}
              kulüp
            </span>
            <span aria-hidden="true" className="text-line-strong">
              •
            </span>
            <span>
              <strong className="font-semibold tabular-nums text-foreground">
                {playerCount.toLocaleString("tr-TR")}
              </strong>{" "}
              futbolcu
            </span>
          </span>
        </div>
      </section>

      <SiteFooter dataGeneratedAt={dataGeneratedAt} />
    </PageShell>
  );
}
