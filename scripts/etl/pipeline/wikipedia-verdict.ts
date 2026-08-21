import type { WikiSite } from "../sources/wikipedia/client";
import type { Contradiction } from "./cross-check";
import type { NormalizedSpell } from "./normalize";

/**
 * VİKİPEDİ'NİN REDDETME YETKİSİ — PROJECT.md §4.3 (4. kural), §8.2, BR-42.
 *
 * ÇÖZDÜĞÜ ŞEY. §4.3'ün 3. kuralı "çelişkide Vikipedi kazanır" der ama
 * yalnızca DEĞERLER için: maç, gol, yıl, kiralık bayrağı. 4. kural ise
 * "Vikipedi asla SİLMEZ" der. Bu asimetri ölçülmüş bir açık bırakıyordu:
 * Wikidata bir ÜYELİĞİ uydurduğunda — Leão'nun Real Madrid'i — Vikipedi onu
 * çürütebiliyor ama düşüremiyordu. BR-42 çelişkiyi görüyor ve DURUYOR;
 * durmak düzeltmek değil: her tazeleme bloke oluyor, yanlış kayıt üretimde
 * kalıyor. 21 Ağustos 2026 itibarıyla Leão ve Mboyo tam olarak öyle duruyor.
 *
 * 4. KURAL KALDIRILMIYOR, DELİNİYOR. Kural ölçülerek konmuştu: silme
 * denendiğinde 70 dönem ayıklanıyordu ve 66'sı SAĞLAMDI. Yani "Vikipedi
 * söylemiyorsa sil" felakettir. Buradaki kapı bunun tersi bir şey istiyor:
 * Vikipedi'nin SUSMASI değil, aynı yıllara BAŞKA bir kulüp YAZMASI. Sessizlik
 * kanıt değildir (§2.7); pozitif ve çelişen bir ifade kanıttır.
 *
 * ÖLÇÜT TEK: KAÇ BAĞIMSIZ DİL. Rakip kaydı kaç Vikipedi dili yazmış?
 *
 *   ≥2 dil  → REDDET   — iki ayrı topluluk aynı şeyi yazmış
 *    1 dil  → KARANTİNA — kanıt tek kaynaklı, karar insanın
 *
 * DİL SAYISININ SINIRI DÜRÜSTÇE YAZILIYOR, çünkü bu ölçütün en zayıf yanı:
 *
 *  1. Diller BAĞIMSIZ DEĞİL. Vikipedi sürümleri birbirinden çeviriyor;
 *     tr maddesi çoğu zaman en maddesinin torunudur. "İki dil" iki ayrı
 *     doğrulama değil, bir doğrulamanın iki kopyası olabilir.
 *  2. TAVAN İKİ. §4.3'ün 2. aşaması `it`/`de`/`fr`'yi yalnızca tr/en
 *     makalesi OLMAYAN oyuncular için okuyor. Yani tanınmış bir oyuncuda
 *     ölçüt en fazla 2 olabilir; ötesi ölçülemez.
 *
 * Bu yüzden kapı ÖNCE GÖLGE MODDA koşuyor: hiçbir şey silmiyor, "silecektim"
 * listesini yazıyor. Uygulanması ayrı ve açık bir karar (`--vikipedi-karari`).
 *
 * SAF FONKSİYON: ağ yok, veritabanı yok, yan etki yok. Silme kararını burası
 * VERİR, uygulamayı çağıran yapar.
 */

/** Bir çelişkinin karar sonucu. */
export type Verdict = "reddet" | "karantina";

/**
 * Kararı REDDET yapmak için gereken en az bağımsız dil sayısı.
 *
 * NEDEN 2, NEDEN 1 DEĞİL. Tek dil, tek topluluğun tek düzenlemesidir ve
 * vandalizme Wikidata kadar açıktır — bir vandalizmi başka bir vandalizmle
 * düzeltmenin yolu yoktur. İki dil bu riski ortadan kaldırmıyor (yukarıdaki
 * 1. sınır) ama ölçülebilir biçimde azaltıyor.
 *
 * NEDEN 3 DEĞİL: ölçülemez. Yukarıdaki 2. sınır yüzünden tanınmış
 * oyuncularda tavan zaten 2; 3 istemek kapıyı KAPATMAK olurdu.
 */
export const MIN_EVIDENCE_SITES = 2;

