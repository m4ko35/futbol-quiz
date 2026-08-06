import { StatMatchUnavailableError } from "@/domain/errors/domain-error";
import { ValidationError } from "@/domain/errors/domain-error";
import {
  isScoped,
  scoreFor,
  STAT_KEYS,
  type StatKey,
} from "@/domain/services/stat-match";
import { dailySeed } from "@/domain/value-objects/daily-seed";
import type { PlayerId } from "@/domain/value-objects/identifiers";
import type {
  DailyStatPlayer,
  StatMatchRepository,
} from "../ports/stat-match-repository";

/**
 * Günlük istatistik eşleştirme — PROJECT.md §9.2.
 *
 * SIZINTI KURALI IZGARADAN FARKLIDIR. Orada değerleri gizlemek oyunun
 * kendisiydi; burada hedef değerler AÇIKÇA verilir, çünkü oyun "bu değere
 * yakın başka kimi biliyorsun" sorusudur. Gizlenen tek şey ADAY HAVUZUDUR:
 * hangi oyuncuların hangi değerlere sahip olduğu dışarı verilmez.
 */

export interface StatDto {
  readonly key: StatKey;
  readonly label: string;
  readonly value: number;
  /** `true` → sayı yalnızca §1.3 kapsamındaki on iki ligi kapsar. */
  readonly scoped: boolean;
}

export interface DailyStatMatchDto {
  readonly date: string;
  readonly player: {
    readonly id: string;
    readonly name: string;
    readonly nationality: string | null;
  };
  readonly stats: readonly StatDto[];
}

export interface StatMatchDeps {
  readonly statMatch: StatMatchRepository;
}

/** Arayüzde gösterilen adlar. Anahtarlar sözleşme, etiketler sunum (§6.5). */
const STAT_LABELS: Readonly<Record<StatKey, string>> = {
  appearances: "Kulüp maçı",
  goals: "Kulüp golü",
  clubs: "Oynadığı kulüp",
  nationalCaps: "A millî maç",
  heightCm: "Boy (cm)",
  weightKg: "Kilo (kg)",
};

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Gün bazlı bellek — `daily-grid.ts` ile aynı gerekçe.
 *
 * Aday sorgusu tüm dönem tablosunu tarayan bir toplamadır; günün ilk isteği
 * öder, sonrakiler ödemez. `checkStatAnswer` günün oyuncusunu her cevapta
 * yeniden ister (istemciye güvenilmediği için) — bellek olmadan her seçim
 * o taramayı tekrarlardı.
 */
const cache = new Map<number, DailyStatPlayer>();

/** Gün değiştikçe eski anahtarlar birikmesin (§7.1). */
const MAX_CACHED_DAYS = 4;

/**
 * BR-19 — günün oyuncusu tohumdan deterministik seçilir.
 *
 * Aday listesi kimliğe göre SIRALI gelir (port sözleşmesi); tohum bu listeye
 * indeks üretir. Sıra kararlı olmasaydı aynı gün iki sunucu örneği farklı
 * oyuncu seçerdi.
 */
async function playerFor(
  seed: number,
  deps: StatMatchDeps,
): Promise<DailyStatPlayer> {
  const cached = cache.get(seed);
  if (cached !== undefined) return cached;

  const candidates = await deps.statMatch.findDailyCandidates();
  if (candidates.length === 0) throw new StatMatchUnavailableError();

  const chosen = candidates[seed % candidates.length];
  if (chosen === undefined) throw new StatMatchUnavailableError();

  if (cache.size >= MAX_CACHED_DAYS) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(seed, chosen);
  return chosen;
}

export async function getDailyStatMatch(
  now: Date,
  deps: StatMatchDeps,
): Promise<DailyStatMatchDto> {
  const player = await playerFor(dailySeed(now), deps);

  return {
    date: isoDate(now),
    player: {
      id: player.id,
      name: player.name,
      nationality: player.nationality,
    },
    stats: STAT_KEYS.map((key) => ({
      key,
      label: STAT_LABELS[key],
      value: player.stats[key],
      scoped: isScoped(key),
    })),
  };
}

export interface CheckStatAnswerInput {
  readonly now: Date;
  readonly statKey: StatKey;
  readonly playerId: PlayerId;
}

export interface CheckStatAnswerDto {
  /** Seçilen oyuncunun o istatistikteki değeri — oyunun sunulan parçası. */
  readonly value: number;
  /** BR-18, 0–100. */
  readonly score: number;
}

/**
 * BR-20 — puanı SUNUCU hesaplar.
 *
 * İstemci hedef değeri gönderemez; gönderebilseydi kendi hedefini uydurup
 * her seçimde %100 alırdı. Günün oyuncusu burada yeniden çözülür.
 */
export async function checkStatAnswer(
  input: CheckStatAnswerInput,
  deps: StatMatchDeps,
): Promise<CheckStatAnswerDto> {
  const daily = await playerFor(dailySeed(input.now), deps);

  // Kullanıcı günün oyuncusunun kendisini seçemez: hedefin kendisi cevap
  // olsaydı her istatistikte bedava %100 olurdu.
  if (input.playerId === daily.id) {
    throw new ValidationError("Günün oyuncusu cevap olarak seçilemez.");
  }

  const value = await deps.statMatch.findStatValue(
    input.playerId,
    input.statKey,
  );

  // BR-16 — puanlanamayan seçim sessizce 0 sayılmaz, REDDEDİLİR. Sıfır vermek
  // kullanıcıya "çok uzaktın" der; doğrusu "bu oyuncunun verisi yok".
  if (value === null) {
    throw new ValidationError(
      "Bu oyuncunun bu istatistikte verisi yok; başka bir oyuncu seçin.",
    );
  }

  return {
    value,
    score: scoreFor(input.statKey, daily.stats[input.statKey], value),
  };
}
