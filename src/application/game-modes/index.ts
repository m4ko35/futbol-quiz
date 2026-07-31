import { commonPlayersMode } from "./common-players";
import { gridMode } from "./grid";
import { GameModeRegistry } from "./registry";
import { statMatchMode } from "./stat-match";

/**
 * Kayıtlı oyun modları — PROJECT.md §9.
 *
 * Yeni bir mod eklemek: aynı klasöre bir dosya yaz, aşağıdaki listeye ekle.
 * Başka hiçbir yere dokunulmaz.
 */
export const gameModes = new GameModeRegistry();

gameModes.register(commonPlayersMode);
gameModes.register(gridMode);
gameModes.register(statMatchMode);

export { GameModeRegistry } from "./registry";
export type { GameMode, GameModeDeps, RegisteredGameMode } from "./types";
