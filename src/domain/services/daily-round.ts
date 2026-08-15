import { STAT_KEYS, type StatKey } from "./stat-match";

/**
 * Günlük turun SUNUCUDAKİ durumu — PROJECT.md §11, BR-43/BR-44/BR-45.
 *
 * Bu dosya saf kuraldır: depolama, kimlik ve zaman burada YOKTUR (§2.1).
 * Turu nerede sakladığımız (Turso) bu kuralları değiştirmez ve
 * değiştirmemelidir — kural burada, taşıma orada.
 *
 * NEDEN VAR. Tur bugüne kadar TAMAMEN İSTEMCİDEYDİ: cevaplar `localStorage`'a
 * yazılıyor, uç ise durumsuz çalışıyordu — aynı istatistiğe istediğiniz kadar
 * cevap gönderip en yüksek puanı saklayabiliyordunuz. Sıralama olmadığı sürece
 * bunun bir bedeli yoktu; lider tablosuyla birlikte **tablonun kendisini
 * anlamsız kılar** (§11.2, T1).
 */

/** Bir istatistiğe verilmiş, puanlanmış ve artık DEĞİŞTİRİLEMEZ cevap. */
export interface RoundAnswer {
  readonly statKey: StatKey;
  readonly playerId: string;
  /** Seçilen oyuncunun o istatistikteki değeri (sunucu okur). */
  readonly value: number;
  /** BR-18, 0–100 (sunucu hesaplar — BR-20). */
  readonly score: number;
}

/**
 * Turun tamamı. Cevaplar SIRALI tutulur: kullanıcının hangi istatistiği ne
 * zaman cevapladığı, sonradan bakıldığında turun kendisini anlatır.
 */
export interface RoundState {
  readonly answers: readonly RoundAnswer[];
}

export const EMPTY_ROUND: RoundState = { answers: [] };

/** Altı istatistiğin hepsinden tam puan — 600. */
export const MAX_ROUND_POINTS = STAT_KEYS.length * 100;

/**
 * Bir gönderimin reddedilme gerekçesi.
 *
 * "Bu istatistik zaten cevaplandı" BURADA YOKTUR ve bu bilinçli: o bir ret
 * değil, saklanan cevabın tekrarıdır (BR-43).
 */
export type RoundRejection = "oyuncu-kullanildi" | "hedef-secilemez";

export type RoundVerdict =
  /** BR-43 — istatistik zaten cevaplanmış; SAKLANAN cevap dönülür. */
  | { readonly kind: "tekrar"; readonly answer: RoundAnswer }
  | { readonly kind: "ret"; readonly reason: RoundRejection }
  /** Kural engeli yok; sunucu değeri okuyup puanlayabilir. */
  | { readonly kind: "puanla" };

export interface SubmissionInput {
  readonly state: RoundState;
  readonly statKey: StatKey;
  readonly playerId: string;
  /** Turun hedef oyuncusu — cevap olarak seçilemez. */
  readonly targetId: string;
}

/** Bir istatistiğin saklanan cevabı; yoksa `undefined`. */
export function answerFor(
  state: RoundState,
  statKey: StatKey,
): RoundAnswer | undefined {
  return state.answers.find((answer) => answer.statKey === statKey);
}

/**
 * Bir gönderim hakkında karar — BR-43, BR-17.
 *
 * SIRA KURALIN PARÇASIDIR ve bir ağ tekrarını doğru ele almak için böyledir:
 * önce "bu istatistik cevaplanmış mı" bakılır, sonra "bu oyuncu kullanılmış
 * mı". Ters sırada, AYNI isteğin tekrarı — istemci yanıtı alamayıp yeniden
 * gönderdiğinde — "bu oyuncuyu zaten kullandın" hatası alırdı; oysa o oyuncuyu
 * kullanan şey isteğin kendisidir. Doğru cevap saklanan cevabı geri vermektir.
 */
