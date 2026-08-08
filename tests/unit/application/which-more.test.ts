import { describe, expect, it } from "vitest";
import { checkAnswer, getRound } from "@/application/use-cases/which-more";
import {
  RoundUnavailableError,
  ValidationError,
} from "@/domain/errors/domain-error";
import { playerId } from "@/domain/value-objects/identifiers";
import {
  FakeWhichMoreRepository,
  type FakeWhichMorePlayer,
} from "../../helpers/fake-repositories";

/**
 * §9.3 — tur kurulumu ve cevap doğrulama.
 *
 * Fake, port sözleşmesini gerçekten uyguluyor (band, taraf, dışlama); bu yüzden
 * buradaki testler "use-case doğru soruyor mu" sorusunu yanıtlıyor, sahte bir
 * cevabı ezberlemiyor.
 */

/** Boy (band 3 cm) üzerinden çalışıyoruz: aralıklar okunaklı. */
const POOL: FakeWhichMorePlayer[] = [
  { id: "kisa", name: "Kısa", values: { heightCm: 160 } },
  { id: "orta", name: "Orta", values: { heightCm: 180 } },
  { id: "uzun", name: "Uzun", values: { heightCm: 200 } },
];

function deps(players: readonly FakeWhichMorePlayer[] = POOL) {
  return { whichMore: new FakeWhichMoreRepository(players) };
}

/** Yazı tura: 0 → "above", 0.9 → "below" (BR-30). */
const ABOVE = () => 0;
const BELOW = () => 0.9;

describe("getRound — ilk tur", () => {
  it("iki oyuncu sunar ve HİÇBİR SAYI taşımaz (BR-32)", async () => {
    const round = await getRound(
      { statKey: "heightCm", stayingId: null, exclude: [] },
      deps(),
    );

    expect(round.pair).not.toBeNull();
    // Alan alan denetleniyor: "sayı yok" iddiası, DTO'ya bir gün `value`
    // eklendiğinde kırılmalı. Metin araması bunu yakalamazdı.
    for (const player of [round.pair?.left, round.pair?.right]) {
      expect(Object.keys(player ?? {}).sort()).toEqual(["clubs", "id", "name"]);
    }
  });

  it("iki oyuncu BR-29 bandını sağlar", async () => {
    // İlk iki aday BİLEREK bandın içinde (180/181, band 3 cm): use-case
    // ikincisini atlayıp 200'e gitmeli. Bandı uygulamayan bir kod 180/181
    // çifti kurar ve bu test kırılır.
    const round = await getRound(
      { statKey: "heightCm", stayingId: null, exclude: [] },
      deps([
        { id: "a", name: "A", values: { heightCm: 180 } },
        { id: "yakin", name: "Yakın", values: { heightCm: 181 } },
        { id: "uzak", name: "Uzak", values: { heightCm: 200 } },
      ]),
    );

    expect(round.pair?.left.id).toBe("a");
    expect(round.pair?.right.id).toBe("uzak");
  });

  it("havuz BOŞKEN ve dışlama yokken hata verir", async () => {
    // Bu havuzun tükenmesi değil, YOKLUĞU: o istatistik hiç çekilmemiş (§6.6).
    await expect(
      getRound({ statKey: "heightCm", stayingId: null, exclude: [] }, deps([])),
    ).rejects.toBeInstanceOf(RoundUnavailableError);
  });

  it("dışlama listesi doluyken havuz biterse HATA DEĞİL, koşu sonu", async () => {
    const round = await getRound(
      {
        statKey: "heightCm",
        stayingId: null,
        exclude: [playerId("kisa"), playerId("orta"), playerId("uzun")],
      },
      deps(),
    );

    expect(round.pair).toBeNull();
  });
});

describe("getRound — BR-28: kazanan kalır", () => {
  it("kalan oyuncu SOLDA durur, değişen sağdaki", async () => {
    const round = await getRound(
      { statKey: "heightCm", stayingId: playerId("orta"), exclude: [] },
      deps(),
      ABOVE,
    );

    expect(round.pair?.left.id).toBe("orta");
    expect(round.pair?.right.id).not.toBe("orta");
  });

  it("görülen oyuncular bir daha sunulmaz", async () => {
    const round = await getRound(
      {
        statKey: "heightCm",
        stayingId: playerId("orta"),
        exclude: [playerId("uzun")],
      },
      deps(),
      ABOVE,
    );

    // "uzun" tek "above" adayıydı; dışlanınca diğer taraf denenir (BR-30).
    expect(round.pair?.right.id).toBe("kisa");
  });
});

