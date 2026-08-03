/**
 * Vikipedi futbolcu bilgi kutusu ayrıştırıcısı — PROJECT.md §4.3.
 *
 * SAF MODÜL: ağ yok, dosya yok, veritabanı yok. Girdisi wikitext, çıktısı
 * kariyer satırlarıdır. Saflık test edilebilirliğin ön koşulu (§8.1) — bu
 * dosyanın tamamı gerçek makale metinleriyle birim testinden geçer.
 *
 * NEDEN SATIR BAZLI DEĞİL. İlk ölçümde ayrıştırma satır satır yapılıyordu;
 * 1657 `years` alanının 700'ü bozuk okunuyordu çünkü editörler alanları AYNI
 * SATIRA sıkıştırıyor:
 *
 *   | years1 = 1996–1997 | clubs1 = [[Corinthians]] | caps1 = 20 | goals1 = 3
 *
 * Doğru okuma için şablon gövdesi ayraç sayarak çıkarılır ve alanlar
 * `{{…}}`/`[[…]]` derinliği SIFIRKEN gelen `|` işaretlerinden bölünür. Bu aynı
 * zamanda bağlantı hedefindeki boruyu da korur: `[[1922 Konyaspor|Anadolu
 * Selçukspor]]` tek parça kalır.
 */

/**
 * Bilgi kutusundan okunan bir kariyer satırı.
 *
 * Kulüp HENÜZ QID'ye çözülmemiştir; çözüm ağ gerektirir ve bu modül saftır.
 * Çözümü `resolveClubTitles` (client.ts) yapar, eşleştirmeyi birleştirme
 * adımı (§4.3).
 */
export interface InfoboxSpell {
  /**
   * Bağlantı hedefi, gösterilen ad DEĞİL:
   * `[[Galatasaray (futbol takımı)|Galatasaray]]` → `Galatasaray (futbol takımı)`
   *
   * Hedef seçilir çünkü QID çözümlemesi `sitelinks` üzerinden yapılır ve
   * sitelink hedef başlığa bakar; gösterilen ad çözülmez.
   */
  readonly clubTitle: string;
  /** Sezon yılı (BR-6). Okunamadıysa null — uydurulmaz (§2.7). */
  readonly startYear: number | null;
  /** Sezon yılı; açık uçlu dönemde null. */
  readonly endYear: number | null;
  readonly appearances: number | null;
  readonly goals: number | null;
  readonly isLoan: boolean;
}

/**
 * Tanınan bilgi kutusu şablonları.
 *
 * Şablon adı ÖNEMLİ: makale gövdesinde de `[[…]]` bağlantıları ve `|` içeren
 * şablonlar var. Kutuyu yalıtmadan tüm metinde alan aramak, kariyer
 * istatistiği tablolarından ve ikinci bilgi kutularından sahte satır toplar.
 *
 * LİSTE ÖLÇÜLEREK BELİRLENDİ. 471 makalelik korpusta kutusu tanınmayan 6
 * makale tek tek incelendi: 1'i `Infobox soccer biography` kullanıyordu (aynı
 * alan adları, yalnızca farklı şablon adı — listeye eklendi), 4'ünde kariyer
 * kutusu yerine `Infobox person`/`Makam sahibi bilgi kutusu` vardı, 1'inde hiç
 * bilgi kutusu yoktu. Kalan boşluk %1,1 ve okunacak veri içermiyor.
 */
const INFOBOX_NAMES =
  /^(infobox\s+(football|soccer)\s+biography|futbolcu\s+bilgi\s+kutusu)/iu;

/**
 * Alan adı şemaları — dil başına bir tane.
 *
 * ALAN ADLARI TAM EŞLEŞİR, önek olarak aranmaz. §4.3'ün 6. kuralı (altyapı ve
 * millî takım okunmaz) bu sayede kendiliğinden sağlanır: `altyapıkulübü1`,
 * `youthclubs1`, `millitakım1`, `nationalteam1` ve `nationalcaps1` hiçbir
 * şemayla tam eşleşmez, dolayısıyla hiç görünmezler. Toplam satırları
 * (`totalcaps`, `totalgoals`) numarasız oldukları için yine dışarıda kalır.
 */
interface FieldScheme {
  readonly club: string;
  readonly years: readonly string[];
  readonly caps: string;
  readonly goals: string;
}

