import type { DatasetRepository } from "@/application/ports/dataset-repository";
import type { GameModeDeps } from "@/application/game-modes";
import { prisma } from "../client";
import { PrismaClubRepository } from "./prisma-club-repository";
import { PrismaDatasetRepository } from "./prisma-dataset-repository";
import { PrismaPlayerRepository } from "./prisma-player-repository";

export { PrismaClubRepository } from "./prisma-club-repository";
export { PrismaDatasetRepository } from "./prisma-dataset-repository";
export { PrismaPlayerRepository } from "./prisma-player-repository";

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
