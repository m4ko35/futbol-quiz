import { commonPlayersMode } from "./common-players";
import { GameModeRegistry } from "./registry";

/**
 * Kayıtlı oyun modları — PROJECT.md §9.
 *
 * Yeni bir mod eklemek: aynı klasöre bir dosya yaz, aşağıdaki listeye ekle.
 * Başka hiçbir yere dokunulmaz.
 */
export const gameModes = new GameModeRegistry();

gameModes.register(commonPlayersMode);

export { GameModeRegistry } from "./registry";
export type { GameMode, GameModeDeps, RegisteredGameMode } from "./types";
