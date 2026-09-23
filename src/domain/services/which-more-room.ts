import type { StatKey } from "./stat-match";
import type { Direction, Level } from "./which-more";
import {
  ROOM_JOIN_WINDOW_MS,
  ROOM_PLAY_WINDOW_MS,
  type RoomJoinVerdict,
  type RoomStatus,
} from "./room";

/**
 * Hangisi Daha odası — İKİNCİ oda modu, PROJECT.md §12.8, BR-67…BR-70.
 *
 * Bu dosya saf kuraldır: depolama, kimlik, rastgelelik ve veri erişimi burada
 * YOKTUR (§2.1). Oda ALTYAPISI (kod, kur/katıl, yoklama, sönme, giriş şartı)
 * §12'den olduğu gibi geliyor; buradaki tek yeni şey Hangisi Daha'ya özgü tur
 * üretimi girdisi (`config`), puanlama (seri / doğru sayısı) ve sonuç.
 *
 * NEDEN `room.ts`'İN YANINDA, İÇİNDE DEĞİL. `room.ts` İstatistik odasının
 * "bitmişliğini" altı istatistiğin dolmasına bağlıyor (`isRoomFinished` →
 * `isRoundFinished`). Buranın bitmişliği bambaşka: Ani ölümde maç, biri
 * elenip diğeri onu geçtiği an — kimse "altı istatistiği" bitirmeden —
 * kesinleşebilir (aşağıdaki kapanış kuralı). İki kavram tek fonksiyona
 * sığmadığı için ayrı; ORTAK olan pencere sabitleri (`ROOM_*_WINDOW_MS`) ve
 * `RoomStatus` sözlüğü ise ödünç alınıyor, kopyalanmıyor.
 */

/**
 * İki yarışma biçimi — BR-69. Host hangisini oynayacağını seçer.
 *
 * `ani-olum`: tek yanlış koşuyu bitirir, uzun seri kazanır (solo moddaki gibi).
 * `sabit-n`: eleme yok, N düello, doğru sayısı kazanır.
 */
export const WHICH_MORE_SUBMODES = ["ani-olum", "sabit-n"] as const;

export type WhichMoreSubmode = (typeof WHICH_MORE_SUBMODES)[number];

export function isWhichMoreSubmode(value: string): value is WhichMoreSubmode {
  return (WHICH_MORE_SUBMODES as readonly string[]).includes(value);
}

/**
 * Sabit N düellonun tur sayısı — BR-69. HOST SEÇER (5 / 10 / 15).
 *
 * Serbest sayı değil sabit üç seçenek: 1 düello "maç" değil, 50 düello bir oda
 * ömrünü (BR-60) aşabilir. Üçü de yoklamayla (§12.1) makul sürede biter.
 */
export const FIXED_N_OPTIONS = [5, 10, 15] as const;

export type FixedN = (typeof FIXED_N_OPTIONS)[number];

export function isFixedN(value: number): value is FixedN {
  return (FIXED_N_OPTIONS as readonly number[]).includes(value);
}

/**
 * Odanın oyun yapılandırması — BR-67. Sınırda **Zod** ile ayrıştırılır (§2.3);
 * bu tip ayrıştırılmış, güvenli hâlidir.
 *
 * `seed` ortak rayı belirler (BR-68): iki oyuncu aynı tohumdan aynı düelloları
 * görür. `n` YALNIZCA `sabit-n`'de vardır — ayrık birlik, "Ani ölümün N'i kaç"
 * gibi anlamsız bir soruyu tip düzeyinde imkânsız kılıyor.
 */
export type WhichMoreRoomConfig =
  | {
      readonly submode: "ani-olum";
      readonly statKey: StatKey;
      readonly level: Level;
      readonly direction: Direction;
      readonly seed: number;
    }
  | {
      readonly submode: "sabit-n";
      readonly statKey: StatKey;
      readonly level: Level;
      readonly direction: Direction;
      readonly seed: number;
      readonly n: FixedN;
    };

/**
 * Bir oyuncunun tek bir düellodaki cevabı — SIRALI okunur.
 *
 * `correct` istemciden GELMEZ: sunucu rayı yeniden oynatıp doğruluğu kendi
 * hesaplar (BR-32/BR-68). `chosenId` yalnızca sonuç ekranı için — oda bitince
 * iki tarafın aynı düelloda ne seçtiği yan yana gösterilir (BR-70).
 */
