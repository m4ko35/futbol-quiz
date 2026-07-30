import { describe, expect, it } from "vitest";
import { findCommonPlayers } from "@/application/use-cases/find-common-players";
import { ClubNotFoundError, SameClubError } from "@/domain/errors/domain-error";
import { clubId } from "@/domain/value-objects/identifiers";
import { aClub, aPlayer, aSpell } from "../../helpers/builders";
import {
  FakeClubRepository,
  FakePlayerRepository,
} from "../../helpers/fake-repositories";

const CLUB_A = clubId("clubA");
const CLUB_B = clubId("clubB");

const galatasaray = aClub({
  id: CLUB_A,
  name: "Galatasaray Spor Kulübü",
  shortName: "Galatasaray",
  country: "TR",
  crestUrl: "https://upload.wikimedia.org/gs.png",
});

const arsenal = aClub({
  id: CLUB_B,
  name: "Arsenal F.C.",
  shortName: "Arsenal",
  country: "GB",
});

const eboue = aPlayer({
  name: "Emmanuel Eboué",
  nationality: "CI",
  position: "Defans",
});

function deps(
  candidates: ConstructorParameters<typeof FakePlayerRepository>[0] = [],
  clubs = [galatasaray, arsenal],
) {
  return {
    clubs: new FakeClubRepository(clubs),
    players: new FakePlayerRepository(candidates),
  };
}

