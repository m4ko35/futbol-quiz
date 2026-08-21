import type { NormalizedSpell } from "./normalize";

/**
 * AYNI KULÜBÜN İKİ KAYDI — PROJECT.md §5.3, §4.3 (3. aşama önkoşulu).
 *
 * NEDEN VAR, ölçülmüş bir felaketten dönülerek. §4.3'ün 3. aşaması
 * (Vikipedi'nin reddetme yetkisi) gölge modda ilk kez koştu ve 51 dönemi
 * reddetmeye hazırlandı. Liste elle incelendi: **28'i aynı kulübün iki
 * adıydı.**
 *
 *   Mario Maraschi  Wikidata: "Vicenza Calcio" 1965-66, 59 maç
 *                   Vikipedi: "LR Vicenza"
 *
 * Uygulansaydı gerçek bir kariyer kaydı SİLİNECEKTİ. §4.3'ün 4. kuralı bir
 * kez ölçmeden uygulanıp 66 sağlam dönemi ayıklamıştı; bu, aynı hatanın yeni
 * kılığıydı ve kapıyı gölge modda koşturmanın tek sebebi buydu.
 *
 * FİKİR: bir oyuncu aynı anda iki kulüpte KALICI olarak bulunamaz (§8.2,
 * "örtüşen kalıcı dönem"). Bu yüzden iki kulüp kaydı arasında zaman olarak
 * örtüşen kalıcı dönem varsa, ya veri hatasıdır ya da iki kayıt AYNI kulüptür.
 * Tek bir örtüşme veri hatasıdır; ÖRÜNTÜ hâline geldiyse — birbirinden
 * bağımsız oyuncularda tekrarlıyorsa — iki kaydın ilişkisi sistemiktir.
 *
 * EŞİK NEDEN 2, VE NEDEN SONUÇTAN TÜRETİLMEDİ. 2, "örüntü" sözcüğünün en dar
 * hâli: bir kez rastlantı, iki kez tekrar. Ölçüm bu ayrımı doğruluyor —
 * gerçek veri hatalarının (Leão, Trapattoni, Parola, Bakambu, Cantona) hepsi
 * 0 veya 1'de, aynı kulüp çiftlerinin hepsi 2 ve üstünde:
 *
 *   Vicenza Calcio / LR Vicenza          72
 *   Toulouse FC (1937) / (1970)          31
 *   Troyes AC / AS Troyes                28
 *   ACS Poli Timișoara / FC Timişoara    18
 *   …
 *   Leão: Real Madrid / Milan             0
 *   Trapattoni: Juventus / Milan          1
 *
 * BU BİR BİRLEŞTİRME DEĞİL. §5.3 kulüpleri birleştirmeyi ölçerek REDDETTİ ve
 * o karar duruyor: burada hiçbir kulüp birleşmiyor, hiçbir dönem taşınmıyor.
 * Tek yaptığı, BR-42'ye "bu ikisi aynı şeyin iki adı olabilir, çelişki
 * sayma" demek. Riskin yönü de bunu destekliyor: yanlış silme veriye yayılır
 * ve geri alınamaz, yanlış susma yalnızca bir kaydı kapıda tutar.
 *
 * SAF FONKSİYON: ağ yok, veritabanı yok.
 */

/** Örüntü sayılmak için gereken en az bağımsız örtüşme. */
export const MIN_KINSHIP_OVERLAPS = 2;

/** Yönsüz çift anahtarı — sıra koşudan koşuya sabit kalmalı. */
export function kinshipKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

interface Span {
  readonly start: number;
  readonly end: number;
}

/**
 * Açık uçlu dönem BURADA sayılmaz.
 *
 * `cross-check.ts` bitişi bilinmeyen kaydı açık sayıyor çünkü oradaki iddiayı
 * ikinci kaynak kuruyor. Burada iddiayı örtüşmenin KENDİSİ kuruyor, yani
 * kanıt yükü bu tarafta: bitişi bilinmeyen 3.588 oyuncuyu (§8.2) örtüşme
 * saymak, ilgisiz kulüpleri akraba ilan ederdi.
 */
function spanOf(spell: NormalizedSpell): Span | null {
  if (spell.startYear === null || spell.endYear === null) return null;
  return { start: spell.startYear, end: spell.endYear };
}

function overlaps(a: Span, b: Span): boolean {
  // Sınıra değmek örtüşme değildir — transfer yılı ortaktır.
  return a.start < b.end && b.start < a.end;
}

/**
 * Aynı kulüp olma ihtimali taşıyan kulüp çiftlerini bulur.
 *
 * Döndürdüğü küme `kinshipKey` biçiminde anahtarlar taşır.
 */
export function findKinClubPairs(input: {
  readonly spells: readonly NormalizedSpell[];
  readonly minOverlaps?: number;
}): ReadonlySet<string> {
  const floor = input.minOverlaps ?? MIN_KINSHIP_OVERLAPS;

  const byPlayer = new Map<string, NormalizedSpell[]>();
  for (const spell of input.spells) {
    if (spell.isLoan || spell.isYouth) continue;
    const list = byPlayer.get(spell.playerWikidataId) ?? [];
    list.push(spell);
    byPlayer.set(spell.playerWikidataId, list);
  }

  const counts = new Map<string, number>();
  for (const spells of byPlayer.values()) {
    if (spells.length < 2) continue;

    // AYNI OYUNCU BİR ÇİFTİ BİR KEZ SAYAR. Bir oyuncunun iki kulüpte
    // üçer dönemi varsa dokuz örtüşme çıkar ve eşik tek kişiyle aşılırdı;
    // aranan şey ise BAĞIMSIZ oyuncularda tekrarlamak.
    const seen = new Set<string>();

    for (let i = 0; i < spells.length; i++) {
      for (let j = i + 1; j < spells.length; j++) {
        const a = spells[i];
        const b = spells[j];
        if (a === undefined || b === undefined) continue;
        if (a.clubWikidataId === b.clubWikidataId) continue;

        const sa = spanOf(a);
        const sb = spanOf(b);
        if (sa === null || sb === null || !overlaps(sa, sb)) continue;

        seen.add(kinshipKey(a.clubWikidataId, b.clubWikidataId));
      }
    }

    for (const key of seen) counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const kin = new Set<string>();
  for (const [key, count] of counts) if (count >= floor) kin.add(key);
  return kin;
}
