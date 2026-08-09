/**
 * Arma çıkarımı ve lisans sınıflandırması — PROJECT.md §4.3.1, BR-33, BR-34.
 *
 * Bu dosya SAF: ağa çıkmaz, veritabanı görmez. Girdi wikitext ve MediaWiki'nin
 * `imageinfo` künyesi, çıktı "bu armayı kullanabilir miyiz" kararı.
 */

/**
 * Kulüp bilgi kutusu şablonları — beş dil.
 *
 * OYUNCU KUTUSUNDAN AYRI (`infobox.ts`): orada `INFOBOX_NAMES` futbolcu
 * kutularını arıyor. Aynı listeyi genişletmek, oyuncu boru hattının ölçülmüş
 * davranışını (471 makalede %98,9 tanıma) riske atardı.
 */
const CLUB_INFOBOX_NAMES =
  /^(infobox\s+(football|soccer)\s+club|futbol\s+kul[üu]b[üu]\s+bilgi\s+kutusu|bilgi\s+kutusu\s+futbol\s+kul[üu]b[üu]|infobox\s+societ[àa]\s+calcistica|infobox\s+fu[ßs]ballklub|infobox\s+club\s+de\s+football)/iu;

/**
 * Arma taşıyabilecek parametreler — ÖNCELİK SIRASIYLA.
 *
 * Sıra önemli: `logo` ve `crest` armayı adlandırır, `image` ise kutunun genel
 * görsel alanıdır ve bazı makalelerde stadyum fotoğrafı taşır. Ölçümde
 * `pageimages` kullanıldığında tam olarak bu hata çıkmıştı (Aberdeen'de tribün,
 * Pasching'de stadyum); adlandırılmış alanı önce sormak onu eler.
 */
const CREST_PARAMS: readonly string[] = [
  "logo",
  "crest",
  "badge",
  "arma",
  "stemma",
  "wappen",
  "image",
  "resim",
  "immagine",
  "bild",
];

const IMAGE_EXTENSION = /\.(svg|png|jpe?g|gif|webp)$/iu;

/** `[[Dosya:X.svg|120px]]`, `File:X.svg` ya da düz `X.svg` → `X.svg` */
export function fileNameFromValue(raw: string): string | null {
  const text = raw.trim();
  if (text.length === 0) return null;

  const linked =
    /\[\[\s*(?:File|Image|Dosya|Datei|Immagine|Fichier)\s*:\s*([^|\]]+)/iu.exec(
      text,
    );
  let candidate = (linked?.[1] ?? text).trim();

  // Bağlantısız yazımda da ad alanı öneki olabilir: `Dosya:X.svg`.
  const prefixed =
    /^(?:File|Image|Dosya|Datei|Immagine|Fichier)\s*:\s*(.+)$/iu.exec(
      candidate,
    );
  candidate = (prefixed?.[1] ?? candidate).trim();

  if (!IMAGE_EXTENSION.test(candidate)) return null;
  // Şablon ya da bağlantı kalıntısı varsa değer güvenilir değil; UYDURULMAZ.
  if (/[[\]{}<>]/u.test(candidate)) return null;

  return candidate.replace(/_/gu, " ");
}

/**
 * Kulüp bilgi kutusunun gövdesini döner (adı ve dış ayraçları olmadan).
 *
 * Ayraç sayarak okunur: iç içe şablonlar (`{{nobr|…}}`) yüzünden ilk `}}`
 * gövdenin sonu olmayabilir.
 */
export function findClubInfobox(wikitext: string): string | null {
  for (
    let i = wikitext.indexOf("{{");
    i !== -1;
    i = wikitext.indexOf("{{", i + 2)
  ) {
    const head = wikitext.slice(i + 2, i + 80).split(/[|}\n]/u)[0] ?? "";
    if (!CLUB_INFOBOX_NAMES.test(head.trim())) continue;

    let depth = 0;
    for (let j = i; j < wikitext.length - 1; j++) {
      if (wikitext.startsWith("{{", j)) {
        depth++;
        j++;
      } else if (wikitext.startsWith("}}", j)) {
        depth--;
        if (depth === 0) return wikitext.slice(i + 2, j);
        j++;
      }
    }
  }
  return null;
}

/**
 * Bilgi kutusundan arma dosya adını çıkarır.
 *
 * BİLGİ KUTUSU YOKSA `null` — makalenin tamamı taranMAZ. Ölçüldü: tüm metinde
 * arama yapmak stadyum ve tarihî fotoğrafları arma sanıyor. "Arma bulunamadı",
 * yanlış bir arma göstermekten iyidir (§2.7).
 */
