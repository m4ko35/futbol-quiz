import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getLeaderboard,
  type LeaderboardRowDto,
} from "@/application/use-cases/leaderboard";
import { ReportNameDialog } from "@/components/report-name-dialog";
import { SiteFooter } from "@/components/site-footer";
import { MAX_ROUND_POINTS } from "@/domain/services/daily-round";
import {
  isLeaderboardPeriod,
  type LeaderboardPeriod,
} from "@/domain/services/leaderboard";
import { accountsRepository, datasets } from "@/infrastructure/db/repositories";
import { currentUser } from "@/lib/auth/current-user";

/**
 * Lider tablosu — PROJECT.md §11.5, BR-50.
 *
 * SEKMELER BAĞLANTI, DÜĞME DEĞİL. Her dönem kendi adresine sahip: paylaşılabilir,
 * geri tuşu çalışır ve JavaScript olmadan da açılır. İstemci tarafı bir sekme
 * bileşeni bunların üçünü de kaybettirirdi ve karşılığında yalnızca sayfa
 * yenilenmemesini kazandırırdı.
 */

export const metadata: Metadata = {
  title: "Lider Tablosu — Futbol Quiz",
  description:
    "Günlük istatistik bulmacasını çözenlerin sıralaması: günlük, haftalık ve tüm zamanlar.",
};

const PERIODS: readonly {
  readonly key: LeaderboardPeriod;
  readonly label: string;
  /** Boş tabloda ne yazacağı — dönemin kendisine göre değişir. */
  readonly empty: string;
}[] = [
  {
    key: "daily",
    label: "Bugün",
    empty: "Bugün henüz kimse turu tamamlamadı. İlk sen ol.",
  },
  {
    key: "weekly",
    label: "Bu hafta",
    empty: "Bu hafta henüz tamamlanmış tur yok.",
  },
  {
    key: "allTime",
    label: "Tüm zamanlar",
    empty: "Henüz tamamlanmış tur yok.",
  },
];

interface PageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function Row({
  row,
  canReport,
}: {
  readonly row: LeaderboardRowDto;
  /**
   * Bildirim düğmesi YALNIZCA giriş yapmışa çizilir (BR-53): bildirmek için
   * giriş şart, yani girişsiz kullanıcıya düğme göstermek onu çalışmayan bir
   * eyleme davet etmek olurdu.
   */
  readonly canReport: boolean;
}) {
  return (
    <tr
      className={
        row.isMe ? "bg-accent-soft font-semibold" : "odd:bg-surface-2/40"
      }
    >
      <td className="px-3 py-2.5 text-right tabular-nums">{row.rank}</td>
      <td className="px-3 py-2.5">
        {row.displayName}
        {row.isMe && <span className="ml-2 text-xs text-muted">(sen)</span>}
        {/* Kendi adını bildirmek sayımı bozardı (§11.12) — düğme de çizilmez. */}
        {canReport && !row.isMe && (
          <ReportNameDialog displayName={row.displayName} />
        )}
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums">{row.points}</td>
      <td className="px-3 py-2.5 text-right tabular-nums text-muted">
        {row.days}
      </td>
    </tr>
  );
}

export default async function LeaderboardPage({ searchParams }: PageProps) {
  const accounts = accountsRepository();
  // Hesap özelliği kapalıysa tablo da yoktur — boş bir tablo göstermek,
  // kimsenin oynamadığı izlenimi verirdi (§11).
  if (accounts === null) notFound();

  const params = await searchParams;
  const requested = typeof params.donem === "string" ? params.donem : "daily";
  // Bilinmeyen dönem SESSİZCE günlüğe düşer: adresi elle yazan biri için
  // hata sayfası göstermek orantısız.
  const period: LeaderboardPeriod = isLeaderboardPeriod(requested)
    ? requested
    : "daily";

  const user = await currentUser();
  const [board, dataGeneratedAt] = await Promise.all([
    getLeaderboard(period, new Date(), user?.id ?? null, { accounts }),
    datasets.getGeneratedAt(),
  ]);

  const active = PERIODS.find((p) => p.key === period) ?? PERIODS[0];

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-5 py-10 sm:px-6 sm:py-14">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          Lider Tablosu
        </h1>
        <p className="max-w-prose text-lg text-muted">
          Günlük istatistik bulmacasını <strong>tamamlayan</strong> herkes
          listede. Bir günün en yüksek puanı {MAX_ROUND_POINTS}.
        </p>
      </header>

      <nav aria-label="Dönem" className="flex flex-wrap gap-2">
        {PERIODS.map((option) => {
          const selected = option.key === period;

          return (
            <Link
              key={option.key}
              href={`/lider-tablosu?donem=${option.key}`}
              aria-current={selected ? "page" : undefined}
              className={
                selected
                  ? "rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-accent-fg"
                  : "rounded-lg border border-line px-3.5 py-2 text-sm font-medium text-muted hover:border-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              }
            >
              {option.label}
            </Link>
          );
        })}
      </nav>

      {board.rows.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-6 text-center text-muted shadow-card">
          {active?.empty}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface shadow-card">
          <table className="w-full min-w-[26rem] border-collapse text-sm">
            <caption className="sr-only">
              {active?.label} dönemi sıralaması
            </caption>
            <thead>
              <tr className="border-b border-line text-xs tracking-wide text-muted uppercase">
                <th scope="col" className="px-3 py-2.5 text-right">
                  Sıra
                </th>
                <th scope="col" className="px-3 py-2.5 text-left">
                  Oyuncu
                </th>
                <th scope="col" className="px-3 py-2.5 text-right">
                  Puan
                </th>
                <th scope="col" className="px-3 py-2.5 text-right">
                  Gün
                </th>
              </tr>
            </thead>
            <tbody>
              {board.rows.map((row) => (
                <Row
                  key={`${row.rank}-${row.displayName}`}
                  row={row}
                  canReport={user !== null}
                />
              ))}

              {/* Kullanıcı ilk 50'de değilse kendi satırı ayrıca gösterilir:
                  sırasını göremeyen kullanıcı için tablo bir duvardır. */}
              {board.me !== null && (
                <>
                  <tr>
                    <td
                      colSpan={4}
                      className="px-3 py-1 text-center text-muted"
                    >
                      ⋯
                    </td>
                  </tr>
                  <Row row={board.me} canReport={user !== null} />
                </>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/*
        AYNI DAVET BURADA DA (§11.11). Tabloyu açan ama girişi olmayan biri
        listeye nasıl gireceğini soruyor; cevabı sayfanın kendisinde yoksa
        aramak zorunda kalır.
      */}
      {user === null && (
        <p className="rounded-xl border border-line bg-surface-2/40 px-4 py-3 text-sm text-muted">
          Listeye girmek için{" "}
          <Link
            href="/giris"
            className="font-semibold text-accent underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            giriş yap
          </Link>{" "}
          ve günün{" "}
          <Link
            href="/istatistik"
            className="font-semibold text-accent underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            istatistik bulmacasını
          </Link>{" "}
          tamamla.
        </p>
      )}

      <p className="max-w-prose text-sm text-muted">
        Yarım bırakılan turlar listeye girmez. Oynanmayan gün sıfır sayılır —
        haftalık ve tüm zamanlar sıralaması <strong>toplam</strong> puandır,
        yani düzenli oynamak yükseltir. Eşit puanlar aynı sırayı paylaşır.
      </p>

      <SiteFooter dataGeneratedAt={dataGeneratedAt} />
    </main>
  );
}
