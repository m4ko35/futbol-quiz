import { z } from "zod";
import {
  RoundUnavailableError,
  ValidationError,
} from "@/domain/errors/domain-error";
import { isStatKey, type StatKey } from "@/domain/services/stat-match";
import {
  isDirection,
  isLevel,
  winningSide,
  type Direction,
  type Level,
} from "@/domain/services/which-more";
import {
  correctCount,
  isEliminated,
  isFixedN,
  isWhichMoreMember,
  judgeWhichMoreJoin,
  suddenDeathStreak,
  whichMoreRoomDeadline,
  whichMoreRoomOutcome,
  whichMoreRoomStatus,
  type FixedN,
  type WhichMoreDuelAnswer,
  type WhichMoreRoomConfig,
  type WhichMoreRoomPlayer,
  type WhichMoreSubmode,
} from "@/domain/services/which-more-room";
import type { RoomJoinRejection, RoomStatus } from "@/domain/services/room";
import {
  ROOM_JOIN_WINDOW_MS,
  ROOM_PLAY_WINDOW_MS,
} from "@/domain/services/room";
import {
  createSeededRandom,
  seedFromBytes,
} from "@/domain/value-objects/seeded-random";
import type { PlayerId } from "@/domain/value-objects/identifiers";
import { roomCodeFromBytes } from "@/domain/value-objects/room-code";
import type { RandomSource } from "../ports/random-source";
import type { WhichMoreCandidate } from "../ports/which-more-repository";
import type {
  StoredWhichMoreRoom,
  WhichMoreRoomsRepository,
} from "../ports/which-more-rooms-repository";
import type { GameModeDeps } from "../game-modes/types";
import {
  buildRoundPair,
  whichMorePlayerDto,
  type WhichMorePairDto,
  type WhichMorePlayerDto,
} from "./which-more";

/**
 * Odanın saklanan yapılandırmasının Zod şeması — BR-67, §2.3.
 *
 * SINIRDA DOĞRULAMA. `config` veritabanında JSON metni olarak durur; iç
 * katmanlara geçmeden önce burada ayrıştırılıp doğrulanır. Ayrık birlik
 * `submode`'a göre: `sabit-n` `n` ister, `ani-olum` istemez — geçersiz bir
 * birleşim (Ani ölümde `n`, ya da tanınmayan istatistik/seviye/yön) iç
 * katmana HİÇ ulaşamaz. `refine` tip koruyucularıyla çıktı doğrudan domain
 * tiplerine (StatKey/Level/Direction/FixedN) daralır.
 */
export const whichMoreRoomConfigSchema = z.discriminatedUnion("submode", [
  z.object({
    submode: z.literal("ani-olum"),
    statKey: z.string().refine(isStatKey),
    level: z.string().refine(isLevel),
    direction: z.string().refine(isDirection),
    seed: z.number().int(),
  }),
  z.object({
    submode: z.literal("sabit-n"),
    statKey: z.string().refine(isStatKey),
    level: z.string().refine(isLevel),
    direction: z.string().refine(isDirection),
    seed: z.number().int(),
    n: z.number().refine(isFixedN),
  }),
]);

/**
 * Hangisi Daha odasının ORTAK RAYI — PROJECT.md §12.8, BR-68.
 *
 * Ray TAMAMEN SUNUCUDA üretilir: istemci ne tohumu ne üreteci görür, yalnızca
 * sunucunun verdiği düelloyu alır. İki oyuncu aynı `roundIndex` için aynı
 * düelloyu gördüğü için (aynı oda, aynı tohum) rayları birebir aynıdır —
 * İstatistik odasındaki "ikinize aynı futbolcu" adaletinin karşılığı, uydurma
 * veri olmadan (§5.2).
 *
 * Sunucu koşuyu HATIRLAMAZ (§9.3 durumsuzluğu): her istekte ray 0. turdan
 * tohumla yeniden oynatılır. Veri bir derleme çıktısı olduğu için (§3.1) zincir
 * süreç boyunca değişmez ve tekrar oynatma ucuzdur.
 */

/** Rayın tek bir düellosu — istemciye giden değersiz çift + sunucunun sakladığı galip. */
export interface RailDuel {
  readonly roundIndex: number;
  readonly left: WhichMorePlayerDto;
  readonly right: WhichMorePlayerDto;
  /**
   * Veriyle belirlenen galip (BR-68). SUNUCUDA KALIR — istemciye gitmez, çünkü
   * bu, o düellonun CEVABIDIR (BR-32). Cevap doğrulaması bununla yapılır.
   */
  readonly winnerId: string;
}

