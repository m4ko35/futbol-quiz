import type { Metadata } from "next";
import { getDailyStatMatch } from "@/application/use-cases/daily-stat-match";
import { getStoredRound } from "@/application/use-cases/stored-round";
import { SiteFooter } from "@/components/site-footer";
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
  title: "İstatistik Eşleştirme — Futbol Quiz",
  description:
    "Her gün bir futbolcu ve istatistikleri. Her sayıya en yakın değere " +
    "sahip başka oyuncuları bulun.",
};

export default async function StatMatchPage() {
  const now = new Date();

  const [daily, dataGeneratedAt, user] = await Promise.all([
    getDailyStatMatch(now, repositories),
    datasets.getGeneratedAt(),
    currentUser(),
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

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-5 py-10 sm:px-6 sm:py-14">
      <StatMatchQuiz
        daily={daily}
        {...(serverAnswers === undefined ? {} : { serverAnswers })}
      />

      <SiteFooter dataGeneratedAt={dataGeneratedAt} />
    </main>
  );
}
