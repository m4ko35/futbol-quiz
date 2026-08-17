import type {
  Account,
  AccountsRepository,
  SaveAnswerResult,
  SaveReportResult,
  StoredRound,
} from "@/application/ports/accounts-repository";
import type { RoundAnswer, RoundState } from "@/domain/services/daily-round";
import type { CompletedRound } from "@/domain/services/leaderboard";
import { isStatKey } from "@/domain/services/stat-match";
import type { ReportReason } from "@/domain/value-objects/report-reason";
import { Prisma, type PrismaClient } from "@/generated/prisma-accounts";

/**
 * `AccountsRepository`'nin Prisma/Turso uygulaması — PROJECT.md §11.3.
 *
 * Ham SQL YOK (§7.2): sorgu kurucusu kullanılıyor.
 */

/** Benzersizlik kısıtı ihlali — BR-43/BR-17'nin yarış kapısı. */
const UNIQUE_VIOLATION = "P2002";

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === UNIQUE_VIOLATION
  );
}

/** Veritabanı satırlarından tur durumu — saf alana çevrilir. */
function toRoundState(
  rows: readonly {
    statKey: string;
    playerId: string;
    value: number;
    score: number;
  }[],
): RoundState {
  const answers: RoundAnswer[] = [];

  for (const row of rows) {
    /**
     * TANIMSIZ İSTATİSTİK ATLANIR. Bugün olamaz — anahtarları biz yazıyoruz.
     * Yarın olabilir: `STAT_KEYS` değişirse eski turlar artık tanınmayan bir
     * anahtar taşır. Atlamak, kullanıcının yeni istatistiği cevaplayabilmesini
     * sağlar.
     *
     * Bu, turun SAKLANAN puanını değiştirmez: lider tablosu `points`
     * sütununu okur (aşağıda), buradan yeniden hesaplamaz. Yani geçmiş
     * sıralamalar bir anahtar değişikliğiyle geriye dönük bozulmaz.
     */
    if (!isStatKey(row.statKey)) continue;

    answers.push({
      statKey: row.statKey,
      playerId: row.playerId,
      value: row.value,
      score: row.score,
    });
  }

  return { answers };
}

export class PrismaAccountsRepository implements AccountsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findBySubjectHash(subjectHash: string): Promise<Account | null> {
    const user = await this.prisma.user.findUnique({
      where: { subjectHash },
      select: { id: true, displayName: true },
    });