type RailDeps = Pick<GameModeDeps, "whichMore">;

/**
 * Rayın `roundIndex`. düellosunu üretir — sunucuda tekrar oynatarak (BR-68).
 *
 * 0. turdan başlanır; her tur galibi VERİYLE belirlenip (yön config'te) bir
 * sonraki turun "kalanı" (BR-28) yapılır, görülen isimler dışlanır (BR-28).
 * `null` = ray tükendi: havuz o kadar uzun bir zinciri besleyemedi ve koşu
 * orada biter (Ani ölümde ikisi de hiç yanılmadan buraya varabilir — solo
 * moddaki "pair: null" ile aynı, hata değil §6.6).
 *
 * Rastgelelik tohumdan gelir ve hem yazı turasına hem deponun seçimine AYNI
 * akıştan verilir (`buildRoundPair`'in üçüncü argümanı); ayrı beslenselerdi
 * ray tekrarlanamazdı.
 */
export async function railDuelAt(
  config: WhichMoreRoomConfig,
  roundIndex: number,
  deps: RailDeps,
): Promise<RailDuel | null> {
  const random = createSeededRandom(config.seed);
  const exclude: PlayerId[] = [];
  let staying: WhichMoreCandidate | null = null;

  for (let index = 0; index <= roundIndex; index += 1) {
    const pair = await buildRoundPair(
      {
        statKey: config.statKey,
        level: config.level,
        stayingId: staying?.id ?? null,
        exclude,
      },
      deps,
      random,
    );
    if (pair === null) return null;

    // Galip veriyle belirlenir (BR-68): yön "more" ise büyük, "less" ise küçük.
    const winner =
      winningSide(config.direction, pair.left.value, pair.right.value) ===
      "left"
        ? pair.left
        : pair.right;

    if (index === roundIndex) {
      return {
        roundIndex,
        left: whichMorePlayerDto(pair.left),
        right: whichMorePlayerDto(pair.right),
        winnerId: winner.id,
      };
    }

    // Bir sonraki tura ilerlet: galip kalır, iki isim de dışlamaya girer.
    staying = winner;
    for (const id of [pair.left.id, pair.right.id]) {
      if (!exclude.includes(id)) exclude.push(id);
    }
  }

  // roundIndex < 0 gibi olağandışı girdi buraya düşer; sınırda zaten reddedilir.
  return null;
}

/**
 * Bir cevabın doğruluğunu SUNUCUDA belirler — BR-68/BR-32.
 *
 * Rayı `roundIndex`'e kadar oynatır, seçilen kartı galiple karşılaştırır.
 * İstemci "doğru" diyemez: değerler hiçbir zaman dışarı çıkmaz, karar hep
 * burada. Seçilen kart o düelloda sunulmadıysa (`chosenId` iki taraftan biri
 * değilse) ya da ray tükenmişse `null` — çağıran bunu geçersiz gönderim sayar.
 */
export interface RailAnswerCheck {
  readonly correct: boolean;
  /** Sonraki turda kalan (BR-28) — istemci bir sonraki düelloyu bununla ister. */
  readonly winnerId: string;
}

export async function checkRailAnswer(
  config: WhichMoreRoomConfig,
  roundIndex: number,
  chosenId: string,
  deps: RailDeps,
): Promise<RailAnswerCheck | null> {
  const duel = await railDuelAt(config, roundIndex, deps);
  if (duel === null) return null;
  if (chosenId !== duel.left.id && chosenId !== duel.right.id) return null;

  return { correct: chosenId === duel.winnerId, winnerId: duel.winnerId };
}

/**
 * Odanın orkestrasyonu — PROJECT.md §12.8.
 *
 * OYUN YENİDEN TANIMLANMIYOR. Yaşam döngüsü (kod, katıl, sönme, giriş şartı)
 * İstatistik odasıyla (`rooms.ts`) aynı desende; buradaki tek yeni şey ray
 * (`railDuelAt`), Hangisi Daha puanlaması (seri / doğru sayısı) ve BR-70'in
 * rakip gizleme kuralı.
 */

export interface WhichMoreRoomDeps {
  readonly rooms: WhichMoreRoomsRepository;
  readonly whichMore: GameModeDeps["whichMore"];
  readonly random: RandomSource;
}