const SCHEMES: readonly FieldScheme[] = [
  // `kulüpyil` (noktasız ı) editörler arasında yaygın bir varyant; ikisi de
  // kabul edilir, çünkü tanınmayan alan adı hata vermez — sessizce veri
  // kaybettirir.
  { club: "kulüp", years: ["kulüpyıl", "kulüpyil"], caps: "maç", goals: "gol" },
  { club: "clubs", years: ["years"], caps: "caps", goals: "goals" },
];

/** Bağlantı hedefi olarak kabul edilmeyen ad alanları. */
const NON_ARTICLE_NAMESPACE =
  /^(dosya|file|image|resim|kategori|category|şablon|template|s|w|wikt|commons|en|tr):/iu;

const DASH = "[-–—−‒]";

/**
 * Kaynak kariyer satırlarını çıkarır. Bilgi kutusu bulunamazsa boş dizi.
 *
 * Sıra bilgi kutusundaki alan numarasına göredir; wikitext'te alanlar
 * karışık sırada yazılmış olabilir.
 */
export function parseInfoboxSpells(wikitext: string): InfoboxSpell[] {
  const body = findInfobox(wikitext);
  if (body === null) return [];

  const fields = splitFields(body);
  const scheme = pickScheme(fields);
  if (scheme === null) return [];

  const spells: Array<{ index: number; spell: InfoboxSpell }> = [];

  for (const [name, value] of fields) {
    const index = fieldIndex(name, scheme.club);
    if (index === null) continue;

    const clubTitle = parseClubLink(value);
    // Bağlantısız değerler gerçek kayıtlar ("Gamlingay United" gibi maddesi
    // olmayan kulüpler) ama QID'ye çözülemezler. §4.3: çözülemeyen bağlantı
    // ATLANIR, tahmin edilmez.
    if (clubTitle === null) continue;

    const { startYear, endYear } = parseYearRange(
      firstDefined(scheme.years.map((y) => fields.get(`${y}${index}`))) ?? "",
    );

    spells.push({
      index,
      spell: {
        clubTitle,
        startYear,
        endYear,
        appearances: parseTally(fields.get(`${scheme.caps}${index}`)),
        goals: parseTally(fields.get(`${scheme.goals}${index}`)),
        isLoan: looksLikeLoan(value),
      },
    });
  }

  return spells.sort((a, b) => a.index - b.index).map((e) => e.spell);
}

/** Bilgi kutusu şablonunun GÖVDESİNİ döner (adı ve dış ayraçları olmadan). */
export function findInfobox(wikitext: string): string | null {
  const text = stripNoise(wikitext);

  for (let i = text.indexOf("{{"); i !== -1; i = text.indexOf("{{", i + 2)) {
    // Şablon adı: `{{` ile ilk `|` veya satır sonu arasındaki bölüm.
    const head = text.slice(i + 2, i + 80).split(/[|}\n]/u)[0] ?? "";
    if (!INFOBOX_NAMES.test(head.trim())) continue;

    const body = readTemplate(text, i);
    if (body !== null) return body;
  }

  return null;
}

/**
 * `<ref>`, `<!-- -->` ve `<gallery>` gibi gürültüyü atar.
 *
 * Kaynak etiketleri alanları BOZAR: içlerinde `|`, `{{`, `[[` ve dört haneli
 * yıllar geçiyor. Ölçüldü — `maç` alanlarının bir kısmında HTML yorumu var
 * (`| maç3 = 5 <!-- güncelle -->`) ve yıl alanlarına `<ref>` içindeki tarih
 * sızıyordu.
 */
function stripNoise(wikitext: string): string {
  return wikitext
    .replace(/<ref\b[^>]*\/\s*>/giu, "")
    .replace(/<ref\b[^>]*>[\s\S]*?<\/ref\s*>/giu, "")
    .replace(/<!--[\s\S]*?-->/gu, "");
}

/**
 * `openIndex` konumundaki `{{` ile eşleşen `}}` arasını döner.
 *
 * Derinlik sayılır: bilgi kutusu içinde `{{convert|1.79|m}}` gibi iç içe
 * şablonlar var ve ilk `}}` ile durmak kutuyu ortadan keser.
 */
function readTemplate(text: string, openIndex: number): string | null {
  let depth = 0;

  for (let i = openIndex; i < text.length - 1;) {
    if (text[i] === "{" && text[i + 1] === "{") {
      depth++;
      i += 2;
    } else if (text[i] === "}" && text[i + 1] === "}") {
      depth--;
      if (depth === 0) return text.slice(openIndex + 2, i);
      i += 2;
    } else {
      i++;
    }
  }

  // Kapanmamış şablon — bozuk wikitext. Yarısını ayrıştırmaktansa atlamak
  // doğru: eksik kutu, yanlış kutudan iyidir.
  return null;
}

