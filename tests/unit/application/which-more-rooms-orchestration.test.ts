import { beforeEach, describe, expect, it } from "vitest";
import type { RandomSource } from "@/application/ports/random-source";
import type {
  CreateWhichMoreRoomResult,
  JoinWhichMoreRoomResult,
  SaveWhichMoreAnswerResult,
  StoredWhichMoreRoom,
  WhichMoreRoomsRepository,
} from "@/application/ports/which-more-rooms-repository";
import {
  createWhichMoreRoom,
  getWhichMoreRoom,
  joinWhichMoreRoom,
  peekWhichMoreRoom,
  submitWhichMoreAnswer,
  type CreateWhichMoreRoomInput,
  type WhichMoreRoomDeps,
} from "@/application/use-cases/which-more-rooms";
import type {
  WhichMoreDuelAnswer,
  WhichMoreRoomConfig,
} from "@/domain/services/which-more-room";
import type { PlayerId } from "@/domain/value-objects/identifiers";
import { isRoomCode } from "@/domain/value-objects/room-code";
import {
  FakeWhichMoreRepository,
  type FakeWhichMorePlayer,
} from "../../helpers/fake-repositories";

/**
 * §12.8 — Hangisi Daha odası orkestrasyonu (kur/katıl/cevap/present, BR-67…BR-70).
 *
 * Depolama değil KARAR ölçülüyor: ray iki tarafta aynı mı, rakip ne zaman
 * gizli, hangi gönderim reddedilir, sonuç ne zaman kesinleşir. Kısıtların
 * gerçekten var olduğu şema testlerinde ayrıca ölçülecek (faz 4).
 */

const SIMDI = new Date("2026-09-23T10:00:00.000Z");
const ileri = (dakika: number): Date =>
  new Date(SIMDI.getTime() + dakika * 60_000);

/**
 * Boy havuzu (band 3, adım 10) — "more" yönünde ray öngörülebilir:
 * duel0=(a,b)→b, duel1=(b,c)→c, ... her tur galibi bir büyüğü.
 */
const POOL: FakeWhichMorePlayer[] = [
  { id: "a", name: "A", values: { heightCm: 160 } },
  { id: "b", name: "B", values: { heightCm: 170 } },
  { id: "c", name: "C", values: { heightCm: 180 } },
  { id: "d", name: "D", values: { heightCm: 190 } },
  { id: "e", name: "E", values: { heightCm: 200 } },
  { id: "f", name: "F", values: { heightCm: 210 } },
  { id: "g", name: "G", values: { heightCm: 220 } },
  { id: "h", name: "H", values: { heightCm: 230 } },
];

// Rayın her turdaki galibi (more): sırayla b, c, d, e, f, g, h; kaybedeni bir
// önceki turun galibi (round0'ınki a). Testler bu zinciri elle kullanır.

/** Bellek içi Hangisi Daha oda deposu — koltuk + tur-indeksi kısıtını uygular. */
class SahteWhichMoreOdaDeposu implements WhichMoreRoomsRepository {
  readonly odalar = new Map<string, StoredWhichMoreRoom>();
  silinenSahipler: string[] = [];
  silinenSonmusler = 0;

  seed(room: StoredWhichMoreRoom): void {
    this.odalar.set(room.code, room);
  }

  findByCode(code: string): Promise<StoredWhichMoreRoom | null> {
    return Promise.resolve(this.odalar.get(code) ?? null);
  }

  createRoom(input: {
    readonly hostId: string;
    readonly code: string;
    readonly config: WhichMoreRoomConfig;
  }): Promise<CreateWhichMoreRoomResult> {
    if (this.odalar.has(input.code)) {
      return Promise.resolve({ kind: "kod-cakisti" });
    }
    const room: StoredWhichMoreRoom = {
      id: `oda-${input.code}`,
      code: input.code,
      hostId: input.hostId,
      state: {
        createdAt: SIMDI,
        startedAt: null,
        config: input.config,
        players: [{ userId: input.hostId, displayName: "EV", answers: [] }],
      },
    };
    this.odalar.set(input.code, room);
    return Promise.resolve({ kind: "kuruldu", room });
  }

