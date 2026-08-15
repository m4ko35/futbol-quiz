import type { AccountsRepository } from "@/application/ports/accounts-repository";
import type { DatasetRepository } from "@/application/ports/dataset-repository";
import type { GameModeDeps } from "@/application/game-modes";
import { accountsPrisma } from "../accounts-client";
import { prisma } from "../client";
import { PrismaAccountsRepository } from "./prisma-accounts-repository";
import { PrismaClubRepository } from "./prisma-club-repository";
import { PrismaDatasetRepository } from "./prisma-dataset-repository";
import { PrismaPlayerRepository } from "./prisma-player-repository";
import { PrismaStatMatchRepository } from "./prisma-stat-match-repository";
import { PrismaWhichMoreRepository } from "./prisma-which-more-repository";

export { PrismaClubRepository } from "./prisma-club-repository";
export { PrismaDatasetRepository } from "./prisma-dataset-repository";
export { PrismaPlayerRepository } from "./prisma-player-repository";
export { PrismaStatMatchRepository } from "./prisma-stat-match-repository";
export { PrismaWhichMoreRepository } from "./prisma-which-more-repository";

/**
 * Uygulamanın çalışma zamanı bağımlılıkları — tek yerden kurulur.
 *
 * Bu, kompozisyon kökü (composition root): somut uygulamaların port'lara
 * bağlandığı TEK nokta. Route handler'lar ve sayfalar buradan `deps` alır,
 * `new PrismaClubRepository(...)` çağırmaz. Böylece bir port'un uygulaması
 * değiştiğinde (ör. önbellekli bir sarmalayıcı eklendiğinde) çağıran hiçbir
 * dosya değişmez.
 */
export const repositories: GameModeDeps = {
  clubs: new PrismaClubRepository(prisma),
  players: new PrismaPlayerRepository(prisma),
  statMatch: new PrismaStatMatchRepository(prisma),
  whichMore: new PrismaWhichMoreRepository(prisma),
};

/**
 * Veri kümesi künyesi — `repositories` içine KONMADI ve bu bilinçli.
 *
 * `GameModeDeps` bir oyun modunun erişebileceği yüzeyi tanımlar ve dar olması
 * kasıtlıdır (§9). Künyeyi aynı nesneye koymak, tip imzası söylemese bile
 * çalışma zamanında her moda fazladan bir kapı açardı. Ayrı dışa aktarım,
 * yüzeyi olduğu gibi bırakır.
 */
export const datasets: DatasetRepository = new PrismaDatasetRepository(prisma);

/**
 * Hesap deposu — hesap özelliği kapalıysa `null` (§11).
 *
 * SABİT DEĞİL, İŞLEV. `repositories` gibi modül yüklenirken kurulsaydı,
 * hesaplara hiç dokunmayan bir istek (ızgara, arama, kulüp sayfası) de Turso
 * bağlantısını kurmuş olurdu — ve o bağlantının bedeli ölçüldü: soğuk el
 * sıkışma 474 ms (§11.3).
 *
 * `null` bir hata değildir; çağıran özelliği gizler ya da `404` döner.
 */
export function accountsRepository(): AccountsRepository | null {
  const client = accountsPrisma();
  if (client === null) return null;

  return new PrismaAccountsRepository(client);
}
