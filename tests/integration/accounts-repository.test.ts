import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { RoundAnswer } from "@/domain/services/daily-round";
import { PrismaAccountsRepository } from "@/infrastructure/db/repositories/prisma-accounts-repository";
import {
  createAccountsDatabase,
  type AccountsTestDatabase,
} from "../helpers/accounts-database";

/**
 * Hesap deposunun port sözleşmesini GERÇEK şemayla ölçer (§8.1, §11).
 *
 * Buradaki testlerin çoğu bir Prisma sorgusunu değil, bir KURALI doğruluyor:
 * BR-43'ün tek denemesi, BR-17'nin tek oyuncusu ve BR-45'in yarım tur
 * dışlaması veritabanı kısıtlarına dayanıyor. Saf birim testleri o kısıtların
 * gerçekten var olduğunu söyleyemez.
 */

let db: AccountsTestDatabase;
let repo: PrismaAccountsRepository;

const answer = (
  statKey: RoundAnswer["statKey"],
  playerId: string,
  score: number,
): RoundAnswer => ({ statKey, playerId, value: 10, score });

async function newAccount(name: string, subject = `ozet-${name}`) {
  const account = await repo.createAccount({
    subjectHash: subject,
    displayName: name,
    displayNameKey: name.toLowerCase(),
  });
  if (account === null) throw new Error(`hesap acilamadi: ${name}`);
  return account;
}

beforeAll(() => {
  db = createAccountsDatabase();
  repo = new PrismaAccountsRepository(db.prisma);
});

afterAll(async () => {
  await db.destroy();
});

beforeEach(async () => {
  // Cascade sayesinde kullanıcıyı silmek turları ve cevapları da siler.
  await db.prisma.user.deleteMany();
});

describe("hesap", () => {
  it("acilir ve iki yoldan da bulunur", async () => {
    const created = await newAccount("Mehmet");

    expect(await repo.findById(created.id)).toEqual(created);
    expect(await repo.findBySubjectHash("ozet-Mehmet")).toEqual(created);
  });

  it("olmayan hesap null doner — hata degil", async () => {
    expect(await repo.findById("yok")).toBeNull();
    expect(await repo.findBySubjectHash("yok")).toBeNull();
  });

  /**
   * BR-46 — ad ALINMISSA null. Sessizce baska bir ad verilmez: kullanıcı
   * kendi seçtiği adla açıldığını sanmamalı.
   */
  it("ALINMIS ad icin null doner", async () => {
    await newAccount("Mehmet");

    const ikinci = await repo.createAccount({
      subjectHash: "baska-ozet",
      displayName: "MEHMET",
      displayNameKey: "mehmet",
    });

    expect(ikinci).toBeNull();
  });

  it("ayni Google hesabi ikinci kez acilamaz", async () => {
    await newAccount("Mehmet");

    const ikinci = await repo.createAccount({
      subjectHash: "ozet-Mehmet",
      displayName: "Baska",
      displayNameKey: "baska",
    });

    expect(ikinci).toBeNull();
  });
});