  joinRoom(input: {
    readonly roomId: string;
    readonly userId: string;
    readonly startedAt: Date;
  }): Promise<JoinWhichMoreRoomResult> {
    const room = [...this.odalar.values()].find((r) => r.id === input.roomId);
    if (room === undefined) throw new Error("oda yok");
    if (room.state.players.length >= 2) {
      return Promise.resolve({ kind: "dolu" });
    }
    const guncel: StoredWhichMoreRoom = {
      ...room,
      state: {
        ...room.state,
        startedAt: input.startedAt,
        players: [
          ...room.state.players,
          { userId: input.userId, displayName: "KONUK", answers: [] },
        ],
      },
    };
    this.odalar.set(room.code, guncel);
    return Promise.resolve({ kind: "katildi", room: guncel });
  }

  saveAnswer(input: {
    readonly roomId: string;
    readonly userId: string;
    readonly answer: WhichMoreDuelAnswer;
  }): Promise<SaveWhichMoreAnswerResult> {
    const room = [...this.odalar.values()].find((r) => r.id === input.roomId);
    if (room === undefined) throw new Error("oda yok");

    const me = room.state.players.find((p) => p.userId === input.userId);
    // TUR İNDEKSİ KISITI — `@@unique([roomPlayerId, roundIndex])` karşılığı.
    if (
      me?.answers.some((a) => a.roundIndex === input.answer.roundIndex) === true
    ) {
      return Promise.resolve({ kind: "zaten-var", room });
    }

    const guncel: StoredWhichMoreRoom = {
      ...room,
      state: {
        ...room.state,
        players: room.state.players.map((p) =>
          p.userId === input.userId
            ? { ...p, answers: [...p.answers, input.answer] }
            : p,
        ),
      },
    };
    this.odalar.set(room.code, guncel);
    return Promise.resolve({ kind: "yazildi", room: guncel });
  }

  deleteHostedRooms(hostId: string): Promise<void> {
    this.silinenSahipler.push(hostId);
    return Promise.resolve();
  }

  deleteExpiredRooms(): Promise<number> {
    this.silinenSonmusler += 1;
    return Promise.resolve(0);
  }
}

/** Sırayla verilen baytları döner; bittiğinde başa sarar. */
class SahteRastgele implements RandomSource {
  private imlec = 0;
  constructor(
    private readonly kaynak: readonly number[] = [3, 11, 19, 2, 24, 8],
  ) {}
  bytes(count: number): Uint8Array {
    return Uint8Array.from({ length: count }, () => {
      const value = this.kaynak[this.imlec % this.kaynak.length] ?? 0;
      this.imlec += 1;
      return value;
    });
  }
}

let depo: SahteWhichMoreOdaDeposu;
let deps: WhichMoreRoomDeps;

beforeEach(() => {
  depo = new SahteWhichMoreOdaDeposu();
  deps = {
    rooms: depo,
    whichMore: new FakeWhichMoreRepository(POOL),
    random: new SahteRastgele(),
  };
});

const aniInput = {
  now: SIMDI,
  userId: "ev",
  submode: "ani-olum",
  statKey: "heightCm",
  level: "hard",
  direction: "more",
} as const;

const sabitInput = (n: 5 | 10 | 15) =>
  ({ ...aniInput, submode: "sabit-n", n }) as const;

/** Oda kur + ikinci oyuncu katıl; kodu döner. */
async function kurVeKatil(
  input: CreateWhichMoreRoomInput = aniInput,
): Promise<string> {
  const kurulan = await createWhichMoreRoom(input, deps);
  await joinWhichMoreRoom(
    { now: ileri(1), userId: "konuk", code: kurulan.code },
    deps,
  );
  return kurulan.code;
}

/** Bir oyuncuyu sırayla verilen kartları seçerek oynatır. */
async function play(
  code: string,
  userId: string,
  choices: readonly string[],
): Promise<void> {
  for (let i = 0; i < choices.length; i += 1) {
    await submitWhichMoreAnswer(
      {
        now: ileri(2),
        userId,
        code,
        roundIndex: i,
        chosenId: choices[i] as PlayerId,
      },
      deps,
    );
  }
}