/** Kod üretimi kaç kez denenir — `rooms.ts` ile aynı gerekçe. */
const CODE_ATTEMPTS = 5;
/** Her denemede istenen bayt — yanlılık elemesi bazılarını atar (`rooms.ts`). */
const CODE_BYTES = 16;

export type WhichMoreRoomOutcomeKind =
  "devam" | "yarim" | "beraberlik" | "kazandin" | "kaybettin";

/** Oda bitince açılan tek tur — hangi kartı seçti, doğru muydu (BR-70). */
export interface WhichMoreRevealedPick {
  readonly roundIndex: number;
  readonly chosenName: string;
  readonly correct: boolean;
}

/** Kendi tarafım — her zaman görünür. */
export interface WhichMoreSideDto {
  readonly displayName: string;
  readonly answered: number;
  /** Ani ölüm serisi (bu modda anlamlı). */
  readonly streak: number;
  /** Sabit N doğru sayısı (bu modda anlamlı). */
  readonly correct: number;
  /** Ani ölümde elendi mi. */
  readonly eliminated: boolean;
  /** Seçimlerim — oda bitince (karşılaştırma ekranı); yoksa `null`. */
  readonly picks: readonly WhichMoreRevealedPick[] | null;
}

/**
 * Rakip tarafı — BR-70 ile SINIRLI görünür.
 *
 * Oda bitene kadar: yalnızca durum. Ani ölümde `eliminated` (oynuyor/elendi),
 * `answered` NULL çünkü sayı seriyi ele verir. Sabit N'de `answered` (n/N
 * ilerlemesi) görünür ama `correct` gizli. `streak`/`correct`/`picks` oda
 * bitince açılır.
 */
export interface WhichMoreOpponentDto {
  readonly displayName: string;
  readonly eliminated: boolean;
  readonly answered: number | null;
  readonly streak: number | null;
  readonly correct: number | null;
  readonly picks: readonly WhichMoreRevealedPick[] | null;
}

export interface WhichMoreRoomDto {
  /** §12.8 — istemci hangi oda şekliyle konuştuğunu buradan ayırt eder (BR-67). */
  readonly mode: "hangisi-daha";
  readonly code: string;
  readonly status: RoomStatus;
  readonly expiresAt: string;
  readonly submode: WhichMoreSubmode;
  readonly statKey: StatKey;
  readonly level: Level;
  readonly direction: Direction;
  /** Sabit N'de tur sayısı; Ani ölümde `null`. */
  readonly n: number | null;
  readonly me: WhichMoreSideDto;
  /** Henüz kimse katılmadıysa `null`. */
  readonly opponent: WhichMoreOpponentDto | null;
  /** Sıradaki düello — DEĞERLER KAPALI (BR-32). Oynanabilir değilse `null`. */
  readonly currentDuel: WhichMorePairDto | null;
  readonly currentRoundIndex: number | null;
  readonly outcome: WhichMoreRoomOutcomeKind;
}

type PresentDeps = Pick<WhichMoreRoomDeps, "whichMore">;

/** Cevapların her turdaki seçimini ADLARIYLA açar — rayı o tura kadar oynatır. */
async function revealPicks(
  config: WhichMoreRoomConfig,
  answers: readonly WhichMoreDuelAnswer[],
  deps: PresentDeps,
): Promise<readonly WhichMoreRevealedPick[]> {
  const ordered = [...answers].sort((a, b) => a.roundIndex - b.roundIndex);
  const picks: WhichMoreRevealedPick[] = [];

  for (const answer of ordered) {
    const duel = await railDuelAt(config, answer.roundIndex, deps);
    // Ad bulunamazsa (ray oda kurulduktan sonra veri yenilenirse öksüz kalır)
    // kimliğe düşülür — sessizce yanlış bir ad göstermektense.
    const name =
      duel === null
        ? answer.chosenId
        : duel.left.id === answer.chosenId
          ? duel.left.name
          : duel.right.id === answer.chosenId
            ? duel.right.name
            : answer.chosenId;
    picks.push({
      roundIndex: answer.roundIndex,
      chosenName: name,
      correct: answer.correct,
    });
  }

  return picks;
}

