import { isPlausibleSeasonYear } from "../../../src/domain/value-objects/season";
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
  /**
   * Üçüncü eşleşme kademesiyle kurtarılan kayıt: mevcut dönem kanıtsızdı,
   * Vikipedi'ninki kanıt taşıyordu (bkz. `yieldsToEvidence`).
   *
   * AYRI SAYILIR çünkü bu kademe 4. kuralın sınırında duruyor; etkisinin
   * koşudan koşuya izlenebilir olması gerekiyor (§8.2).
   */
  matchedByEvidence: number;
  /** Başlangıç yılı yok: ne eşleştirilebilir ne kalıcı kimlik verilebilir. */
  skippedNoYear: number;
  /**
   * Vikipedi'nin yılı, kaydın diğer ucuyla tutarsız bir aralık üretiyordu;
   * Wikidata'nın aralığı korundu (kural 4).
   */
  rejectedYearConflict: number;
  /**
   * Vikipedi'nin aralığı, aynı kulüpteki başka bir dönemin üstüne binecekti;
   * Wikidata'nın aralığı korundu (kural 4).
   */
  rejectedYearCollision: number;
  /**
   * Vikipedi'nin maç/gol değeri karışınca gol maçı aşıyordu (BR-22);
   * Wikidata'nın çifti korundu (kural 4).
   */
  rejectedTallyConflict: number;
  /**
   * BR-22 — Vikipedi'nin doğruladığı, bu yüzden GERİ VERİLEN gol sayısı.
   * Ölçüm ve gerekçe: `resolveDisputedTallies`.
   */
  disputedTallyRestored: number;
  /** İkinci kaynak doğrulamadığı için düşürülmüş kalan gol sayısı. */
  disputedTallyDropped: number;
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

/**
 * Vikipedi'nin yıllarını akla yatkınlık denetiminden geçirir — §8.2.
 *
 * `tallies`'in maç/gol için yaptığının yıl karşılığı ve gerekçesi aynı:
 * ölçülerek yanlış olduğu görülen bir değeri "bilinmiyor" saymak, onu
 * kullanmaktan da kaydı çöpe atmaktan da iyidir (§2.7).
 *
 * ÖLÇÜLDÜ, VE ÖNCE YANLIŞ YAPILDI. Denetim yokken tam koşuda 70 dönem
 * "yıl makul aralık dışında" diye AYIKLANIYORDU — oysa bunların 66'sı
 * Wikidata'da sağlam duran, Vikipedi'nin bozduğu kayıtlardı. Yani katman
 * kural 4'ü ("Vikipedi asla silmez") ikinci bir yoldan daha ihlal ediyordu.
 * Bozuk yıl artık kaydı öldürmüyor, sadece yok sayılıyor.
 */
function plausibleYear(year: number | null): number | null {
  return year !== null && isPlausibleSeasonYear(year) ? year : null;
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
    matchedByEvidence: 0,
    skippedNoYear: 0,
    rejectedYearConflict: 0,
    rejectedYearCollision: 0,
    rejectedTallyConflict: 0,
    disputedTallyRestored: 0,
    disputedTallyDropped: 0,
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
        if (match.viaEvidence) stats.matchedByEvidence++;
        used.add(match.spell);
        // Kardeş dönemler: aynı oyuncunun AYNI kulüpteki diğer kayıtları.
        // Genişleyen bir aralığın onlara değmemesi gerekiyor (bkz. `enrich`).
        const siblings = [...existing, ...addedHere].filter(
          (s) => s !== match.spell,
        );
        const merged = enrich(match.spell, record, siblings, stats);
        if (merged !== match.spell)
          patched.set(match.spell.wikidataStatementId, merged);
        continue;
      }

      // KURAL 1 — eksik dönem eklenir. Yalnızca ÇAKIŞMA YOKSA: bir dönemle
      // örtüşen kayıt, o dönemin kendisi olabilir ve iki kopya üretmek veri
      // hatasıdır (§8.2 örtüşen dönem uyarısı).
      const startYear = plausibleYear(record.startYear);
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

  return {
    spells: resolveDisputedTallies([...spells, ...created], incoming, stats),
    stats,
  };
}

