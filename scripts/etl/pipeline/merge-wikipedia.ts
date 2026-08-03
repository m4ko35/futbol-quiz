import { tallies, type NormalizedSpell } from "./normalize";

/**
 * Vikipedi kayıtlarının Wikidata omurgasıyla birleştirilmesi — PROJECT.md §4.3.
 *
 * SAF FONKSİYON: ağ yok, veritabanı yok. Kulüp QID'leri çağıran tarafından
 * ÇÖZÜLMÜŞ olarak gelir; çözme ağ gerektirir ve bu dosyanın saf kalması
 * §4.3'ün altı kuralının teker teker test edilebilmesinin ön koşuludur.
 */

/** Kulüp QID'si çözülmüş bir bilgi kutusu kaydı. */
export interface WikipediaSpell {
  readonly playerWikidataId: string;
  readonly clubWikidataId: string;
  readonly startYear: number | null;
  readonly endYear: number | null;
  readonly appearances: number | null;
  readonly goals: number | null;
  readonly isLoan: boolean;
}

export interface MergeStats {
  /** Wikidata'da hiç olmayan, Vikipedi'den eklenen dönem (kural 1). */
  added: number;
  /** Boş alanı doldurulan dönem (kural 2). */
  enriched: number;
  /** Dolu alanı Vikipedi'ninkiyle değiştirilen dönem (kural 3). */
  overridden: number;
  /** Kulüp evrende değil — kapsam dışı lig, alt lig (kural 5). */
  skippedOutOfUniverse: number;
  /** Hangi döneme ait olduğu belirlenemedi; üzerine yazmaktansa atlandı. */
  skippedAmbiguous: number;
  /** Başlangıç yılı yok: ne eşleştirilebilir ne kalıcı kimlik verilebilir. */
  skippedNoYear: number;
}

export interface MergeResult {
  readonly spells: NormalizedSpell[];
  readonly stats: MergeStats;
}

/**
 * Vikipedi'den gelen dönemin sentetik ifade kimliği.
 *
 * Wikidata'nınkiyle (`Q…-<UUID>`) çakışamaz, bu yüzden yükleme idempotent
 * kalır: aynı veriyle ikinci koşu satır çoğaltmaz.
 *
 * Kaldırılan elle düzeltme mekanizmasının kimliğine benziyor ama aynı şey
 * değil — değer bir KAYNAKTAN türetiliyor, birinin elle yazdığı dosyadan
 * değil (§4.3).
 */
export function syntheticSpellId(spell: {
  playerWikidataId: string;
  clubWikidataId: string;
  startYear: number;
}): string {
  return `wikipedia-${spell.playerWikidataId}-${spell.clubWikidataId}-${spell.startYear}`;
}

