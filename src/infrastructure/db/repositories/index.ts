import type { GameModeDeps } from "@/application/game-modes";
import { prisma } from "../client";
import { PrismaClubRepository } from "./prisma-club-repository";
import { PrismaPlayerRepository } from "./prisma-player-repository";

export { PrismaClubRepository } from "./prisma-club-repository";
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
