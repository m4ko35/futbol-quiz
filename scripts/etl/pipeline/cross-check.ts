import type { WikipediaSpell } from "./merge-wikipedia";
import {
  OPEN_SEASON_END,
  sharesSeason,
  type NormalizedSpell,
} from "./normalize";
import type { WikiSite } from "../sources/wikipedia/client";
import { kinshipKey } from "./club-kinship";
import type { UnresolvedClubRow } from "./wikipedia-pass";

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
 *
 * KÖR OLDUĞU YERDE DE SUSAR (21 Ağustos 2026 eklendi). "İkinci kaynak başka
 * bir şey söylüyor" ile "ikinci kaynağı okuyamadık" aynı şey değil; ikincisi
 * çelişki değil BİLGİSİZLİKTİR ve ayrı raporlanır (`Undecided`).
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
  /**
   * Rakip kayıtları ÜRETEN diller — §4.3, 3. aşama.
   *
   * Çelişkinin kendisi için gerekli değil; kararı için gerekli. Kaç bağımsız
   * dilin aynı şeyi söylediği, `wikipedia-verdict.ts`'in tek ölçütü.
   */
  readonly wikipediaSites: readonly WikiSite[];
}

/**
 * Kapının KARAR VEREMEDİĞİ kayıt — §8.2.
 *
 * Diğer üç koşulu da geçmiş, yani eski kural bunu ÇELİŞKİ İLAN EDERDİ. Ama
 * oyuncunun bilgi kutusunda okuyamadığımız bir satır tam da tartışmalı
 * yıllara denk geliyor: o satır, aradığımız kulübün ta kendisi olabilir.
 *
 * Bu bir "daha zayıf çelişki" DEĞİL — bilgisizliktir ve öyle raporlanır.
 * Bloklamaz; sayısı, kulüp adı indeksinin ne kadar eksik olduğunun ölçüsüdür.
 */
export interface Undecided {
  readonly playerWikidataId: string;
  readonly spellId: string;
  readonly clubWikidataId: string;
  readonly startYear: number | null;
  readonly endYear: number | null;
  readonly appearances: number | null;
  /** Aynı yıllarda BAŞKA kulüp söyleyen, çözülmüş satırlar. */
  readonly wikipediaClubs: readonly string[];
  /** Kararı engelleyen okunamamış bağlantılar — ham adlarıyla. */
  readonly unreadTitles: readonly string[];
}

