import { describe, expect, it } from "vitest";
import {
  EMPTY_ROUND,
  withAnswer,
  type RoundState,
} from "@/domain/services/daily-round";
import {
  isMember,
  isRoomFinished,
  isTargetVisible,
  judgeJoin,
  roomDeadline,
  roomOutcome,
  roomStatus,
  ROOM_JOIN_WINDOW_MS,
  ROOM_PLAY_WINDOW_MS,
  type RoomState,
} from "@/domain/services/room";
import { STAT_KEYS } from "@/domain/services/stat-match";

/**
 * §12 BR-54/BR-57/BR-60/BR-61/BR-62 — odanın kuralları.
 *
 * ZAMAN HER YERDE PARAMETRE. Tek bir `Date.now()` çağrısı olsaydı sönme
 * kuralları ancak gerçek zaman beklenerek sınanabilirdi.
 */

const KURULUS = new Date("2026-08-20T10:00:00.000Z");

/** Verilen puanlarla altı istatistiği de cevaplanmış bir tur. */
const fullRound = (scores: readonly number[]): RoundState =>
  STAT_KEYS.reduce(
    (state, key, index) =>
      withAnswer(state, {
        statKey: key,
        playerId: `${key}-p`,
        value: 1,
        score: scores[index] ?? 0,
      }),
    EMPTY_ROUND,
  );

/** Yalnızca ilk istatistiği cevaplanmış, yani YARIM bir tur. */
const halfRound = (): RoundState =>
  withAnswer(EMPTY_ROUND, {
    statKey: STAT_KEYS[0],
    playerId: "yarim-p",
    value: 1,
    score: 50,
  });

const player = (userId: string, round: RoundState = EMPTY_ROUND) => ({
  userId,
  displayName: userId.toUpperCase(),
  round,
});

const waiting = (): RoomState => ({
  createdAt: KURULUS,
  startedAt: null,
  players: [player("ev")],
});

const playing = (
  evRound: RoundState = EMPTY_ROUND,
  konukRound: RoundState = EMPTY_ROUND,
): RoomState => ({
  createdAt: KURULUS,
  startedAt: new Date(KURULUS.getTime() + 60_000),
  players: [player("ev", evRound), player("konuk", konukRound)],
});

const after = (room: RoomState, ms: number): Date =>
  new Date((room.startedAt ?? room.createdAt).getTime() + ms);

describe("roomDeadline — BR-60'ın iki penceresi", () => {
  it("katılım beklenirken kuruluştan itibaren sayar", () => {
    expect(roomDeadline(waiting()).getTime()).toBe(
      KURULUS.getTime() + ROOM_JOIN_WINDOW_MS,
    );
  });

  it("tur başlamışsa BAŞLANGIÇTAN itibaren sayar", () => {
    const room = playing();

    expect(roomDeadline(room).getTime()).toBe(
      (room.startedAt?.getTime() ?? 0) + ROOM_PLAY_WINDOW_MS,
    );
  });
});

describe("roomStatus", () => {
  it("tek oyuncu ve süre dolmamışsa bekliyor", () => {
    expect(roomStatus(waiting(), new Date(KURULUS.getTime() + 1000))).toBe(
      "bekliyor",
    );
  });

  it("otuz dakika dolduğunda katılımsız oda söner", () => {
    const now = new Date(KURULUS.getTime() + ROOM_JOIN_WINDOW_MS);

    expect(roomStatus(waiting(), now)).toBe("suresi-doldu");
  });

  it("iki oyuncu varsa ve turlar sürüyorsa oynaniyor", () => {
    const room = playing(halfRound());

    expect(roomStatus(room, after(room, 1000))).toBe("oynaniyor");
  });

  it("iki tur da bitince bitti", () => {
    const room = playing(fullRound([10, 10, 10, 10, 10, 10]), fullRound([1]));

    expect(roomStatus(room, after(room, 1000))).toBe("bitti");
  });

  it("tek taraf bitirmişse hâlâ oynaniyor", () => {
    const room = playing(fullRound([10, 10, 10, 10, 10, 10]), halfRound());

    expect(roomStatus(room, after(room, 1000))).toBe("oynaniyor");
  });

  /**
   * SIRA KURALIN PARÇASI: süre denetimi önce yapılsaydı, altmışıncı dakikada
   * bitirilen bir tur altmış birinci dakikada "süresi doldu" olurdu — yani
   * oyun oynanıp bittikten sonra sonucu kaybolurdu.
   */
  it("BİTMİŞ oda süre dolsa da sönmez", () => {
    const room = playing(fullRound([50]), fullRound([40]));

    expect(roomStatus(room, after(room, ROOM_PLAY_WINDOW_MS * 2))).toBe(
      "bitti",
    );
  });

  it("bitmemiş tur altmış dakikada söner", () => {
    const room = playing(halfRound(), EMPTY_ROUND);

    expect(roomStatus(room, after(room, ROOM_PLAY_WINDOW_MS))).toBe(
      "suresi-doldu",
    );
  });
});

describe("isRoomFinished", () => {
  it("tek oyuncunun bitirmesi odayı bitirmez", () => {
    expect(
      isRoomFinished({
        createdAt: KURULUS,
        startedAt: null,
        players: [player("ev", fullRound([100]))],
      }),
    ).toBe(false);
  });
});