export function mergeWikipediaSpells(input: {
  readonly spells: readonly NormalizedSpell[];
  readonly wikipedia: readonly WikipediaSpell[];
  /** Kulüp evreni — §5.3'teki sorgudan gelir, Vikipedi belirlemez (kural 5). */
  readonly clubIds: ReadonlySet<string>;
  /** Kulübün kendisi altyapı/yedek takım mı (BR-2). */
  readonly isYouthClub: (clubWikidataId: string) => boolean;
}): MergeResult {
  const stats: MergeStats = {
    added: 0,
    enriched: 0,
    overridden: 0,
    skippedOutOfUniverse: 0,
    skippedAmbiguous: 0,
    skippedNoYear: 0,
  };

  // Mevcut dönemler oyuncu+kulüp kırılımında gruplanır; birleştirme kararı
  // her zaman bu grubun içinde verilir.
  const groups = new Map<string, NormalizedSpell[]>();
  for (const spell of input.spells) {
    const key = groupKey(spell.playerWikidataId, spell.clubWikidataId);
    groups.set(key, [...(groups.get(key) ?? []), spell]);
  }

  const incoming = new Map<string, WikipediaSpell[]>();
  for (const record of input.wikipedia) {
    // KURAL 5 — kulüp evrenini Vikipedi belirlemez. Alt lig veya kapsam dışı
    // lig kulüpleri bilgi kutusunda görünse de alınmaz.
    if (!input.clubIds.has(record.clubWikidataId)) {
      stats.skippedOutOfUniverse++;
      continue;
    }
    const key = groupKey(record.playerWikidataId, record.clubWikidataId);
    incoming.set(key, [...(incoming.get(key) ?? []), record]);
  }

  // Değişiklikler ifade kimliğine göre biriktirilir; sonuç sırası girdiyle
  // aynı kalır (kararlılık, kuru koşu karşılaştırmalarını okunur kılıyor).
  const patched = new Map<string, NormalizedSpell>();
  const created: NormalizedSpell[] = [];

  for (const [key, records] of incoming) {
    const existing = groups.get(key) ?? [];
    const used = new Set<NormalizedSpell>();
    /**
     * Bu grupta BU KOŞUDA üretilen dönemler.
     *
     * Çakışma denetimine katılmak zorundalar: aynı kulüp için iki bilgi
     * kutusu kaydı geldiğinde (aynı dönemin iki satıra bölünmesi ya da
     * yalnızca tekrar) ikincisi birincisini görmezse AYNI sentetik kimlikle
     * ikinci bir satır üretilirdi — yükleme artık idempotent olmazdı.
     */
    const addedHere: NormalizedSpell[] = [];

    for (const record of records) {
      const match = findMatch(record, existing, used);

      if (match !== null) {
        used.add(match);
        const merged = enrich(match, record, stats);
        if (merged !== match) patched.set(match.wikidataStatementId, merged);
        continue;
      }

      // KURAL 1 — eksik dönem eklenir. Yalnızca ÇAKIŞMA YOKSA: bir dönemle
      // örtüşen kayıt, o dönemin kendisi olabilir ve iki kopya üretmek veri
      // hatasıdır (§8.2 örtüşen dönem uyarısı).
      const startYear = record.startYear;
      if (startYear === null) {
        stats.skippedNoYear++;
        continue;
      }
      if (
        [...existing, ...addedHere].some((spell) => overlaps(spell, record))
      ) {
        stats.skippedAmbiguous++;
        continue;
      }

      const fresh = toNewSpell(
        record,
        startYear,
        input.isYouthClub(record.clubWikidataId),
      );
      addedHere.push(fresh);
      created.push(fresh);
      stats.added++;
    }
  }

  const spells = input.spells.map(
    (spell) => patched.get(spell.wikidataStatementId) ?? spell,
  );

  return { spells: [...spells, ...created], stats };
}

function groupKey(playerId: string, clubId: string): string {
  return `${playerId}|${clubId}`;
}

/** İki dönem aynı yıl aralığına değiyor mu? Uçlardan biri bilinmiyorsa evet. */
function overlaps(spell: NormalizedSpell, record: WikipediaSpell): boolean {
  if (spell.startYear === null || record.startYear === null) return true;

  const spellEnd = spell.endYear ?? Number.POSITIVE_INFINITY;
  const recordEnd = record.endYear ?? Number.POSITIVE_INFINITY;

  return spell.startYear <= recordEnd && record.startYear <= spellEnd;
}

/**
 * Bilgi kutusu kaydının hangi Wikidata dönemine ait olduğunu bulur.
 *
 * EŞLEŞTİRME BAŞLANGIÇ YILINA BAKAR ve iki aşamalıdır:
 *
 *   1. Tam yıl eşleşmesi. Gidip dönen oyuncularda (Bertrand @ Southampton:
 *      2014 kiralık, 2015 kalıcı) doğru dönemi seçen tek ölçüt budur.
 *   2. Tek aday kaldıysa ±1 yıl hoşgörüsü. Ölçüldü: başlangıç yılları 624
 *      eşleşmenin %96,2'sinde birebir aynı, ±1'de %2,8 daha. Bu hoşgörü
 *      olmadan o kayıtlar "yeni dönem" sayılıp kopya üretirdi.
 *
 * Aday yılı bilinmiyorsa tek adaylı grupta eşleşme kabul edilir — çelişki
 * doğması imkânsız, doldurulacak boşluk ise gerçek.
 *
 * Hiçbiri tutmuyorsa null döner ve çağıran kaydı EKLEMEYİ dener; örtüşme
 * varsa orada da atılır.
 */