export function extractCrestFile(wikitext: string): string | null {
  const infobox = findClubInfobox(wikitext);
  if (infobox === null) return null;

  for (const param of CREST_PARAMS) {
    const pattern = new RegExp(`\\|\\s*${param}\\s*=\\s*([^\\n|}]+)`, "iu");
    const match = pattern.exec(infobox);
    if (match?.[1] === undefined) continue;

    const file = fileNameFromValue(match[1]);
    if (file !== null) return file;
  }

  return null;
}

/**
 * ARMA OLMADIĞI KESİN olan dosyalar.
 *
 * ÖLÇÜLMÜŞ HATA (§4.3.1): ilk koşuda bilgi kutusunun genel `image` alanı ve
 * Commons kategorisi arma yerine başka görseller getirdi —
 *
 *   1. FK Příbram    → Stadion Na Litavce2.jpg
 *   Bolton Wanderers → Alf Farman.jpg            (bir oyuncu portresi)
 *   Athletic Bilbao  → Kit socks …logo.png       (forma çorabı)
 *   Cagliari         → IMG Logo del Trofeo Gigi Riva.jpg
 *
 * Son ikisi adında "logo" geçtiği için sözcük süzgecinden geçiyordu; bu yüzden
 * ayrı bir RET listesi gerekiyor.
 */
const NOT_A_CREST =
  /stadi(on|um|o|e)|arena|kit\s|socks|shirt|jersey|forma|trofe|troph|coat\s+of\s+arms|panorama|aerial|luftbild|tribün|tribune|maç|match|squadra|team\s+photo|kadro/iu;

/**
 * Adında armaya işaret eden sözcük geçen dosyalar — İKİ SINIF.
 *
 * UZUN VE AYIRT EDİCİ olanlar kelime içinde de eşleşebilir: dosya adları
 * sıkışık yazılıyor (`BaltykaFCLogo2018.png`) ve sınır şartı bunları elerdi.
 *
 * KISA olanlar SINIR İSTER. Ölçülmüş hata: `arma` sınırsızken "Alf F**arma**n"
 * (bir oyuncu portresi) arma sayıldı, `badge` sınırsızken Fulham'ın maskotu
 * "Billy the B**adge**r" geçti. İkisi de veritabanına yazılmıştı.
 */
const CREST_WORD_LOOSE = /logo|crest|stemma|wappen|escudo|emblem/iu;
const CREST_WORD_STRICT = /\b(badge|arma|amblem)\b/iu;

/**
 * Bu dosya gerçekten bir arma olabilir mi?
 *
 * İKİ KOŞULDAN BİRİ yeter: adında armaya işaret eden bir sözcük geçmesi ya da
 * kulüp adıyla ortak bir belirteç taşıması. Ret listesi ikisini de geçersiz
 * kılar — "Trofeo … Logo" adındaki dosya sözcük süzgecinden geçiyor ama arma
 * değil.
 *
 * YANLIŞ ARMA, BOŞ ARMADAN KÖTÜDÜR (§2.7): süzgeç birkaç doğru armayı da
 * eleyecek (kısaltmayla adlandırılmış dosyalar gibi), bu bilinçli bir takas.
 */
export function isPlausibleCrest(fileName: string, clubName: string): boolean {
  if (NOT_A_CREST.test(fileName)) return false;
  if (CREST_WORD_LOOSE.test(fileName) || CREST_WORD_STRICT.test(fileName)) {
    return true;
  }

  const fileTokens = significantTokens(fileName);
  return significantTokens(clubName).some((token) =>
    fileTokens.some((other) => other.includes(token) || token.includes(other)),
  );
}

/** Karşılaştırılabilir belirteçler: aksansız, küçük harfli, en az 4 karakter. */
function significantTokens(text: string): string[] {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, " ")
    .split(" ")
    .filter((token) => token.length >= 4 && !GENERIC_TOKENS.has(token));
}

/** Neredeyse her kulüpte geçen sözcükler — ayırt edici değil. */
const GENERIC_TOKENS = new Set([
  "spor",
  "kulubu",
  "club",
  "clube",
  "futbol",
  "football",
  "calcio",
  "fussball",
  "sport",
  "sportif",
  "sporting",
  "united",
  "city",
  "real",
  "atletico",
  "logo",
  "crest",
  "badge",
  "svg",
  "png",
  "jpeg",
  "team",
  "fotboll",
  "voetbal",
]);

/** MediaWiki `imageinfo` künyesinin ihtiyacımız olan kısmı. */
export interface FileMetadata {
  /**
   * Dosya COMMONS'ta var mı?
   *
   * Künye Commons'a sorularak alınır, kaynak vikiye değil. Sebep: özgürlük
   * garantisi tam olarak budur — Commons yalnızca her iki ülkede de özgür
   * dosyaları barındırır. Adil kullanım dosyaları oraya hiç giremez, dolayısıyla
   * "Commons'ta yok" cevabı "kullanamayız" ile eş anlamlıdır.
   */
  readonly existsOnCommons: boolean;
  readonly licenseShortName: string | null;
  readonly artist: string | null;
  readonly attributionRequired: boolean;
  readonly nonFree: boolean;
}