export interface WhichMoreDuelAnswer {
  readonly roundIndex: number;
  readonly chosenId: string;
  readonly correct: boolean;
}

export interface WhichMoreRoomPlayer {
  readonly userId: string;
  /** Sonuç ekranı ad gösterir (BR-54); kimlik numarası okunmaz. */
  readonly displayName: string;
  readonly answers: readonly WhichMoreDuelAnswer[];
}

/**
 * Odanın saf alan durumu — depolama kimliklerinden arınmış.
 *
 * `RoomState`'in (İstatistik) karşılığı ama `players[].round` yerine düello
 * cevapları taşır ve `config`'i içinde tutar (rayı ve puanlamayı config
 * belirler). `targetPlayerId` YOK: Hangisi Daha odasının hedefi yok, rayı var.
 */
export interface WhichMoreRoomState {
  readonly createdAt: Date;
  readonly startedAt: Date | null;
  readonly config: WhichMoreRoomConfig;
  readonly players: readonly WhichMoreRoomPlayer[];
}

/** BR-54 — oda iki kişiliktir (İstatistik ile aynı). */
const MAX_ROOM_PLAYERS = 2;

/** Cevapları tur indeksine göre ARTAN sıralar — depo sırası garanti değil. */
function ordered(
  answers: readonly WhichMoreDuelAnswer[],
): readonly WhichMoreDuelAnswer[] {
  return [...answers].sort((a, b) => a.roundIndex - b.roundIndex);
}

/**
 * Ani ölüm serisi — İLK yanlışa kadarki doğru sayısı (BR-69).
 *
 * Koşu ilk yanlışta biter, yani yanlıştan sonraki cevaplar OLMAMALI (sunucu
 * eleneni oynatmaz); yine de savunmacı davranıyoruz: seri, baştan ilk yanlışa
 * kadar sayılır, sonrası görmezden gelinir.
 */
export function suddenDeathStreak(
  answers: readonly WhichMoreDuelAnswer[],
): number {
  let streak = 0;
  for (const answer of ordered(answers)) {
    if (!answer.correct) break;
    streak += 1;
  }
  return streak;
}

/** Ani ölümde koşu bitti mi — bir yanlış cevap koşuyu bitirir (BR-69). */
export function isEliminated(answers: readonly WhichMoreDuelAnswer[]): boolean {
  return answers.some((answer) => !answer.correct);
}

/** Sabit N doğru sayısı — eleme yok, hepsi sayılır (BR-69). */
export function correctCount(answers: readonly WhichMoreDuelAnswer[]): number {
  return answers.reduce((sum, answer) => sum + (answer.correct ? 1 : 0), 0);
}

export type WhichMoreRoomResult =
  /** Sonuç henüz KESİNLEŞMEDİ (süre/sönme ayrı bir sorudur, bkz. `whichMoreRoomOutcome`). */
  | { readonly kind: "devam" }
  /** BR-69 — eşit skor beraberliktir (BR-62 hattı). */
  | { readonly kind: "beraberlik"; readonly score: number }
  | {
      readonly kind: "galip";
      readonly winnerId: string;
      readonly winnerScore: number;
      readonly loserScore: number;
    };

function galip(
  winnerId: string,
  winnerScore: number,
  loserScore: number,
): WhichMoreRoomResult {
  return { kind: "galip", winnerId, winnerScore, loserScore };
}

/** İki skoru karşılaştırır — eşitse beraberlik, değilse yüksek olan galip. */
function compareScores(
  aId: string,
  aScore: number,
  bId: string,
  bScore: number,
): WhichMoreRoomResult {
  if (aScore === bScore) return { kind: "beraberlik", score: aScore };
  return aScore > bScore
    ? galip(aId, aScore, bScore)
    : galip(bId, bScore, aScore);
}

