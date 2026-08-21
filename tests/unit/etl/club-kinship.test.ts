import { describe, expect, it } from "vitest";

import {
  findKinClubPairs,
  kinshipKey,
  MIN_KINSHIP_OVERLAPS,
} from "../../../scripts/etl/pipeline/club-kinship";
import type { NormalizedSpell } from "../../../scripts/etl/pipeline/normalize";

/**
 * §5.3 — aynı kulübün iki kaydı.
 *
 * BU TESTLERİN ÖLÇÜTÜ ölçülmüş bir felakete dönüş. §4.3'ün 3. aşaması gölge
 * modda 51 dönemi reddetmeye hazırlandı; liste incelendi ve **28'i aynı
 * kulübün iki adıydı** — Mario Maraschi'nin "Vicenza Calcio 1965-66, 59 maç"
 * kaydı, Vikipedi ona "LR Vicenza" dediği için silinecekti.
 */

let sayac = 0;
function donem(over: Partial<NormalizedSpell> = {}): NormalizedSpell {
  sayac++;
  return {
    wikidataStatementId: `s${String(sayac)}`,
    playerWikidataId: "P1",
    clubWikidataId: "A",
    startYear: 2010,
    endYear: 2014,
    isCurrent: false,
    isLoan: false,
    isYouth: false,
    appearances: 50,
    goals: 5,
    ...over,
  };
}

/** Bir oyuncunun iki kulüpte örtüşen kalıcı dönemi. */
function cift(player: string, a = "A", b = "B"): NormalizedSpell[] {
  return [
    donem({ playerWikidataId: player, clubWikidataId: a }),
    donem({ playerWikidataId: player, clubWikidataId: b }),
  ];
}

describe("aynı kulübün iki kaydı", () => {
  it("ÖRÜNTÜ akrabalıktır: iki bağımsız oyuncu yeter", () => {
    const kin = findKinClubPairs({
      spells: [...cift("P1"), ...cift("P2")],
    });

    expect(kin.has(kinshipKey("A", "B"))).toBe(true);
    expect(MIN_KINSHIP_OVERLAPS).toBe(2);
  });

  it("TEK örtüşme veri hatasıdır, akrabalık değil", () => {
    // Trapattoni'nin Juventus'ta Milan'ın maçlarıyla görünmesi tek bir
    // kayıttır; Juventus ile Milan'ı akraba ilan etmek felaket olurdu.
    const kin = findKinClubPairs({ spells: cift("P1") });

    expect(kin.size).toBe(0);
  });

  it("AYNI oyuncu eşiği tek başına AŞAMAZ", () => {
    // Bir oyuncunun iki kulüpte üçer dönemi varsa dokuz örtüşme çıkar.
    // Aranan şey bağımsız oyuncularda TEKRARLAMAK.
    const kin = findKinClubPairs({
      spells: [
        ...cift("P1"),
        donem({ playerWikidataId: "P1", clubWikidataId: "A", startYear: 2011 }),
        donem({ playerWikidataId: "P1", clubWikidataId: "B", startYear: 2012 }),
      ],
    });

    expect(kin.size).toBe(0);
  });

  it("ÖRTÜŞMEYEN dönemler akrabalık üretmez", () => {
    // Normal transfer: 2010-2014 sonra 2014-2018. Sınıra değmek örtüşme
    // değildir, yoksa her kariyer akrabalık sayılırdı.
    const kin = findKinClubPairs({
      spells: [
        donem({ playerWikidataId: "P1", clubWikidataId: "A" }),
        donem({
          playerWikidataId: "P1",
          clubWikidataId: "B",
          startYear: 2014,
          endYear: 2018,
        }),
        donem({ playerWikidataId: "P2", clubWikidataId: "A" }),
        donem({
          playerWikidataId: "P2",
          clubWikidataId: "B",
          startYear: 2014,
          endYear: 2018,
        }),
      ],
    });

    expect(kin.size).toBe(0);
  });

  it("AÇIK UÇLU dönem sayılmaz", () => {
    // `cross-check` bitişi bilinmeyeni açık sayar çünkü orada iddiayı ikinci
    // kaynak kurar. Burada iddiayı örtüşmenin kendisi kuruyor: bitişi
    // bilinmeyen 3.588 oyuncuyu saymak ilgisiz kulüpleri akraba yapardı.
    const kin = findKinClubPairs({
      spells: [
        donem({ playerWikidataId: "P1", clubWikidataId: "A", endYear: null }),
        donem({ playerWikidataId: "P1", clubWikidataId: "B", startYear: 2012 }),
        donem({ playerWikidataId: "P2", clubWikidataId: "A", endYear: null }),
        donem({ playerWikidataId: "P2", clubWikidataId: "B", startYear: 2012 }),
      ],
    });

    expect(kin.size).toBe(0);
  });

  it("KİRALIK ve ALTYAPI dışarıda", () => {
    // Kiralık, aynı anda iki kulüple ilişkili görünmenin MEŞRU hâli.
    const kin = findKinClubPairs({
      spells: [
        donem({ playerWikidataId: "P1", clubWikidataId: "A" }),
        donem({ playerWikidataId: "P1", clubWikidataId: "B", isLoan: true }),
        donem({ playerWikidataId: "P2", clubWikidataId: "A" }),
        donem({ playerWikidataId: "P2", clubWikidataId: "B", isYouth: true }),
      ],
    });

    expect(kin.size).toBe(0);
  });

  it("anahtar YÖNSÜZDÜR", () => {
    // Sıra koşudan koşuya sabit kalmalı; aksi hâlde aynı veri farklı sonuç
    // verir.
    expect(kinshipKey("B", "A")).toBe(kinshipKey("A", "B"));
  });

  it("HİÇBİR kulüp birleştirmez, hiçbir dönem taşımaz", () => {
    // §5.3 birleştirmeyi ölçerek reddetti ve o karar duruyor. Bu modül
    // yalnızca bir küme döndürür.
    const spells = [...cift("P1"), ...cift("P2")];
    const kopya = structuredClone(spells);

    findKinClubPairs({ spells });

    expect(spells).toEqual(kopya);
  });
});
