import { winningSide } from "@/domain/services/which-more";
import type { WhichMoreRoomConfig } from "@/domain/services/which-more-room";
import { createSeededRandom } from "@/domain/value-objects/seeded-random";
import type { PlayerId } from "@/domain/value-objects/identifiers";
import type { WhichMoreCandidate } from "../ports/which-more-repository";
import type { GameModeDeps } from "../game-modes/types";
import {
  buildRoundPair,
  whichMorePlayerDto,
  type WhichMorePlayerDto,
} from "./which-more";

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