/**
 * ANİ ÖLÜMÜN KAPANIŞI — BR-69. Maç, sonuç KESİNLEŞTİĞİ an biter.
 *
 * Her oyuncunun koşusu ilk yanlışta biter (`isEliminated`), o ana kadarki
 * serisi (`suddenDeathStreak`) sabitlenir. Karar:
 *
 *  (a) İkisi de elendi → serileri karşılaştır (eşit = beraberlik).
 *  (b) Biri `s`'de elendi, diğerinin serisi `s`'yi GEÇTİYSE → diğeri kazandı,
 *      HÂLÂ OYNUYOR OLSA BİLE. `s`'yi geçmek geleceğinden bağımsız kazandırır;
 *      elenen bir daha oynamaz, o yüzden `s` onun tavanıdır.
 *  (c) Aksi hâlde KARAR YOK: ya ikisi de canlı, ya biri `s`'de elenmiş ama
 *      diğeri hâlâ `≤ s` seride canlı (yalnızca `s+1`'e ulaşması yeter). İki
 *      durumda da bekleyiş SINIRLI; bitmezse 60 dk sönmesi devreye girer
 *      (`whichMoreRoomOutcome` → yarım).
 *
 * İkisi de hiç yanılmazsa (çok nadir) sonuç hiç kesinleşmez; süre kuralı
 * kapatır. Bu bilinçli: hükmen bir galip uydurmak, oyunun hiçbir yerinde
 * karşılığı olmayan bir sonuç üretirdi (BR-61 ile aynı gerekçe).
 */
function suddenDeathResult(
  a: WhichMoreRoomPlayer,
  b: WhichMoreRoomPlayer,
): WhichMoreRoomResult {
  const aOut = isEliminated(a.answers);
  const bOut = isEliminated(b.answers);
  const aStreak = suddenDeathStreak(a.answers);
  const bStreak = suddenDeathStreak(b.answers);

  if (aOut && bOut) {
    return compareScores(a.userId, aStreak, b.userId, bStreak);
  }
  if (aOut && bStreak > aStreak) return galip(b.userId, bStreak, aStreak);
  if (bOut && aStreak > bStreak) return galip(a.userId, aStreak, bStreak);
  return { kind: "devam" };
}

/**
 * SABİT N SONUCU — BR-69. Sonuç yalnızca İKİSİ DE N'i bitirince kesinleşir.
 *
 * Erken kesinleşme (biri diğerinin ulaşamayacağı kadar öndeyse) BİLEREK YOK:
 * §12.8 "ikisi de N'i bitirince kesinleşir" diyor. Eleme olmadığı için her
 * oyuncu N düellonun tamamını cevaplar; yarım kalırsa süre kuralı (yarım)
 * devreye girer.
 */
function fixedNResult(
  a: WhichMoreRoomPlayer,
  b: WhichMoreRoomPlayer,
  n: FixedN,
): WhichMoreRoomResult {
  if (a.answers.length < n || b.answers.length < n) return { kind: "devam" };
  return compareScores(
    a.userId,
    correctCount(a.answers),
    b.userId,
    correctCount(b.answers),
  );
}

/**
 * Maçın SAF sonucu — zamandan bağımsız (BR-69).
 *
 * İki oyuncu yoksa sonuç olamaz: `devam`. Zaman/sönme bu fonksiyonun konusu
 * değil; onu `whichMoreRoomOutcome` ekliyor (İstatistik odasında `roomOutcome`
 * ile `roomStatus`'ün ayrı olmasıyla aynı ayrım).
 */
export function whichMoreRoomResult(
  room: WhichMoreRoomState,
): WhichMoreRoomResult {
  const [a, b] = room.players;
  if (a === undefined || b === undefined) return { kind: "devam" };

  return room.config.submode === "ani-olum"
    ? suddenDeathResult(a, b)
    : fixedNResult(a, b, room.config.n);
}

/** Maç kesinleşti mi — `bitti` durumunun kapısı. */
export function isWhichMoreRoomDecided(room: WhichMoreRoomState): boolean {
  return whichMoreRoomResult(room).kind !== "devam";
}

/**
 * Odanın ölüm anı — BR-60 (İstatistik ile aynı iki pencere).
 *
 * `roomDeadline`'ın (İstatistik) birebir karşılığı; ayrı durmasının tek sebebi
 * girdinin `WhichMoreRoomState` olması. Pencere sabitleri PAYLAŞILIYOR, yani
 * süreler tek yerde tanımlı.
 */