export interface CrestAttribution {
  readonly license: string;
  readonly author: string | null;
  readonly filePage: string;
}

/**
 * YEREL vikideki bir dosyanın künyesi — yalnızca denetim için (§4.3.1).
 *
 * `FileMetadata`'dan ayrı tutuluyor çünkü SORU FARKLI. Orada soru "bu dosyayı
 * kullanabilir miyiz"; burada "Commons'ta olmayan bu dosya NEDEN orada değil".
 * İkisini tek tipte birleştirmek, ikinci sorunun cevabının birinciye sızmasına
 * ve BR-33'ün sessizce gevşemesine yol açardı.
 */
export interface LocalFileMetadata {
  readonly exists: boolean;
  /** `imagerepository === "shared"` — dosya aslında Commons'ta. */
  readonly onCommons: boolean;
  readonly licenseShortName: string | null;
  /** Makine okunur lisans kodu (`pd`, `cc-by-sa-4.0`, `fair use`). */
  readonly license: string | null;
  readonly usageTerms: string | null;
  readonly artist: string | null;
  readonly attributionRequired: boolean;
  readonly nonFree: boolean;
  readonly copyrighted: string | null;
  readonly restrictions: string | null;
}

/**
 * Bir yerel dosyanın Commons dışında kalma SEBEBİ.
 *
 * `belirsiz` kasten var: künyesi bu dört kovaya oturmayan dosyayı özgür
 * SAYMAK, kanıtlamadığımız bir şeyi varsaymak olurdu. Denetim bunları ayrı
 * listeler ve ham etiketlerini basar — karar veriye bakılarak verilir.
 */
export type LocalFileVerdict =
  | "commons" // aslında Commons'ta; adres yönlendirme ardında kalmış
  | "adil-kullanım" // NonFree işaretli — telifli, yeniden kullanılamaz
  | "yalnızca-ABD" // künyesi ABD kısıtını AÇIKÇA söylüyor
  | "özgür-görünüyor" // künye özgür diyor ama KANIT DEĞİL — aşağıya bakın
  | "yok" // dosya yerel vikide de yok
  | "belirsiz";

/** Künyede AÇIKÇA görünen ABD kısıtı. */
const US_ONLY = /united\s+states|\bus\b[\s-]*only|usonly/iu;

/** Özgür sayılan lisans kodlarının kökü. */
const FREE_LICENSE = /^(pd|cc0|cc-by(-sa)?(-\d|$)|cc-sa|gfdl|fal|ogl)/iu;

/**
 * Yerel dosya neden Commons'ta değil?
 *
 * SIRA ÖNEMLİ. `onCommons` en başta: bu bir ret sebebi değil, bizim arama
 * hatamızdır. `nonFree` ondan hemen sonra gelir — ABD kısıtı taşıyan bir dosya
 * AYNI ZAMANDA adil kullanım olabilir ve o durumda ağır olan kazanır.
 *
 * "ÖZGÜR-GÖRÜNÜYOR" BİR İZİN DEĞİL, BİR SORU İŞARETİDİR.
 *
 * ÖLÇÜLMÜŞ HATA (§4.3.1). İlk yazımda bu kova "özgür" adını taşıyordu ve
 * doğrudan kullanılabilir sayılıyordu. Ölçüm bunu çürüttü: `extmetadata`,
 * dünya çapında kamu malı olan bir dosya ile YALNIZCA ABD'de kamu malı olanı
 * AYIRT EDEMİYOR. `{{PD-ineligible-USonly}}` de düz `{{PD}}` de aynı üç alanı
 * üretiyor —
 *
 *   LicenseShortName: "PD" · UsageTerms: "Public domain" · Copyrighted: "False"
 *
 * Ayrım yalnızca dosya sayfasının şablon metninde ("Do not copy this file to
 * Wikimedia Commons", "non-free … in its home country"). Bu kovaya düşen 7
 * dosya elle denetlendi: 5'i ABD'ye özgüydü, 2'si gerçekten özgürdü. Yani
 * künyeye bakıp otomatik karar verilseydi 5 telifli dosya sitede olurdu.
 *
 * Bu yüzden karar burada BİTMEZ; kova insanın bakması için ayrılır.
 */