    return user;
  }

  async findById(id: string): Promise<Account | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, displayName: true },
    });

    return user;
  }

  async findByDisplayNameKey(key: string): Promise<Account | null> {
    const user = await this.prisma.user.findUnique({
      where: { displayNameKey: key },
      select: { id: true, displayName: true },
    });

    return user;
  }

  async createAccount(input: {
    readonly subjectHash: string;
    readonly displayName: string;
    readonly displayNameKey: string;
  }): Promise<Account | null> {
    try {
      const user = await this.prisma.user.create({
        data: {
          id: crypto.randomUUID(),
          subjectHash: input.subjectHash,
          displayName: input.displayName,
          displayNameKey: input.displayNameKey,
        },
        select: { id: true, displayName: true },
      });

      return user;
    } catch (error: unknown) {
      /**
       * Ad ALINMIŞ. Kontrol edip sonra yazmak yerine yazıp yakalamak bilinçli:
       * iki kullanıcı aynı adı aynı anda seçerse "önce bak" yaklaşımı ikisine
       * de yeşil ışık yakar. Kısıt ise yalnızca birine izin verir.
       */
      if (isUniqueViolation(error)) return null;
      throw error;
    }
  }

  async deleteAccount(id: string): Promise<void> {
    // Turlar ve cevaplar şemadaki `onDelete: Cascade` ile birlikte gider
    // (BR-48); ayrıca silmek gerekmiyor ve gerekmemesi de sınandı (§11.3).
    await this.prisma.user.delete({ where: { id } });
  }

  async findRound(
    userId: string,
    puzzleDay: number,
  ): Promise<StoredRound | null> {
    const round = await this.prisma.dailyRound.findUnique({
      where: { userId_puzzleDay: { userId, puzzleDay } },
      select: {
        id: true,
        puzzleDay: true,
        completedAt: true,
        answers: {
          select: {
            statKey: true,
            playerId: true,
            value: true,
            score: true,
          },
          // Sıra KARARLI olmalı: turun cevap sırası kullanıcıya gösteriliyor
          // ve iki istekte iki farklı sıra dönmemeli.
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (round === null) return null;

    return {
      id: round.id,
      puzzleDay: round.puzzleDay,
      completedAt: round.completedAt,
      state: toRoundState(round.answers),
    };
  }

  async saveAnswer(input: {
    readonly userId: string;
    readonly puzzleDay: number;
    readonly answer: RoundAnswer;
    readonly complete: boolean;
  }): Promise<SaveAnswerResult> {
    try {
      /**
       * TEK İŞLEM: turu aç (yoksa), cevabı yaz, toplamı ve tamamlanma
       * damgasını güncelle. Ayrı yazılsalardı araya giren bir hata `points`
       * alanını cevaplarla tutarsız bırakır ve tablo sessizce yanlış sıralardı
       * (§11.4).
       */
      await this.prisma.$transaction(async (tx) => {
        const round = await tx.dailyRound.upsert({
          where: {
            userId_puzzleDay: {
              userId: input.userId,
              puzzleDay: input.puzzleDay,
            },
          },
          create: {
            id: crypto.randomUUID(),
            userId: input.userId,
            puzzleDay: input.puzzleDay,
            points: 0,
          },
          update: {},
          select: { id: true },
        });

        // Kısıt ihlali BURADA doğar: aynı istatistik (BR-43) ya da aynı
        // oyuncu (BR-17) ikinci kez yazılamaz.
        await tx.roundAnswer.create({
          data: {
            id: crypto.randomUUID(),
            roundId: round.id,
            statKey: input.answer.statKey,
            playerId: input.answer.playerId,
            value: input.answer.value,
            score: input.answer.score,
          },
        });

        await tx.dailyRound.update({
          where: { id: round.id },
          data: {
            // ARTIRMA, ATAMA DEĞİL: iki eşzamanlı cevap birbirinin toplamını
            // ezmemeli. Cevap satırı zaten kısıtla korunuyor ama farklı
            // istatistiklere aynı anda cevap vermek MEŞRU.
            points: { increment: input.answer.score },
            completedAt: input.complete ? new Date() : null,
          },
        });
      });
    } catch (error: unknown) {
      /**
       * YARIŞI KAYBETTİK. Eşzamanlı ikinci istek önce yazmış; kısıt durdurdu.
       * Bu bir hata değil, BR-43'ün ta kendisi — "ikinci istek ilk cevabı
       * döner". Saklanan tur okunup dönülüyor.
       */
      if (!isUniqueViolation(error)) throw error;

      const existing = await this.findRound(input.userId, input.puzzleDay);
      if (existing === null) throw error; // Olamaz; olursa gerçek bir hata.

      return { kind: "zaten-var", round: existing };
    }

    const saved = await this.findRound(input.userId, input.puzzleDay);
    if (saved === null) {
      throw new Error("Tur yazıldı ama okunamadı (§11.3).");
    }

    return { kind: "yazildi", round: saved };
  }

  async findCompletedRounds(
    range: { readonly from: number; readonly to: number } | null,
  ): Promise<readonly CompletedRound[]> {
    const rounds = await this.prisma.dailyRound.findMany({
      where: {
        // BR-45 — yarım tur sorguya HİÇ girmez.
        completedAt: { not: null },
        ...(range === null
          ? {}
          : { puzzleDay: { gte: range.from, lte: range.to } }),
      },
      select: {
        userId: true,
        puzzleDay: true,
        points: true,
        completedAt: true,
        user: { select: { displayName: true } },
      },
    });

    const completed: CompletedRound[] = [];

    for (const round of rounds) {
      // `completedAt` sorguda süzüldü; tip yine de daraltılmalı.
      if (round.completedAt === null) continue;

      completed.push({
        userId: round.userId,
        displayName: round.user.displayName,
        puzzleDay: round.puzzleDay,
        points: round.points,
        completedAt: round.completedAt,
      });
    }

    return completed;
  }

  async saveNameReport(input: {
    readonly reporterId: string;
    readonly reportedId: string;
    readonly reason: ReportReason;
  }): Promise<SaveReportResult> {
    try {
      await this.prisma.nameReport.create({
        data: {
          id: crypto.randomUUID(),
          reporterId: input.reporterId,
          reportedId: input.reportedId,
          reason: input.reason,
        },
        select: { id: true },
      });

      return "yazildi";
    } catch (error: unknown) {
      /**
       * ZATEN BİLDİRMİŞ. `createAccount` ile aynı biçim: önce bakıp sonra
       * yazmak yerine yazıp yakalıyoruz, çünkü eşzamanlı iki istekte "önce
       * bak" ikisine de yeşil ışık yakar ve sayım şişer.
       */
      if (isUniqueViolation(error)) return "zaten-bildirdi";
      throw error;
    }
  }
}
