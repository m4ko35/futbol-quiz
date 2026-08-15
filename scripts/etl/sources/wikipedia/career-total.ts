/**
 * KARİYER TOPLAMI — Vikipedi'nin `Career statistics` tablosundan, §9.2.
 *
 * NEDEN VAR. Oyundaki `goals` yalnızca kapsamdaki 24 ligi sayıyor; Ronaldo
 * 600 gol görünüyor, oysa resmî toplamı bunun çok üstünde. Ürün sahibi
 * kupaları ve Avrupa maçlarını da içeren **toplam resmî** sayıyı istedi.
 *
 * NEDEN WIKIDATA DEĞİL, ölçüldü (15 Ağustos 2026):
 *
 *  · `P54` ifadelerinde **kulvar niteleyicisi yok** — Ronaldo'nun 12
 *    ifadesindeki niteleyicilerin tamamı sayıldı, lig/kupa ayrımı yok.
 *  · `P6509` (kariyerdeki toplam gol) tanınırlık havuzunun **%0,1'inde**
 *    var (6/6.464). Tüm Wikidata'da 11.424 varlık — boyun 1/124'ü. Dolu
 *    olduğu yerde de belirsiz: Messi'de iki aday toplam (474 ve 916).
 *
 * Sayı yalnızca burada, tablonun en alt satırında duruyor. Tablonun TAMAMINI
 * çözmek GEREKMİYOR — sezon satırları, `rowspan`'li kulüp adları, kulüp→QID
 * eşlemesi, hiçbiri. Tek satır okunur.
 *
 * BU MODÜL SAFTIR: ağ yok, veritabanı yok (§8.1).
 */

/** Kulüp kariyerinin tamamı — bütün kulvarlar dâhil. */
export interface CareerTotal {
  readonly appearances: number | null;
  readonly goals: number | null;
}

/**
 * Akla yatkın en yüksek kariyer maçı.
 *
 * `MAX_SPELL_TALLY` (1000) DÖNEM başınadır ve burada kullanılamaz: Ronaldo'nun
 * kariyer toplamı 1.099 maç, yani o sınırı tek başına aşıyor. Buradaki sınır
 * bilinen rekorlara göre konuldu — en çok resmî maç ~1.390 (Peter Shilton) —
 * ve yıl kılıklı sayıları (1987, 2005) elemek için hâlâ yeterince dar.
 */
export const MAX_CAREER_TALLY = 1600;

/**
 * Bölüm başlığı — dile göre.
 *
 * ŞİMDİLİK YALNIZCA İNGİLİZCE ÖLÇÜLDÜ: kolay havuzda en.wiki kapsamı %98,0
 * (49/50), havuzun geri kalanında %20,0 (10/50). Diğer diller eklenmeden
 * önce ayrı ayrı ölçülmeli — bilgi kutusunda olduğu gibi biçim farkları
 * dilden dile değişiyor.
 */
const CAREER_HEADING = /^==+\s*Career statistics\s*==+\s*$/iu;

/** Herhangi bir başlık — bölüm sınırını bulmak için. */
const ANY_HEADING = /^(=+)\s*(.+?)\s*\1\s*$/u;

const TABLE_START = /^\s*\{\|/u;
const TABLE_END = /^\s*\|\}/u;
const ROW_SEPARATOR = /^\s*\|-/u;

/**
 * Toplam satırının ETİKET hücresi.
 *
 * `colspan` DEĞERİNE BAKILMAZ: ölçümde 2 ve 3 birlikte geçiyor ve değere
 * bağlanmak Sivok'ta kulüp ara toplamının kariyer toplamı sanılmasına yol
 * açtı.
 */
const TOTAL_LABEL = /^\s*!.*?\bcolspan\b[^|]*\|\s*'*(?:career\s+)?total\b/iu;

/** Yalnızca KARİYER toplamı — kulüp ara toplamlarından ayırt eder. */
const CAREER_TOTAL_LABEL = /^\s*!.*?\bcolspan\b[^|]*\|\s*'*career\s+total\b/iu;

/**
 * ASİST SÜTUNU TAŞIYAN TABLO OKUNMAZ.
 *
 * Ölçülen kusur (Juan Manuel Vargas): tablosu her kulvar için ÜÇ sütun
 * tutuyor — `Apps / Goals / Assists`. "Satırın son iki sayısı" kuralı orada
 * maç/gol değil **gol/asist** veriyor ve sonuç akla yatkın göründüğü için
 * fark edilmiyor. Sütunları saymak yerine bu biçimi tanıyıp susmak doğru:
 * hangi sütunun ne olduğunu bilmeden sayı üretmek §2.7'nin yasakladığı şey.
 */
const ASSISTS_HEADER = /\bassists?\b/iu;

