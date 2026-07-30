import { ValidationError } from "@/domain/errors/domain-error";
import type { GameMode, GameModeDeps, RegisteredGameMode } from "./types";

/**
 * Oyun modu kayıt defteri — PROJECT.md §9.
 */

/**
 * Tipli bir modu kayıt defterine konabilir hâle getirir.
 *
 * Ayrıştırma burada, modun İÇİNDE yapılır. Modun `execute` fonksiyonu bu
 * yüzden hiçbir zaman doğrulanmamış girdi görmez — kural bir kez, tek yerde
 * uygulanır ve her yeni mod onu otomatik olarak devralır (§2.3).
 */
export function defineGameMode<TInput, TOutput>(
  mode: GameMode<TInput, TOutput>,
): RegisteredGameMode {
  return {
    id: mode.id,
    title: mode.title,
    async run(rawInput: unknown, deps: GameModeDeps): Promise<unknown> {
      const parsed = mode.inputSchema.safeParse(rawInput);

      if (!parsed.success) {
        // Zod'un ayrıntılı hata ağacı yanıta GİRMEZ (§6.3): alan yolları ve
        // gelen değerler iç yapıyı açık eder. Kullanıcıya sabit bir mesaj,
        // ayrıntı ise yalnızca sunucu loguna gider.
        throw new ValidationError(
          `"${mode.title}" için verilen girdi geçersiz.`,
        );
      }

      return mode.execute(parsed.data, deps);
    },
  };
}

/**
 * Modlar `Map` içinde tutulur; kimlik çakışması SESSİZ GEÇMEZ.
 *
 * Sessiz üzerine yazma, iki modun aynı kimliği paylaştığı durumda hangisinin
 * çalıştığını rastgele hâle getirirdi — ve bu, testlerde görünmeyip yalnızca
 * üretimde ortaya çıkan bir hata sınıfıdır.
 */
export class GameModeRegistry {
  readonly #modes = new Map<string, RegisteredGameMode>();

  register(mode: RegisteredGameMode): void {
    if (this.#modes.has(mode.id)) {
      throw new Error(
        `Oyun modu kimliği zaten kayıtlı: "${mode.id}". ` +
          `Kimlikler benzersiz olmalıdır (PROJECT.md §9).`,
      );
    }
    this.#modes.set(mode.id, mode);
  }

  get(id: string): RegisteredGameMode | undefined {
    return this.#modes.get(id);
  }

  list(): RegisteredGameMode[] {
    return [...this.#modes.values()];
  }
}