/** O anki oyuncunun cevaplayacağı sıradaki düello — oynanabilir değilse `null`. */
async function currentDuelFor(
  room: StoredWhichMoreRoom,
  me: WhichMoreRoomPlayer,
  now: Date,
  deps: PresentDeps,
): Promise<{ readonly pair: WhichMorePairDto; readonly index: number } | null> {
  if (whichMoreRoomStatus(room.state, now) !== "oynaniyor") return null;

  const config = room.state.config;
  if (config.submode === "ani-olum" && isEliminated(me.answers)) return null;
  if (config.submode === "sabit-n" && me.answers.length >= config.n)
    return null;

  const index = me.answers.length;
  const duel = await railDuelAt(config, index, deps);
  if (duel === null) return null;

  return { pair: { left: duel.left, right: duel.right }, index };
}

async function opponentDto(
  config: WhichMoreRoomConfig,
  other: WhichMoreRoomPlayer,
  revealed: boolean,
  deps: PresentDeps,
): Promise<WhichMoreOpponentDto> {
  if (revealed) {
    return {
      displayName: other.displayName,
      eliminated: isEliminated(other.answers),
      answered: other.answers.length,
      streak: suddenDeathStreak(other.answers),
      correct: correctCount(other.answers),
      picks: await revealPicks(config, other.answers, deps),
    };
  }

  // BR-70 — gizli. Sabit N'de ilerleme (answered) açık, doğru sayısı gizli;
  // Ani ölümde answered SAYISI seriyi ele verdiği için null, yalnızca durum.
  return {
    displayName: other.displayName,
    eliminated: isEliminated(other.answers),
    answered: config.submode === "sabit-n" ? other.answers.length : null,
    streak: null,
    correct: null,
    picks: null,
  };
}

function outcomeKind(
  room: StoredWhichMoreRoom,
  userId: string,
  now: Date,
): WhichMoreRoomOutcomeKind {
  const outcome = whichMoreRoomOutcome(room.state, now);
  switch (outcome.kind) {
    case "devam":
    case "yarim":
    case "beraberlik":
      return outcome.kind;
    case "galip":
      return outcome.winnerId === userId ? "kazandin" : "kaybettin";
  }
}

/**
 * Odanın kullanıcıya görünen hâli — BR-70 TEK YERDE uygulanıyor.
 *
 * Rakibin ne kadar açığa çıktığı yalnızca burada karar veriliyor; dört uç da
 * aynı DTO'yu döndürdüğü için "rakibi ne zaman göster" sorusunun dört farklı
 * cevabı olamaz (İstatistik `present`'iyle aynı gerekçe).
 */
async function presentWhichMore(
  room: StoredWhichMoreRoom,
  userId: string,
  now: Date,
  deps: PresentDeps,
): Promise<WhichMoreRoomDto> {
  const { state } = room;
  const config = state.config;
  const status = whichMoreRoomStatus(state, now);
  const revealed = status === "bitti";

  const me = state.players.find((player) => player.userId === userId);
  if (me === undefined) throw new ValidationError("Bu odanın üyesi değilsin.");
  const other = state.players.find((player) => player.userId !== userId);

  const current = await currentDuelFor(room, me, now, deps);

  return {
    mode: "hangisi-daha",
    code: room.code,
    status,
    expiresAt: whichMoreRoomDeadline(state).toISOString(),
    submode: config.submode,
    statKey: config.statKey,
    level: config.level,
    direction: config.direction,
    n: config.submode === "sabit-n" ? config.n : null,
    me: {
      displayName: me.displayName,
      answered: me.answers.length,
      streak: suddenDeathStreak(me.answers),
      correct: correctCount(me.answers),
      eliminated: isEliminated(me.answers),
      picks: revealed ? await revealPicks(config, me.answers, deps) : null,
    },
    opponent:
      other === undefined
        ? null
        : await opponentDto(config, other, revealed, deps),
    currentDuel: current?.pair ?? null,
    currentRoundIndex: current?.index ?? null,
    outcome: outcomeKind(room, userId, now),
  };
}

export interface CreateWhichMoreRoomInput {
  readonly now: Date;
  readonly userId: string;
  readonly submode: WhichMoreSubmode;
  readonly statKey: StatKey;
  readonly level: Level;
  readonly direction: Direction;
  /** Sabit N için gerekli; Ani ölümde yok sayılır. */
  readonly n?: FixedN;
}

/** Girdiden TOHUMLU config kurar — tohum crypto'dan (tahmin edilemez, BR-68). */
function buildConfig(
  input: CreateWhichMoreRoomInput,
  random: RandomSource,
): WhichMoreRoomConfig {
  const seed = seedFromBytes(random.bytes(4));

  if (input.submode === "sabit-n") {
    if (input.n === undefined) {
      throw new ValidationError("Sabit N modunda tur sayısı gerekli.");
    }
    return {
      submode: "sabit-n",
      statKey: input.statKey,
      level: input.level,
      direction: input.direction,
      seed,
      n: input.n,
    };
  }

  return {
    submode: "ani-olum",
    statKey: input.statKey,
    level: input.level,
    direction: input.direction,
    seed,
  };
}