export function whichMoreRoomDeadline(room: WhichMoreRoomState): Date {
  return room.startedAt === null
    ? new Date(room.createdAt.getTime() + ROOM_JOIN_WINDOW_MS)
    : new Date(room.startedAt.getTime() + ROOM_PLAY_WINDOW_MS);
}

/**
 * Odanın durumu — SAKLANMAZ, TÜRETİLİR (§12.3).
 *
 * KESİNLEŞME SAATTEN ÖNCE GELİR — `roomStatus` ile aynı sıra gerekçesi: Ani
 * ölümde 59. dakikada kesinleşmiş bir maç, 61. dakikada "süresi doldu"
 * olmamalı. Bu yüzden önce `isWhichMoreRoomDecided`, sonra saat.
 */
export function whichMoreRoomStatus(
  room: WhichMoreRoomState,
  now: Date,
): RoomStatus {
  if (isWhichMoreRoomDecided(room)) return "bitti";
  if (now.getTime() >= whichMoreRoomDeadline(room).getTime()) {
    return "suresi-doldu";
  }
  return room.startedAt === null ? "bekliyor" : "oynaniyor";
}

export type WhichMoreRoomOutcome =
  | { readonly kind: "devam" }
  /** BR-61 hattı — biri bırakıp gitti; hükmen galip YOK. */
  | { readonly kind: "yarim" }
  | { readonly kind: "beraberlik"; readonly score: number }
  | {
      readonly kind: "galip";
      readonly winnerId: string;
      readonly winnerScore: number;
      readonly loserScore: number;
    };

/**
 * Odanın sonucu, ZAMANLA birlikte — BR-61/BR-69.
 *
 * `roomOutcome`'un (İstatistik) karşılığı: kesinleşmiş maç sonucunu verir,
 * sönmüş ama kesinleşmemiş maç `yarim`, gerisi `devam`. Kesinleşme saatten
 * önce geldiği için önce durum sorulur.
 */
export function whichMoreRoomOutcome(
  room: WhichMoreRoomState,
  now: Date,
): WhichMoreRoomOutcome {
  const status = whichMoreRoomStatus(room, now);
  if (status === "suresi-doldu") return { kind: "yarim" };
  if (status !== "bitti") return { kind: "devam" };

  const result = whichMoreRoomResult(room);
  // `bitti` sonucun kesinleştiğini garanti eder; bu dal yalnızca tipi daraltır.
  if (result.kind === "devam") return { kind: "devam" };
  return result;
}

/** İki oyuncu da katıldı mı — ray ancak o zaman iki tarafa açılır (BR-57 hattı). */
export function isWhichMoreRoomFull(room: WhichMoreRoomState): boolean {
  return room.players.length === MAX_ROOM_PLAYERS;
}

export function isWhichMoreMember(
  room: WhichMoreRoomState,
  userId: string,
): boolean {
  return room.players.some((player) => player.userId === userId);
}

/**
 * BR-54 — katılma kararı (İstatistik `judgeJoin`'in karşılığı).
 *
 * SIRA AYNI: önce üyelik, sonra kapılık, sonra doluluk — dolu bir odanın kendi
 * üyesi sayfayı yenilediğinde "oda dolu" hatası almasın diye. Tek fark durumun
 * `whichMoreRoomStatus`'ten okunması; kararın kendisi birebir aynı, o yüzden
 * `RoomJoinVerdict` sözlüğü ödünç alınıyor (kopyalanmıyor).
 */
export function judgeWhichMoreJoin(
  room: WhichMoreRoomState,
  userId: string,
  now: Date,
): RoomJoinVerdict {
  if (isWhichMoreMember(room, userId)) return { kind: "zaten-uye" };

  const status = whichMoreRoomStatus(room, now);
  if (status !== "bekliyor") return { kind: "ret", reason: "oda-kapali" };

  // `bekliyor` zaten tek oyuncu demek; bu satır bir güvenlik ağıdır.
  if (room.players.length >= MAX_ROOM_PLAYERS) {
    return { kind: "ret", reason: "oda-dolu" };
  }

  return { kind: "katil" };
}
