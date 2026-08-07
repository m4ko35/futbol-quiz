import { describe, expect, it } from "vitest";
import type { GridDeps } from "@/application/game-modes/grid/generate";
import {
  checkCustomAnswer,
  listPlayableCriteria,
  type CriterionRef,
} from "@/application/use-cases/custom-grid";
import { ValidationError } from "@/domain/errors/domain-error";
import type { PlayerSpells } from "@/domain/services/common-players";
import { MIN_CELL_ANSWERS } from "@/domain/services/grid";
import { clubId, playerId } from "@/domain/value-objects/identifiers";
import { aClub, aPlayer, aSpell } from "../../helpers/builders";
import {
  FakeClubRepository,
  FakePlayerRepository,
} from "../../helpers/fake-repositories";
import { gridFixture } from "../../helpers/grid-fixture";

/**
 * §9.1 — "Sen kur" ızgarası (BR-25, BR-26).
 *
 * BURADA DENETLENEN ŞEY SÜZGECİN KENDİSİ DEĞİL, süzgeç ile doğrulayıcının
 * AYNI soruyu sorması. Ölçüldü (§9.1): serbest seçimde rastgele altı kulübün
 * yalnızca %0,1'i geçerli ızgara veriyor — yani seçiciye gelen her ölçüt,
 * cevap ucunun da kabul edeceği bir ızgara kurmalı.
 */

function ref(id: string): CriterionRef {
  return { kind: "club", id };
}

describe("listPlayableCriteria — BR-25", () => {
  it("seçilen sütunların HEPSİYLE kesişen ölçütleri döndürür", async () => {
    const fixture = gridFixture();
    const [a, b, c, ...rest] = fixture.clubIds;

    const criteria = await listPlayableCriteria(
      { against: [ref(a!), ref(b!), ref(c!)] },
      fixture.deps,
    );

    const ids = criteria.map((one) => one.id);
    // Fixture her kulüp çiftine bandın içinde ortak oyuncu koyuyor; kalan
    // kulüplerin hepsi satır olabilmeli.
    for (const other of rest) expect(ids).toContain(other);
  });

  it("sütunun kendisi satır adayı olarak DÖNMEZ", async () => {
    const fixture = gridFixture();
    const [a, b, c] = fixture.clubIds;

    const criteria = await listPlayableCriteria(
      { against: [ref(a!), ref(b!), ref(c!)] },
      fixture.deps,
    );

    // Bir ölçüt hem satırda hem sütunda bulunamaz (`isGridShapeValid`).
    for (const chosen of [a, b, c]) {
      expect(criteria.map((one) => one.id)).not.toContain(chosen);
    }
  });

  it("bandın ALTINDA kalan ölçüt listeye girmez", async () => {
    const { deps, sutun, seyrek, bol } = sparseFixture();

    const criteria = await listPlayableCriteria(
      { against: [ref(sutun)] },
      deps,
    );
    const ids = criteria.map((one) => one.id);

    // ÖNCE LİSTENİN BOŞ OLMADIĞI gösterilir: aksi hâlde aşağıdaki beklenti
    // hiçbir şey söylemeden geçerdi.
    expect(ids).toContain(bol);
    // `seyrek` kulübünde ortak oyuncu var ama alt sınırın altında: hücre bilgi
    // değil ŞANS sorardı (BR-9).
    expect(ids).not.toContain(seyrek);
  });

  it("ölçüt verilmezse reddedilir", async () => {
    const fixture = gridFixture();

    await expect(
      listPlayableCriteria({ against: [] }, fixture.deps),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("seçilemez kulüp reddedilir — sessizce atlanmaz", async () => {
    const { deps, gizli } = sparseFixture();

    await expect(
      listPlayableCriteria({ against: [ref(gizli)] }, deps),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("bilinmeyen kulüp reddedilir", async () => {
    const fixture = gridFixture();

    await expect(
      listPlayableCriteria(
        { against: [ref("yok-boyle-bir-kulup")] },
        fixture.deps,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("checkCustomAnswer — BR-26", () => {
  it("iki ölçütü de sağlayan oyuncu DOĞRU sayılır", async () => {
    const fixture = gridFixture();
    const [a, b] = fixture.clubIds;
    const player = fixture.playerAtBoth(a!, b!);

    const result = await checkCustomAnswer(
      { row: ref(a!), column: ref(b!), playerId: playerId(player) },
      fixture.deps,
    );

    expect(result.correct).toBe(true);
  });

  it("ölçütlerden birini sağlamayan oyuncu YANLIŞ sayılır", async () => {
    const fixture = gridFixture();
    const [a, b, c] = fixture.clubIds;
    // a ve b'de oynadı; c ile b'nin kesişimi sorulduğunda düşmeli.
    const player = fixture.playerAtBoth(a!, b!);

    const result = await checkCustomAnswer(
      { row: ref(c!), column: ref(b!), playerId: playerId(player) },
      fixture.deps,
    );

    expect(result.correct).toBe(false);
  });

  it("satır ve sütun aynı ölçütse reddedilir", async () => {
    const fixture = gridFixture();
    const [a, b] = fixture.clubIds;

    await expect(
      checkCustomAnswer(
        {
          row: ref(a!),
          column: ref(a!),
          playerId: playerId(fixture.playerAtBoth(a!, b!)),
        },
        fixture.deps,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("biçimsiz ülke kodu reddedilir", async () => {
    const fixture = gridFixture();
    const [a, b] = fixture.clubIds;

    await expect(
      checkCustomAnswer(
        {
          // Küçük harf: `Intl` çözemez ve ölçüt sessizce boş bir hücreye
          // dönüşürdü.
          row: { kind: "nationality", id: "tr" },
          column: ref(a!),
          playerId: playerId(fixture.playerAtBoth(a!, b!)),
        },
        fixture.deps,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

/**
 * Bandın ALTINDA kalan bir kulüp içeren küçük küme.
 *
 * `gridFixture` her çifte bandın içinde ortak oyuncu koyuyor; alt sınırın
 * denetlendiğini görmek için ayrı bir kurulum gerekiyor.
 */
function sparseFixture(): {
  deps: GridDeps;
  sutun: string;
  bol: string;
  seyrek: string;
  gizli: string;
} {
  const sutun = "kulup-sutun";
  const bol = "kulup-bol";
  const seyrek = "kulup-seyrek";
  const gizli = "kulup-gizli";

  const clubs = [
    aClub({ id: clubId(sutun), shortName: "Sütun" }),
    aClub({ id: clubId(bol), shortName: "Bol" }),
    aClub({ id: clubId(seyrek), shortName: "Seyrek" }),
    aClub({ id: clubId(gizli), shortName: "Gizli", isSelectable: false }),
  ];

  const candidates: PlayerSpells[] = [];
  const pair = (other: string, count: number): void => {
    for (let i = 0; i < count; i++) {
      const player = aPlayer({ name: `Oyuncu ${other}-${String(i)}` });
      candidates.push({
        player,
        spells: [
          aSpell({ playerId: player.id, clubId: clubId(sutun) }),
          aSpell({ playerId: player.id, clubId: clubId(other) }),
        ],
      });
    }
  };

  pair(bol, MIN_CELL_ANSWERS);
  pair(seyrek, MIN_CELL_ANSWERS - 1);

  return {
    deps: {
      clubs: new FakeClubRepository(clubs),
      players: new FakePlayerRepository(candidates),
    },
    sutun,
    bol,
    seyrek,
    gizli,
  };
}
