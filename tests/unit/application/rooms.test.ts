import { beforeEach, describe, expect, it } from "vitest";
import type { PlayerRepository } from "@/application/ports/player-repository";
import type { RandomSource } from "@/application/ports/random-source";
import type {
  CreateRoomResult,
  JoinRoomResult,
  RoomsRepository,
  SaveRoomAnswerResult,
  StoredRoom,
} from "@/application/ports/rooms-repository";
import type {
  StatMatchRepository,
  StatMatchTarget,
} from "@/application/ports/stat-match-repository";
import {
  createRoom,
  getRoom,
  joinRoom,
  peekRoom,
  submitRoomAnswer,
  type RoomDeps,
} from "@/application/use-cases/rooms";
import type { RoundAnswer } from "@/domain/services/daily-round";
import type { RoomPlayerState } from "@/domain/services/room";
import { STAT_KEYS, type StatKey } from "@/domain/services/stat-match";
import type { PlayerId } from "@/domain/value-objects/identifiers";
import { isRoomCode } from "@/domain/value-objects/room-code";

/**
 * Oda kullanım senaryoları — PROJECT.md §12, BR-54…BR-63.
 *
 * Buradaki testler DEPOLAMAYI değil KARARI ölçüyor: hedef ne zaman görünür,
 * rakibin puanı ne zaman açılır, hangi istek reddedilir. Kısıtların gerçekten
 * var olduğu ayrıca şema testlerinde ölçülecek.
 */

const SIMDI = new Date("2026-08-20T10:00:00.000Z");
const ileri = (dakika: number): Date =>
  new Date(SIMDI.getTime() + dakika * 60_000);

function hedef(id: string): StatMatchTarget {
  return {
    id: id as PlayerId,
    name: `Oyuncu ${id}`,
    nationality: "TR",
    stats: {
      appearances: 400,
      goals: 100,
      clubs: 4,
      nationalCaps: 50,
      heightCm: 180,
      birthYear: 1990,
    },
  };
}

class SahteIstatistik implements Partial<StatMatchRepository> {
  readonly adaylar: StatMatchTarget[] = [hedef("h1"), hedef("h2"), hedef("h3")];

  findDailyCandidates(): Promise<readonly StatMatchTarget[]> {
    return Promise.resolve(this.adaylar);
  }

  findChosenTarget(playerId: PlayerId): Promise<StatMatchTarget | null> {
    return Promise.resolve(
      this.adaylar.find((aday) => aday.id === playerId) ?? null,
    );
  }

  findStatValue(_playerId: PlayerId, _key: StatKey): Promise<number | null> {
    // Hedefe yakın ama eşit değil: puan 0 da 100 de olmasın.
    return Promise.resolve(380);
  }
}

/**
 * Bellek içi oda deposu — koltuk kısıtını GERÇEKTEN uyguluyor.
 *
 * Kısıtı taklit etmeyen bir sahte, BR-54'ün yarışını sınanamaz kılardı: kural
 * `judgeJoin`'de değil, kısıtta kapanıyor.
 */
class SahteOdaDeposu implements RoomsRepository {
  readonly odalar = new Map<string, StoredRoom>();
  silinenSahipler: string[] = [];
  silinenSonmusler = 0;
  /** Kaç kez çakışma taklidi yapılacak — kod yeniden deneme yolunu sınar. */
  cakismaSayisi = 0;

  seed(room: StoredRoom): StoredRoom {
    this.odalar.set(room.code, room);
    return room;
  }

  findByCode(code: string): Promise<StoredRoom | null> {
    return Promise.resolve(this.odalar.get(code) ?? null);
  }

