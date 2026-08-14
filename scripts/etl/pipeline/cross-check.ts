import type { WikipediaSpell } from "./merge-wikipedia";
import type { NormalizedSpell } from "./normalize";

/**
 * ÇAPRAZ KAYNAK DENETİMİ — PROJECT.md §4.3, §8.2, BR-42.
 *
 * NEDEN VAR, ölçülmüş bir olaydan. 11 Ağustos 2026 23:13–23:15 UTC arasında
 * bir Wikidata kullanıcısı (`~2026-44395-88`) Rafael Leão'nun kaydında üç
 * düzenleme yaptı: boyu 288 cm yaptı, Lille'i Porto'ya, **Milan'ı Real
 * Madrid'e** çevirdi. ETL 12 Ağustos'ta koştu ve üçünü de aldı.
 *
 * ÜÇÜNDEN YALNIZCA BİRİ BİZE ULAŞTI. 288 cm, boyun akla yatkınlık aralığına
 * (140–220) takıldı ve `null` oldu — kapı çalıştı. Kulüp üyeliği için ise
 * hiçbir kapı YOKTU: "Real Madrid" akla yatkın bir kulüptür, aralığı yoktur,
 * kendi içinde çelişmez. Üretimde Real Madrid ∩ Milan sorgusu Leão'yu
 * döndürmeye başladı ve bunu ürün sahibi fark etti, hiçbir denetim değil.
 *
 * NEDEN MEVCUT DENETİMLER YETMEDİ:
 *
 *  · `sanitizeSpells` tekil kaydın KENDİ İÇİNDE çelişmesine bakar; bu kayıt
 *    kendi içinde tutarlıydı.
 *  · `validateDataset`'in "örtüşen kalıcı dönem" uyarısı `prev.endYear`
 *    dolu olmasını şart koşuyordu — Leão'nun iki dönemi de AÇIK UÇLU olduğu
 *    için uyarı bile üretilmedi (o boşluk da kapatıldı).
 *  · İfade rütbesi kullanılamaz: vandalize edilen ifade `rank=preferred`'dı.
 *
 * BU DENETİMİN FİKRİ: tek kaynağın söylediği bir şey, İKİNCİ kaynak aynı
 * dönemde BAŞKA bir kulüp söylüyorsa, çelişkidir. Vikipedi bilgi kutusu zaten
 * okunuyor (§4.3); yeni bir ağ isteği, yeni bir kaynak, yeni bir lisans
 * yüzeyi getirmiyor — elimizdeki ikinci kaynağı ilk kez DOĞRULAMA için
 * kullanıyoruz.
 *
 * SESSİZCE SİLMEZ. §4.3'ün 4. kuralı "Vikipedi asla silmez" der ve o kural
 * ölçülerek konmuştu: silme denendiğinde 70 dönem ayıklanıyordu ve 66'sı
 * sağlamdı. Bu modül de silmez — ÇELİŞKİYİ RAPORLAR, kararı `validateDataset`
 * verir. Ayrım önemli: burada bulunan şey "yanlış kayıt" değil, "iki kaynağın
 * anlaşamadığı kayıt"tır.
 */

/** Wikidata'nın iddia ettiği, Vikipedi'nin çürüttüğü bir dönem. */
export interface Contradiction {
  readonly playerWikidataId: string;
  /** Çelişen Wikidata ifadesinin kimliği — tek tek incelenebilsin diye. */
  readonly spellId: string;
  /** Wikidata'nın söylediği kulüp. */
  readonly clubWikidataId: string;
  readonly startYear: number | null;
  readonly endYear: number | null;
  readonly appearances: number | null;
  /** Vikipedi'nin AYNI dönemde söylediği kulüp(ler). */
  readonly wikipediaClubs: readonly string[];
}

/**
 * Çelişki sayılmak için gereken en az maç sayısı.
 *
 * NEDEN VAR. Bilgi kutuları eksiktir: kısa süreli, maçsız ya da çok eski
 * dönemler sık sık yazılmaz. O eksiklikleri "çelişki" saymak, kapıyı
 * gürültüye boğar ve gürültülü kapı kapatılır.
 *
 * NEDEN 10. Bir bilgi kutusu, oyuncunun 10+ maç oynadığı bir kulübü atlamış
 * ve ÜSTELİK aynı yıllar için başka bir kulüp yazmış olamaz — bu artık
 * "eksiklik" değil, iki kaynağın farklı şey söylemesidir. Leão'nun sahte
 * kaydı 227 maç taşıyordu, yani bu eşiğin çok üstünde.
 */
