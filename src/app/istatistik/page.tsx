import type { Metadata } from "next";
import Link from "next/link";
import { getDailyStatMatch } from "@/application/use-cases/daily-stat-match";
import { getStoredRound } from "@/application/use-cases/stored-round";
import { PageShell } from "@/components/page-shell";
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
      />

      {/*
        ODAYA GİRİŞ BURADA, MOD ŞERİDİNDE DEĞİL — §12.
        Oda beşinci bir oyun modu değil, İSTATİSTİK MODUNUN bir oynanış
        biçimi: aynı oyun, aynı kurallar, tek fark karşında birinin olması.
        Şeride koymak onu ayrı bir oyun gibi gösterirdi ve şerit zaten dört
        öğeyle ölçülmüştü (§7.17). Doğal yeri, aynı oyunu tek başına oynadığın
        sayfanın altı.

        HESAP KAPALIYKEN HİÇ GÖSTERİLMİYOR: `/oda` o kurulumda 404 döner ve
        çalışmayan bir kapıyı tanıtmak, §11.11'de düzeltilen kusurun aynısı
        olurdu.
      */}
      {accounts !== null && (
        <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5 shadow-card">
          <h2 className="text-xl font-bold tracking-tight">
            Arkadaşına karşı oyna
          </h2>
          <p className="max-w-prose text-sm text-muted">
            Bir oda kur, kodu arkadaşına gönder.{" "}
            <strong className="font-semibold text-foreground">
              İkinize de aynı futbolcu
            </strong>{" "}
            açılır; altı istatistikte daha çok puan toplayan kazanır.
          </p>

          <Link
            href={user === null ? "/giris" : "/oda"}
            className="w-fit rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-accent-fg transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {user === null ? "Giriş yap ve oda kur" : "Oda kur veya koda katıl"}
          </Link>
        </section>
      )}

      <SiteFooter dataGeneratedAt={dataGeneratedAt} />
    </PageShell>
  );
}