export function classifyLocalFile(meta: LocalFileMetadata): LocalFileVerdict {
  if (!meta.exists) return "yok";
  if (meta.onCommons) return "commons";
  if (meta.nonFree) return "adil-kullanım";

  const short = meta.licenseShortName ?? "";
  const terms = meta.usageTerms ?? "";
  if (US_ONLY.test(short) || US_ONLY.test(terms)) return "yalnızca-ABD";

  const code = meta.license ?? "";
  if (FREE_LICENSE.test(code) || meta.copyrighted === "False") {
    return "özgür-görünüyor";
  }

  return "belirsiz";
}

/**
 * BR-33 — bu dosya kullanılabilir mi?
 *
 * YALNIZCA COMMONS'TAKİLER. Bir Vikipedi'ye yüklenmiş yerel dosyalar iki
 * sebepten yerel olur: ya adil kullanımdır (yeniden kullanım hakkı yok), ya da
 * yalnızca ABD'de özgürdür — Commons her iki ülkede de özgür olmasını şart
 * koşar. İkincisi "biraz özgür" değil; kaynak ülkesinde hâlâ telifli demek ve
 * sitemiz dünyaya açık.
 *
 * Ölçüldü (§4.3.1): 80 dosyanın 69'u yerel, bunların 67'si açıkça adil kullanım
 * işaretli. Yani yerel dosyaları elemek neredeyse tamamen adil kullanımı elemek
 * demek.
 *
 * `nonFree` denetimi Commons'ta ATIL kalmalı (oraya adil kullanım giremez) ve
 * kasten duruyor: sözleşme değişip künye başka bir vikiden okunursa kural
 * sessizce delinmesin.
 */
export function isUsableFile(meta: FileMetadata): boolean {
  return meta.existsOnCommons && !meta.nonFree;
}

/**
 * BR-34 — atıf künyesi. Zorunlu atıf varsa yazar da olmalı.
 *
 * `null` dönerse arma KULLANILMAZ. Eksik künyeyle göstermek, lisansın tek
 * koşulunu çiğnemek olurdu; "arma boş kalsın" sonucu buna yeğdir.
 */
export function toAttribution(
  fileName: string,
  meta: FileMetadata,
): CrestAttribution | null {
  const license = meta.licenseShortName?.trim() ?? "";
  if (license.length === 0) return null;

  const author = cleanAuthor(meta.artist);
  if (meta.attributionRequired && author === null) return null;

  return {
    license,
    author,
    filePage: commonsFilePage(fileName),
  };
}

/**
 * KENDİ ürettiğimiz arma adresinden dosya adını geri çözer.
 *
 * NEDEN GEREKLİ: armalar Faz 4'te künyesiz yüklendi ve elimizde yalnızca adres
 * var. Künyeyi tamamlamak için dosya adına ihtiyaç duyuluyor; adresi yeniden
 * üreten şema (`commonsFileUrl`) tersine çevrilebilir.
 *
 *   .../commons/d/d0/Logo_of_AC_Milan.svg              → Logo of AC Milan.svg
 *   .../commons/thumb/a/ab/X.png/120px-X.png           → X.png
 */
export function fileNameFromCrestUrl(url: string): string | null {
  const marker = "/wikipedia/commons/";
  const at = url.indexOf(marker);
  if (at === -1) return null;

  const path = url.slice(at + marker.length);
  const segments = path.split("/").filter((s) => s.length > 0);

  // Küçük resim yolunda son parça `120px-Ad.png`, asıl ad bir öncekidir.
  const isThumb = segments[0] === "thumb";
  const wanted = isThumb ? segments.at(-2) : segments.at(-1);
  if (wanted === undefined) return null;

  try {
    const name = decodeURIComponent(wanted).replaceAll("_", " ").trim();
    return name.length === 0 ? null : name;
  } catch {
    return null;
  }
}

/** Dosya sayfası — lisansın tam metnine giden tek kararlı adres. */
export function commonsFilePage(fileName: string): string {
  return `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(
    fileName.replaceAll(" ", "_"),
  )}`;
}

/**
 * `Artist` alanı HTML taşır (`<a href=…>Ad</a>`, `<p>…</p>`).
 *
 * Etiketler SÖKÜLÜR, kaçırılmaz: bu değer arayüzde metin olarak gösterilecek
 * ve ham HTML'i React zaten basmaz — ama saklamak da yanlış olurdu, veri
 * sunuma özgü işaretleme taşımamalı.
 */
export function cleanAuthor(raw: string | null): string | null {
  if (raw === null) return null;

  const text = raw
    .replace(/<[^>]*>/gu, " ")
    .replace(/&amp;/gu, "&")
    .replace(/&quot;/gu, '"')
    .replace(/&#39;/gu, "'")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&nbsp;/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();

  if (text.length === 0) return null;
  // Aşırı uzun künye bir yazar adı değil, bir lisans metnidir; kırpılır.
  return text.length > 120 ? `${text.slice(0, 117)}…` : text;
}
