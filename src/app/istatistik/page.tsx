import type { Metadata } from "next";
import { getDailyStatMatch } from "@/application/use-cases/daily-stat-match";
import { getStoredRound } from "@/application/use-cases/stored-round";
import { listLeagues } from "@/application/use-cases/search-clubs";
import { DataLabel } from "@/components/data-label";
import { PageShell } from "@/components/page-shell";
import { RoomEntryBar } from "@/components/room-entry-bar";
import { SiteFooter } from "@/components/site-footer";
import type { RoundRecording } from "@/components/stat-match-game";
import { StatMatchQuiz } from "@/components/stat-match-quiz";
import {
  accountsRepository,
  datasets,
  repositories,
} from "@/infrastructure/db/repositories";
import { currentUser } from "@/lib/auth/current-user";
import type { StatMatchState } from "@/lib/stat-match-storage";

/**
 * İstatistik eşleştirme ekranı — PROJECT.md §9.2.
 *
 * Sunucu bileşeni: günün oyuncusunu use-case'ten DOĞRUDAN alır, kendi API'sine
 * HTTP isteği atmaz.
 */

export const metadata: Metadata = {
  title: "İstatistik Eşleştirme — Futbol Challenge",
  alternates: { canonical: "/istatistik" },
  description:
    "Futbolcu istatistik tahmin oyunu: her gün bir futbolcunun gol, maç, " +
    "kulüp ve millî maç sayıları. Her değere en yakın başka futbolcuları " +
    "bulun. Ücretsiz futbol bilme oyunu.",
};

/**
 * "Nasıl oynanır" kartları — hepsi GERÇEK kural (BR-16/BR-18/BR-17).
 *
 * Stitch iki düz paragrafı yerine üç kart çiziyordu; kartların İÇERİĞİ ise
 * uydurmaydı ("logaritmik fark skalası", nadirlik). Gerçek kurallar kondu.
 * İçerik statik, bu yüzden modül düzeyinde bir sabit — her istekte yeniden
 * kurulmasına gerek yok (ızgara sayfasındaki `HOW_TO_RULES` ile aynı desen).
 */
const HOW_TO_RULES: readonly {
  readonly title: string;
  readonly body: string;
}[] = [
  {
    title: "Hedefe Yaklaşın",
    body: "Her istatistik için, değeri günün oyuncusuna en yakın olduğunu düşündüğünüz BAŞKA bir futbolcu seçin. Soru oyuncuyu tanımak değil, başkalarının büyüklüklerini bilmek.",
  },
  {
    title: "Fark ve Puan",
    body: "Puan, tahmininizin farkını o istatistiğin kendi yayılımına bölerek hesaplanır; ne kadar yakınsanız o kadar yüksek. Boy ile gol aynı kuralla, ölçeklerinden bağımsız puanlanır.",
  },
  {
    title: "Tek Kullanım",
    body: "Bir futbolcuyu yalnızca bir istatistikte kullanabilirsiniz; aynı isim iki değeri birden yakalayamaz. Oyun farklı büyüklükler için farklı isimler ister.",
  },
];

export default async function StatMatchPage() {
  const now = new Date();

  const [daily, dataGeneratedAt, user, leagues, clubCount, playerCount] =
    await Promise.all([
      getDailyStatMatch(now, repositories),
      datasets.getGeneratedAt(),
      currentUser(),
      // "Kapsam" şeridinin GERÇEK sayıları (§5.2): uydurma değil, veri kümesi.
      listLeagues({ clubs: repositories.clubs }),
      datasets.countSelectableClubs(),
      datasets.countPlayers(),
    ]);

  /**
   * SAKLANAN TUR SUNUCUDA OKUNUR (§11, BR-43).
   *
   * İstemciye bırakılsaydı sayfa önce boş çizilir, sonra tur "atlayarak"
   * gelirdi; daha kötüsü, o aradaki saniyede kullanıcı cevapladığı bir
   * istatistiği yeniden deneyip reddedilirdi.
   */
  const accounts = accountsRepository();
  const stored =
    user === null || accounts === null
      ? null
      : await getStoredRound(user.id, now, {
          accounts,
          players: repositories.players,
        });

  /** Saklanan turu oyun bileşeninin beklediği biçime çevirir. */
  const serverAnswers: StatMatchState["answers"] | undefined =
    stored === null
      ? undefined
      : Object.fromEntries(
          stored.answers.map((answer) => [
            answer.statKey,
            {
              playerId: answer.playerId,
              playerName: answer.playerName,
              value: answer.value,
              score: answer.score,
            },
          ]),
        );

  /**
   * KAYIT DURUMU BURADA HESAPLANIR — §11.11.
   *
   * İstemciye bırakılamaz: oturum bilgisi tarayıcıya ait değil. Orada
   * okunmaya çalışılsaydı sayfa önce "misafir" çizer, sonra durum atlayarak
   * düzelirdi — giriş yapmış kullanıcıya bir an "kaydedilmiyor" demek,
   * söylenebilecek en kötü yalan olurdu.
   *
   * Hesap özelliği kapalıyken `undefined`: olmayan bir özelliği tanıtmak
   * yanıltıcıdır ve `/giris` zaten 404 döner.
   */
  const recording: RoundRecording | undefined =
    accounts === null
      ? undefined
      : user === null
        ? { kind: "misafir" }
        : { kind: "kayitli", displayName: user.displayName };

  return (
    <PageShell>
      <StatMatchQuiz
        daily={daily}
        {...(serverAnswers === undefined ? {} : { serverAnswers })}
        {...(recording === undefined ? {} : { recording })}
        /*
          ODAYA ÇAĞRI İSTATİSTİK SATIRLARININ ÜSTÜNDE — §12.7.

          İlk hâli sayfanın en altındaydı ve orada görülmüyordu: altı satır ve
          sayı doğrularıyla birlikte yaklaşık 1.200 piksel aşağıda kalıyordu.
          Yeni yeri, kullanıcının "oyun ne, bugünün oyuncusu kim" sorularını
          yanıtlamış ama henüz OYNAMAYA BAŞLAMAMIŞ olduğu an.

          HESAP KAPALIYKEN HİÇ GÖSTERİLMİYOR: `/oda` o kurulumda 404 döner ve
          çalışmayan bir kapıyı tanıtmak, §11.11'de düzeltilen kusurun aynısı
          olurdu.
        */
        {...(accounts === null
          ? {}
          : { beforeStats: <RoomEntryBar signedIn={user !== null} /> })}
      />

      {/*
        SEO/tanıtım bölümü — §7.11. Oyunun altında, ikincil tonda. Stitch'in üç
        kartlı düzeni (§9.2): kartlar GERÇEK kurallar (BR-16/BR-18/BR-17);
        Stitch'in "logaritmik fark skalası"/nadirlik içeriği uydurmaydı (§5.2) —
        gerçek kurallarla değiştirildi. Kapsam şeridi de gerçek sayıları taşır.
      */}
      <section
        id="nasil-oynanir"
        className="flex scroll-mt-24 flex-col gap-5 border-t border-line pt-8"
      >
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <h2 className="text-lg font-semibold">
            İstatistik eşleştirme oyunu nasıl oynanır?
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
