import {
  RoundUnavailableError,
  ValidationError,
} from "@/domain/errors/domain-error";
import { isScoped, type StatKey } from "@/domain/services/stat-match";
import {
  isPlayablePair,
  opponentSide,
  otherSide,
  winningSide,
  type Direction,
  type Level,
} from "@/domain/services/which-more";
import type { PlayerId } from "@/domain/value-objects/identifiers";
import type { WhichMoreCandidate } from "../ports/which-more-repository";
import type { GameModeDeps } from "../game-modes/types";

/**
 * "Hangisi daha" turu ve cevabı — PROJECT.md §9.3.
 *
 * KOŞUYU SUNUCU HATIRLAMAZ. Her tur kendi başına kurulur ve her cevap kendi
 * başına doğrulanır; seri sayacı istemcidedir. Bunun kabul edilen bedeli
 * §9.3'te yazılı: skor yereldir, kimseye karşı yarışmaz.
 */

/** Turda sunulan oyuncu — SAYI TAŞIMAZ (BR-32). */
export interface WhichMorePlayerDto {
  readonly id: string;
  readonly name: string;
  readonly clubs: readonly string[];
}

export interface WhichMorePairDto {
  readonly left: WhichMorePlayerDto;
  readonly right: WhichMorePlayerDto;
}

export interface WhichMoreRoundDto {
  readonly statKey: StatKey;
  /** `null` = havuz tükendi; koşu biter (§6.6). Hata değildir. */
  readonly pair: WhichMorePairDto | null;
}

export interface WhichMoreAnswerDto {
  readonly correct: boolean;
  readonly left: { readonly id: string; readonly value: number };
  readonly right: { readonly id: string; readonly value: number };
  /** BR-28 — doğruysa bir sonraki turda kalan oyuncu. */
  readonly winnerId: string;
  /** §9.2'nin kapsam bildirimi: sayı yalnızca 24 ligi mi sayıyor? */
  readonly scoped: boolean;
}

export interface RoundInput {
  readonly statKey: StatKey;
  /**
   * BR-41 — havuzun genişliği. Koşu boyunca DEĞİŞMEZ ama sunucu bunu bilmez:
   * koşuyu hatırlamayan bir sunucuda her tur seviyeyi yeniden söylemek
   * zorundadır (§9.3'ün durumsuzluk kararının doğrudan sonucu).
   */
  readonly level: Level;
  /** `null` = koşunun ilk turu. */
  readonly stayingId: PlayerId | null;
  readonly exclude: readonly PlayerId[];
}

type RoundDeps = Pick<GameModeDeps, "whichMore">;

/**
 * Bir turun İKİ ADAYI — DEĞERLERİYLE birlikte.
 *
 * `getRound` bunu değersiz DTO'ya indirger (BR-32); ama oda rayı (§12.8, BR-68)
 * değerlere İHTİYAÇ DUYAR: kalan oyuncu veriyle belirlenir, yani bir sonraki
 * düelloyu kurmak için galibin değerini bilmek şart. Bu yüzden seçim mantığı
 * değer koruyan bu ara katmanda; iki çağıran (solo DTO ve ray) TEK kaynaktan
 * beslenir (§9.1'in "süzgeç ile doğrulayıcı aynı olmalı" kuralı).
 */
export interface RoundPair {
  readonly left: WhichMoreCandidate;
  readonly right: WhichMoreCandidate;
}

/**
 * Bir turun adaylarını kurar — değerleriyle.
 *
 * `random` DIŞARIDAN gelir: BR-30'un yazı turası test edilebilir olmalı ve oda
 * rayı için TOHUMLU bir üreteç geçilir (§12.8, BR-68). Rastgelelik hem yazı
 * turasına HEM de deponun seçimine (`findCandidate`'in ikinci argümanı) aynı
 * akıştan verilir; ikisi ayrı kaynaklardan beslenseydi ray tekrarlanamazdı.
 */
export async function buildRoundPair(
  input: RoundInput,
  deps: RoundDeps,
  random: () => number = Math.random,
): Promise<RoundPair | null> {
  const { statKey, level } = input;

  if (input.stayingId === null) {
    return buildFirstPair(statKey, level, input.exclude, deps, random);
  }

  const staying = await deps.whichMore.findPlayer(input.stayingId, statKey);
  if (staying === null) {
    // İstemci sunucunun kurmadığı bir oyuncuyu "kalan" diye gönderdi.
    throw new ValidationError("Kalan oyuncu bu istatistikte geçerli değil.");
  }

  // BR-30 — yazı tura; seçilen taraf boşsa öteki denenir.
  const first = opponentSide(random());
  const opponent =
    (await findOn(
      first,
      staying.value,
      statKey,
      level,
      input.exclude,
      deps,
      random,
    )) ??
    (await findOn(
      otherSide(first),
      staying.value,
      statKey,
      level,
      input.exclude,
      deps,
      random,
    ));

  if (opponent === null) return null;

  // Kalan oyuncu SOLDA durur. Yer değiştirseydi kullanıcı her turda iki ismi
  // yeniden okumak zorunda kalırdı; oysa değişen tek şey sağdaki.
  return { left: staying, right: opponent };
}