export function judgeSubmission(input: SubmissionInput): RoundVerdict {
  const existing = answerFor(input.state, input.statKey);
  if (existing !== undefined) return { kind: "tekrar", answer: existing };

  // Hedefin kendisi cevap olsaydı her istatistikte bedava tam puan olurdu.
  if (input.playerId === input.targetId) {
    return { kind: "ret", reason: "hedef-secilemez" };
  }

  // BR-17 — kural artık SUNUCUDA zorlanıyor; bugüne kadar yalnızca arayüz
  // engelliyordu, yani uca doğrudan istek atan hiçbir engelle karşılaşmıyordu.
  if (isPlayerUsed(input.state, input.playerId)) {
    return { kind: "ret", reason: "oyuncu-kullanildi" };
  }

  return { kind: "puanla" };
}

/** BR-17 — oyuncu bu turda herhangi bir istatistikte kullanılmış mı? */
export function isPlayerUsed(state: RoundState, playerId: string): boolean {
  return state.answers.some((answer) => answer.playerId === playerId);
}

/**
 * Cevabı tura ekler ve YENİ durumu döner; girdi değiştirilmez.
 *
 * Aynı istatistiğe ikinci kez yazmak bir PROGRAMLAMA HATASIDIR (çağıran
 * `judgeSubmission` ile geçmek zorundadır), bu yüzden sessizce üzerine yazmak
 * yerine patlar: sessiz üzerine yazma, BR-43'ün tek denemesini kaybettirir ve
 * hiçbir yerde iz bırakmaz.
 */
export function withAnswer(state: RoundState, answer: RoundAnswer): RoundState {
  if (answerFor(state, answer.statKey) !== undefined) {
    throw new Error(
      `Bu istatistik zaten cevaplanmış: ${answer.statKey} (BR-43).`,
    );
  }
  return { answers: [...state.answers, answer] };
}

export function answeredCount(state: RoundState): number {
  return state.answers.length;
}

/** Henüz cevaplanmamış istatistikler — sunum sırası STAT_KEYS'tir. */
export function remainingStats(state: RoundState): StatKey[] {
  return STAT_KEYS.filter((key) => answerFor(state, key) === undefined);
}

/** Altı istatistiğin hepsi cevaplandı mı? */
export function isRoundFinished(state: RoundState): boolean {
  return remainingStats(state).length === 0;
}

/**
 * BR-44 — turun puanı SUNUCUDA birikir; istemci puan göndermez.
 *
 * TOPLAM SAKLANIR, ORTALAMA DEĞİL. İkisi aynı sırayı üretir (ortalama =
 * toplam / 6) ama ortalama yuvarlanır ve o yuvarlama sıralamada gerçek fark
 * taşıyan iki kullanıcıyı EŞİT gösterir: 407 ve 411 puan, ortalamada ikisi de
 * 68'dir. Tabloda saklanan sayı bu yüzden toplamdır; yüzde yalnızca sunumda
 * hesaplanır.
 */
export function roundPoints(state: RoundState): number {
  return state.answers.reduce((sum, answer) => sum + answer.score, 0);
}

/**
 * Turun yüzdesi — oyunun bugüne kadar gösterdiği sayı (0–100).
 *
 * Yarım turda da anlamlıdır: cevaplanan istatistiklerin ortalamasıdır.
 * Sıralamada KULLANILMAZ (bkz. `roundPoints`).
 */
export function roundPercent(state: RoundState): number {
  const count = answeredCount(state);
  if (count === 0) return 0;
  return Math.round(roundPoints(state) / count);
}

/**
 * BR-45 — lider tablosuna yalnızca TAMAMLANMIŞ tur girer.
 *
 * Yarım tur `null` döner: ne cezalandırılır ne ödüllendirilir, yalnızca
 * listede görünmez. Yarım turu 0 saymak yanlış olurdu — kullanıcı oynamadığı
 * için değil, BİTİRMEDİĞİ için listede yok; ikisi farklı şeyler ve toplamda
 * 0 yazmak "kötü oynadı" diye okunur.
 */
export function leaderboardPoints(state: RoundState): number | null {
  return isRoundFinished(state) ? roundPoints(state) : null;
}