/**
 * BR-22 — düşürülmüş gol sayısını İKİNCİ KAYNAK doğruluyorsa geri verir.
 *
 * NEDEN GEREKLİ, ölçüldü: eski kural "gol maçı aşamaz" diyordu ve koşuda
 * 1.102 dönemi kesiyordu. Öncülü yanlış — elit golcüler maç sayısından fazla
 * gol atar. Ronaldo'nun Real Madrid'deki 292 maç / 311 golü bu yüzden
 * siliniyordu ve oyuncu, altı istatistiğin de dolu olmasını şart koşan aday
 * havuzuna (§9.1, BR-15) da giremiyordu.
 *
 * KARAR TEK BAŞINA VERİLMEZ. Wikidata'nın değeri, Vikipedi'nin AYNI dönem
 * için verdiği çiftle karşılaştırılır:
 *
 *   · maç ve gol birebir aynı  → değer korunur (iki kaynak mutabık)
 *   · başka bir şey            → düşürülür (bugünkü davranış)
 *
 * Ölçülen ayrım gücü — 150+ maçlık kayıtlarda 12/12 doğru:
 *
 *   Ronaldo         292/311  · Vikipedi 311  → korunur
 *   Zeki R. Sporel  352/470  · Vikipedi 470  → korunur
 *   (kaleci)        208/343  · Vikipedi   0  → düşürülür
 *   (bozuk kayıt)   156/5603 · Vikipedi  56  → düşürülür
 *
 * KOŞUDA ÖLÇÜLDÜ: 1.102 dönemin 140'ı kurtuldu, 962'si düşürüldü. Çevrimdışı
 * tahmin 76 demişti; düşük kaldı çünkü yalnızca önbellekteki sayfaları
 * okuyabiliyor ve dönemleri maç sayısı vekiliyle eşleştiriyordu. Oran düşük
 * (%13) ama kurtulanlar TANINMIŞ oyunculardır; hasar orada yoğunlaşıyordu.
 *
 * Vikipedi katmanı atlanırsa (`--skip-wikipedia`) hiçbir kayıt doğrulanamaz
 * ve hepsi düşürülmüş kalır — koruma zayıflamaz, yalnızca kurtarma olmaz.
 */
function resolveDisputedTallies(
  spells: readonly NormalizedSpell[],
  incoming: ReadonlyMap<string, WikipediaSpell[]>,
  stats: MergeStats,
): NormalizedSpell[] {
  return spells.map((spell) => {
    const disputed = spell.disputedGoals;
    if (disputed === undefined || disputed === null) return spell;

    const records =
      incoming.get(groupKey(spell.playerWikidataId, spell.clubWikidataId)) ??
      [];
    // ÖZGÜN çifte bakılır, birleştirme sonrası değere değil: maç sayısı
    // Vikipedi'ninkiyle ezilmiş olabilir ve o durumda karşılaştırma kendi
    // kaynağıyla yapılırdı — mutabakat değil, yankı olurdu.
    const corroborated = records.some(
      (record) =>
        record.appearances === spell.disputedAppearances &&
        record.goals === disputed,
    );

    if (!corroborated) {
      stats.disputedTallyDropped++;
      return { ...spell, disputedGoals: null, disputedAppearances: null };
    }

    stats.disputedTallyRestored++;
    return {
      ...spell,
      goals: disputed,
      disputedGoals: null,
      disputedAppearances: null,
    };
  });
}

function groupKey(playerId: string, clubId: string): string {
  return `${playerId}|${clubId}`;
}