/**
 * Oda kurulmadan önce en az bir düello üretilebildiğini doğrular.
 *
 * Oynanmayacak bir oda kurmak (havuz o istatistikte boş/yetersiz) kullanıcıyı
 * çalışmayan bir koda gönderirdi — İstatistik odasının `pickTarget`'inin boş
 * havuzu reddetmesiyle aynı gerekçe. `RoundUnavailableError` (havuz hiç yok)
 * temiz bir ret'e çevrilir; sızıntı yok (§6.3).
 */
async function assertRailPlayable(
  config: WhichMoreRoomConfig,
  deps: PresentDeps,
): Promise<void> {
  let first: RailDuel | null = null;
  try {
    first = await railDuelAt(config, 0, deps);
  } catch (error: unknown) {
    if (error instanceof RoundUnavailableError) first = null;
    else throw error;
  }

  if (first === null) {
    throw new ValidationError(
      "Bu ayarlarla oda kurulamıyor: soru havuzu yetersiz.",
    );
  }
}

export async function createWhichMoreRoom(
  input: CreateWhichMoreRoomInput,
  deps: WhichMoreRoomDeps,
): Promise<WhichMoreRoomDto> {
  // ÖNCE TEMİZLİK — BR-60 (İstatistik `createRoom` ile aynı).
  await deps.rooms.deleteHostedRooms(input.userId);
  await deps.rooms.deleteExpiredRooms({
    unjoinedBefore: new Date(input.now.getTime() - ROOM_JOIN_WINDOW_MS),
    unfinishedBefore: new Date(input.now.getTime() - ROOM_PLAY_WINDOW_MS),
  });

  const config = buildConfig(input, deps.random);
  await assertRailPlayable(config, deps);

  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt += 1) {
    const code = roomCodeFromBytes(deps.random.bytes(CODE_BYTES));
    if (code === null) continue;

    const result = await deps.rooms.createRoom({
      hostId: input.userId,
      code,
      config,
    });

    if (result.kind === "kuruldu") {
      return presentWhichMore(result.room, input.userId, input.now, deps);
    }
  }

  throw new ValidationError("Oda kodu üretilemedi. Lütfen tekrar deneyin.");
}

export interface WhichMoreRoomByCodeInput {
  readonly now: Date;
  readonly userId: string;
  readonly code: string;
}

async function requireWhichMoreRoom(
  code: string,
  deps: WhichMoreRoomDeps,
): Promise<StoredWhichMoreRoom> {
  const room = await deps.rooms.findByCode(code);
  // "Oda yok" ile "oda söndü" ayrımı `rooms.ts` ile aynı: sönmüş oda buradan
  // GEÇER, kararı `whichMoreRoomStatus` verir.
  if (room === null) {
    throw new ValidationError("Böyle bir oda yok. Kodu kontrol edin.");
  }
  return room;
}

export async function joinWhichMoreRoom(
  input: WhichMoreRoomByCodeInput,
  deps: WhichMoreRoomDeps,
): Promise<WhichMoreRoomDto> {
  const room = await requireWhichMoreRoom(input.code, deps);
  const verdict = judgeWhichMoreJoin(room.state, input.userId, input.now);

  switch (verdict.kind) {
    case "zaten-uye":
      return presentWhichMore(room, input.userId, input.now, deps);

    case "ret":
      throw new ValidationError(
        verdict.reason === "oda-dolu"
          ? "Bu oda dolu."
          : "Bu oda artık açık değil.",
      );

    case "katil": {
      const result = await deps.rooms.joinRoom({
        roomId: room.id,
        userId: input.userId,
        startedAt: input.now,
      });

      if (result.kind === "dolu") throw new ValidationError("Bu oda dolu.");

      return presentWhichMore(result.room, input.userId, input.now, deps);
    }
  }
}

export async function getWhichMoreRoom(
  input: WhichMoreRoomByCodeInput,
  deps: WhichMoreRoomDeps,
): Promise<WhichMoreRoomDto> {
  const room = await requireWhichMoreRoom(input.code, deps);

  if (!isWhichMoreMember(room.state, input.userId)) {
    throw new ValidationError("Bu odanın üyesi değilsin.");
  }

  return presentWhichMore(room, input.userId, input.now, deps);
}