describe("createWhichMoreRoom (§12.8, BR-67)", () => {
  it("geçerli kod üretir, config'i yansıtır, hedef YOK", async () => {
    const oda = await createWhichMoreRoom(sabitInput(5), deps);

    expect(isRoomCode(oda.code)).toBe(true);
    expect(oda.submode).toBe("sabit-n");
    expect(oda.n).toBe(5);
    expect(oda.statKey).toBe("heightCm");
    expect(oda.status).toBe("bekliyor");
    expect(oda.opponent).toBeNull();
    // Bekleyen odada henüz düello yok (ray iki oyuncu katılınca açılır).
    expect(oda.currentDuel).toBeNull();
  });

  it("Ani ölüm modunda n null", async () => {
    const oda = await createWhichMoreRoom(aniInput, deps);
    expect(oda.submode).toBe("ani-olum");
    expect(oda.n).toBeNull();
  });

  it("kurucunun eski odalarını siler, sönmüşleri süpürür (BR-60)", async () => {
    await createWhichMoreRoom(aniInput, deps);
    expect(depo.silinenSahipler).toEqual(["ev"]);
    expect(depo.silinenSonmusler).toBe(1);
  });

  it("havuz yetersizse oda KURULMAZ (oynanamaz oda üretilmez)", async () => {
    const bosDeps: WhichMoreRoomDeps = {
      rooms: new SahteWhichMoreOdaDeposu(),
      whichMore: new FakeWhichMoreRepository([]),
      random: new SahteRastgele(),
    };
    await expect(createWhichMoreRoom(aniInput, bosDeps)).rejects.toThrow(
      /soru havuzu yetersiz/u,
    );
  });
});

describe("joinWhichMoreRoom — ortak ray (§12.8, BR-68)", () => {
  it("katılınca tur başlar ve İKİ TARAF da AYNI düelloyu görür", async () => {
    const kod = await kurVeKatil();

    const ev = await getWhichMoreRoom(
      { now: ileri(2), userId: "ev", code: kod },
      deps,
    );
    const konuk = await getWhichMoreRoom(
      { now: ileri(2), userId: "konuk", code: kod },
      deps,
    );

    expect(ev.status).toBe("oynaniyor");
    expect(ev.currentRoundIndex).toBe(0);
    // ORTAK RAY: iki oyuncunun ilk düellosu birebir aynı.
    expect(ev.currentDuel?.left.id).toBe("a");
    expect(ev.currentDuel?.right.id).toBe("b");
    expect(konuk.currentDuel?.left.id).toBe(ev.currentDuel?.left.id);
    expect(konuk.currentDuel?.right.id).toBe(ev.currentDuel?.right.id);
  });

  it("düello DEĞER TAŞIMAZ (BR-32)", async () => {
    const kod = await kurVeKatil();
    const ev = await getWhichMoreRoom(
      { now: ileri(2), userId: "ev", code: kod },
      deps,
    );
    expect(Object.keys(ev.currentDuel?.left ?? {}).sort()).toEqual([
      "clubs",
      "id",
      "name",
    ]);
  });

  it("zaten üye hata almaz; dolu odaya üçüncü giremez", async () => {
    const kod = await kurVeKatil();

    const yine = await joinWhichMoreRoom(
      { now: ileri(3), userId: "konuk", code: kod },
      deps,
    );
    expect(yine.status).toBe("oynaniyor");

    await expect(
      joinWhichMoreRoom({ now: ileri(3), userId: "yabanci", code: kod }, deps),
    ).rejects.toThrow(/açık değil|dolu/u);
  });
});

describe("submitWhichMoreAnswer — ray ilerlemesi (§12.8)", () => {
  it("doğru kart seriyi ve tur indeksini ilerletir", async () => {
    const kod = await kurVeKatil();

    const sonuc = await submitWhichMoreAnswer(
      {
        now: ileri(2),
        userId: "ev",
        code: kod,
        roundIndex: 0,
        chosenId: "b" as PlayerId,
      },
      deps,
    );

    expect(sonuc.correct).toBe(true);
    expect(sonuc.room.me.answered).toBe(1);
    expect(sonuc.room.me.streak).toBe(1);
    expect(sonuc.room.currentRoundIndex).toBe(1);
    // Sonraki düello: kalan (b) solda, yeni rakip (c) sağda.
    expect(sonuc.room.currentDuel?.left.id).toBe("b");
    expect(sonuc.room.currentDuel?.right.id).toBe("c");
  });

  it("sıra dışı tur reddedilir", async () => {
    const kod = await kurVeKatil();
    await expect(
      submitWhichMoreAnswer(
        {
          now: ileri(2),
          userId: "ev",
          code: kod,
          roundIndex: 3,
          chosenId: "b" as PlayerId,
        },
        deps,
      ),
    ).rejects.toThrow(/Sıra dışı/u);
  });

  it("aynı turu tekrar göndermek SAKLANANI döner (BR-58 hattı)", async () => {
    const kod = await kurVeKatil();
    await play(kod, "ev", ["b"]);

    const tekrar = await submitWhichMoreAnswer(
      {
        now: ileri(3),
        userId: "ev",
        code: kod,
        roundIndex: 0,
        chosenId: "a" as PlayerId, // farklı kart göndersek de saklanan döner
      },
      deps,
    );
    expect(tekrar.correct).toBe(true);
    expect(tekrar.room.me.answered).toBe(1);
  });

  it("düelloda sunulmayan kart reddedilir", async () => {
    const kod = await kurVeKatil();
    await expect(
      submitWhichMoreAnswer(
        {
          now: ileri(2),
          userId: "ev",
          code: kod,
          roundIndex: 0,
          chosenId: "h" as PlayerId, // duel0 (a,b) içinde değil
        },
        deps,
      ),
    ).rejects.toThrow(/geçersiz/u);
  });
});

