import type { NormalizedClub, NormalizedSpell } from "./normalize";

/**
 * Kulüp ikizlerinin birleştirilmesi — PROJECT.md §5.3.
 *
 * SAF FONKSİYON: ağ yok, veritabanı yok. Wikidata ilişkileri çağıran
 * tarafından ÇÖZÜLMÜŞ olarak gelir.
 *
 * SORUN. Wikidata aynı futbol geçmişini bazen iki varlığa bölüyor: bir yanda
 * şemsiye spor kulübü (`Fenerbahçe SK`, çok takımlı), öte yanda onun futbol
 * takımı (`Fenerbahçe`). Oyuncuların `P54` ifadelerini editörler rastgele
 * birine bağlıyor ve veri kümesinde kulüp İKİYE bölünüyor — kullanıcı seçim
 * listesinde iki "Fenerbahçe" görüyor, hangisini seçerse seçsin kariyerin bir
 * kısmını kaçırıyor.
 *
 * ÖLÇÜLDÜ: evrende `P361`/`P831` ile bağlı 23 çift var; 200 dönem bu yüzden
 * yanlış tarafta duruyor. Fenerbahçe'nin 97 döneminin 81'i, asıl kulüpte de
 * dönemi olan oyunculara ait.
 */

/** Wikidata'da `P361` (parçası) veya `P831` (ana kulüp) ile bağlı bir çift. */
export interface ClubLink {
  readonly clubWikidataId: string;
  readonly parentWikidataId: string;
}

export interface ClubMergeStats {
  /** Asıl kulübe katılan gölge varlık sayısı. */
  mergedClubs: number;
  /** Asıl kulübe taşınan dönem. */
  movedSpells: number;
  /** Asıl kulüpte birebir aynısı olduğu için atılan dönem. */
  droppedIdentical: number;
  /**
   * Asıl kulüpteki bir dönemle örtüştüğü için atılan dönem.
   *
   * §4.3'ün kurduğu ilkenin aynısı: örtüşme belirsizliğin ta kendisidir ve
   * ikinci bir kopya üretmek §8.2'nin "örtüşen kalıcı dönem" uyarısını
   * tetiklerdi — kullanıcı aynı kulübü kariyerde iki kez görürdü.
   */
  droppedOverlapping: number;
}

export interface ClubMergeResult {
  readonly clubs: NormalizedClub[];
  readonly spells: NormalizedSpell[];
  readonly stats: ClubMergeStats;
}

/**
 * Gölge kulüpleri asıl kulübe katar.
 *
 * YÖN TAHMİN EDİLMEZ, ÖLÇÜLÜR. `P831`'in yönü Wikidata'da tutarsız (§5.3) ve
 * hangi ucun "gerçek" kulüp olduğu türden okunamaz. Karar mercii bu projede
 * zaten var: **dönem sayısı**. Çok dönemli taraf asıl kabul edilir; eşitlikte
 * QID'si küçük olan seçilir, çünkü sıranın koşudan koşuya SABİT kalması
 * gerekir (aksi hâlde aynı veri farklı kulüp kimlikleri üretir).
 *
 * HANGİ ÇİFTLERİN BİRLEŞECEĞİNE BURASI KARAR VERMEZ. Selef/halef kulüpler de
 * (`RC Roubaix` → `CO Roubaix-Tourcoing`, 1945 birleşmesi) aynı `P361` bağını
 * taşıyor ama AYRI kulüplerdir. Ayrımı sorgu yapıyor: iki taraf da
 * `Q476028` (futbol kulübü) ise bağ bir birleşme kaydıdır ve döndürülmez
 * (`clubDuplicates`, queries.ts).
 */