describe("tur yazma — BR-43, BR-44", () => {
  it("ilk cevap turu ACAR", async () => {
    const user = await newAccount("Ali");

    expect(await repo.findRound(user.id, 20260815)).toBeNull();

    const result = await repo.saveAnswer({
      userId: user.id,
      puzzleDay: 20260815,
      answer: answer("goals", "p1", 80),
      complete: false,
    });

    expect(result.kind).toBe("yazildi");
    expect(result.round.state.answers).toHaveLength(1);
    expect(result.round.completedAt).toBeNull();
  });

  /**
   * SAYFAYI ACIP OYNAMAYAN icin satir uretilmez; aksi halde lider tablosu
   * "0 puanli" kayitlarla dolardi.
   */
  it("okuma tur ACMAZ", async () => {
    const user = await newAccount("Ali");

    await repo.findRound(user.id, 20260815);

    expect(await db.prisma.dailyRound.count()).toBe(0);
  });

  it("puan sunucuda BIRIKIR", async () => {
    const user = await newAccount("Ali");

    await repo.saveAnswer({
      userId: user.id,
      puzzleDay: 20260815,
      answer: answer("goals", "p1", 80),
      complete: false,
    });
    const result = await repo.saveAnswer({
      userId: user.id,
      puzzleDay: 20260815,
      answer: answer("clubs", "p2", 55),
      complete: false,
    });

    expect(result.round.state.answers).toHaveLength(2);

    const stored = await db.prisma.dailyRound.findFirst({
      select: { points: true },
    });
    expect(stored?.points).toBe(135);
  });

  /**
   * T1'IN KAPISI. Kisit olmasaydi ayni istatistige onlarca oyuncu denenip en
   * iyisi saklanabilirdi.
   */
  it("AYNI istatistige ikinci cevap yazilmaz", async () => {
    const user = await newAccount("Ali");

    await repo.saveAnswer({
      userId: user.id,
      puzzleDay: 20260815,
      answer: answer("goals", "p1", 40),
      complete: false,
    });

    const ikinci = await repo.saveAnswer({
      userId: user.id,
      puzzleDay: 20260815,
      answer: answer("goals", "mukemmel", 100),
      complete: false,
    });

    expect(ikinci.kind).toBe("zaten-var");
    expect(ikinci.round.state.answers).toHaveLength(1);
    expect(ikinci.round.state.answers[0]?.score).toBe(40);
  });

  it("puan reddedilen ikinci denemeyle ARTMAZ", async () => {
    const user = await newAccount("Ali");

    await repo.saveAnswer({
      userId: user.id,
      puzzleDay: 20260815,
      answer: answer("goals", "p1", 40),
      complete: false,
    });
    await repo.saveAnswer({
      userId: user.id,
      puzzleDay: 20260815,
      answer: answer("goals", "mukemmel", 100),
      complete: false,
    });

    const stored = await db.prisma.dailyRound.findFirst({
      select: { points: true },
    });
    expect(stored?.points).toBe(40);
  });

  /** BR-17 — bir oyuncu turda yalnizca bir istatistikte. */
  it("AYNI oyuncu baska istatistikte kullanilamaz", async () => {
    const user = await newAccount("Ali");

    await repo.saveAnswer({
      userId: user.id,
      puzzleDay: 20260815,
      answer: answer("goals", "p1", 40),
      complete: false,
    });

    const ikinci = await repo.saveAnswer({
      userId: user.id,
      puzzleDay: 20260815,
      answer: answer("clubs", "p1", 90),
      complete: false,
    });

    expect(ikinci.kind).toBe("zaten-var");
    expect(ikinci.round.state.answers).toHaveLength(1);
  });

  it("ayri gunler ayri turlardir", async () => {
    const user = await newAccount("Ali");

    await repo.saveAnswer({
      userId: user.id,
      puzzleDay: 20260815,
      answer: answer("goals", "p1", 40),
      complete: false,
    });
    const ertesi = await repo.saveAnswer({
      userId: user.id,
      puzzleDay: 20260816,
      answer: answer("goals", "p1", 70),
      complete: false,
    });

    expect(ertesi.kind).toBe("yazildi");
    expect(await db.prisma.dailyRound.count()).toBe(2);
  });

  it("cevap sirasi KARARLIDIR", async () => {
    const user = await newAccount("Ali");

    for (const [key, player] of [
      ["clubs", "p1"],
      ["goals", "p2"],
      ["heightCm", "p3"],
    ] as const) {
      await repo.saveAnswer({
        userId: user.id,
        puzzleDay: 20260815,
        answer: answer(key, player, 50),
        complete: false,
      });
    }

    const round = await repo.findRound(user.id, 20260815);
    expect(round?.state.answers.map((a) => a.statKey)).toEqual([
      "clubs",
      "goals",
      "heightCm",
    ]);
  });
});

describe("lider tablosu kaynagi — BR-45, BR-50", () => {
  async function tamamlanmisTur(
    name: string,
    puzzleDay: number,
    score: number,
  ) {
    const user = await newAccount(name, `ozet-${name}`);
    await repo.saveAnswer({
      userId: user.id,
      puzzleDay,
      answer: answer("goals", `p-${name}`, score),
      complete: true,
    });
    return user;
  }

  it("tamamlanmis tur completedAt tasir", async () => {
    await tamamlanmisTur("Ali", 20260815, 90);

    const rounds = await repo.findCompletedRounds(null);
    expect(rounds).toHaveLength(1);
    expect(rounds[0]?.points).toBe(90);
    expect(rounds[0]?.displayName).toBe("Ali");
  });

  /** YARIM TUR TABLOYA HIC GIRMEZ — suzgec sorgunun icinde. */
  it("yarim tur listeye GIRMEZ", async () => {
    const user = await newAccount("Yarim");
    await repo.saveAnswer({
      userId: user.id,
      puzzleDay: 20260815,
      answer: answer("goals", "p1", 100),
      complete: false,
    });

    expect(await repo.findCompletedRounds(null)).toHaveLength(0);
  });

  it("gun araligi suzer", async () => {
    await tamamlanmisTur("Pazartesi", 20260810, 100);
    await tamamlanmisTur("Cuma", 20260814, 200);
    await tamamlanmisTur("Sonraki", 20260817, 300);

    const hafta = await repo.findCompletedRounds({
      from: 20260810,
      to: 20260816,
    });

    expect(hafta.map((r) => r.points).sort((a, b) => a - b)).toEqual([
      100, 200,
    ]);
  });

  it("aralik yoksa tum zamanlar doner", async () => {
    await tamamlanmisTur("A", 20260810, 100);
    await tamamlanmisTur("B", 20270101, 200);

    expect(await repo.findCompletedRounds(null)).toHaveLength(2);
  });
});

describe("hesap silme — BR-48", () => {
  it("hesapla birlikte turlar ve cevaplar da silinir", async () => {
    const user = await newAccount("Silinecek");
    await repo.saveAnswer({
      userId: user.id,
      puzzleDay: 20260815,
      answer: answer("goals", "p1", 90),
      complete: true,
    });

    await repo.deleteAccount(user.id);

    expect(await repo.findById(user.id)).toBeNull();
    expect(await db.prisma.dailyRound.count()).toBe(0);
    expect(await db.prisma.roundAnswer.count()).toBe(0);
  });

  it("silinen hesabin turu lider tablosundan da duser", async () => {
    const user = await newAccount("Silinecek");
    await repo.saveAnswer({
      userId: user.id,
      puzzleDay: 20260815,
      answer: answer("goals", "p1", 90),
      complete: true,
    });

    await repo.deleteAccount(user.id);

    expect(await repo.findCompletedRounds(null)).toHaveLength(0);
  });
});