  createRoom(input: {
    readonly hostId: string;
    readonly code: string;
    readonly targetPlayerId: string;
  }): Promise<CreateRoomResult> {
    if (this.cakismaSayisi > 0) {
      this.cakismaSayisi -= 1;
      return Promise.resolve({ kind: "kod-cakisti" });
    }
    if (this.odalar.has(input.code)) {
      return Promise.resolve({ kind: "kod-cakisti" });
    }

    const room: StoredRoom = {
      id: `oda-${input.code}`,
      code: input.code,
      hostId: input.hostId,
      targetPlayerId: input.targetPlayerId,
      state: {
        createdAt: SIMDI,
        startedAt: null,
        players: [
          { userId: input.hostId, displayName: "EV", round: { answers: [] } },
        ],
      },
    };

    this.odalar.set(input.code, room);
    return Promise.resolve({ kind: "kuruldu", room });
  }

  joinRoom(input: {
    readonly roomId: string;
    readonly userId: string;
    readonly startedAt: Date;
  }): Promise<JoinRoomResult> {
    const room = [...this.odalar.values()].find(
      (aday) => aday.id === input.roomId,
    );
    if (room === undefined) throw new Error("oda yok");

    // İKİNCİ KOLTUK KISITI — `@@unique([roomId, seat])` karşılığı.
    if (room.state.players.length >= 2) {
      return Promise.resolve({ kind: "dolu" });
    }

    const guncel: StoredRoom = {
      ...room,
      state: {
        ...room.state,
        startedAt: input.startedAt,
        players: [
          ...room.state.players,
          {
            userId: input.userId,
            displayName: "KONUK",
            round: { answers: [] },
          },
        ],
      },
    };

    this.odalar.set(room.code, guncel);
    return Promise.resolve({ kind: "katildi", room: guncel });
  }

