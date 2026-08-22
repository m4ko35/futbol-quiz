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
  StatMatchRepository,
  StatMatchTarget,
} from "../ports/stat-match-repository";

/**
 * İstatistik eşleştirme — PROJECT.md §9.2.
 *
 * İKİ GİRİŞ, TEK OYUN. Hedefi ya gün tohumu seçer (BR-19) ya da kullanıcı
 * (BR-24); ondan sonrası aynıdır — aynı altı istatistik, aynı puanlama,
 * aynı sunucu doğrulaması.
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
  /**
   * `true` → sayı yalnızca §1.3 kapsamındaki yirmi dört ligi kapsar.
   *
   * 22 Ağustos 2026'dan beri bunu söyleyen TEK istatistik kulüp sayısıdır;
   * maç ve gol kariyerin tamamına geçti (BR-23).
   */
  readonly scoped: boolean;
}

/** Bir turun sunulan hâli — hedef ve altı istatistiği. */
export interface StatMatchRoundDto {
  readonly player: {
    readonly id: string;
    readonly name: string;
    readonly nationality: string | null;
  };
  readonly stats: readonly StatDto[];
}

/** Günlük tur; `date` yalnızca burada vardır (ilerleme gün anahtarına yazılır). */
export interface DailyStatMatchDto extends StatMatchRoundDto {
  readonly date: string;
}

export interface StatMatchDeps {
  readonly statMatch: StatMatchRepository;
}

/**
 * Arayüzde gösterilen adlar. Anahtarlar sözleşme, etiketler sunum (§6.5).
 *
 * "Kulüp maçı"/"Kulüp golü" 22 Ağustos 2026'da "Resmî maç"/"Resmî gol" oldu
 * ve bu kozmetik bir değişiklik değil: sayının KAPSAMI değişti. Artık kulüp
 * kariyerinin tamamı (lig, kupa, Avrupa) artı A millî takım sayılıyor, yani
 * eski ad yeni sayıyı yanlış anlatırdı — millî takım golü "kulüp golü"
 * değildir.
 */
const STAT_LABELS: Readonly<Record<StatKey, string>> = {
  appearances: "Resmî maç",
  goals: "Resmî gol",
  clubs: "Oynadığı kulüp",
  nationalCaps: "A millî maç",
  heightCm: "Boy (cm)",
  birthYear: "Doğum yılı",
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
 *
 * "Sen seç" turu bu belleği KULLANMAZ ve buna ihtiyacı da yoktur: hedef,
 * birincil anahtarla tek satır okumasıdır.
 */
const cache = new Map<number, StatMatchTarget>();

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
): Promise<StatMatchTarget> {
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

/**
 * Hedefi sunulan tur şekline çevirir.
 *
 * DIŞA AÇIK çünkü §12'nin odası da aynı şekli döndürüyor: oda oyunu yeniden
 * tanımlamıyor, aynı turu iki kişiye birden oynatıyor. İkinci bir çevirici
 * yazılsaydı istatistik etiketleri iki yerde ayrı ayrı tutulurdu.
 */
export function toStatMatchRound(target: StatMatchTarget): StatMatchRoundDto {
  return {
    player: {
      id: target.id,
      name: target.name,
      nationality: target.nationality,
    },
    stats: STAT_KEYS.map((key) => ({
      key,
      label: STAT_LABELS[key],
      value: target.stats[key],
      scoped: isScoped(key),
    })),
  };
}

export async function getDailyStatMatch(
  now: Date,
  deps: StatMatchDeps,
): Promise<DailyStatMatchDto> {
  const player = await playerFor(dailySeed(now), deps);

  return { date: isoDate(now), ...toStatMatchRound(player) };
}

/**
 * BR-24 — "Sen seç": hedefi kullanıcı belirler.
 *
 * Reddi SESSİZ DEĞİLDİR. Uygun olmayan bir oyuncu için başka birine
 * kaydırmak, kullanıcının aradığı ismi bulduğunu sanmasına yol açardı.
 */
export async function getChosenStatMatch(
  target: PlayerId,
  deps: StatMatchDeps,
): Promise<StatMatchRoundDto> {
  const chosen = await deps.statMatch.findChosenTarget(target);

  if (chosen === null) {
    throw new ValidationError(
      "Bu oyuncu hedef olarak seçilemez: altı istatistiğinin hepsi dolu değil.",
    );
  }

  return toStatMatchRound(chosen);
}

export interface CheckStatAnswerInput {
  readonly now: Date;
  readonly statKey: StatKey;
  readonly playerId: PlayerId;
  /**
   * "Sen seç" turunda hedefin KİMLİĞİ. Yoksa günün oyuncusu hedeftir.
   *
   * BR-20 bozulmaz: istemci hedefin kimliğini söyleyebilir ama DEĞERLERİNİ
   * söyleyemez — onları sunucu okur ve puanı sunucu hesaplar. Kolay bir hedef
   * seçebilmek bir açık değil, modun kendisidir (§9.2).
   */
  readonly targetId?: PlayerId;
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
 * İstemci hedef DEĞERİ gönderemez; gönderebilseydi kendi hedefini uydurup
 * her seçimde %100 alırdı. Hedef burada yeniden çözülür: günlük turda gün
 * tohumundan, "Sen seç" turunda kimlikten (ve o kimlik BR-24'ten yeniden
 * geçirilir — istemcinin gönderdiği diye geçerli sayılmaz).
 */
export async function checkStatAnswer(
  input: CheckStatAnswerInput,
  deps: StatMatchDeps,
): Promise<CheckStatAnswerDto> {
  const target = await resolveTarget(input, deps);

  // Kullanıcı hedefin kendisini seçemez: hedefin kendisi cevap olsaydı her
  // istatistikte bedava %100 olurdu.
  if (input.playerId === target.id) {
    throw new ValidationError("Hedef oyuncu cevap olarak seçilemez.");
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
    score: scoreFor(input.statKey, target.stats[input.statKey], value),
  };
}

async function resolveTarget(
  input: CheckStatAnswerInput,
  deps: StatMatchDeps,
): Promise<StatMatchTarget> {
  if (input.targetId === undefined)
    return playerFor(dailySeed(input.now), deps);

  const chosen = await deps.statMatch.findChosenTarget(input.targetId);
  if (chosen === null) {
    throw new ValidationError("Bu oyuncu hedef olarak seçilemez.");
  }
  return chosen;
}