/** Verilen aralık, kardeş dönemlerden herhangi birine değiyor mu? */
function rangesOverlap(
  startYear: number | null,
  endYear: number | null,
  siblings: readonly NormalizedSpell[],
): boolean {
  if (startYear === null) return false;

  const end = endYear ?? Number.POSITIVE_INFINITY;
  return siblings.some((other) => {
    if (other.startYear === null) return false;
    const otherEnd = other.endYear ?? Number.POSITIVE_INFINITY;
    return other.startYear <= end && startYear <= otherEnd;
  });
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
/**
 * Eşleşme ve HANGİ KADEMENİN tuttuğu.
 *
 * Kademe çağırana geri dönmek zorunda: üçüncü kademe ayrı sayılıyor ve
 * koşulunu eşleşmeden sonra yeniden değerlendirmek YANLIŞ sayardı — yıl
 * tutarken de kanıtsız/kanıtlı koşulu sağlanmış olabilir.
 */
interface SpellMatch {
  readonly spell: NormalizedSpell;
  readonly viaEvidence: boolean;
}

function findMatch(
  record: WikipediaSpell,
  existing: readonly NormalizedSpell[],
  used: ReadonlySet<NormalizedSpell>,
): SpellMatch | null {
  const free = existing.filter((spell) => !used.has(spell));
  if (free.length === 0) return null;

  const exact = free.find(
    (spell) =>
      spell.startYear !== null &&
      record.startYear !== null &&
      spell.startYear === record.startYear,
  );
  if (exact !== undefined) return { spell: exact, viaEvidence: false };

  if (free.length !== 1) return null;

  const only = free[0];
  if (only === undefined) return null;

  if (only.startYear === null || record.startYear === null)
    return { spell: only, viaEvidence: false };
  if (Math.abs(only.startYear - record.startYear) <= 1)
    return { spell: only, viaEvidence: false };

  return yieldsToEvidence(only, record)
    ? { spell: only, viaEvidence: true }
    : null;
}

/**
 * ÜÇÜNCÜ EŞLEŞME KADEMESİ — kanıtsız kayıt, kanıtlı okumaya bırakır.
 *
 * NEDEN GEREKLİ (ölçüldü, Yunus Akgün). Wikidata'da Galatasaray dönemi
 * **2008'de** başlıyor ve açık uçlu; oyuncu o tarihte 8 yaşında, yani kayıt
 * akademi girişi — ama `P3831` altyapı niteleyicisi YOK, dolayısıyla BR-2
 * bunu eleyemiyor. Bilgi kutusu doğrusunu yazıyor: 2018–, 99 maç 16 gol.
 *
 * İki kayıt eşleşemiyordu: yıl farkı 10, yani `±1` hoşgörüsünün dışında. 1.
 * kural da ekleyemiyordu çünkü 2008–(açık) ile 2018–(açık) örtüşüyor ve
 * "örtüşme belirsizliğin ta kendisidir". Sonuç: tek bozuk Wikidata kaydı, o
 * kulüpteki BÜTÜN düzeltmeyi bloke ediyor ve kayıt `skippedAmbiguous`
 * kovasına düşüyordu.
 *
 * KOŞULLAR DAR TUTULDU, çünkü bu kademe 4. kuralın ("Vikipedi silmez")
 * sınırında duruyor — var olan bir aralığı daraltabilir:
 *
 *   1. Mevcut dönem KANITSIZ olmalı: maç da gol de boş. Doğrulanabilir hiçbir
 *      şey taşımayan bir kaydın yılları için kaybedilecek bilgi yoktur.
 *   2. Vikipedi kaydı KANIT taşımalı: maç ya da gol dolu. Kanıtsızı kanıtsızla
 *      değiştirmek yalnızca kaynağı değiştirirdi, güveni artırmazdı.
 *   3. Aralıklar ÖRTÜŞMELİ. Ayrık aralıklar tanım gereği farklı dönemlerdir ve
 *      1. kural onları zaten ekliyor; örtüşme şartı o yolu bozmadan bırakır.
 *
 * Eşleşme kurulduktan sonra `enrich`in bütün güvenceleri (yıl çifti, kardeş
 * çakışması, maç/gol çifti) olduğu gibi işler — bu kademe yeni bir birleştirme
 * yolu açmıyor, var olanın kapısını genişletiyor.
 */
function yieldsToEvidence(
  spell: NormalizedSpell,
  record: WikipediaSpell,
): boolean {
  return (
    spell.appearances === null &&
    spell.goals === null &&
    (record.appearances !== null || record.goals !== null) &&
    overlaps(spell, record)
  );
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
  siblings: readonly NormalizedSpell[],
  stats: MergeStats,
): NormalizedSpell {
  const checked = tallies(
    record.appearances ?? undefined,
    record.goals ?? undefined,
  );

  /**
   * YIL ÇİFTİ BİRLİKTE DEĞERLENDİRİLİR — kural 4'ün ince ihlali buradaydı.
   *
   * Alanlar tek tek birleştirilince Vikipedi'nin başlangıcı Wikidata'nın
   * bitişiyle eşleşebiliyor ve ortaya tutarsız bir aralık çıkıyor:
   * 2010–2012 kaydı, Vikipedi 2013 derse 2013–2012 oluyor. Böyle bir kaydı
   * `sanitizeSpells` "başlangıç bitişten sonra" diye ATIYOR — yani Vikipedi
   * dolaylı yoldan var olan bir dönemi SİLDİRİYOR.
   *
   * ÖLÇÜLDÜ: tam koşuda tam olarak 15 dönem böyle kayboluyordu. Sayı küçük
   * ama yön yanlış; zenginleştirmenin bir kaydı kullanılamaz hâle getirmesi
   * kabul edilemez. Çift tutarsızsa Wikidata'nın aralığı OLDUĞU GİBİ kalır —
   * eldeki tutarlı veri, tutarsız bir karışımdan iyidir.
   */
  const mergedStart = plausibleYear(record.startYear) ?? spell.startYear;
  const mergedEnd = plausibleYear(record.endYear) ?? spell.endYear;

  /**
   * GENİŞLEYEN ARALIK KARDEŞ DÖNEME DEĞMEMELİ — ölçülmüş üçüncü ihlal.
   *
   * Wikidata bir kulüpteki kiralık ve kalıcı dönemi AYRI iki kayıtta tutuyor;
   * bilgi kutusu ikisini çoğu zaman TEK satırda birleştiriyor. Trippier
   * örneği: Wikidata'da Burnley 2011 (kiralık) ve 2012–2014 (kalıcı), bilgi
   * kutusunda tek satır 2011–2015. Kiralık kaydı bu aralıkla zenginleşince
   * 2011–2014 oluyor ve kalıcı dönemin üstüne biniyor — §8.2'nin "örtüşen
   * kalıcı dönem" uyarısı tam olarak bu.
   *
   * Aralık zaten örtüşüyorduysa (Wikidata'nın kendi tutarsızlığı) Vikipedi
   * suçlanmaz; yalnızca YENİ doğan örtüşme geri alınır.
   */
  const wouldCollide =
    !rangesOverlap(spell.startYear, spell.endYear, siblings) &&
    rangesOverlap(mergedStart, mergedEnd, siblings);

  const yearsConsistent =
    mergedStart === null || mergedEnd === null || mergedStart <= mergedEnd;
  const yearsUsable = yearsConsistent && !wouldCollide;

  const startYear = yearsUsable ? mergedStart : spell.startYear;
  const endYear = yearsUsable ? mergedEnd : spell.endYear;

  /**
   * MAÇ/GOL ÇİFTİ DE BİRLİKTE DEĞERLENDİRİLİR — aynı hatanın dördüncüsü.
   *
   * `tallies` Vikipedi'nin ÇİFTİNİ denetliyor, ama birleştirme iki alanı ayrı
   * ayrı seçince kaynaklar karışabiliyor: Wikidata'nın 50 maçı, Vikipedi'nin
   * 90 golüyle eşleşiyor ve "oynamadığı maçta gol atmış" bir kayıt çıkıyor.
   *
   * ÖLÇÜLDÜ: `db:verify` yükleme sonrası tam 9 böyle dönem saydı ve kabul
   * kontrolünü düşürdü. Birim testleri göremezdi — ikisi de tek başına
   * geçerli, birleşimleri geçersiz.
   */
  const mergedAppearances = checked.appearances ?? spell.appearances;
  const mergedGoals = checked.goals ?? spell.goals;
  const talliesUsable =
    mergedAppearances === null ||
    mergedGoals === null ||
    mergedGoals <= mergedAppearances;

  const appearances = talliesUsable ? mergedAppearances : spell.appearances;
  const goals = talliesUsable ? mergedGoals : spell.goals;

  if (!yearsConsistent) stats.rejectedYearConflict++;
  else if (wouldCollide) stats.rejectedYearCollision++;
  if (!talliesUsable) stats.rejectedTallyConflict++;

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

  // Bitiş de denetimden geçer ve tutarsızsa BİLİNMİYOR sayılır; başlangıcı
  // sağlam bir kaydı, bozuk bir bitiş yüzünden tamamen atmak veri kaybıdır.
  const end = plausibleYear(record.endYear);
  const endYear = end !== null && end < startYear ? null : end;

  return {
    wikidataStatementId: syntheticSpellId({ ...record, startYear }),
    playerWikidataId: record.playerWikidataId,
    clubWikidataId: record.clubWikidataId,
    startYear,
    endYear,
    isCurrent: endYear === null,
    isLoan: record.isLoan,
    isYouth,
    appearances: checked.appearances,
    goals: checked.goals,
  };
}