export function mergeDuplicateClubs(input: {
  readonly clubs: readonly NormalizedClub[];
  readonly spells: readonly NormalizedSpell[];
  readonly links: readonly ClubLink[];
}): ClubMergeResult {
  const stats: ClubMergeStats = {
    mergedClubs: 0,
    movedSpells: 0,
    droppedIdentical: 0,
    droppedOverlapping: 0,
  };

  const known = new Set(input.clubs.map((c) => c.wikidataId));

  const spellCount = new Map<string, number>();
  for (const spell of input.spells) {
    spellCount.set(
      spell.clubWikidataId,
      (spellCount.get(spell.clubWikidataId) ?? 0) + 1,
    );
  }

  // ─── 1. Gölge → asıl eşlemesi ───────────────────────────────────────────
  const canonicalOf = new Map<string, string>();

  for (const link of input.links) {
    const a = link.clubWikidataId;
    const b = link.parentWikidataId;
    // Evren dışı uç bir birleştirme yapamaz: gölgenin dönemlerini taşıyacak
    // bir hedef yoksa yapılacak bir şey de yok.
    if (a === b || !known.has(a) || !known.has(b)) continue;

    const countA = spellCount.get(a) ?? 0;
    const countB = spellCount.get(b) ?? 0;
    const [canonical, shadow] =
      countA > countB || (countA === countB && a < b) ? [a, b] : [b, a];

    // Bir gölge yalnızca BİR asıl kulübe katılır. İkinci bir bağ gelirse ilki
    // korunur; sırayı kaynak veri belirlemesin diye giriş sırası anlamlıdır.
    if (!canonicalOf.has(shadow)) canonicalOf.set(shadow, canonical);
  }

  // Zincir çözülür: gölge başka bir gölgeyi gösteriyor olabilir.
  const resolve = (id: string): string => {
    const seen = new Set<string>([id]);
    let current = id;
    for (;;) {
      const next = canonicalOf.get(current);
      // Döngü koruması: Wikidata'da karşılıklı `P361` bağları gerçekten var.
      if (next === undefined || seen.has(next)) return current;
      seen.add(next);
      current = next;
    }
  };

  const merged = new Map<string, string>();
  for (const shadow of canonicalOf.keys()) {
    const canonical = resolve(shadow);
    if (canonical !== shadow) merged.set(shadow, canonical);
  }
  stats.mergedClubs = merged.size;

  if (merged.size === 0) {
    return { clubs: [...input.clubs], spells: [...input.spells], stats };
  }

  // ─── 2. Dönemleri taşı ──────────────────────────────────────────────────
  // Asıl kulüpteki mevcut dönemler oyuncu+kulüp kırılımında indekslenir;
  // taşınan her dönem bu grupla karşılaştırılır.
  const byPlayerClub = new Map<string, NormalizedSpell[]>();
  const index = (spell: NormalizedSpell): void => {
    const key = `${spell.playerWikidataId}|${spell.clubWikidataId}`;
    byPlayerClub.set(key, [...(byPlayerClub.get(key) ?? []), spell]);
  };

  const kept: NormalizedSpell[] = [];
  const moving: NormalizedSpell[] = [];

  for (const spell of input.spells) {
    if (merged.has(spell.clubWikidataId)) moving.push(spell);
    else {
      kept.push(spell);
      index(spell);
    }
  }

  for (const spell of moving) {
    const clubWikidataId = merged.get(spell.clubWikidataId);
    if (clubWikidataId === undefined) continue;

    const key = `${spell.playerWikidataId}|${clubWikidataId}`;
    const siblings = byPlayerClub.get(key) ?? [];

    if (siblings.some((other) => sameRange(other, spell))) {
      stats.droppedIdentical++;
      continue;
    }
    if (siblings.some((other) => overlaps(other, spell))) {
      stats.droppedOverlapping++;
      continue;
    }

    const moved = { ...spell, clubWikidataId };
    kept.push(moved);
    index(moved);
    stats.movedSpells++;
  }

  // ─── 3. Gölge kulüpleri listeden çıkar ──────────────────────────────────
  const clubs = input.clubs.filter((club) => !merged.has(club.wikidataId));

  return { clubs, spells: kept, stats };
}

function sameRange(a: NormalizedSpell, b: NormalizedSpell): boolean {
  return a.startYear === b.startYear && a.endYear === b.endYear;
}

/**
 * İki dönem aynı yıl aralığına değiyor mu? Uçlardan biri bilinmiyorsa EVET.
 *
 * `merge-wikipedia.ts`'teki `overlaps` ile aynı kural ve aynı gerekçe:
 * bilinmeyen bir uç, örtüşmediğini KANITLAMAZ; kanıtlanmamış ayrılık yeni
 * kayıt üretmeye yetmez.
 */
function overlaps(a: NormalizedSpell, b: NormalizedSpell): boolean {
  if (a.startYear === null || b.startYear === null) return true;

  const aEnd = a.endYear ?? Number.POSITIVE_INFINITY;
  const bEnd = b.endYear ?? Number.POSITIVE_INFINITY;

  return a.startYear <= bEnd && b.startYear <= aEnd;
}
