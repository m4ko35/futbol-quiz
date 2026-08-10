import type { Metadata } from "next";
import { getDailyStatMatch } from "@/application/use-cases/daily-stat-match";
import { SiteFooter } from "@/components/site-footer";
import { StatMatchQuiz } from "@/components/stat-match-quiz";
import { datasets, repositories } from "@/infrastructure/db/repositories";

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
  const [daily, dataGeneratedAt] = await Promise.all([
    getDailyStatMatch(new Date(), repositories),
    datasets.getGeneratedAt(),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-5 py-10 sm:px-6 sm:py-14">
      <StatMatchQuiz daily={daily} />

      <SiteFooter dataGeneratedAt={dataGeneratedAt} />
    </main>
  );
}