describe("Ani ölüm — eleme ve kapanış (§12.8, BR-69)", () => {
  it("yanlış cevap eler, sonraki düello kalmaz", async () => {
    const kod = await kurVeKatil();

    const sonuc = await submitWhichMoreAnswer(
      {
        now: ileri(2),
        userId: "ev",
        code: kod,
        roundIndex: 0,
        chosenId: "a" as PlayerId, // kaybeden
      },
      deps,
    );

    expect(sonuc.correct).toBe(false);
    expect(sonuc.room.me.eliminated).toBe(true);
    expect(sonuc.room.currentDuel).toBeNull();
    // Rakip henüz oynamadı → sonuç kesinleşmedi.
    expect(sonuc.room.outcome).toBe("devam");
  });

  it("elendikten sonra cevap kabul edilmez", async () => {
    const kod = await kurVeKatil();
    await play(kod, "ev", ["a"]); // round 0 yanlış → elendi

    await expect(
      submitWhichMoreAnswer(
        {
          now: ileri(3),
          userId: "ev",
          code: kod,
          roundIndex: 1,
          chosenId: "c" as PlayerId,
        },
        deps,
      ),
    ).rejects.toThrow(/Koşun bitti/u);
  });

  it("biri elenip diğeri geçince maç KESİNLEŞİR (canlı olsa bile)", async () => {
    const kod = await kurVeKatil();
    await play(kod, "ev", ["a"]); // ev 0 seride elendi
    await play(kod, "konuk", ["b"]); // konuk 1 seride, 0'ı geçti

    const konuk = await getWhichMoreRoom(
      { now: ileri(4), userId: "konuk", code: kod },
      deps,
    );
    const ev = await getWhichMoreRoom(
      { now: ileri(4), userId: "ev", code: kod },
      deps,
    );

    expect(konuk.status).toBe("bitti");
    expect(konuk.outcome).toBe("kazandin");
    expect(ev.outcome).toBe("kaybettin");
  });
});

describe("BR-70 — rakip ilerlemesi bitene dek gizli", () => {
  it("Ani ölüm: rakibin SAYISI gizli, yalnızca durum; kendiminki açık", async () => {
    const kod = await kurVeKatil();
    await play(kod, "ev", ["b", "c"]); // ev 2 seri

    const konuk = await getWhichMoreRoom(
      { now: ileri(3), userId: "konuk", code: kod },
      deps,
    );

    // Rakip (ev) canlı ama serisi/sayısı gizli (answered null → seri sızmaz).
    expect(konuk.opponent?.eliminated).toBe(false);
    expect(konuk.opponent?.answered).toBeNull();
    expect(konuk.opponent?.streak).toBeNull();
    expect(konuk.opponent?.picks).toBeNull();
    // Kendi tarafı normal görünür.
    expect(konuk.me.answered).toBe(0);
  });

  it("Sabit N: rakibin İLERLEMESİ (n/N) görünür ama doğru sayısı gizli", async () => {
    const kod = await kurVeKatil(sabitInput(5));
    // 2 cevap, eleme YOK. round0 (a,b)→b doğru; round1 (b,c)→b kaybeden (yanlış).
    await play(kod, "ev", ["b", "b"]);

    const konuk = await getWhichMoreRoom(
      { now: ileri(3), userId: "konuk", code: kod },
      deps,
    );

    expect(konuk.opponent?.answered).toBe(2); // ilerleme açık
    expect(konuk.opponent?.correct).toBeNull(); // doğru sayısı gizli
    expect(konuk.opponent?.picks).toBeNull();
  });
});