/**
 * Yeni bir tur kurar (solo). Değersiz DTO döner — BR-32.
 *
 * `random` DIŞARIDAN gelir: BR-30'un yazı turası test edilebilir olmalı.
 * Varsayılanı `Math.random` — çağıranların çoğu bunu düşünmek zorunda kalmasın.
 */
export async function getRound(
  input: RoundInput,
  deps: RoundDeps,
  random: () => number = Math.random,
): Promise<WhichMoreRoundDto> {
  const pair = await buildRoundPair(input, deps, random);
  return {
    statKey: input.statKey,
    pair:
      pair === null
        ? null
        : {
            left: whichMorePlayerDto(pair.left),
            right: whichMorePlayerDto(pair.right),
          },
  };
}

async function buildFirstPair(
  statKey: StatKey,
  level: Level,
  exclude: readonly PlayerId[],
  deps: RoundDeps,
  random: () => number,
): Promise<RoundPair | null> {
  const left = await deps.whichMore.findCandidate(
    { statKey, level, threshold: null, side: "any", exclude },
    random,
  );

  if (left === null) {
    // Dışlama listesi boşken hiç aday yoksa havuz tükenmemiştir, YOKTUR:
    // o istatistik veri kümesinde hiç çekilmemiş demektir (§6.6).
    if (exclude.length === 0) throw new RoundUnavailableError();
    return null;
  }

  const right = await deps.whichMore.findCandidate(
    {
      statKey,
      level,
      threshold: left.value,
      side: "any",
      exclude: [...exclude, left.id],
    },
    random,
  );

  if (right === null) return null;

  return { left, right };
}

function findOn(
  side: "above" | "below",
  threshold: number,
  statKey: StatKey,
  level: Level,
  exclude: readonly PlayerId[],
  deps: RoundDeps,
  random: () => number,
): Promise<WhichMoreCandidate | null> {
  return deps.whichMore.findCandidate(
    { statKey, level, threshold, side, exclude },
    random,
  );
}

/**
 * BR-41 — CEVAP GİRDİSİNDE SEVİYE YOK ve bu bir eksiklik değil.
 *
 * Seviye hangi çiftin KURULACAĞINI daraltır, hangi cevabın DOĞRU olduğunu
 * değiştirmez: iki oyuncunun değeri seviyeden bağımsızdır. Cevap ucuna da
 * konsaydı iki uç arasında tutarlılığı hiçbir şey zorlamazdı — `direction`'ın
 * tur girdisinde OLMAMASIYLA aynı gerekçe (§9.3).
 *
 * Güvenlik açığı da doğurmuyor: bu uç zaten BR-29 bandını sağlayan HER çifte
 * cevap veriyor ve seviye o bandı ne genişletiyor ne daraltıyor.
 */
export interface AnswerInput {
  readonly statKey: StatKey;
  readonly direction: Direction;
  readonly leftId: PlayerId;
  readonly rightId: PlayerId;
  readonly chosenId: PlayerId;
}

/**
 * Cevabı doğrular — BR-32.
 *
 * Değerleri SUNUCU okur; istemci gönderemez. Gönderebilseydi oyunun tamamı
 * tarayıcı konsolunda çözülürdü (BR-12/BR-20 ile aynı gerekçe).
 */
export async function checkAnswer(
  input: AnswerInput,
  deps: RoundDeps,
): Promise<WhichMoreAnswerDto> {
  if (input.leftId === input.rightId) {
    throw new ValidationError("Aynı oyuncu iki kez sunulamaz.");
  }
  if (input.chosenId !== input.leftId && input.chosenId !== input.rightId) {
    throw new ValidationError("Seçilen oyuncu bu turda sunulmadı.");
  }

  const [left, right] = await Promise.all([
    deps.whichMore.findPlayer(input.leftId, input.statKey),
    deps.whichMore.findPlayer(input.rightId, input.statKey),
  ]);

  if (left === null || right === null) {
    throw new ValidationError(
      "Bu oyunculardan birinin bu istatistikte değeri yok.",
    );
  }

  // SÜZGEÇ İLE DOĞRULAYICI AYNI OLMALI (§9.1). Sunucu BR-29 bandını sağlamayan
  // bir çift kurmaz; kurulmamış bir çiftin cevabı da kabul edilmez. Aksi hâlde
  // istemci kendi seçtiği iki oyuncuyu gönderip kolay sorular üretebilirdi.
  if (!isPlayablePair(input.statKey, left.value, right.value)) {
    throw new ValidationError(
      "Bu iki oyuncu karşılaştırılamayacak kadar yakın.",
    );
  }

  const side = winningSide(input.direction, left.value, right.value);
  const winner = side === "left" ? left : right;

  return {
    correct: input.chosenId === winner.id,
    left: { id: left.id, value: left.value },
    right: { id: right.id, value: right.value },
    winnerId: winner.id,
    scoped: isScoped(input.statKey),
  };
}

/**
 * Adayı değersiz sunum DTO'suna indirger — BR-32 TEK YERDE.
 *
 * Oda rayı da (§12.8) bunu kullanır: değerin dışarı sızmaması iki modda da
 * aynı fonksiyondan geçtiği için garanti.
 */
export function whichMorePlayerDto(
  candidate: WhichMoreCandidate,
): WhichMorePlayerDto {
  return {
    id: candidate.id,
    name: candidate.name,
    clubs: candidate.clubs,
  };
}