export interface RejectionCandidate {
  readonly playerWikidataId: string;
  readonly spellId: string;
  readonly clubWikidataId: string;
  readonly startYear: number | null;
  readonly endYear: number | null;
  readonly appearances: number | null;
  /** Vikipedi'nin aynı yıllara yazdığı kulüpler. */
  readonly wikipediaClubs: readonly string[];
  /** Rakip kaydı üreten diller. Kararın tek dayanağı. */
  readonly evidenceSites: readonly WikiSite[];
  readonly verdict: Verdict;
}

export interface VerdictResult {
  readonly candidates: RejectionCandidate[];
  /**
   * Düşürülecek Wikidata ifade kimlikleri — yalnızca `reddet` olanlar.
   *
   * KARANTİNADAKİLER BURADA YOK ve bu ayrım kapının kendisidir: karantina
   * "karar veremedim" demektir, "hafifçe sil" değil.
   */
  readonly rejectedSpellIds: ReadonlySet<string>;
}

/**
 * Çelişkileri karara bağlar.
 *
 * SIRA GARANTİLİ: girdi sırası korunur. Rapor koşudan koşuya aynı sırada
 * çıkmalı, yoksa iki koşunun farkı okunamaz.
 */
export function judgeContradictions(input: {
  readonly contradictions: readonly Contradiction[];
  readonly minSites?: number;
}): VerdictResult {
  const floor = input.minSites ?? MIN_EVIDENCE_SITES;

  const candidates: RejectionCandidate[] = [];
  const rejectedSpellIds = new Set<string>();

  for (const contradiction of input.contradictions) {
    const evidenceSites = [...new Set(contradiction.wikipediaSites)];
    const verdict: Verdict =
      evidenceSites.length >= floor ? "reddet" : "karantina";

    if (verdict === "reddet") rejectedSpellIds.add(contradiction.spellId);

    candidates.push({
      playerWikidataId: contradiction.playerWikidataId,
      spellId: contradiction.spellId,
      clubWikidataId: contradiction.clubWikidataId,
      startYear: contradiction.startYear,
      endYear: contradiction.endYear,
      appearances: contradiction.appearances,
      wikipediaClubs: contradiction.wikipediaClubs,
      evidenceSites,
      verdict,
    });
  }

  return { candidates, rejectedSpellIds };
}

export interface AppliedVerdict {
  readonly spells: NormalizedSpell[];
  /**
   * Karara BAĞLANMIŞ çelişkiler listeden çıkar.
   *
   * NEDEN. BR-42 kapısı "iki kaynak anlaşamıyor" diye durur. Reddedilen
   * kayıtta anlaşmazlık ÇÖZÜLDÜ — Vikipedi kazandı ve kayıt düştü. Listede
   * bırakmak, kapının kendi çözdüğü şey yüzünden durması olurdu ve tazeleme
   * yine hiç geçmezdi. Karantinadakiler KALIR; onlar hâlâ çözülmemiştir.
   */
  readonly contradictions: Contradiction[];
  /** Gerçekten düşürülen dönem sayısı — günlüğe ve §8.2'ye yazılır. */
  readonly droppedCount: number;
}

/**
 * Kararı dönemlere UYGULAR.
 *
 * AYRI BİR FONKSİYON, çünkü kararı vermek ile uygulamak iki ayrı iş ve
 * ikincisi veri kaybettirir. `extract.ts` içinde birkaç satır olarak durduğu
 * sürece test edilemezdi; §4.3'ün 4. kuralı bir kez ölçülmeden uygulanıp
 * 66 sağlam dönemi ayıklamıştı, o yüzden bu yolun kendi testi olmalı.
 */
export function applyVerdict(input: {
  readonly spells: readonly NormalizedSpell[];
  readonly contradictions: readonly Contradiction[];
  readonly rejectedSpellIds: ReadonlySet<string>;
}): AppliedVerdict {
  if (input.rejectedSpellIds.size === 0) {
    return {
      spells: [...input.spells],
      contradictions: [...input.contradictions],
      droppedCount: 0,
    };
  }

  const spells = input.spells.filter(
    (spell) => !input.rejectedSpellIds.has(spell.wikidataStatementId),
  );

  return {
    spells,
    contradictions: input.contradictions.filter(
      (c) => !input.rejectedSpellIds.has(c.spellId),
    ),
    droppedCount: input.spells.length - spells.length,
  };
}