describe("isTargetVisible — BR-57", () => {
  it("ikinci oyuncu katılmadan hedefi HİÇ KİMSEYE göstermez", () => {
    expect(isTargetVisible(waiting())).toBe(false);
  });

  it("tur başlayınca gösterir", () => {
    expect(isTargetVisible(playing())).toBe(true);
  });

  /** Bir kez açılan hedef sır değildir; sönmüş odada gizlemek bilgi korumaz. */
  it("oda sönmüş olsa da açılmış hedefi gizlemez", () => {
    const room = playing(halfRound());

    expect(roomStatus(room, after(room, ROOM_PLAY_WINDOW_MS))).toBe(
      "suresi-doldu",
    );
    expect(isTargetVisible(room)).toBe(true);
  });
});

describe("judgeJoin — BR-54", () => {
  it("boş yeri olan bekleyen odaya katılmaya izin verir", () => {
    const verdict = judgeJoin(waiting(), "konuk", new Date(KURULUS));

    expect(verdict.kind).toBe("katil");
  });

  /**
   * SIRA KURALIN PARÇASI: üyelik denetimi sona bırakılsaydı, iki kişilik dolu
   * bir odanın KENDİ üyesi sayfayı yenilediğinde "oda dolu" hatası alırdı —
   * oysa odayı dolduran kişi kendisi.
   */
  it("zaten üye olan için ret değil 'zaten-uye' döner", () => {
    expect(judgeJoin(waiting(), "ev", new Date(KURULUS)).kind).toBe(
      "zaten-uye",
    );

    const room = playing();
    expect(judgeJoin(room, "konuk", after(room, 1000)).kind).toBe("zaten-uye");
  });

  it("başlamış odaya üçüncü kişiyi almaz", () => {
    const room = playing();
    const verdict = judgeJoin(room, "yabanci", after(room, 1000));

    expect(verdict).toEqual({ kind: "ret", reason: "oda-kapali" });
  });

  it("sönmüş odaya katılmaya izin vermez", () => {
    const now = new Date(KURULUS.getTime() + ROOM_JOIN_WINDOW_MS);
    const verdict = judgeJoin(waiting(), "konuk", now);

    expect(verdict).toEqual({ kind: "ret", reason: "oda-kapali" });
  });

  it("isMember üyeliği doğru okur", () => {
    expect(isMember(waiting(), "ev")).toBe(true);
    expect(isMember(waiting(), "konuk")).toBe(false);
  });
});

describe("roomOutcome — BR-61, BR-62", () => {
  it("tur sürerken devam der", () => {
    const room = playing(halfRound());

    expect(roomOutcome(room, after(room, 1000))).toEqual({ kind: "devam" });
  });

  it("bekleyen odada da devam der", () => {
    expect(roomOutcome(waiting(), new Date(KURULUS))).toEqual({
      kind: "devam",
    });
  });

  /**
   * BR-61 — bitiren tarafı hükmen galip saymak reddedildi: kişi kötü oynadığı
   * için değil BİTİRMEDİĞİ için sonuç yok, ve hükmen galibiyet rakibi
   * bağlantısını kesmeye teşvik ederdi.
   */
  it("rakip bırakıp gitmişse GALİP YOKTUR", () => {
    const room = playing(
      fullRound([100, 100, 100, 100, 100, 100]),
      halfRound(),
    );

    expect(roomOutcome(room, after(room, ROOM_PLAY_WINDOW_MS))).toEqual({
      kind: "yarim",
    });
  });

  it("eşit toplamda beraberlik verir", () => {
    const room = playing(
      fullRound([10, 20, 30, 0, 0, 0]),
      fullRound([30, 20, 10, 0, 0, 0]),
    );

    expect(roomOutcome(room, after(room, 1000))).toEqual({
      kind: "beraberlik",
      points: 60,
    });
  });

  /** BR-62 — ilk bitiren kazanmaz; girdide bitiş anı hiç yok. */
  it("beraberliği süreye bakarak bozmaz", () => {
    const room = playing(fullRound([50]), fullRound([50]));

    expect(roomOutcome(room, after(room, 1000)).kind).toBe("beraberlik");
  });

  it("yüksek toplamı olan kazanır — ev sahibi", () => {
    const room = playing(fullRound([90, 90]), fullRound([10, 10]));

    expect(roomOutcome(room, after(room, 1000))).toEqual({
      kind: "galip",
      winnerId: "ev",
      winnerPoints: 180,
      loserPoints: 20,
    });
  });

  it("yüksek toplamı olan kazanır — konuk", () => {
    const room = playing(fullRound([10, 10]), fullRound([90, 90]));

    expect(roomOutcome(room, after(room, 1000))).toEqual({
      kind: "galip",
      winnerId: "konuk",
      winnerPoints: 180,
      loserPoints: 20,
    });
  });

  it("bitmiş odanın sonucu süre geçse de durur", () => {
    const room = playing(fullRound([70]), fullRound([30]));

    expect(roomOutcome(room, after(room, ROOM_PLAY_WINDOW_MS * 3)).kind).toBe(
      "galip",
    );
  });
});
