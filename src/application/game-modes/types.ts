import type { ZodType } from "zod";
import type { ClubRepository } from "../ports/club-repository";
import type { PlayerRepository } from "../ports/player-repository";
import type { StatMatchRepository } from "../ports/stat-match-repository";

/**
 * Oyun modu sözleşmesi — PROJECT.md §9.
 *
 * MVP tek mod içerir, fakat sözleşme baştan tanımlanır. Amaç Açık/Kapalı
 * ilkesidir: yeni bir mod eklemek bu klasöre bir dosya koyup kayıt listesine
 * eklemekten ibaret olmalı, mevcut modlar ve çekirdek kod DEĞİŞMEMELİDİR.
 */

/**
 * Modların erişebildiği her şey. Yalnızca PORT arayüzleri taşır.
 *
 * Mod kodu Prisma'yı, HTTP'yi ya da dosya sistemini göremez. Bu kısıt bir
 * üslup tercihi değil: bir oyun modu ileride topluluk katkısı olarak
 * gelebilir ve o kodun erişebileceği yüzeyin dar olması gerekir.
 */
export interface GameModeDeps {
  readonly clubs: ClubRepository;
  readonly players: PlayerRepository;
  readonly statMatch: StatMatchRepository;
}

export interface GameMode<TInput, TOutput> {
  /** Kararlı, makine tarafından okunan kimlik: "common-players". */
  readonly id: string;

  /** Kullanıcıya gösterilen ad. */
  readonly title: string;

  /** Girdi sözleşmesi. Ayrıştırılmamış veri `execute`'a ULAŞAMAZ (§2.3). */
  readonly inputSchema: ZodType<TInput>;

  execute(input: TInput, deps: GameModeDeps): Promise<TOutput>;
}

/**
 * Kayıt defterinde duran, tipleri silinmiş mod.
 *
 * NEDEN ayrı bir tip: kayıt defteri farklı girdi/çıktı tiplerine sahip modları
 * yan yana tutmak zorunda. `GameMode<unknown, unknown>` işe yaramaz —
 * `inputSchema` girdi tipinde değişken (invariant) olduğu için hiçbir somut
 * mod ona atanamaz. Çözüm, şemayı dışarı sızdırmak yerine İÇERİDE tüketmek:
 * `run` ham girdiyi alır, kendi şemasıyla ayrıştırır, sonra `execute` çağırır.
 * Böylece tip güvenliği modun içinde korunur ve `any` kullanılmaz (§2.5).
 */
export interface RegisteredGameMode {
  readonly id: string;
  readonly title: string;
  run(rawInput: unknown, deps: GameModeDeps): Promise<unknown>;
}