export const MIN_CONTRADICTION_APPEARANCES = 10;

interface Span {
  readonly start: number;
  readonly end: number;
}

/**
 * Açık uçlu dönemin bitişi.
 *
 * `null` bitiş "bilinmiyor VEYA hâlâ orada" demek (§5.1). Örtüşme sorusunda
 * ikisi de aynı yöne bakar: kayıt hâlâ AÇIK sayılır. Leão'nun iki kaydı da
 * buradan geçiyor — kapatılan boşluk tam olarak bu.
 */
const OPEN_END = 9999;

function spanOf(spell: {
  startYear: number | null;
  endYear: number | null;
}): Span | null {
  if (spell.startYear === null) return null;
  return { start: spell.startYear, end: spell.endYear ?? OPEN_END };
}

/** İki aralık gerçekten örtüşüyor mu — sınıra DEĞMEK örtüşme değildir. */
function overlaps(a: Span, b: Span): boolean {
  // 2019–2020 ile 2020–2022 aynı sezonu paylaşmaz; transfer yılı ortaktır.
  return a.start < b.end && b.start < a.end;
}

/**
 * Wikidata dönemlerinden, Vikipedi'nin çürüttüklerini bulur.
 *
 * ÜÇ KOŞUL BİRDEN aranır; herhangi biri düşerse çelişki İDDİA EDİLMEZ:
 *
 *  1. Oyuncunun Vikipedi kaydı VAR. Yoksa ikinci kaynak yok demektir ve
 *     sessizlik kanıt değildir (§2.7).
 *  2. Wikidata'nın kulübü, oyuncunun bilgi kutusunda HİÇ geçmiyor.
 *  3. Bilgi kutusu, aynı yılları BAŞKA bir kulüple dolduruyor.
 *
 * Üçüncüsü belirleyici: ikincisi tek başına "bilgi kutusu eksik" olabilir,
 * ama aynı yıllara başka bir kulüp yazılmışsa iki kaynak ANLAŞMIYOR demektir.
 *
 * Kiralık dönemler İKİ TARAFTA da dışarıda: kiralık, oyuncunun aynı anda iki
 * kulüple ilişkili göründüğü meşru durumdur ve bu denetimin varsayımını
 * kıracak tek şey odur.
 */
export function findContradictions(input: {
  readonly spells: readonly NormalizedSpell[];
  readonly wikipedia: readonly WikipediaSpell[];
  readonly minAppearances?: number;
}): Contradiction[] {
  const floor = input.minAppearances ?? MIN_CONTRADICTION_APPEARANCES;

  /** Oyuncu → bilgi kutusundaki kalıcı kayıtlar. */
  const byPlayer = new Map<string, WikipediaSpell[]>();
  for (const record of input.wikipedia) {
    if (record.isLoan) continue;
    const list = byPlayer.get(record.playerWikidataId) ?? [];
    list.push(record);
    byPlayer.set(record.playerWikidataId, list);
  }

  const found: Contradiction[] = [];

  for (const spell of input.spells) {
    if (spell.isYouth || spell.isLoan) continue;
    if ((spell.appearances ?? 0) < floor) continue;

    // KOŞUL 1 — ikinci kaynak var mı?
    const records = byPlayer.get(spell.playerWikidataId);
    if (records === undefined || records.length === 0) continue;

    // KOŞUL 2 — kulüp bilgi kutusunda hiç geçiyor mu?
    if (records.some((r) => r.clubWikidataId === spell.clubWikidataId))
      continue;

    const span = spanOf(spell);
    if (span === null) continue;

    // KOŞUL 3 — aynı yılları başka bir kulüp mü dolduruyor?
    const rivals = records.filter((record) => {
      const other = spanOf(record);
      return other !== null && overlaps(span, other);
    });
    if (rivals.length === 0) continue;

    found.push({
      playerWikidataId: spell.playerWikidataId,
      spellId: spell.wikidataStatementId,
      clubWikidataId: spell.clubWikidataId,
      startYear: spell.startYear,
      endYear: spell.endYear,
      appearances: spell.appearances,
      wikipediaClubs: [...new Set(rivals.map((r) => r.clubWikidataId))],
    });
  }

  return found;
}