/**
 * Şablon gövdesini `ad → değer` eşlemesine böler.
 *
 * Bölme yalnızca derinlik SIFIRKEN yapılır; `{{…}}` ve `[[…]]` içindeki
 * borular korunur. Aynı ad iki kez geçerse İLKİ kazanır (MediaWiki'nin
 * davranışı bunun tersi ama tekrar eden alan zaten bozuk bir kutudur ve iki
 * seçenek de tahmindir).
 */
function splitFields(body: string): Map<string, string> {
  const parts: string[] = [];
  let current = "";
  let curly = 0;
  let square = 0;

  for (let i = 0; i < body.length; i++) {
    const pair = body.slice(i, i + 2);

    if (pair === "{{" || pair === "[[") {
      if (pair === "{{") curly++;
      else square++;
      current += pair;
      i++;
      continue;
    }
    if (pair === "}}" || pair === "]]") {
      if (pair === "}}") curly--;
      else square--;
      current += pair;
      i++;
      continue;
    }
    if (body[i] === "|" && curly === 0 && square === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += body[i];
  }
  parts.push(current);

  const fields = new Map<string, string>();
  // İlk parça şablon adıdır, alan değildir.
  for (const part of parts.slice(1)) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;

    const name = part.slice(0, eq).trim().toLowerCase();
    if (name.length === 0 || fields.has(name)) continue;

    fields.set(name, part.slice(eq + 1).trim());
  }

  return fields;
}

/**
 * Hangi dil şemasının kullanıldığını sayarak belirler.
 *
 * İki şemayı BİRLİKTE okumak, ikisini de içeren bir kutuda aynı dönemi iki kez
 * sayardı. Sayarak seçmek hem bunu önler hem de ayrıştırıcıyı dilden bağımsız
 * kılar: şablon yönlendirmesi yüzünden İngilizce alan adları kullanan bir
 * Türkçe makale de doğru okunur.
 */
function pickScheme(fields: ReadonlyMap<string, string>): FieldScheme | null {
  let best: FieldScheme | null = null;
  let bestCount = 0;

  for (const scheme of SCHEMES) {
    let count = 0;
    for (const name of fields.keys()) {
      if (fieldIndex(name, scheme.club) !== null) count++;
    }
    if (count > bestCount) {
      best = scheme;
      bestCount = count;
    }
  }

  return best;
}

/** `kulüp8` + önek `kulüp` → 8. Tam eşleşme değilse null. */
function fieldIndex(name: string, prefix: string): number | null {
  if (!name.startsWith(prefix)) return null;

  const rest = name.slice(prefix.length);
  if (!/^\d+$/u.test(rest)) return null;

  return Number.parseInt(rest, 10);
}

function firstDefined(values: readonly (string | undefined)[]): string | null {
  return values.find((v) => v !== undefined) ?? null;
}

/**
 * Yıl aralığını SEZON YILINA çevirir — BR-6.
 *
 * Bilgi kutusundaki yıllar tarih değil, kariyer aralığıdır ve iki ucu farklı
 * okunur. Bardakçı örneği kuralı tek başına gösteriyor:
 *
 *   | kulüpyıl1 = 2011-2022   Konyaspor    → 2011 … 2021 sezonu
 *   | kulüpyıl8 = 2022-       Galatasaray  → 2022 … (devam ediyor)
 *
 * 2022 yazında Konyaspor'dan ayrılıp Galatasaray'a katıldı. Konyaspor'daki SON
 * SEZONU 2021/22, yani sezon yılı 2021'dir. Bitiş ucundan bir çıkarmak,
 * Wikidata'nın yıl hassasiyetli tarihlerine uygulanan kuralın (`seasonYearAt`)
 * aynısıdır — iki kaynak aynı ölçeğe indirgenmezse bir kulüpte hem 2021 hem
 * 2022 biten iki dönem görünür.
 *
 * Sezon gösterimi (`2015–16`) de aynı kuralla doğru sonuca varır: uzatılmış
 * bitiş 2016, bir eksiği 2015 — yani 2015/16 sezonu.
 *
 * TEK YIL (`2014`) bir sezonun kendisidir, ayrılma yılı değil; çıkarma
 * uygulanmaz. Aynı sonuca `toSpell`'deki kenetleme de varır (bitiş
 * başlangıçtan küçükse başlangıca çekilir), o yüzden iki yol tutarlıdır.
 *
 * ÇIKARMA TAHMİN DEĞİL, ÖLÇÜLDÜ. 471 makalelik korpusta belirsizliksiz 589
 * bitiş eşleşmesi karşılaştırıldı:
 *
 *   bir çıkarılmış hâliyle : %95,4 tam uyum
 *   ham hâliyle            : %2,7  tam uyum — kayıtların %95,4'ü tam +1'de
 *
 * Başlangıç ucunda çıkarma YOK ve o da ölçüldü: 624 eşleşmede %96,2 tam uyum.
 */