function findMatch(
  record: WikipediaSpell,
  existing: readonly NormalizedSpell[],
  used: ReadonlySet<NormalizedSpell>,
): NormalizedSpell | null {
  const free = existing.filter((spell) => !used.has(spell));
  if (free.length === 0) return null;

  const exact = free.find(
    (spell) =>
      spell.startYear !== null &&
      record.startYear !== null &&
      spell.startYear === record.startYear,
  );
  if (exact !== undefined) return exact;

  if (free.length !== 1) return null;

  const only = free[0];
  if (only === undefined) return null;

  if (only.startYear === null || record.startYear === null) return only;
  return Math.abs(only.startYear - record.startYear) <= 1 ? only : null;
}

/**
 * KURAL 2 ve 3 — boş alan doldurulur, çelişkide Vikipedi kazanır.
 *
 * Vikipedi'nin `null` değeri BİR DEĞER DEĞİL, "bilinmiyor"dur; asla mevcut
 * bir değerin üzerine yazmaz (kural 4: Vikipedi silmez). Açık uçlu bir bilgi
 * kutusu aralığı da bu yüzden Wikidata'nın bitiş yılını silmez.
 *
 * Maç/gol değerleri BR-22 akla yatkınlık denetiminden geçer: bilgi kutuları
 * da yıl kılıklı maç sayısı taşıyor ve Wikidata'ya uygulanan sınır burada da
 * geçerlidir.
 */
function enrich(
  spell: NormalizedSpell,
  record: WikipediaSpell,
  stats: MergeStats,
): NormalizedSpell {
  const checked = tallies(
    record.appearances ?? undefined,
    record.goals ?? undefined,
  );

  const startYear = record.startYear ?? spell.startYear;
  const endYear = record.endYear ?? spell.endYear;
  const appearances = checked.appearances ?? spell.appearances;
  const goals = checked.goals ?? spell.goals;

  const changes = [
    [spell.startYear, startYear],
    [spell.endYear, endYear],
    [spell.appearances, appearances],
    [spell.goals, goals],
  ] as const;

  const filled = changes.filter(
    ([before, after]) => before === null && after !== null,
  );
  const replaced = changes.filter(
    ([before, after]) => before !== null && after !== null && before !== after,
  );
  const loanChanged = spell.isLoan !== record.isLoan;

  if (filled.length === 0 && replaced.length === 0 && !loanChanged)
    return spell;

  if (filled.length > 0) stats.enriched++;
  if (replaced.length > 0 || loanChanged) stats.overridden++;

  return {
    ...spell,
    startYear,
    endYear,
    appearances,
    goals,
    // BR-3: kiralık dönemler zaten SAYILIR, yalnızca rozetle işaretlenir.
    // Ölçüldü: 660 eşleşmenin %2'sinde iki kaynak ayrışıyor ve ayrışma iki
    // yöne de dağılıyor (8 / 5) — sistematik fark yok, kural 3 uygulanır.
    isLoan: record.isLoan,
    // Başlangıcı olup bitişi olmayan dönem "hâlâ kulüpte" demektir; alanlar
    // değiştiyse bu türetilmiş değer de yeniden hesaplanmalı.
    isCurrent: startYear !== null && endYear === null,
  };
}

function toNewSpell(
  record: WikipediaSpell,
  startYear: number,
  isYouth: boolean,
): NormalizedSpell {
  const checked = tallies(
    record.appearances ?? undefined,
    record.goals ?? undefined,
  );

  return {
    wikidataStatementId: syntheticSpellId({ ...record, startYear }),
    playerWikidataId: record.playerWikidataId,
    clubWikidataId: record.clubWikidataId,
    startYear,
    endYear: record.endYear,
    isCurrent: record.endYear === null,
    isLoan: record.isLoan,
    isYouth,
    appearances: checked.appearances,
    goals: checked.goals,
  };
}
