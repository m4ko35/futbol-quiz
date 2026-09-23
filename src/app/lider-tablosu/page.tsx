import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getLeaderboard,
  type LeaderboardRowDto,
} from "@/application/use-cases/leaderboard";
import { DataLabel } from "@/components/data-label";
import { LeaderboardShareButton } from "@/components/leaderboard-share";
import { PageShell } from "@/components/page-shell";
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
  title: "Lider Tablosu — Futbol Challenge",
  alternates: { canonical: "/lider-tablosu" },
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

/**
 * "Nasıl puan hesaplanır" kartları — hepsi GERÇEK kural (BR-45 + §11.5 + §11.6).
 *
 * Stitch sayfanın altındaki tek paragrafı üç kart çiziyordu ama içeriği
 * ("%40 nadirlik · %30 seri · %30 doğruluk" formülü) uydurmaydı (§5.2). Gerçek
 * kurallar kondu: tamamla-gir, toplam, gizlilik. İçerik statik — modül
 * düzeyinde bir sabit (ızgara/istatistik/hangisi-daha'daki desen).
 */
const HOW_TO_RULES: readonly {
  readonly title: string;
  readonly body: string;
}[] = [
  {
    title: "Tamamla, Listeye Gir",
    body: "Günün istatistik bulmacasının altı sorusunu da tamamlayan herkes listede. Yarım bırakılan tur girmez. Bir günün en yüksek puanı 600 (altı istatistik × 100).",
  },
  {
    title: "Toplam Puan Yükseltir",
    body: "Haftalık ve tüm zamanlar sıralaması toplam puandır; oynanmayan gün sıfır sayılır, düzenli oynamak yükseltir. Eşit puanlar aynı sırayı paylaşır.",
  },
  {
    title: "Şeffaf ve Anonim",
    body: "Gerçek ad zorunlu değil; istediğin takma adı seçersin. Google girişinde e-posta gizli kalır, üçüncü tarafla paylaşılmaz. Tablo herkese açıktır.",
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
      {/*
        PODYUM TİPOGRAFİYLE KURULUYOR, RENKLE DEĞİL.

        İlk üçü `accent` ile boyamak akla geldi ve reddedildi: §7.12 o rolü
        "kaydın dili" olarak tanımlıyor — seçici, gezinme, birincil eylem,
        odak konturu. Sırayı onunla boyamak, kullanıcının öğrendiği anlamı
        sulandırırdı. Ağırlık ve ölçü aynı hiyerarşiyi rol karıştırmadan
        kuruyor.

        ERİŞİLEBİLİRLİK AÇISINDAN SÜSLEME: sıra bilgisi zaten sayının
        kendisinde. Buradaki vurgu bir bilgi taşımıyor, yalnızca onu
        pekiştiriyor — yani WCAG 1.4.1'in "renk tek gösterge olmasın"
        kuralına konu değil.
      */}
      <td className="px-3 py-3 text-right">
        <span
          className={
            row.rank <= 3
              ? "font-display text-2xl leading-none font-bold tabular-nums"
              : "font-display text-base tabular-nums text-muted"
          }
        >
          {row.rank}
        </span>
      </td>
      <td className={row.rank <= 3 ? "px-3 py-3 font-semibold" : "px-3 py-3"}>
        {row.displayName}
        {row.isMe && <span className="ml-2 text-xs text-muted">(sen)</span>}
        {/* Kendi adını bildirmek sayımı bozardı (§11.12) — düğme de çizilmez. */}
        {canReport && !row.isMe && (
          <ReportNameDialog displayName={row.displayName} />
        )}
      </td>
      {/* Puan tablonun manşet sayısı — condensed editorial yüz (§7.12). */}
      <td className="px-3 py-3 text-right font-display text-base font-bold tabular-nums">
        {row.points}
      </td>
      <td className="px-3 py-3 text-right font-display tabular-nums text-muted">
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
  const activeLabel = active?.label ?? PERIODS[0]?.label ?? "Bugün";

  // Kullanıcının KENDİ satırı — görünür satırlar arasında ya da `me` alanında
  // (ilk 50'de değilse). "Senin sıralaman" bandı bunu öne çıkarır (§11.5).
  const ownRow = board.rows.find((row) => row.isMe) ?? board.me;

  return (
    <PageShell>
      <header className="flex flex-col gap-3">
        <DataLabel as="p" className="text-accent">
          Günlük istatistik sıralaması
        </DataLabel>
        <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          Lider Tablosu
        </h1>
        <p className="max-w-prose text-lg text-muted">
          Günlük istatistik bulmacasını <strong>tamamlayan</strong> herkes
          listede. Bir günün en yüksek puanı {MAX_ROUND_POINTS}.
        </p>
        {/* "Nasıl puan hesaplanır?" çapası — Stitch'in başlık düğmesinin
            karşılığı; sayfanın altındaki gerçek-kural kartlarına iner. */}
        <a
          href="#nasil-puanlama"
          className="font-display inline-flex w-fit items-center gap-1.5 text-sm font-semibold tracking-wide text-accent uppercase underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.4c-.7.3-1 .8-1 1.5v.3" />
            <path d="M12 17h.01" />
          </svg>
          <span>Nasıl puan hesaplanır?</span>
        </a>
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
                  ? "inline-flex min-h-11 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-accent-fg"
                  : "inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-sm font-medium text-muted hover:border-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              }
            >
              {option.label}
            </Link>
          );
        })}
      </nav>

      {/*
        KENDİ-DURUM BÖLGESİ (§11.5, Stitch dili) — tablonun üstünde, üç durum
        tek yerde: dereceye girmişe vurgulu sıra bandı + paylaş; girmiş ama
        listede olmayana "tamamla" çağrısı; girişsize giriş çağrısı.
      */}
      {ownRow !== null && (
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 rounded-xl border-2 border-accent bg-accent-soft px-4 py-4 shadow-card sm:px-6">
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <DataLabel className="text-accent">Senin sıralaman</DataLabel>
              <span className="font-display text-3xl leading-none font-bold tabular-nums sm:text-4xl">
                #{ownRow.rank}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-semibold">{ownRow.displayName}</span>
              <span className="text-sm text-muted">
                <strong className="font-display tabular-nums text-foreground">
                  {ownRow.points}
                </strong>{" "}
                puan · {ownRow.days} gün · {activeLabel}
              </span>
            </div>
          </div>

          <LeaderboardShareButton
            rank={ownRow.rank}
            points={ownRow.points}
            periodLabel={activeLabel}
            period={period}
          />
        </div>
      )}

      {/* Giriş yapmış ama bu dönemde dereceye girmemiş: tablo bir duvar değil,
          bir davet olmalı. */}
      {user !== null && ownRow === null && board.rows.length > 0 && (
        <p className="rounded-xl border border-line bg-surface-2/40 px-4 py-3 text-sm text-muted">
          Bu {activeLabel.toLocaleLowerCase("tr-TR")} döneminde henüz listede
          değilsin. Günün{" "}
          <Link
            href="/istatistik"
            className="font-semibold text-accent underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            istatistik bulmacasını
          </Link>{" "}
          tamamla, ismin buraya gelsin.
        </p>
      )}

      {/*
        AYNI DAVET GİRİŞSİZE (§11.11). Tabloyu açan ama girişi olmayan biri
        listeye nasıl gireceğini soruyor; cevabı sayfanın kendisinde yoksa
        aramak zorunda kalır. Kendi-durum bölgesinde, tablonun üstünde.
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
              {/* Sütun başlıkları editorial etiket idyomunda: condensed
                  (font-display), büyük harf, tracking'li — DataLabel ile aynı
                  ritim; th'ler tr'den miras alır. */}
              <tr className="border-b border-line font-display text-xs font-semibold tracking-[0.08em] text-muted uppercase">
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
        "Nasıl puan hesaplanır?" — §11.5. Stitch'in üç kartlı düzeni, ama
        GERÇEK kurallarla (BR-45 + toplam kuralı + gizlilik); Stitch'in
        "%40 nadirlik · %30 seri · %30 doğruluk" formülü uydurmaydı (§5.2).
        Numara rozeti süsleme (aria-hidden): kurallar sıralı adımlar değil,
        üç eş kural — `ul`, `ol` değil.
      */}
      <section
        id="nasil-puanlama"
        className="flex scroll-mt-24 flex-col gap-5 border-t border-line pt-8"
      >
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <h2 className="text-lg font-semibold">Nasıl puan hesaplanır?</h2>
          <DataLabel className="text-muted">Sıralama kuralları</DataLabel>
        </div>

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
      </section>

      <SiteFooter dataGeneratedAt={dataGeneratedAt} />
    </PageShell>
  );
}