describe("Sabit N — sonuç ve karşılaştırma (§12.8, BR-69/BR-70)", () => {
  it("ikisi de N'i bitirince yüksek doğru kazanır, seçimler AÇILIR", async () => {
    const kod = await kurVeKatil(sabitInput(5));

    await play(kod, "ev", ["b", "c", "d", "e", "f"]); // 5 doğru
    await play(kod, "konuk", ["b", "c", "d", "d", "e"]); // 3 doğru (3,4 yanlış)

    const ev = await getWhichMoreRoom(
      { now: ileri(6), userId: "ev", code: kod },
      deps,
    );

    expect(ev.status).toBe("bitti");
    expect(ev.outcome).toBe("kazandin");
    expect(ev.me.correct).toBe(5);
    // Oda bitti → rakibin seçimleri ve doğru sayısı AÇILIR (karşılaştırma).
    expect(ev.opponent?.correct).toBe(3);
    expect(ev.opponent?.picks).toHaveLength(5);
    expect(ev.me.picks).toHaveLength(5);
    // İlk seçimin adı çözülmüş (kimlik değil).
    expect(ev.me.picks?.[0]?.chosenName).toBe("B");
  });

  it("eşit doğru beraberliktir (BR-62 hattı)", async () => {
    const kod = await kurVeKatil(sabitInput(5));
    // Her turun kaybedeni bir önceki turun galibidir (round0'ınki "a").
    await play(kod, "ev", ["b", "c", "c", "e", "f"]); // 4 doğru (round2 yanlış: c)
    await play(kod, "konuk", ["b", "c", "d", "e", "e"]); // 4 doğru (round4 yanlış: e)

    const ev = await getWhichMoreRoom(
      { now: ileri(6), userId: "ev", code: kod },
      deps,
    );
    expect(ev.outcome).toBe("beraberlik");
  });
});

describe("peek/get — üyelik ve dört ekran", () => {
  it("var olmayan kod `yok`", async () => {
    const sonuc = await peekWhichMoreRoom(
      { now: SIMDI, userId: "ev", code: "ZZZZZZ" },
      deps,
    );
    expect(sonuc.kind).toBe("yok");
  });

  it("boş odaya yabancı `katilabilir`, dolu odaya `kapali`", async () => {
    const kurulan = await createWhichMoreRoom(aniInput, deps);
    const bos = await peekWhichMoreRoom(
      { now: ileri(1), userId: "yabanci", code: kurulan.code },
      deps,
    );
    expect(bos.kind).toBe("katilabilir");

    await joinWhichMoreRoom(
      { now: ileri(1), userId: "konuk", code: kurulan.code },
      deps,
    );
    const dolu = await peekWhichMoreRoom(
      { now: ileri(2), userId: "ucuncu", code: kurulan.code },
      deps,
    );
    expect(dolu.kind).toBe("kapali");
  });

  it("üye olmayan odayı okuyamaz", async () => {
    const kod = await kurVeKatil();
    await expect(
      getWhichMoreRoom({ now: ileri(2), userId: "yabanci", code: kod }, deps),
    ).rejects.toThrow(/üyesi değilsin/u);
  });

  it("tur başlamadan cevap kabul edilmez", async () => {
    const kurulan = await createWhichMoreRoom(aniInput, deps);
    await expect(
      submitWhichMoreAnswer(
        {
          now: ileri(1),
          userId: "ev",
          code: kurulan.code,
          roundIndex: 0,
          chosenId: "b" as PlayerId,
        },
        deps,
      ),
    ).rejects.toThrow(/henüz başlamadı/u);
  });

  it("süresi dolmuş ama kesinleşmemiş maç yarim, cevap kabul etmez", async () => {
    const kod = await kurVeKatil();
    await expect(
      submitWhichMoreAnswer(
        {
          now: ileri(62),
          userId: "ev",
          code: kod,
          roundIndex: 0,
          chosenId: "b" as PlayerId,
        },
        deps,
      ),
    ).rejects.toThrow(/süresi doldu/u);

    const ev = await getWhichMoreRoom(
      { now: ileri(62), userId: "ev", code: kod },
      deps,
    );
    expect(ev.status).toBe("suresi-doldu");
    expect(ev.outcome).toBe("yarim");
  });
});