export function parseYearRange(raw: string): {
  startYear: number | null;
  endYear: number | null;
} {
  const text = stripTemplates(raw);
  const match = new RegExp(
    `(\\d{4})\\s*(?:(${DASH})\\s*(\\d{2,4})?)?`,
    "u",
  ).exec(text);
  if (match?.[1] === undefined) return { startYear: null, endYear: null };

  const startYear = Number.parseInt(match[1], 10);

  // Tire yok → tek sezon.
  if (match[2] === undefined) return { startYear, endYear: startYear };
  // Tire var, bitiş yok → hâlâ kulüpte; bitiş UYDURULMAZ (§2.7).
  if (match[3] === undefined) return { startYear, endYear: null };

  const leaving = expandYear(match[3], startYear);
  return { startYear, endYear: Math.max(leaving - 1, startYear) };
}

/** `2015–16` → 2016, `1999–00` → 2000. Dört haneliyse olduğu gibi. */
function expandYear(raw: string, startYear: number): number {
  const value = Number.parseInt(raw, 10);
  if (raw.length === 4) return value;

  const century = Math.floor(startYear / 100) * 100;
  const expanded = century + value;
  return expanded < startYear ? expanded + 100 : expanded;
}

/**
 * Maç/gol sayısını okur; sayı yoksa null.
 *
 * `?` ve `-` gerçek değerlerdir ve "bilinmiyor" demektir — ölçüldü, İngilizce
 * `caps` alanlarında 9 kez geçiyor. Bunları 0'a çevirmek "hiç oynamadı"
 * iddiası olurdu (§2.7).
 *
 * Akla yatkınlık denetimi (BR-22) BURADA YAPILMAZ: bu modül söz dizimini
 * okur, kuralları birleştirme adımı uygular (`tallies`).
 */
export function parseTally(raw: string | undefined): number | null {
  if (raw === undefined) return null;

  // `{{0}}` hizalama şablonudur; `{{0}}42` gerçekte 42'dir.
  const match = /^\s*(\d+)/u.exec(stripTemplates(raw));
  if (match?.[1] === undefined) return null;

  const value = Number.parseInt(match[1], 10);
  return Number.isFinite(value) ? value : null;
}

/**
 * Kulüp alanındaki İLK bağlantının hedefini döner.
 *
 * `[[Hedef|Gösterilen]]` ve `[[Hedef]]` biçimlerinin ikisi de hedefi verir.
 * Bölüm bağlantısı (`#`) ve alt çizgiler normalleştirilir; ad alanı öneki
 * taşıyan bağlantılar (dosya, kategori) kulüp değildir ve atlanır.
 */
export function parseClubLink(raw: string): string | null {
  for (const match of stripTemplates(raw).matchAll(
    /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/gu,
  )) {
    const target = (match[1] ?? "")
      .replace(/_/gu, " ")
      .replace(/\s+/gu, " ")
      .replace(/^:/u, "")
      .trim();

    if (target.length === 0 || NON_ARTICLE_NAMESPACE.test(target)) continue;
    return target;
  }

  return null;
}

/**
 * Kiralık dönem mi?
 *
 * İKİ İŞARETİN BİRLEŞİMİ, ölçüldü. 1005 İngilizce kulüp satırında 119'unda ok
 * (`→`), 116'sında "(loan)" var; 4'ünde ok var ama not yok, 1'inde not var ama
 * ok yok. Tek işarete bakmak her iki yönde de kayıt kaçırıyor.
 */
export function looksLikeLoan(raw: string): boolean {
  return /→|&rarr;|->/u.test(raw) || /\(\s*(kiral[ıi]k|loan)/iu.test(raw);
}

/** Dengeli `{{…}}` gruplarını atar; bağlantılara dokunmaz. */
function stripTemplates(value: string): string {
  let out = "";
  let depth = 0;

  for (let i = 0; i < value.length; i++) {
    const pair = value.slice(i, i + 2);

    if (pair === "{{") {
      depth++;
      i++;
      continue;
    }
    if (pair === "}}") {
      if (depth > 0) depth--;
      i++;
      continue;
    }
    if (depth === 0) out += value[i];
  }

  return out;
}