export interface CrossCheckResult {
  readonly contradictions: Contradiction[];
  readonly undecided: Undecided[];
  /**
   * Rakip kulüp, tartışmalı kulübün BAŞKA ADI olduğu için çelişki
   * sayılmayan kayıt sayısı — §5.3, `club-kinship.ts`.
   *
   * Ayrı bir liste değil, bir SAYAÇ: bunlar bilinen ve kabul edilmiş bir
   * durum (kulüp ikizleri, §5.3) ve her koşuda yüzlerce satır yazmak raporu
   * boğardı. Sayının kendisi yine de görünmeli — büyümesi, kulüp kimliği
   * sorununun büyüdüğü anlamına gelir.
   */
  readonly kinSuppressed: number;
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

function spanOf(spell: {
  startYear: number | null;
  endYear: number | null;
}): Span | null {
  if (spell.startYear === null) return null;
  // Açık uçlu kayıt hâlâ sürüyor sayılır (§5.1). Leão'nun iki kaydı da
  // buradan geçiyor — 13 Ağustos'ta kapatılan boşluk tam olarak buydu.
  return { start: spell.startYear, end: spell.endYear ?? OPEN_SEASON_END };
}

/**
 * Ortak SEZON var mı — kural `normalize.ts`'te, tek kopya.
 *
 * KAPSAYICI KIYASLAMA BURADA GÜVENLİ, akrabalık ölçümünde değil. Farkı bu
 * denetimin 2. koşulu yaratıyor: kulüp bilgi kutusunda HİÇ geçmemeli. Devre
 * arası transferde Vikipedi iki kulübü de yazar, dolayısıyla koşul düşer ve
 * transfer çelişki sayılmaz (`overlapsBeyondTransfer` gerekçesi).
 */
function overlaps(a: Span, b: Span): boolean {
  return sharesSeason(a, b);
}

/**
 * Wikidata dönemlerinden, Vikipedi'nin çürüttüklerini bulur.
 *
 * DÖRT KOŞUL BİRDEN aranır; herhangi biri düşerse çelişki İDDİA EDİLMEZ:
 *
 *  1. Oyuncunun Vikipedi kaydı VAR. Yoksa ikinci kaynak yok demektir ve
 *     sessizlik kanıt değildir (§2.7).
 *  2. Wikidata'nın kulübü, oyuncunun bilgi kutusunda HİÇ geçmiyor.
 *  3. Bilgi kutusu, aynı yılları BAŞKA bir kulüple dolduruyor.
 *  4. O yıllarda OKUYAMADIĞIMIZ bir satır yok.
 *
 * Üçüncüsü belirleyici: ikincisi tek başına "bilgi kutusu eksik" olabilir,
 * ama aynı yıllara başka bir kulüp yazılmışsa iki kaynak ANLAŞMIYOR demektir.
 *
 * DÖRDÜNCÜSÜ 2'NİN ANLAMINI KORUYOR ve ölçülerek eklendi (§8.2, 21 Ağustos
 * 2026). "Kulüp bilgi kutusunda hiç geçmiyor" iki ayrı sebeple doğru
 * çıkabiliyordu: Vikipedi gerçekten söz etmiyordur, ya da söz eder ama biz o
 * bağlantıyı evrendeki bir kulübe BAĞLAYAMAMIŞIZDIR. İkincisi kapının kendi
 * körlüğüdür ve kanıt değildir — nitekim Orbelín Pineda'nın DOĞRU olan AEK
 * Atina kaydı bu yüzden çelişki ilan edilmişti. Körlük seyrek de değil:
 * okunan satırların yarısı evren dışı (§4.3) ve evren içi bir kulüp de takma
 * ad indeksinde eksikse aynı yoldan düşüyor.
 *
 * Bu koşul EN SONA konuldu, bilerek. Böylece `undecided` listesi, eski
 * kuralın çelişki ilan EDECEĞİ kayıtların tam olarak kendisidir — iki sayı
 * doğrudan kıyaslanabilir ve körlüğün büyüklüğü ölçülebilir.
 *
 * Kiralık dönemler İKİ TARAFTA da dışarıda: kiralık, oyuncunun aynı anda iki
 * kulüple ilişkili göründüğü meşru durumdur ve bu denetimin varsayımını
 * kıracak tek şey odur. Okunamayan satırlar da aynı süzgeçten geçiyor —
 * ayrı davranmaları için bir sebep yok, kiralık bayrağı kulüpten bağımsız
 * ayrıştırılıyor.
 */
export function findContradictions(input: {
  readonly spells: readonly NormalizedSpell[];
  readonly wikipedia: readonly WikipediaSpell[];
  /**
   * Evrendeki bir kulübe bağlanamayan bilgi kutusu satırları.
   *
   * VERİLMEZSE KAPI ESKİ GİBİ DAVRANIR. Varsayılan boş liste; birim testleri
   * körlük senaryosunu ayrıca kuruyor, gerçek koşuda `extract.ts` dolduruyor.
   */
  readonly unresolved?: readonly UnresolvedClubRow[];
  /**
   * Aynı kulübün iki kaydı olabilecek kulüp çiftleri (`club-kinship.ts`).
   *
   * VERİLMEZSE KAPI ESKİ GİBİ DAVRANIR. Verildiğinde, rakip kulüp
   * tartışmalı kulübün başka adıysa çelişki İDDİA EDİLMEZ: "Vicenza Calcio"
   * ile "LR Vicenza" iki kaynağın anlaşmazlığı değil, aynı şeyin iki yazımı.
   */
  readonly kinClubPairs?: ReadonlySet<string>;
  readonly minAppearances?: number;
}): CrossCheckResult {
  const floor = input.minAppearances ?? MIN_CONTRADICTION_APPEARANCES;

  /** Oyuncu → bilgi kutusundaki kalıcı kayıtlar. */
  const byPlayer = new Map<string, WikipediaSpell[]>();
  for (const record of input.wikipedia) {
    if (record.isLoan) continue;
    const list = byPlayer.get(record.playerWikidataId) ?? [];
    list.push(record);
    byPlayer.set(record.playerWikidataId, list);
  }

  /** Oyuncu → okunamamış kalıcı satırlar. */
  const unreadByPlayer = new Map<string, UnresolvedClubRow[]>();
  for (const row of input.unresolved ?? []) {
    if (row.isLoan) continue;
    const list = unreadByPlayer.get(row.playerWikidataId) ?? [];
    list.push(row);
    unreadByPlayer.set(row.playerWikidataId, list);
  }

  const kin = input.kinClubPairs ?? new Set<string>();

  const contradictions: Contradiction[] = [];
  const undecided: Undecided[] = [];
  let kinSuppressed = 0;

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
    const allRivals = records.filter((record) => {
      const other = spanOf(record);
      return other !== null && overlaps(span, other);
    });
    if (allRivals.length === 0) continue;

    /*
      KOŞUL 3b — rakip, aynı kulübün BAŞKA ADI olabilir mi?

      "Vicenza Calcio" ile "LR Vicenza" iki kaynağın anlaşmazlığı değil, aynı
      kulübün iki kaydı (§5.3). Bunu çelişki saymak bir yana, 3. aşamada
      REDDEDİLİRSE gerçek bir kariyer kaydı silinir — ölçüldü, 51 reddin 28'i
      bu sınıftandı (`club-kinship.ts`).
    */
    const rivals = allRivals.filter(
      (record) =>
        !kin.has(kinshipKey(spell.clubWikidataId, record.clubWikidataId)),
    );
    if (rivals.length === 0) {
      kinSuppressed++;
      continue;
    }

    const wikipediaClubs = [...new Set(rivals.map((r) => r.clubWikidataId))];
    const wikipediaSites = [...new Set(rivals.flatMap((r) => r.sites))];

    /*
      KOŞUL 4 — bu yıllarda okuyamadığımız bir satır var mı?

      YILI OLMAYAN SATIR DA ENGELLER. Aralığı belirlenemeyen bir satırın
      tartışmalı yıllara denk gelip gelmediği bilinemez; bilinemeyen bir şeyi
      "denk gelmiyor" saymak, kapatılmak istenen açığın ta kendisidir.
    */
    const blinding = (unreadByPlayer.get(spell.playerWikidataId) ?? []).filter(
      (row) => {
        const other = spanOf(row);
        return other === null || overlaps(span, other);
      },
    );

    if (blinding.length > 0) {
      undecided.push({
        playerWikidataId: spell.playerWikidataId,
        spellId: spell.wikidataStatementId,
        clubWikidataId: spell.clubWikidataId,
        startYear: spell.startYear,
        endYear: spell.endYear,
        appearances: spell.appearances,
        wikipediaClubs,
        unreadTitles: [...new Set(blinding.map((r) => r.clubTitle))],
      });
      continue;
    }

    contradictions.push({
      playerWikidataId: spell.playerWikidataId,
      spellId: spell.wikidataStatementId,
      clubWikidataId: spell.clubWikidataId,
      startYear: spell.startYear,
      endYear: spell.endYear,
      appearances: spell.appearances,
      wikipediaClubs,
      wikipediaSites,
    });
  }

  return { contradictions, undecided, kinSuppressed };
}