/** `<ref>…</ref>`, `<ref … />` ve şablonlar — hücrede sayı gibi görünürler. */
function stripNoise(line: string): string {
  return line
    .replace(/<ref[^>]*\/>/giu, "")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/giu, "")
    .replace(/\{\{[^{}]*\}\}/gu, "")
    .replace(/'''?/gu, "");
}

/** Kaydın "yok" dediği hücre: em/en tire, kısa çizgi ya da boşluk. */
const ABSENT_CELL = /^[—–-]?$/u;

/**
 * Bir satırdaki hücrelerin sayısal okuması.
 *
 * ÜÇ DURUM VARDIR ve üçünü ayırmak zorunludur:
 *
 *  · **sayı** — okundu.
 *  · **yok** (`—`, boş) — o kulvarda kayıt yok; sayı üretmez ve bu doğrudur,
 *    çünkü `null` sıfır değildir (§2.7).
 *  · **okunamadı** (`36+`, `?`) — kayıt VAR ama değeri eksik.
 *
 * ÜÇÜNCÜSÜ SATIRIN TAMAMINI ÇÜRÜTÜR ve bu ölçülerek öğrenildi. Guardiola'nın
 * kariyer toplamı satırı şöyle yazılmış:
 *
 *     ! 398 || 21 || 33+ || 3+ || 72+ || 4 || 21+ || 0 || 524+ || 28+
 *
 * Okunabilenleri toplayıp okunamayanları atlamak `[398, 21, 4, 0]` veriyordu;
 * son iki sayı kuralı da bundan **4 maç / 0 gol** üretiyordu. Sayı çift
 * olduğu için bütünlük denetimi bile susuyordu. Yani kusur sessiz, sonucu
 * inandırıcı ve tamamen yanlıştı — tam olarak §2.7'nin yasakladığı şey.
 *
 * BİNLİK AYRACI KALDIRILIR: Ronaldo'nun toplamı `1,099` yazılıyor ve ayracı
 * yok saymak onu **1** yapardı.
 */
function numbersIn(text: string): number[] | null {
  const found: number[] = [];

  for (const cell of stripNoise(text).split(/!!|\|\|/u)) {
    // Hücre `colspan=…|değer` biçiminde olabilir; değer ayraçtan SONRADIR.
    const raw = cell.includes("|")
      ? cell.slice(cell.lastIndexOf("|") + 1)
      : cell;
    const value = raw.replace(/^\s*!/u, "").trim();

    if (ABSENT_CELL.test(value)) continue;

    const match = /^([\d,]+)$/u.exec(value);
    if (match?.[1] === undefined) return null;

    const parsed = Number.parseInt(match[1].replace(/,/gu, ""), 10);
    if (!Number.isFinite(parsed)) return null;
    found.push(parsed);
  }

  return found;
}

/**
 * KULÜP tablosunun satırları — `Career statistics` bölümünden.
 *
 * ÜÇ SINIR BİRDEN GEREKLİ ve üçü de ölçülmüş bir kusuru kapatıyor:
 *
 *  · BÖLÜM sınırı olmasaydı, sayfanın herhangi bir yerindeki tablo okunurdu.
 *    Teknik direktörlük tablosu böylece dışarıda kalır — o ayrı bir üst
 *    başlıktır ve `{{WDLtot}}` taşır. Henry ile Sergen Yalçın'da naif "son
 *    toplam satırı" onu yakalıyordu: oyuncunun golü yerine teknik direktörün
 *    galibiyeti yazılırdı.
 *
 *  · ALT BAŞLIK sınırı olmasaydı, `===International===` bölümündeki millî
 *    takım tablosu kulüp tablosu sanılırdı. Ronaldo'da "son toplam satırı"
 *    tam olarak oydu (1.099/830 yerine 192/131).
 *
 *  · ALT BAŞLIK SIRASI SABİT DEĞİL — sadece "ilk tablo" demek yetmiyor.
 *    Ölçüldü: Tony Cascarino ve Per Krøldrup'un makalelerinde
 *    `==Career statistics==` bölümü **doğrudan `===International===` ile
 *    başlıyor** ve kulüp tablosu hiç yok. Orada doğru cevap "kulüp tablosu
 *    yok"tur, ilk tabloyu okumak değil.
 *
 * Alt başlığı hiç olmayan makalelerde ilk tablo kulüp tablosudur; bu ayrım
 * varsayım değil, iki biçimin de görülmesinden.
 */
const CLUB_SUBHEADING = /^(=+)\s*club\b.*?\1\s*$/iu;

function clubTableLines(wikitext: string): string[] | null {
  const lines = wikitext.split("\n");

  const start = lines.findIndex((line) => CAREER_HEADING.test(line));
  if (start < 0) return null;

  const openingLevel = (ANY_HEADING.exec(lines[start] ?? "")?.[1] ?? "==")
    .length;

  // Bölümün sınırı: aynı ya da üst düzeyde bir sonraki başlık.
  let end = lines.length;
  const subheadings: number[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const heading = ANY_HEADING.exec(lines[i] ?? "");
    if (heading === null) continue;
    if ((heading[1] ?? "").length <= openingLevel) {
      end = i;
      break;
    }
    subheadings.push(i);
  }

  // Kulüp tablosu nereden başlıyor?
  let from = start + 1;
  if (subheadings.length > 0) {
    const club = subheadings.find((i) => CLUB_SUBHEADING.test(lines[i] ?? ""));
    // Alt başlıklar var ama kulüp yok: bu makalede kulüp tablosu YOK.
    if (club === undefined) return null;
    from = club + 1;
    // Kulüp alt bölümü, bir sonraki alt başlıkta biter.
    const next = subheadings.find((i) => i > club);
    if (next !== undefined) end = Math.min(end, next);
  }

  const table: string[] = [];
  let inside = false;

  for (let i = from; i < end; i++) {
    const line = lines[i] ?? "";

    if (!inside) {
      if (TABLE_START.test(line)) inside = true;
      continue;
    }

    if (TABLE_END.test(line)) return table;
    table.push(line);
  }

  // Tablo yok ya da kapanmamış: kayıt bozuk, iddia üretme.
  return null;
}

/**
 * Kulüp kariyerinin toplam maç ve golü; okunamazsa `null`.
 *
 * HANGİ TOPLAM SATIRI, ölçülerek daraltıldı. "Sonuncuyu al" yetmiyor:
 *
 *  · `Career total` etiketli satır VARSA o alınır — kesin olan budur.
 *  · Yoksa ve tabloda TEK bir toplam satırı varsa, o satır kulübün toplamı
 *    ve aynı zamanda kariyer toplamıdır (tek kulüplü oyuncu).
 *  · Yoksa ve BİRDEN ÇOK toplam satırı varsa **susulur**. Ölçüldü: Yann
 *    M'Vila'nın tablosunda kariyer toplamı hiç yok, yalnızca kulüp başına
 *    ara toplamlar var; sonuncuyu almak son kulübün sayısını bütün kariyer
 *    diye yazıyordu (91/1 yerine 449 maçlık bir kariyer). Juan Manuel
 *    Vargas'ta aynı kalıp ülke başına tekrarlanıyor.
 *
 * SATIRIN SON İKİ SAYISI alınır — tablodaki son sütun çifti "Total"dır ve
 * sütun sayısı makaleden makaleye değişiyor (ölçüldü: 10, 12 ve 14 sütunlu
 * örnekler var; kimi tabloda "League cup" yok, kimi tabloda "Other" yok).
 * Sabit indeks kullanmak bu yüzden yanlış olurdu.
 *
 * AKLA YATKINLIK KAPISI: gol maçtan çok olamaz ve sayılar `MAX_CAREER_TALLY`
 * altında kalmalı. Aşan satır ayrıştırma kusurunu gösterir; §2.7 gereği
 * yanlış sayı göstermektense hiç göstermemek doğrudur.
 */
export function parseCareerTotal(wikitext: string): CareerTotal | null {
  const table = clubTableLines(wikitext);
  if (table === null) return null;

  // Sütunların ne olduğu bilinmiyorsa sayı üretilmez.
  if (table.some((line) => ASSISTS_HEADER.test(line))) return null;

  /**
   * SAYI ÜRETEN toplam satırları. Etiketi saymak YETMEZ ve bu testle
   * bulundu: tablo BAŞLIĞINDA da `!colspan="2"|Total` var — o bir sütun
   * grubu etiketi, satır değil. Etiketleri saymak tek kulüplü oyuncuda
   * "iki toplam satırı var" sanıp okumayı durduruyordu.
   */
  const candidates: { readonly career: boolean; readonly cells: number[] }[] =
    [];

  for (let i = 0; i < table.length; i++) {
    const line = table[i] ?? "";
    if (!TOTAL_LABEL.test(line)) continue;

    // Değerler etiketle AYNI satırda olabilir (`…|Total||121||85`) ya da
    // sonraki satırlara yayılabilir (Ronaldo). İkisi de görülüyor.
    const cells = numbersIn(line.replace(TOTAL_LABEL, ""));
    if (cells === null) continue;

    let broken = false;
    for (let j = i + 1; j < table.length; j++) {
      const next = table[j] ?? "";
      if (ROW_SEPARATOR.test(next) || TOTAL_LABEL.test(next)) break;
      const more = numbersIn(next);
      if (more === null) {
        broken = true;
        break;
      }
      cells.push(...more);
    }
    if (broken) continue;

    // Sütunlar maç/gol ÇİFTİ hâlinde gelir; tek sayı, satırın yanlış
    // okunduğunu gösterir. Sayısız satır başlıktır, aday değildir.
    if (cells.length >= 2 && cells.length % 2 === 0) {
      candidates.push({ career: CAREER_TOTAL_LABEL.test(line), cells });
    }
  }

  const careerRows = candidates.filter((row) => row.career);
  const chosen =
    careerRows.length > 0
      ? careerRows[careerRows.length - 1]
      : candidates.length === 1
        ? candidates[0]
        : undefined;

  if (chosen === undefined) return null;

  const { cells: last } = chosen;
  const goals = last[last.length - 1];
  const appearances = last[last.length - 2];
  if (appearances === undefined || goals === undefined) return null;

  if (appearances > MAX_CAREER_TALLY || goals > MAX_CAREER_TALLY) return null;
  if (goals > appearances) return null;

  return { appearances, goals };
}
