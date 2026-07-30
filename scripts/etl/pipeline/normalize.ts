import { toSearchKey } from "../../../src/domain/value-objects/search-key";
import { toSeasonYear } from "../../../src/domain/value-objects/season";
import { OUT_OF_SCOPE_GENDER_QIDS, WD } from "../leagues";
import { int, qid, str, type SparqlBinding } from "../sources/wikidata/schemas";

/**
 * Ham Wikidata bağlamalarını veritabanına yazılabilir kayıtlara çevirir.
 *
 * Buradaki her fonksiyon SAFTIR (ağ yok, veritabanı yok) — bu sayede
 * `tests/unit/etl/normalize.test.ts` içinde doğrudan test edilebilirler
 * (PROJECT.md §8.1).
 */

export interface NormalizedClub {
  wikidataId: string;
  name: string;
  shortName: string;
  searchKey: string;
  country: string | null;
  foundedYear: number | null;
  crestUrl: string | null;
  /** Kulübün bulunduğu hedef lig; hedef ligler dışındaysa null. */
  leagueWikidataId: string | null;
}

export interface NormalizedPlayer {
  wikidataId: string;
  name: string;
  searchKey: string;
  birthDate: Date | null;
  nationality: string | null;
  position: string | null;
  /**
   * Wikidata `P21` QID'i, kayıt yoksa null. Yalnızca veri kümesini erkek
   * liglerine sınırlamak için okunur (bkz. `OUT_OF_SCOPE_GENDER_QIDS`);
   * veritabanına yazılmaz ve arayüzde gösterilmez.
   */
  genderQid: string | null;
}

export interface NormalizedSpell {
  wikidataStatementId: string;
  playerWikidataId: string;
  clubWikidataId: string;
  startYear: number | null;
  endYear: number | null;
  isCurrent: boolean;
  isLoan: boolean;
  isYouth: boolean;
  appearances: number | null;
  goals: number | null;
}

// Arama anahtarı domain'de tanımlıdır: aynı normalizasyonu ETL yazarken,
// repository ararken kullanır. İkisi ayrışırsa arama sessizce boş döner.
export { toSearchKey };

/** Kulüp adından yaygın hukuki/kurumsal ekleri atar. */
const CLUB_SUFFIXES =
  /\s+(spor\s+kul[üu]b[üu]|futbol\s+kul[üu]b[üu]|s\.?\s?k\.?|f\.?\s?c\.?|a\.?\s?f\.?\s?c\.?|f\.?\s?k\.?|c\.?\s?f\.?|a\.?\s?c\.?|s\.?\s?c\.?|b\.?\s?k\.?|u\.?\s?s\.?|calcio|1\d{3})$/i;
const CLUB_PREFIXES = /^(fc|ac|as|ss|ssc|sv|vfl|vfb|tsg|rc|cd|ud|sd|afc)\s+/i;

/**
 * Gösterim için kısa kulüp adı: "Galatasaray Spor Kulübü" → "Galatasaray".
 *
 * Sadeleştirme adı boşaltacaksa özgün ad korunur — "FC Barcelona" gibi
 * adlarda ön eki atmak bazen geriye anlamlı bir şey bırakmaz.
 */
export function toShortName(fullName: string): string {
  const trimmed = fullName.trim();

  let short = trimmed.replace(CLUB_SUFFIXES, "").trim();
  const withoutPrefix = short.replace(CLUB_PREFIXES, "").trim();
  if (withoutPrefix.length >= 3) short = withoutPrefix;

  return short.length >= 3 ? short : trimmed;
}

/**
 * Yedek takım / altyapı tespiti.
 *
 * Bu takımlar ayrı Wikidata varlıklarıdır ve "A takımında oynadı" sayılmaz
 * (BR-2). Ad kalıbına bakmak kusursuz değil ama pratikte iyi çalışıyor.
 */
export function looksLikeYouthOrReserve(name: string): boolean {
  return /\b(u-?\d{2}|under-?\d{2}|youth|academy|reserves?|altyap[ıi]|genç(ler)?|[AB]\s*tak[ıi]m[ıi]|\bII\b|\bB\b)\s*$/iu.test(
    name.trim(),
  );
}

/** Wikidata ISO tarihini Date'e çevirir; ayrıştırılamazsa null. */
export function parseWikidataDate(value: string | undefined): Date | null {
  if (value === undefined) return null;

  // Wikidata bilinmeyen ayı/günü "00" olarak verebilir: "1998-00-00T00:00:00Z"
  const normalized = value.replace(/-00/g, "-01");
  const date = new Date(normalized);

  return Number.isNaN(date.getTime()) ? null : date;
}

/** Tarihi sezon yılına indirger (BR-6). Tarih yoksa null — uydurulmaz. */
export function toSeasonYearOrNull(value: string | undefined): number | null {
  const date = parseWikidataDate(value);
  return date === null ? null : toSeasonYear(date);
}

/**
 * `.../statement/Q161089-AD66DA21-...` → `Q161089-AD66DA21-...`
 *
 * Bu kimlik Spell'in doğal anahtarıdır; biçim beklenmedikse kayıt atlanır.
 */