export type WhichMoreRoomEntry =
  | { readonly kind: "uye"; readonly room: WhichMoreRoomDto }
  | { readonly kind: "katilabilir" }
  | { readonly kind: "kapali"; readonly reason: RoomJoinRejection }
  | { readonly kind: "yok" };

export async function peekWhichMoreRoom(
  input: WhichMoreRoomByCodeInput,
  deps: WhichMoreRoomDeps,
): Promise<WhichMoreRoomEntry> {
  const room = await deps.rooms.findByCode(input.code);
  if (room === null) return { kind: "yok" };

  if (isWhichMoreMember(room.state, input.userId)) {
    return {
      kind: "uye",
      room: await presentWhichMore(room, input.userId, input.now, deps),
    };
  }

  const verdict = judgeWhichMoreJoin(room.state, input.userId, input.now);
  return verdict.kind === "ret"
    ? { kind: "kapali", reason: verdict.reason }
    : { kind: "katilabilir" };
}

export interface SubmitWhichMoreAnswerInput extends WhichMoreRoomByCodeInput {
  readonly roundIndex: number;
  readonly chosenId: string;
}

export interface SubmitWhichMoreAnswerDto {
  readonly correct: boolean;
  readonly room: WhichMoreRoomDto;
}

export async function submitWhichMoreAnswer(
  input: SubmitWhichMoreAnswerInput,
  deps: WhichMoreRoomDeps,
): Promise<SubmitWhichMoreAnswerDto> {
  const room = await requireWhichMoreRoom(input.code, deps);

  const me = room.state.players.find(
    (player) => player.userId === input.userId,
  );
  if (me === undefined) throw new ValidationError("Bu odanın üyesi değilsin.");

  // BR-58 hattı — bu tur indeksi zaten cevaplandıysa SAKLANANI dön (ağ tekrarı
  // hata değildir). Sıra denetiminden ÖNCE gelir (`judgeSubmission` deseni).
  const existing = me.answers.find(
    (answer) => answer.roundIndex === input.roundIndex,
  );
  if (existing !== undefined) {
    return {
      correct: existing.correct,
      room: await presentWhichMore(room, input.userId, input.now, deps),
    };
  }

  const status = whichMoreRoomStatus(room.state, input.now);
  if (status !== "oynaniyor") {
    throw new ValidationError(
      status === "bekliyor"
        ? "Tur henüz başlamadı: arkadaşın odaya katılmalı."
        : status === "bitti"
          ? "Bu oda bitti."
          : "Bu turun süresi doldu.",
    );
  }

  const config = room.state.config;
  if (config.submode === "ani-olum" && isEliminated(me.answers)) {
    throw new ValidationError("Koşun bitti: bir yanlış cevap koşuyu bitirir.");
  }
  if (config.submode === "sabit-n" && me.answers.length >= config.n) {
    throw new ValidationError("Bu maçtaki tüm düelloları cevapladın.");
  }

  // CEVAPLAR ARDIŞIK GELİR: istemci bir sonraki turu sunucudan alır, kendi
  // atlayamaz. Sıra dışı indeks bir programlama/oynama hatasıdır.
  if (input.roundIndex !== me.answers.length) {
    throw new ValidationError("Sıra dışı tur: önce mevcut düelloyu cevapla.");
  }

  const check = await checkRailAnswer(
    config,
    input.roundIndex,
    input.chosenId,
    deps,
  );
  if (check === null) {
    throw new ValidationError("Bu tura geçersiz bir cevap gönderildi.");
  }

  const saved = await deps.rooms.saveAnswer({
    roomId: room.id,
    userId: input.userId,
    answer: {
      roundIndex: input.roundIndex,
      chosenId: input.chosenId,
      correct: check.correct,
    },
  });

  // Yarışı kaybettik: eşzamanlı ikinci istek önce yazmış — SAKLANAN döner.
  if (saved.kind === "zaten-var") {
    const stored = saved.room.state.players
      .find((player) => player.userId === input.userId)
      ?.answers.find((answer) => answer.roundIndex === input.roundIndex);

    if (stored !== undefined) {
      return {
        correct: stored.correct,
        room: await presentWhichMore(saved.room, input.userId, input.now, deps),
      };
    }
  }

  return {
    correct: check.correct,
    room: await presentWhichMore(saved.room, input.userId, input.now, deps),
  };
}
