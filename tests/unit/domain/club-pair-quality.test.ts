import { describe, expect, it } from "vitest";
import {
  DEGENERATE_PAIR_RATIO,
  findDegeneratePair,
} from "@/domain/services/club-pair-quality";
import { aClub } from "../../helpers/builders";

/**
 * BR-36 — dejenere kulüp çifti (PROJECT.md §5.3).
 *
 * Testler eşiğin ÖLÇÜLEN yerini kilitler. Gerçek veriden alınan çiftler
 * kullanılıyor, uydurma sayılar değil: eşik kayarsa hangi gerçek çiftin
 * sınıfının değiştiği doğrudan görünsün.
 */
describe("findDegeneratePair", () => {
  it("eşiğin üstündeki çifti ölçüsüyle birlikte döndürür", () => {
    // Gençlerbirliği ikizi — %92,5
    const result = findDegeneratePair({
      clubA: aClub({ shortName: "Gençlerbirliği", playerCount: 461 }),
      clubB: aClub({
        shortName: "Gençlerbirliği (futbol takımı)",
        playerCount: 426,
      }),
      sharedPlayers: 394,
    });

    expect(result).toEqual({
      sharedPlayers: 394,
      smallerClubPlayers: 426,
      smallerClubName: "Gençlerbirliği (futbol takımı)",
    });
  });

  it("küçük kulübü paydaya alır — sıra fark etmez", () => {
    // Condal / Barcelona: %80,0. Küçük taraf 65'lik Condal, 1457'lik
    // Barcelona değil; ters sırada da aynı sonuç çıkmalı.
    const condal = aClub({ shortName: "Condal", playerCount: 65 });
    const barcelona = aClub({ shortName: "Barcelona", playerCount: 1457 });

    const forward = findDegeneratePair({
      clubA: condal,
      clubB: barcelona,
      sharedPlayers: 52,
    });
    const reverse = findDegeneratePair({
      clubA: barcelona,
      clubB: condal,
      sharedPlayers: 52,
    });

    expect(forward).toEqual(reverse);
    expect(forward?.smallerClubName).toBe("Condal");
    expect(forward?.smallerClubPlayers).toBe(65);
  });

  it("eşiğin altındaki gerçek çifti işaretlemez", () => {
    // Toulouse FC (1937) × Toulouse FC (1970) — %69,4, ölçülen boşluğun
    // hemen altındaki en yakın çift. Bu geçerse eşik kaymış demektir.
    expect(
      findDegeneratePair({
        clubA: aClub({ shortName: "Toulouse FC (1937)", playerCount: 108 }),
        clubB: aClub({ shortName: "Toulouse FC (1970)", playerCount: 566 }),
        sharedPlayers: 75,
      }),
    ).toBeNull();
  });

  it("Karpaty ikizi (%76,8) eşiğin üstünde kalır", () => {
    // Boşluğun hemen üstündeki en yakın çift. Alt ve üst komşunun ikisi de
    // kilitlenmezse eşiğin bandın İÇİNDE olduğu iddiası test edilmemiş olur.
    expect(
      findDegeneratePair({
        clubA: aClub({ shortName: "Karpaty Lviv", playerCount: 99 }),
        clubB: aClub({ shortName: "FK Karpaty Lviv", playerCount: 547 }),
        sharedPlayers: 76,
      }),
    ).not.toBeNull();
  });

  it("tam eşikte işaretler — sınır dâhildir", () => {
    expect(
      findDegeneratePair({
        clubA: aClub({ playerCount: 100 }),
        clubB: aClub({ playerCount: 400 }),
        sharedPlayers: 100 * DEGENERATE_PAIR_RATIO,
      }),
    ).not.toBeNull();
  });

  it("kadrosu bilinmeyen kulüpte SUSAR, sıfıra bölmez", () => {
    // playerCount 0 bir veri kusurudur (db:verify ölçer) ve sunum katmanında
    // telafi edilmez: 0/0 ne uyarı ne sessiz NaN üretmeli.
    expect(
      findDegeneratePair({
        clubA: aClub({ playerCount: 0 }),
        clubB: aClub({ playerCount: 500 }),
        sharedPlayers: 0,
      }),
    ).toBeNull();
  });

  it("ortak oyuncusu olmayan çifti işaretlemez", () => {
    expect(
      findDegeneratePair({
        clubA: aClub({ playerCount: 40 }),
        clubB: aClub({ playerCount: 40 }),
        sharedPlayers: 0,
      }),
    ).toBeNull();
  });
});