  saveAnswer(input: {
    readonly roomId: string;
    readonly userId: string;
    readonly answer: RoundAnswer;
  }): Promise<SaveRoomAnswerResult> {
    const room = [...this.odalar.values()].find(
      (aday) => aday.id === input.roomId,
    );
    if (room === undefined) throw new Error("oda yok");

    const players: RoomPlayerState[] = room.state.players.map((player) => {
      if (player.userId !== input.userId) return player;
      return {
        ...player,
        round: { answers: [...player.round.answers, input.answer] },
      };
    });

    const guncel: StoredRoom = { ...room, state: { ...room.state, players } };
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

/**
 * Oyuncu adlarını çözen sahte depo.
 *
 * ADI OLMAYAN KİMLİK DE SINANIYOR: `withPlayerNames` bulunamayan adı
 * kimliğiyle gösterir ve o yedek kuralı burada da geçerli olmalı.
 */
class SahteOyuncuDeposu implements Partial<PlayerRepository> {
  findNames(ids: readonly PlayerId[]): Promise<Map<string, string>> {
    return Promise.resolve(
      new Map(ids.map((id) => [id, `${id} adı`] as const)),
    );
  }
}

/** Sırayla verilen baytları döner; bittiğinde başa sarar. */
class SahteRastgele implements RandomSource {
  private imlec = 0;
  constructor(private readonly kaynak: readonly number[] = [7]) {}

  bytes(count: number): Uint8Array {
    return Uint8Array.from({ length: count }, () => {
      const value = this.kaynak[this.imlec % this.kaynak.length] ?? 0;
      this.imlec += 1;
      return value;
    });
  }
}

let depo: SahteOdaDeposu;
let deps: RoomDeps;

beforeEach(() => {
  depo = new SahteOdaDeposu();
  deps = {
    rooms: depo,
    statMatch: new SahteIstatistik() as unknown as StatMatchRepository,
    players: new SahteOyuncuDeposu() as unknown as PlayerRepository,
    random: new SahteRastgele([3, 11, 19, 2, 24, 8]),
  };
});

/** Kurulmuş ve iki oyuncunun katıldığı bir oda. */
async function kurVeKatil(): Promise<string> {
  const kurulan = await createRoom({ now: SIMDI, userId: "ev" }, deps);
  await joinRoom({ now: ileri(1), userId: "konuk", code: kurulan.code }, deps);
  return kurulan.code;
}

describe("createRoom — BR-55, BR-56, BR-57, BR-60", () => {
  it("geçerli bir kod üretir", async () => {
    const oda = await createRoom({ now: SIMDI, userId: "ev" }, deps);

    expect(isRoomCode(oda.code)).toBe(true);
  });

  it("HEDEFİ DÖNMEZ — ikinci oyuncu katılmadı (BR-57)", async () => {
    const oda = await createRoom({ now: SIMDI, userId: "ev" }, deps);

    expect(oda.target).toBeNull();
    expect(oda.status).toBe("bekliyor");
    expect(oda.opponent).toBeNull();
  });

  it("kurucunun eski odalarını siler, sönmüşleri süpürür (BR-60)", async () => {
    await createRoom({ now: SIMDI, userId: "ev" }, deps);

    expect(depo.silinenSahipler).toEqual(["ev"]);
    expect(depo.silinenSonmusler).toBe(1);
  });

  it("kod çakışırsa yeni kodla yeniden dener (BR-55)", async () => {
    depo.cakismaSayisi = 2;

    const oda = await createRoom({ now: SIMDI, userId: "ev" }, deps);

    expect(isRoomCode(oda.code)).toBe(true);
  });

  it("çakışma sürekliyse sessizce dönmez, hata verir", async () => {
    depo.cakismaSayisi = 99;

    await expect(
      createRoom({ now: SIMDI, userId: "ev" }, deps),
    ).rejects.toThrow(/Oda kodu üretilemedi/u);
  });
});

describe("joinRoom — BR-54, BR-57", () => {
  it("katılınca tur başlar ve hedef İKİ TARAFA DA açılır", async () => {
    const kod = await kurVeKatil();

    const konuk = await getRoom(
      { now: ileri(2), userId: "konuk", code: kod },
      deps,
    );
    const ev = await getRoom({ now: ileri(2), userId: "ev", code: kod }, deps);

    expect(konuk.status).toBe("oynaniyor");
    expect(konuk.target?.stats).toHaveLength(STAT_KEYS.length);
    expect(ev.target?.player.id).toBe(konuk.target?.player.id);
  });

  it("zaten üye olan hata almaz, odayı görür", async () => {
    const kod = await kurVeKatil();

    const yine = await joinRoom(
      { now: ileri(3), userId: "konuk", code: kod },
      deps,
    );

    expect(yine.status).toBe("oynaniyor");
  });

  it("dolu odaya üçüncü kişi giremez", async () => {
    const kod = await kurVeKatil();

    await expect(
      joinRoom({ now: ileri(3), userId: "yabanci", code: kod }, deps),
    ).rejects.toThrow(/açık değil|dolu/u);
  });

  it("sönmüş odaya katılınamaz", async () => {
    const kurulan = await createRoom({ now: SIMDI, userId: "ev" }, deps);

    await expect(
      joinRoom({ now: ileri(31), userId: "konuk", code: kurulan.code }, deps),
    ).rejects.toThrow(/açık değil/u);
  });

  it("olmayan kod için 'oda yok' der, 'süresi doldu' demez", async () => {
    await expect(
      joinRoom({ now: SIMDI, userId: "konuk", code: "BBBBBB" }, deps),
    ).rejects.toThrow(/Böyle bir oda yok/u);
  });
});

describe("getRoom — üyelik ve BR-63", () => {
  it("üye olmayan odayı okuyamaz", async () => {
    const kod = await kurVeKatil();

    await expect(
      getRoom({ now: ileri(2), userId: "yabanci", code: kod }, deps),
    ).rejects.toThrow(/üyesi değilsin/u);
  });

  /**
   * BR-63 — rakibin puanı tur biterken gizlidir. Görünseydi kullanıcı ne
   * kadar açık olduğunu bilir ve oyun "kimi biliyorsun"dan "ne kadar lazım"a
   * dönerdi.
   */
  it("tur sürerken RAKİBİN puanını göstermez, kendiminkini gösterir", async () => {
    const kod = await kurVeKatil();
    await submitRoomAnswer(
      {
        now: ileri(2),
        userId: "konuk",
        code: kod,
        statKey: "goals",
        playerId: "cevap-1" as PlayerId,
      },
      deps,
    );

    const ev = await getRoom({ now: ileri(3), userId: "ev", code: kod }, deps);

    expect(ev.opponent?.answered).toBe(1);
    expect(ev.opponent?.points).toBeNull();
    expect(ev.me.points).toBe(0);
  });
});

describe("submitRoomAnswer — BR-58, BR-17, BR-20", () => {
  it("puanı sunucu hesaplar ve cevabı yazar", async () => {
    const kod = await kurVeKatil();

    const sonuc = await submitRoomAnswer(
      {
        now: ileri(2),
        userId: "ev",
        code: kod,
        statKey: "appearances",
        playerId: "cevap-1" as PlayerId,
      },
      deps,
    );

    expect(sonuc.value).toBe(380);
    expect(sonuc.score).toBeGreaterThan(0);
    expect(sonuc.room.me.answered).toBe(1);
  });

  it("aynı istatistiğe ikinci cevap SAKLANANI döner (BR-58)", async () => {
    const kod = await kurVeKatil();
    const ilk = await submitRoomAnswer(
      {
        now: ileri(2),
        userId: "ev",
        code: kod,
        statKey: "goals",
        playerId: "cevap-1" as PlayerId,
      },
      deps,
    );

    const ikinci = await submitRoomAnswer(
      {
        now: ileri(3),
        userId: "ev",
        code: kod,
        statKey: "goals",
        playerId: "cevap-2" as PlayerId,
      },
      deps,
    );

    expect(ikinci.score).toBe(ilk.score);
    expect(ikinci.room.me.answered).toBe(1);
  });

  it("aynı oyuncu ikinci istatistikte kullanılamaz (BR-17)", async () => {
    const kod = await kurVeKatil();
    await submitRoomAnswer(
      {
        now: ileri(2),
        userId: "ev",
        code: kod,
        statKey: "goals",
        playerId: "cevap-1" as PlayerId,
      },
      deps,
    );

    await expect(
      submitRoomAnswer(
        {
          now: ileri(3),
          userId: "ev",
          code: kod,
          statKey: "clubs",
          playerId: "cevap-1" as PlayerId,
        },
        deps,
      ),
    ).rejects.toThrow(/zaten kullandın/u);
  });

  it("hedefin kendisi cevap olamaz", async () => {
    const kod = await kurVeKatil();
    const oda = await getRoom({ now: ileri(2), userId: "ev", code: kod }, deps);
    const hedefId = oda.target?.player.id ?? "";

    await expect(
      submitRoomAnswer(
        {
          now: ileri(3),
          userId: "ev",
          code: kod,
          statKey: "goals",
          playerId: hedefId as PlayerId,
        },
        deps,
      ),
    ).rejects.toThrow(/Hedef oyuncu cevap olarak seçilemez/u);
  });

  it("tur başlamadan cevap kabul edilmez", async () => {
    const kurulan = await createRoom({ now: SIMDI, userId: "ev" }, deps);

    await expect(
      submitRoomAnswer(
        {
          now: ileri(1),
          userId: "ev",
          code: kurulan.code,
          statKey: "goals",
          playerId: "cevap-1" as PlayerId,
        },
        deps,
      ),
    ).rejects.toThrow(/henüz başlamadı/u);
  });

  it("süresi dolmuş turda cevap kabul edilmez", async () => {
    const kod = await kurVeKatil();

    await expect(
      submitRoomAnswer(
        {
          now: ileri(62),
          userId: "ev",
          code: kod,
          statKey: "goals",
          playerId: "cevap-1" as PlayerId,
        },
        deps,
      ),
    ).rejects.toThrow(/süresi doldu/u);
  });

  it("üye olmayan cevap yazamaz", async () => {
    const kod = await kurVeKatil();

    await expect(
      submitRoomAnswer(
        {
          now: ileri(2),
          userId: "yabanci",
          code: kod,
          statKey: "goals",
          playerId: "cevap-1" as PlayerId,
        },
        deps,
      ),
    ).rejects.toThrow(/üyesi değilsin/u);
  });
});

describe("sonuç — BR-61, BR-62", () => {
  const dolu = (puanlar: readonly number[]): { answers: RoundAnswer[] } => ({
    answers: STAT_KEYS.map((key, index) => ({
      statKey: key,
      playerId: `${key}-${String(index)}`,
      value: 1,
      score: puanlar[index] ?? 0,
    })),
  });

  const odaKur = (
    evRound: { answers: RoundAnswer[] },
    konukRound: { answers: RoundAnswer[] },
  ): string => {
    depo.seed({
      id: "oda-X",
      code: "BBBBBB",
      hostId: "ev",
      targetPlayerId: "h1",
      state: {
        createdAt: SIMDI,
        startedAt: SIMDI,
        players: [
          { userId: "ev", displayName: "EV", round: evRound },
          { userId: "konuk", displayName: "KONUK", round: konukRound },
        ],
      },
    });
    return "BBBBBB";
  };

  it("yüksek toplam kazanır ve iki taraf da aynı sonucu görür", async () => {
    const kod = odaKur(dolu([90, 90]), dolu([10, 10]));

    const ev = await getRoom({ now: ileri(5), userId: "ev", code: kod }, deps);
    const konuk = await getRoom(
      { now: ileri(5), userId: "konuk", code: kod },
      deps,
    );

    expect(ev.outcome).toBe("kazandin");
    expect(konuk.outcome).toBe("kaybettin");
  });

  it("oda bitince rakibin puanı AÇILIR", async () => {
    const kod = odaKur(dolu([90, 90]), dolu([10, 10]));

    const ev = await getRoom({ now: ileri(5), userId: "ev", code: kod }, deps);

    expect(ev.me.points).toBe(180);
    expect(ev.opponent?.points).toBe(20);
  });

  it("eşit toplam beraberliktir (BR-62)", async () => {
    const kod = odaKur(dolu([50, 50]), dolu([50, 50]));

    const ev = await getRoom({ now: ileri(5), userId: "ev", code: kod }, deps);

    expect(ev.outcome).toBe("beraberlik");
  });

  it("rakip bırakıp gitmişse galip yoktur (BR-61)", async () => {
    const kod = odaKur(dolu([100, 100, 100, 100, 100, 100]), { answers: [] });

    const ev = await getRoom({ now: ileri(61), userId: "ev", code: kod }, deps);

    expect(ev.status).toBe("suresi-doldu");
    expect(ev.outcome).toBe("yarim");
  });
});

describe("peekRoom — sayfanın dört ekranı", () => {
  it("var olmayan kod için `yok` der", async () => {
    const sonuc = await peekRoom(
      { now: SIMDI, userId: "ev", code: "ZZZZZZ" },
      deps,
    );

    expect(sonuc.kind).toBe("yok");
  });

  it("üyeye odanın kendisini verir", async () => {
    const kod = await kurVeKatil();

    const sonuc = await peekRoom(
      { now: ileri(2), userId: "konuk", code: kod },
      deps,
    );

    expect(sonuc.kind).toBe("uye");
    if (sonuc.kind !== "uye") return;
    expect(sonuc.room.code).toBe(kod);
    expect(sonuc.room.target).not.toBeNull();
  });

  it("boş odaya gelen yabancıya `katilabilir` der", async () => {
    const kurulan = await createRoom({ now: SIMDI, userId: "ev" }, deps);

    const sonuc = await peekRoom(
      { now: ileri(1), userId: "yabanci", code: kurulan.code },
      deps,
    );

    expect(sonuc.kind).toBe("katilabilir");
  });

  /**
   * ÜÇÜNCÜ KİŞİ "KATIL" DÜĞMESİ GÖRMEMELİ. Gerekçe kullanıcı tarafında:
   * çalışmayacağı baştan belli bir düğmeyi göstermek, tıklattıktan sonra
   * hayal kırıklığı yaratmak demek.
   */
  it("dolu odaya gelen yabancıya gerekçesiyle `kapali` der (BR-54)", async () => {
    const kod = await kurVeKatil();

    const sonuc = await peekRoom(
      { now: ileri(2), userId: "ucuncu", code: kod },
      deps,
    );

    expect(sonuc.kind).toBe("kapali");
    if (sonuc.kind !== "kapali") return;
    // Tur başladığı için kapı `oda-kapali`; doluluk ikinci savunma hattı.
    expect(sonuc.reason).toBe("oda-kapali");
  });

  it("sönmüş odaya gelen yabancıya `kapali` der, `yok` demez (BR-60)", async () => {
    const kurulan = await createRoom({ now: SIMDI, userId: "ev" }, deps);

    const sonuc = await peekRoom(
      { now: ileri(31), userId: "yabanci", code: kurulan.code },
      deps,
    );

    expect(sonuc.kind).toBe("kapali");
    if (sonuc.kind !== "kapali") return;
    expect(sonuc.reason).toBe("oda-kapali");
  });
});

describe("cevaplar DTO'da — BR-63", () => {
  const dolu = (puanlar: readonly number[]): { answers: RoundAnswer[] } => ({
    answers: puanlar.map((score, index) => ({
      statKey: STAT_KEYS[index] as StatKey,
      playerId: `secim-${String(index)}`,
      value: 1,
      score,
    })),
  });

  const odaKur = (
    evRound: { answers: RoundAnswer[] },
    konukRound: { answers: RoundAnswer[] },
  ): string => {
    depo.seed({
      id: "oda-C",
      code: "CCCCCC",
      hostId: "ev",
      targetPlayerId: "h1",
      state: {
        createdAt: SIMDI,
        startedAt: SIMDI,
        players: [
          { userId: "ev", displayName: "EV", round: evRound },
          { userId: "konuk", displayName: "KONUK", round: konukRound },
        ],
      },
    });
    return "CCCCCC";
  };

  /**
   * SAYFA YENİLENDİĞİNDE TAHTA BOŞ KALMAMALI. Kusur arayüz yazılırken çıktı:
   * DTO yalnızca "kaç istatistik cevaplandı" sayısını taşıyordu, cevapların
   * kendisini değil.
   */
  it("kendi cevaplarım ADLARIYLA gelir, tur bitmemiş olsa da", async () => {
    const kod = odaKur(dolu([90, 40]), { answers: [] });

    const ev = await getRoom({ now: ileri(5), userId: "ev", code: kod }, deps);

    expect(ev.status).toBe("oynaniyor");
    expect(ev.me.answers).toHaveLength(2);
    expect(ev.me.answers?.[0]?.playerName).toBe("secim-0 adı");
  });

  it("RAKİBİN cevapları tur biterken GİZLİDİR", async () => {
    const kod = odaKur(dolu([90, 40]), dolu([70]));

    const ev = await getRoom({ now: ileri(5), userId: "ev", code: kod }, deps);

    expect(ev.opponent?.answered).toBe(1);
    expect(ev.opponent?.answers).toBeNull();
    expect(ev.opponent?.points).toBeNull();
  });

  it("oda bitince rakibin cevapları da AÇILIR — karşılaştırma ekranı", async () => {
    const tam = STAT_KEYS.map(() => 60);
    const kod = odaKur(dolu(tam), dolu(tam));

    const ev = await getRoom({ now: ileri(5), userId: "ev", code: kod }, deps);

    expect(ev.status).toBe("bitti");
    expect(ev.opponent?.answers).toHaveLength(STAT_KEYS.length);
    expect(ev.me.answers).toHaveLength(STAT_KEYS.length);
  });
});
