import type { Metadata } from "next";
import { CURATED_CLUB_QIDS } from "@/application/curated-clubs";
import { toClubDto } from "@/application/dto/club-dto";
import { getDailyGrid } from "@/application/use-cases/daily-grid";
import { listLeagues } from "@/application/use-cases/search-clubs";
import { DataLabel } from "@/components/data-label";
import { GridQuiz } from "@/components/grid-quiz";
import { PageShell } from "@/components/page-shell";
import { RoomEntryBar } from "@/components/room-entry-bar";
import { SiteFooter } from "@/components/site-footer";
import {
  accountsRepository,
  datasets,
  repositories,
} from "@/infrastructure/db/repositories";
import { currentUser } from "@/lib/auth/current-user";

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

/**
 * "Nasıl oynanır" kartları — hepsi GERÇEK kural (BR-9/BR-10/BR-13).
 *
 * Stitch'in üçüncü kartı "Nadirlik Puanı"ydı ve o veride yok (§5.2); yerine
 * sınırlı deneme + "Pes et" kuralı kondu. İçerik statik, bu yüzden modül
 * düzeyinde bir sabit — her istekte yeniden kurulmasına gerek yok.
 */
const HOW_TO_RULES: readonly {
  readonly title: string;
  readonly body: string;
}[] = [
  {
    title: "Kesişimleri Bulun",
    body: "Her hücre, satır ve sütun ölçütlerinin ikisini birden karşılayan bir futbolcu ister — örneğin belirli bir kulüpte oynamış ve belirli bir ülkeden bir isim.",
  },
  {
    title: "Tek Kullanım",
    body: "Bir futbolcuyu ızgarada yalnızca bir hücrede kullanabilirsiniz; aynı isim iki hücreyi birden dolduramaz.",
  },
  {
    title: "Sınırlı Deneme",
    body: "Hücre sayısı kadar tahmin hakkınız var; yanlış bir tahmin bir hücreyi harcar. Tıkanırsanız Pes et düğmesi kalan hücrelerin örnek cevaplarını gösterir.",
  },
];

export default async function GridPage() {
  // Hepsi birbirinden bağımsız; sırayla beklemek boşuna gecikme olurdu.
  const [
    grid,
    dataGeneratedAt,
    curated,
    clubCount,
    playerCount,
    leagues,
    user,
  ] = await Promise.all([
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
    // "Kapsam" şeridinin GERÇEK sayıları (§5.2): uydurma değil, veri kümesi.
    datasets.countSelectableClubs(),
    datasets.countPlayers(),
    listLeagues({ clubs: repositories.clubs }),
    currentUser(),
  ]);

  const curatedClubs = curated
    .map(toClubDto)
    .sort((a, b) => a.shortName.localeCompare(b.shortName, "tr"));

  /**
   * ODAYA ÇAĞRI ŞERİDİ — §12.9, İstatistik/Hangisi Daha ile aynı kapı (§12.7).
   * Hesap kapalıyken HİÇ gösterilmez (`/oda` 404 döner); girişsizde `/giris`.
   */
  const accounts = accountsRepository();
  const roomEntry =
    accounts === null ? undefined : (
      <RoomEntryBar mode="izgara" signedIn={user !== null} />
    );

  return (
    <PageShell>
      <GridQuiz
        grid={grid}
        curatedClubs={curatedClubs}
        {...(roomEntry === undefined ? {} : { roomEntry })}
      />

      {/*
        SEO/tanıtım bölümü — §7.11. Oyunun altında, ikincil tonda. Stitch'in
        üç kurallı düzeni: kartlar GERÇEK kurallar (BR-9/BR-10/BR-13);
        Stitch'in üçüncü kartı "Nadirlik Puanı" idi ve o uydurmaydı (§5.2) —
        gerçek bir kuralla (sınırlı deneme + pes et) değiştirildi. Kapsam
        şeridi de gerçek sayıları taşır.
      */}
      <section
        id="nasil-oynanir"
        className="flex scroll-mt-24 flex-col gap-5 border-t border-line pt-8"
      >
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <h2 className="text-lg font-semibold">
            Futbol ızgara oyunu nasıl oynanır?
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