describe("findCommonPlayers use-case", () => {
  it("§6.2'deki yanıt şeklini üretir", async () => {
    const result = await findCommonPlayers(
      { clubA: CLUB_A, clubB: CLUB_B },
      deps([
        {
          player: eboue,
          spells: [
            aSpell({
              clubId: CLUB_A,
              years: { start: 2011, end: 2014 },
              appearances: 64,
              goals: 3,
            }),
            aSpell({
              clubId: CLUB_B,
              years: { start: 2005, end: 2011 },
              appearances: 214,
              goals: 9,
            }),
          ],
        },
      ]),
    );

    expect(result.clubA.shortName).toBe("Galatasaray");
    expect(result.clubB.shortName).toBe("Arsenal");
    expect(result.count).toBe(1);
    expect(result.players[0]).toEqual({
      id: eboue.id,
      name: "Emmanuel Eboué",
      nationality: "CI",
      position: "Defans",
      spellsAtA: [
        {
          startYear: 2011,
          endYear: 2014,
          isLoan: false,
          appearances: 64,
          goals: 3,
        },
      ],
      spellsAtB: [
        {
          startYear: 2005,
          endYear: 2011,
          isLoan: false,
          appearances: 214,
          goals: 9,
        },
      ],
    });
  });

  it("güvenilmez `isCurrent` alanını dışarı VERMEZ", async () => {
    // Alan, Wikidata'da "bitiş tarihi yok" durumundan türetiliyor ve bu
    // "hâlâ kulüpte" anlamına gelmiyor (ölçüm: §10.2). Yanlış olduğu bilinen
    // bir alanı sözleşmeye koymak, onu tüketen herkes için tuzaktır.
    //
    // Kaynak dönem `isCurrent: true` taşıyor; yanıtta izi olmamalı.
    const result = await findCommonPlayers(
      { clubA: CLUB_A, clubB: CLUB_B },
      deps([
        {
          player: aPlayer(),
          spells: [
            aSpell({
              clubId: CLUB_A,
              isCurrent: true,
              years: { start: 1899, end: null },
            }),
            aSpell({ clubId: CLUB_B, isCurrent: true }),
          ],
        },
      ]),
    );

    const spell = result.players[0]?.spellsAtA[0];
    expect(spell).toBeDefined();
    expect(Object.keys(spell ?? {})).toEqual([
      "startYear",
      "endYear",
      "isLoan",
      "appearances",
      "goals",
    ]);
  });

  it("count, players dizisinin uzunluğuyla tutarlıdır", async () => {
    const result = await findCommonPlayers(
      { clubA: CLUB_A, clubB: CLUB_B },
      deps(
        [1, 2, 3].map(() => ({
          player: aPlayer(),
          spells: [aSpell({ clubId: CLUB_A }), aSpell({ clubId: CLUB_B })],
        })),
      ),
    );

    expect(result.count).toBe(result.players.length);
    expect(result.count).toBe(3);
  });

  it("ortak oyuncu yoksa boş ama geçerli yanıt döner", async () => {
    const result = await findCommonPlayers(
      { clubA: CLUB_A, clubB: CLUB_B },
      deps([]),
    );

    expect(result.count).toBe(0);
    expect(result.players).toEqual([]);
    // Kulüp bilgisi yine dolu: arayüz "X ∩ Y → sonuç yok" diyebilmeli.
    expect(result.clubA.shortName).toBe("Galatasaray");
  });

  it("BR-4: aynı kulüp iki kez seçilemez", async () => {
    await expect(
      findCommonPlayers({ clubA: CLUB_A, clubB: CLUB_A }, deps()),
    ).rejects.toThrow(SameClubError);
  });

  it("BR-4 denetimi veritabanına GİTMEDEN önce yapılır", async () => {
    // Kulüp deposu boş: eğer önce sorgu çalışsaydı ClubNotFoundError gelirdi.
    // SameClubError gelmesi, sıranın doğru olduğunu kanıtlar.
    await expect(
      findCommonPlayers({ clubA: CLUB_A, clubB: CLUB_A }, deps([], [])),
    ).rejects.toThrow(SameClubError);
  });

  it("bilinmeyen kulüp kimliği NOT_FOUND üretir", async () => {
    await expect(
      findCommonPlayers(
        { clubA: CLUB_A, clubB: clubId("yokBoyleKulup") },
        deps(),
      ),
    ).rejects.toThrow(ClubNotFoundError);
  });

  it("hata mesajı HANGİ kulübün eksik olduğunu söylemez", async () => {
    // Ayrı mesajlar, geçerli kimlikleri deneme yanılmayla ayıklamayı
    // kolaylaştırırdı (§6.3).
    const missingA = findCommonPlayers(
      { clubA: clubId("yok1"), clubB: CLUB_B },
      deps(),
    ).catch((error: unknown) => (error as Error).message);
    const missingB = findCommonPlayers(
      { clubA: CLUB_A, clubB: clubId("yok2") },
      deps(),
    ).catch((error: unknown) => (error as Error).message);

    expect(await missingA).toBe(await missingB);
  });

  it("ölçüt varsayılanları §6.2 ile aynıdır: altyapı hariç, kiralık dahil", async () => {
    const candidates = [
      {
        player: aPlayer({ name: "Kiralık" }),
        spells: [
          aSpell({ clubId: CLUB_A, isLoan: true }),
          aSpell({ clubId: CLUB_B }),
        ],
      },
      {
        player: aPlayer({ name: "Altyapı" }),
        spells: [
          aSpell({ clubId: CLUB_A, isYouth: true }),
          aSpell({ clubId: CLUB_B }),
        ],
      },
    ];

    const result = await findCommonPlayers(
      { clubA: CLUB_A, clubB: CLUB_B },
      deps(candidates),
    );

    expect(result.players.map((p) => p.name)).toEqual(["Kiralık"]);
  });

  it("kısmi ölçüt verilince diğer alan varsayılanda kalır", async () => {
    const candidates = [
      {
        player: aPlayer({ name: "Altyapı" }),
        spells: [
          aSpell({ clubId: CLUB_A, isYouth: true }),
          aSpell({ clubId: CLUB_B }),
        ],
      },
      {
        player: aPlayer({ name: "Kiralık" }),
        spells: [
          aSpell({ clubId: CLUB_A, isLoan: true }),
          aSpell({ clubId: CLUB_B }),
        ],
      },
    ];

    const result = await findCommonPlayers(
      { clubA: CLUB_A, clubB: CLUB_B, filter: { includeYouth: true } },
      deps(candidates),
    );

    // includeLoans belirtilmedi → varsayılan `true` korunmalı.
    expect(result.players.map((p) => p.name).sort()).toEqual([
      "Altyapı",
      "Kiralık",
    ]);
  });

  it("A ve B yer değiştirdiğinde aynı oyuncu kümesini döndürür", async () => {
    const candidates = [
      {
        player: aPlayer({ name: "Simetri" }),
        spells: [aSpell({ clubId: CLUB_A }), aSpell({ clubId: CLUB_B })],
      },
    ];

    const forward = await findCommonPlayers(
      { clubA: CLUB_A, clubB: CLUB_B },
      deps(candidates),
    );
    const reversed = await findCommonPlayers(
      { clubA: CLUB_B, clubB: CLUB_A },
      deps(candidates),
    );

    expect(reversed.count).toBe(forward.count);
    expect(reversed.players.map((p) => p.id)).toEqual(
      forward.players.map((p) => p.id),
    );
    // Kulüpler de yer değiştirmeli — arayüz sütun başlıklarını buradan alır.
    expect(reversed.clubA.shortName).toBe("Arsenal");
  });
});