describe("getRound — BR-30: dengeli rakip", () => {
  it("yazı 'above' ise rakip kalandan BÜYÜK", async () => {
    const round = await getRound(
      { statKey: "heightCm", stayingId: playerId("orta"), exclude: [] },
      deps(),
      ABOVE,
    );

    expect(round.pair?.right.id).toBe("uzun");
  });

  it("yazı 'below' ise rakip kalandan KÜÇÜK", async () => {
    const round = await getRound(
      { statKey: "heightCm", stayingId: playerId("orta"), exclude: [] },
      deps(),
      BELOW,
    );

    expect(round.pair?.right.id).toBe("kisa");
  });

  /**
   * Sömürünün kapandığının kuraldaki karşılığı: aynı kalan oyuncuyla iki
   * yazı tura sonucu FARKLI rakip veriyor. Tek taraf seçilseydi ikisi de aynı
   * kişiyi verirdi ve "hep kalanı seç" kazanan strateji olurdu (§9.3).
   */
  it("aynı kalanla iki tura FARKLI rakip verir", async () => {
    const above = await getRound(
      { statKey: "heightCm", stayingId: playerId("orta"), exclude: [] },
      deps(),
      ABOVE,
    );
    const below = await getRound(
      { statKey: "heightCm", stayingId: playerId("orta"), exclude: [] },
      deps(),
      BELOW,
    );

    expect(above.pair?.right.id).not.toBe(below.pair?.right.id);
  });

  it("seçilen taraf boşsa ÖTEKİ taraftan çekilir", async () => {
    // "uzun" havuzun en büyüğü; üstünde kimse yok.
    const round = await getRound(
      { statKey: "heightCm", stayingId: playerId("uzun"), exclude: [] },
      deps(),
      ABOVE,
    );

    expect(round.pair?.right.id).toBe("kisa");
  });

  it("iki taraf da boşsa koşu biter (pair: null)", async () => {
    const round = await getRound(
      {
        statKey: "heightCm",
        stayingId: playerId("orta"),
        exclude: [playerId("kisa"), playerId("uzun")],
      },
      deps(),
      ABOVE,
    );

    expect(round.pair).toBeNull();
  });

  it("kalan oyuncunun o istatistikte değeri yoksa reddedilir", async () => {
    await expect(
      getRound(
        { statKey: "weightKg", stayingId: playerId("orta"), exclude: [] },
        deps(),
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("checkAnswer — BR-32", () => {
  it("'more' yönünde büyük olanı seçen kazanır", async () => {
    const answer = await checkAnswer(
      {
        statKey: "heightCm",
        direction: "more",
        leftId: playerId("orta"),
        rightId: playerId("uzun"),
        chosenId: playerId("uzun"),
      },
      deps(),
    );

    expect(answer.correct).toBe(true);
    expect(answer.winnerId).toBe("uzun");
    expect(answer.left.value).toBe(180);
    expect(answer.right.value).toBe(200);
  });

  it("'less' yönünde AYNI seçim kaybeder", async () => {
    const answer = await checkAnswer(
      {
        statKey: "heightCm",
        direction: "less",
        leftId: playerId("orta"),
        rightId: playerId("uzun"),
        chosenId: playerId("uzun"),
      },
      deps(),
    );

    expect(answer.correct).toBe(false);
    expect(answer.winnerId).toBe("orta");
  });

  it("kapsam bildirimi taşınır", async () => {
    const scoped = await checkAnswer(
      {
        statKey: "appearances",
        direction: "more",
        leftId: playerId("a"),
        rightId: playerId("b"),
        chosenId: playerId("a"),
      },
      deps([
        { id: "a", name: "A", values: { appearances: 300 } },
        { id: "b", name: "B", values: { appearances: 100 } },
      ]),
    );

    // Maç/gol/kulüp yalnızca 24 ligi sayar (§9.2 kapsam bildirimi).
    expect(scoped.scoped).toBe(true);
  });

  it("SUNUCUNUN KURMAYACAĞI çift cevap olarak da kabul edilmez", async () => {
    // §9.1'in "süzgeç ile doğrulayıcı aynı olmalı" kuralı: band altındaki bir
    // çifti istemci kendi uydurup kolay soru üretemez.
    await expect(
      checkAnswer(
        {
          statKey: "heightCm",
          direction: "more",
          leftId: playerId("a"),
          rightId: playerId("b"),
          chosenId: playerId("a"),
        },
        deps([
          { id: "a", name: "A", values: { heightCm: 181 } },
          { id: "b", name: "B", values: { heightCm: 180 } },
        ]),
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("turda sunulmamış bir oyuncu seçilemez", async () => {
    await expect(
      checkAnswer(
        {
          statKey: "heightCm",
          direction: "more",
          leftId: playerId("orta"),
          rightId: playerId("uzun"),
          chosenId: playerId("kisa"),
        },
        deps(),
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("aynı oyuncu iki kez sunulamaz", async () => {
    await expect(
      checkAnswer(
        {
          statKey: "heightCm",
          direction: "more",
          leftId: playerId("orta"),
          rightId: playerId("orta"),
          chosenId: playerId("orta"),
        },
        deps(),
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("değeri olmayan oyuncu karşılaştırılamaz", async () => {
    await expect(
      checkAnswer(
        {
          statKey: "weightKg",
          direction: "more",
          leftId: playerId("orta"),
          rightId: playerId("uzun"),
          chosenId: playerId("orta"),
        },
        deps(),
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