export function statementIdFromUri(uri: string | undefined): string | null {
  if (uri === undefined) return null;

  const last = uri.split("/").pop();
  return last !== undefined && last.length > 0 ? last : null;
}

const POSITION_MAP: ReadonlyArray<readonly [RegExp, string]> = [
  [/goalkeeper|kaleci/i, "Kaleci"],
  [/sweeper|libero/i, "Defans"],
  [/(centre|center|full|wing)-?back|defender|defans|bek|stoper/i, "Defans"],
  [/midfield|orta saha/i, "Orta saha"],
  [/winger|kanat/i, "Kanat"],
  [/striker|forward|forvet|santrfor/i, "Forvet"],
];

/** Mevki etiketini sabit bir Türkçe kümeye eşler; tanınmazsa ham etiket. */
export function normalizePosition(label: string | undefined): string | null {
  if (label === undefined || label.trim().length === 0) return null;

  for (const [pattern, turkish] of POSITION_MAP) {
    if (pattern.test(label)) return turkish;
  }
  return label.trim();
}

/** ISO 3166-1 alpha-2 biçimini doğrular ("TR", "GB"). */
export function normalizeCountryCode(code: string | undefined): string | null {
  if (code === undefined) return null;

  const upper = code.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(upper) ? upper : null;
}

/** Etiket, QID'e düşmüşse (etiket servisi çözemediyse) kullanılmaz. */
function usableLabel(label: string | undefined, id: string): string | null {
  if (label === undefined) return null;

  const trimmed = label.trim();
  return trimmed.length > 0 && trimmed !== id ? trimmed : null;
}

export function toClub(
  binding: SparqlBinding,
  leagueWikidataId: string | null,
): NormalizedClub | null {
  const id = qid(binding, "club");
  if (id === undefined) return null;

  const name = usableLabel(str(binding, "clubLabel"), id);
  if (name === null) return null; // adsız kulüp gösterilemez

  const inception = parseWikidataDate(str(binding, "inception"));

  return {
    wikidataId: id,
    name,
    shortName: toShortName(name),
    searchKey: toSearchKey(name),
    country: normalizeCountryCode(str(binding, "countryCode")),
    foundedYear: inception === null ? null : inception.getUTCFullYear(),
    crestUrl: str(binding, "logo") ?? null,
    leagueWikidataId,
  };
}

export function toPlayer(binding: SparqlBinding): NormalizedPlayer | null {
  const id = qid(binding, "player");
  if (id === undefined) return null;

  const name = usableLabel(str(binding, "playerLabel"), id);
  if (name === null) return null;

  return {
    wikidataId: id,
    name,
    searchKey: toSearchKey(name),
    birthDate: parseWikidataDate(str(binding, "dob")),
    nationality: normalizeCountryCode(str(binding, "countryCode")),
    position: normalizePosition(str(binding, "positionLabel")),
    genderQid: qid(binding, "gender") ?? null,
  };
}

/**
 * Oyuncu, hedeflenen erkek liglerinin kapsamında mı?
 *
 * `P21` kaydı olmayan oyuncular kapsamda KALIR — eksik meta veri, dışlama
 * gerekçesi değildir (gerekçe: `OUT_OF_SCOPE_GENDER_QIDS`).
 */
export function isInScope(player: NormalizedPlayer): boolean {
  return (
    player.genderQid === null ||
    !OUT_OF_SCOPE_GENDER_QIDS.includes(player.genderQid)
  );
}

/**
 * Bir dönem kaydını normalize eder.
 *
 * @param clubWikidataId sorgunun hedef kulübü (bağlamada dönmüyor)
 * @param clubIsYouth kulübün kendisi altyapı/yedek takım mı (BR-2)
 */
export function toSpell(
  binding: SparqlBinding,
  clubWikidataId: string,
  clubIsYouth: boolean,
): NormalizedSpell | null {
  const statementId = statementIdFromUri(str(binding, "st"));
  const playerId = qid(binding, "player");

  if (statementId === null || playerId === undefined) return null;

  const startYear = toSeasonYearOrNull(str(binding, "start"));
  const endYear = toSeasonYearOrNull(str(binding, "end"));

  // Başlangıcı olup bitişi olmayan kayıt, Wikidata'da "hâlâ kulüpte"
  // anlamına gelir. Bitiş yılı bilinmediği için null bırakılır (§2.7).
  const isCurrent = startYear !== null && endYear === null;

  return {
    wikidataStatementId: statementId,
    playerWikidataId: playerId,
    clubWikidataId,
    startYear,
    endYear,
    isCurrent,
    isLoan: qid(binding, "acq") === WD.VALUE_LOAN,
    isYouth: clubIsYouth,
    appearances: int(binding, "apps") ?? null,
    goals: int(binding, "goals") ?? null,
  };
}

/**
 * Aynı doğal anahtara sahip kayıtları teker: Wikidata'da bir ifade birden
 * çok satır olarak dönebilir (çok değerli niteleyiciler yüzünden).
 */
export function dedupeBy<T>(
  items: readonly T[],
  key: (item: T) => string,
): T[] {
  const seen = new Map<string, T>();
  for (const item of items) {
    const k = key(item);
    if (!seen.has(k)) seen.set(k, item);
  }
  return [...seen.values()];
}
