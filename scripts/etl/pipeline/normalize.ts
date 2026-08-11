import { toSearchKey } from "../../../src/domain/value-objects/search-key";
import { toSeasonYear } from "../../../src/domain/value-objects/season";
import { OUT_OF_SCOPE_GENDER_QIDS, WD } from "../leagues";
import { int, qid, str, type SparqlBinding } from "../sources/wikidata/schemas";
import { toCommonsFileUrl } from "./crest-url";

/**
 * Ham Wikidata bağlamalarını veritabanına yazılabilir kayıtlara çevirir.
 *
 * Buradaki her fonksiyon SAFTIR (ağ yok, veritabanı yok) — bu sayede
 * `tests/unit/etl/normalize.test.ts` içinde doğrudan test edilebilirler
 * (PROJECT.md §8.1).
 */

export interface NormalizedClub {
  wikidataId: string;
  name: string;
  shortName: string;
  searchKey: string;
  country: string | null;
  foundedYear: number | null;
  crestUrl: string | null;
  /** Kulübün bulunduğu hedef lig; hedef ligler dışındaysa null. */
  leagueWikidataId: string | null;
}

export interface NormalizedPlayer {
  wikidataId: string;
  name: string;
  searchKey: string;
  birthDate: Date | null;
  /**
   * BR-38 ile SEÇİLMİŞ futbol uyruğu. `applyPlayerStats` doldurur — seçim
   * millî takımı gerektirir ve o bilgi ayrı bir sorgudan gelir.
   */
  nationality: string | null;
  /** Ham vatandaşlıklar (`P27`) — BR-38'in girdisi; tekil ve sıralı. */
  citizenships: readonly string[];
  /** Doğum ülkesi (`P19` → `P17`) — BR-38'in üçüncü kademesi. */
  birthCountry: string | null;
  position: string | null;
  /**
   * Wikidata `P21` QID'i, kayıt yoksa null. Yalnızca veri kümesini erkek
   * liglerine sınırlamak için okunur (bkz. `OUT_OF_SCOPE_GENDER_QIDS`);
   * veritabanına yazılmaz ve arayüzde gösterilmez.
   */
  genderQid: string | null;

  /** §9.2 — ayrı bir sorgudan gelir, `toPlayer` bunları doldurmaz. */
  nationalCaps: number | null;
  heightCm: number | null;
  weightKg: number | null;
}

export interface NormalizedSpell {
  wikidataStatementId: string;
  playerWikidataId: string;
  clubWikidataId: string;
  startYear: number | null;
  endYear: number | null;
  isCurrent: boolean;
  isLoan: boolean;
  isYouth: boolean;
  appearances: number | null;
  goals: number | null;
  /**
   * BR-22 — gol sayısı maç sayısını aştığı için DÜŞÜRÜLEN değer.
   *
   * Normalizasyon anında karar verilemez çünkü ikinci kaynak (Vikipedi)
   * henüz okunmamıştır. Değer burada saklanır, kararı birleştirme sonrası
   * `resolveDisputedTallies` verir. Veritabanına YAZILMAZ.
   */
  disputedGoals?: number | null;
  /**
   * Golün tartışmalı sayıldığı ANDAKİ maç sayısı.
   *
   * Doğrulama bu ÇİFTE bakar. Yalnızca gole bakmak yetmez: birleştirme maç
   * sayısını Vikipedi'ninkiyle ezebiliyor ve o durumda "iki kaynak mutabık"
   * sessizce "tek kaynak kendini doğruluyor"a dönüşürdü.
   */
  disputedAppearances?: number | null;
}

// Arama anahtarı domain'de tanımlıdır: aynı normalizasyonu ETL yazarken,
// repository ararken kullanır. İkisi ayrışırsa arama sessizce boş döner.
export { toSearchKey };

/** Kulüp adından yaygın hukuki/kurumsal ekleri atar. */
const CLUB_SUFFIXES =
  /\s+(spor\s+kul[üu]b[üu]|futbol\s+kul[üu]b[üu]|s\.?\s?k\.?|f\.?\s?c\.?|a\.?\s?f\.?\s?c\.?|f\.?\s?k\.?|c\.?\s?f\.?|a\.?\s?c\.?|s\.?\s?c\.?|b\.?\s?k\.?|u\.?\s?s\.?|calcio|1\d{3})$/i;
const CLUB_PREFIXES = /^(fc|ac|as|ss|ssc|sv|vfl|vfb|tsg|rc|cd|ud|sd|afc)\s+/i;

/**
 * Gösterim için kısa kulüp adı: "Galatasaray Spor Kulübü" → "Galatasaray".
 *
 * Sadeleştirme adı boşaltacaksa özgün ad korunur — "FC Barcelona" gibi
 * adlarda ön eki atmak bazen geriye anlamlı bir şey bırakmaz.
 */
export function toShortName(fullName: string): string {
  const trimmed = fullName.trim();

  let short = trimmed.replace(CLUB_SUFFIXES, "").trim();
  const withoutPrefix = short.replace(CLUB_PREFIXES, "").trim();
  if (withoutPrefix.length >= 3) short = withoutPrefix;

  return short.length >= 3 ? short : trimmed;
}

/**
 * Yedek takım / altyapı tespiti.
 *
 * Bu takımlar ayrı Wikidata varlıklarıdır ve "A takımında oynadı" sayılmaz
 * (BR-2). Ad kalıbına bakmak kusursuz değil ama pratikte iyi çalışıyor.
 *
 * `II` VE TEK HARFLİK `B` EKLERİ ÇIKARILDI — ölçüldü. Kalıp yedek takım
 * geleneğini (`Ajax II`, `Barcelona B`) hedefliyordu, ama tek başına bir ad
 * ekiyle hükümdar adını ayırt edemiyor: 992 kulübün TAMAMI tarandığında
 * kalıba takılan tek kulüp **Willem II** çıktı — Eredivisie kulübü, yedek
 * takım değil. Sonucu ağırdı: 510 dönemin hepsi altyapı sayıldığı için kulüp
 * her modda sıfır sonuç veriyordu (BR-2 altyapıyı elediği için).
 *
 * Aynı tarama gerçek yedek takım sayısını da verdi: **sıfır**. Kulüp evreni
 * lig üyeliğinden geliyor ve yedek takımlar bu liglerde yok. Yani çıkarılan
 * iki dal bu veri kümesinde hiçbir doğru eşleşme üretmiyordu.
 *
 * Yedek takımlar ileride evrene girerse (§10.2) ad kalıbı YETMEZ: doğru
 * ayrım "eki atınca geriye kalan ad başka bir kulübe ait mi" sorusudur ve
 * bu, kulüp evreninin tamamını görmeyi gerektirir.
 */
export function looksLikeYouthOrReserve(name: string): boolean {
  return /\b(u-?\d{2}|under-?\d{2}|youth|academy|reserves?|altyap[ıi]|genç(ler)?|[AB]\s*tak[ıi]m[ıi])\s*$/iu.test(
    name.trim(),
  );
}

/** Wikidata ISO tarihini Date'e çevirir; ayrıştırılamazsa null. */
export function parseWikidataDate(value: string | undefined): Date | null {
  if (value === undefined) return null;

  // Wikidata bilinmeyen ayı/günü "00" olarak verebilir: "1998-00-00T00:00:00Z"
  const normalized = value.replace(/-00/g, "-01");
  const date = new Date(normalized);

  return Number.isNaN(date.getTime()) ? null : date;
}

/** Tarihi sezon yılına indirger (BR-6). Tarih yoksa null — uydurulmaz. */
export function toSeasonYearOrNull(value: string | undefined): number | null {
  const date = parseWikidataDate(value);
  return date === null ? null : toSeasonYear(date);
}

/**
 * Tek bir dönemde akla yatkın en yüksek maç/gol sayısı — BR-22.
 *
 * Boy/kilo aralıklarıyla aynı gerekçe (§2.7): ölçülerek yanlış olduğu görülen
 * bir değeri göstermek, "bilinmiyor" demekten kötüdür. Sınır tahmin değil,
 * veriden okundu — sıralamada 1987 ile 770 arasında açık bir uçurum var:
 *
 *   5000  Renaldo Lopes da Cruz @ Las Palmas   ← iki yıllık dönem, imkânsız
 *   1987  Paolo Maldini @ Milan                ← maç sayısı değil, KATILIŞ YILI
 *   ────────────────────────────────────────── sınır
 *    770  John Trollope @ Swindon Town         ← gerçek İngiltere rekoru
 *    764  Jimmy Dickinson @ Portsmouth
 *
 * Gollerde de aynı kalıp var (5603, 5509, 2000, 1817 — hepsi yıl kılıklı).
 * En yüksek GERÇEK değer Messi'nin Barcelona'daki 474'ü, yani 1000 sınırı
 * hiçbir gerçek kaydı kesmiyor.
 */
export const MAX_SPELL_TALLY = 1000;

/** Wikidata zaman hassasiyeti: 9 = yıl, 10 = ay, 11 = gün. */
export const PRECISION_YEAR = 9;
export const PRECISION_MONTH = 10;

/**
 * Dönemin ucu hangi anlama geliyor — kural yönü buna bağlı.
 */
export type SpellBoundary = "start" | "end";

/**
 * Hassasiyete duyarlı sezon yılı — PROJECT.md BR-6.
 *
 * NEDEN AYRI BİR KURAL. Wikidata tarihlerin %93,7'sini YIL hassasiyetinde
 * tutuyor ve WDQS bunları `YYYY-01-01` diye normalleştiriyor. Bu tarihi
 * olduğu gibi sezon kuralından geçirmek Ocak'ı bir önceki sezona yazar; yani
 * "2025'te katıldı" bilgisi 2024 sezonu olarak kaydedilirdi. Ölçülen belirti:
 * Šeško'nun kaydı kendi içinde çelişiyordu — Leipzig 2022–2025 ve Manchester
 * United 2024'ten itibaren.
 *
 * Yıl hassasiyetinde iki uç ZITTIR ve bu bir varsayım değil, Avrupa futbol
 * takviminin sonucudur:
 *
 *   başlangıç "2025" → 2025/26 sezonu   → 2025   (yaz transferi)
 *   bitiş     "2025" → 2024/25 sezonunun sonu → 2024
 *
 * Ay ve gün hassasiyetinde gerçek tarih bilindiği için normal sezon kuralı
 * (BR-6) doğrudur ve olduğu gibi uygulanır. Yıldan kaba hassasiyet (on yıl,
 * yüzyıl) bir sezona indirgenemez; UYDURULMAZ, null döner (§2.7).
 */
export function seasonYearAt(
  value: string | undefined,
  precision: number | undefined,
  boundary: SpellBoundary,
): number | null {
  const date = parseWikidataDate(value);
  if (date === null) return null;

  if (precision === undefined || precision > PRECISION_YEAR) {
    // Ay/gün biliniyor (veya hassasiyet bildirilmemiş): normal kural.
    return toSeasonYear(date);
  }

  if (precision < PRECISION_YEAR) return null;

  const year = date.getUTCFullYear();
  return boundary === "start" ? year : year - 1;
}

/**
 * `.../statement/Q161089-AD66DA21-...` → `Q161089-AD66DA21-...`
 *
 * Bu kimlik Spell'in doğal anahtarıdır; biçim beklenmedikse kayıt atlanır.
 */
export function statementIdFromUri(uri: string | undefined): string | null {
  if (uri === undefined) return null;

  const last = uri.split("/").pop();
  return last !== undefined && last.length > 0 ? last : null;
}

/**
 * Mevki etiketi → sabit Türkçe küme.
 *
 * SIRA ANLAMLIDIR: ilk eşleşen kazanır. "attacking midfielder" hem `midfield`
 * hem `attack` içerir; orta saha kalıbı önce geldiği için doğru sonucu verir.
 *
 * KALIPLAR ÖLÇÜLEREK GENİŞLETİLDİ. İlk sürüm 76.358 oyuncunun 19.897'sini
 * (%26) eşleyemiyordu ve bunlar ham etiketle veritabanına giriyordu:
 * `savunma` 14.905, `wing half` 4.346, `attacker` 646. Türkçe Wikidata
 * etiketleri (`savunma`) ve tarihsel İngiliz mevkileri (`wing half`,
 * `centre half`) hesaba katılmamıştı.
 *
 * `back` KELİMESİ SINIRLARIYLA ARANIR. Sınırsız bir `back` kalıbı
 * "half-back"i de yakalar ve onu yanlış sıraya sokardı; `(^|\s)back(\s|$)`
 * yalnızca tek başına duran "back" etiketini eşler.
 */
/**
 * `position` alanının alabileceği DEĞERLERİN TAMAMI (`null` dışında).
 *
 * Dışa aktarılıyor çünkü `db:verify` bunu denetliyor: kural gevşetilir ya da
 * yeni bir etiket sızarsa, kabul kontrolü veri yenilendiği anda patlar. Kuralın
 * kodda doğru olması yetmez — üretilen VERİNİN ona uyduğu ölçülmelidir (§8.2).
 */
export const POSITIONS: readonly string[] = [
  "Kaleci",
  "Defans",
  "Orta saha",
  "Kanat",
  "Forvet",
];

const POSITION_MAP: ReadonlyArray<readonly [RegExp, string]> = [
  [/goalkeeper|kaleci|portero|goalie/i, "Kaleci"],
  [/sweeper|libero/i, "Defans"],

  // "centre half" ORTA SAHA DEĞİL. 2-3-5 dizilişinde half-back'ler orta hattı
  // kurardı; WM dizilişiyle birlikte merkezdeki oyuncu stopere çekildi ve
  // "centre half" bugünkü anlamıyla stoperi anlatır. Aşağıdaki "half" kuralının
  // ÖNÜNDE durmak zorunda, yoksa orta sahaya düşer.
  [/(centre|center)[\s-]?half/i, "Defans"],

  // Kanattaki half-back'ler ise orta saha oyuncusuydu. 4.346 oyuncu bu
  // etiketi taşıyor ve ilk sürümde hiç eşlenmiyordu.
  [/(wing|left|right)[\s-]?half|half[\s-]?back/i, "Orta saha"],

  [
    /(centre|center|full|wing|left|right)[\s-]?back|(^|\s)back(\s|$)|defender|defans|savunma|defensa|bek|stoper|stopper/i,
    "Defans",
  ],
  [/midfield|orta saha|orta oyuncu|oyun kurucu|playmaker|medio/i, "Orta saha"],
  [/winger|kanat|(left|right)[\s-]?wing/i, "Kanat"],
  [/striker|forward|attacker|forvet|santrfor|delantero/i, "Forvet"],
];

/**
 * Mevki etiketini sabit bir Türkçe kümeye eşler; TANINMAZSA `null`.
 *
 * NEDEN HAM ETİKETE DÜŞÜLMÜYOR (davranış değişti). Eski sürüm tanımadığı
 * etiketi olduğu gibi geçiriyordu ve Wikidata'nın `P413` alanı yalnızca futbol
 * mevkisi taşımıyor. Veri kümesinde ölçülen değerler arasında şunlar vardı:
 *
 *   "İçişleri Bakanlığı (İngiltere)", "yardımcı koç", "kadın",
 *   "Iván Luquetta", "Q114044295", "Todas las Sangres",
 *   "wicket-keeper", "fly-half", "prop", "lock", "smaçör", "pasör"
 *
 * Yani bir bakanlık, bir kişi adı, çözülememiş bir QID, bir roman, kriket,
 * ragbi, voleybol ve hentbol mevkileri. Bunlar "belirsiz veri" değil YANLIŞ
 * veridir; kullanıcıya bir futbolcunun mevkisi diye gösterilemez.
 *
 * §2.7'nin "belirsizlik veri kaybından iyidir" kuralıyla çelişmiyor: o kural
 * ölçülemeyen bir şeyi UYDURMAYI yasaklar. Burada yapılan, ölçülerek yanlış
 * olduğu görülen bir değeri "bilinmiyor" diye işaretlemektir — `isCurrent`
 * alanının kaldırılmasıyla aynı gerekçe (§6.2).
 */
export function normalizePosition(label: string | undefined): string | null {
  if (label === undefined || label.trim().length === 0) return null;

  for (const [pattern, turkish] of POSITION_MAP) {
    if (pattern.test(label)) return turkish;
  }
  return null;
}

/** ISO 3166-1 alpha-2 biçimini doğrular ("TR", "GB"). */
export function normalizeCountryCode(code: string | undefined): string | null {
  if (code === undefined) return null;

  const upper = code.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(upper) ? upper : null;
}

/** Etiket, QID'e düşmüşse (etiket servisi çözemediyse) kullanılmaz. */
function usableLabel(label: string | undefined, id: string): string | null {
  if (label === undefined) return null;

  const trimmed = label.trim();
  return trimmed.length > 0 && trimmed !== id ? trimmed : null;
}

export function toClub(
  binding: SparqlBinding,
  leagueWikidataId: string | null,
): NormalizedClub | null {
  const id = qid(binding, "club");
  if (id === undefined) return null;

  const name = usableLabel(str(binding, "clubLabel"), id);
  if (name === null) return null; // adsız kulüp gösterilemez

  const inception = parseWikidataDate(str(binding, "inception"));

  return {
    wikidataId: id,
    name,
    shortName: toShortName(name),
    searchKey: toSearchKey(name),
    country: normalizeCountryCode(str(binding, "countryCode")),
    foundedYear: inception === null ? null : inception.getUTCFullYear(),
    crestUrl: toCommonsFileUrl(str(binding, "logo") ?? null),
    leagueWikidataId,
  };
}

export function toPlayer(binding: SparqlBinding): NormalizedPlayer | null {
  const id = qid(binding, "player");
  if (id === undefined) return null;

  const name = usableLabel(str(binding, "playerLabel"), id);
  if (name === null) return null;

  const citizenship = normalizeCountryCode(str(binding, "countryCode"));

  return {
    wikidataId: id,
    name,
    searchKey: toSearchKey(name),
    birthDate: parseWikidataDate(str(binding, "dob")),
    // BR-38: seçim `applyPlayerStats`'ta yapılır, millî takım oraya kadar
    // bilinmiyor. Burada yalnızca ham girdi toplanır.
    nationality: null,
    citizenships: citizenship === null ? [] : [citizenship],
    birthCountry: normalizeCountryCode(str(binding, "birthCountryCode")),
    position: normalizePosition(str(binding, "positionLabel")),
    genderQid: qid(binding, "gender") ?? null,
    // Ayrı sorgulardan gelir; `applyPlayerStats` doldurur.
    nationalCaps: null,
    heightCm: null,
    weightKg: null,
  };
}

/**
 * Bağlamaları OYUNCU BAŞINA TEK kayda indirir — §5.3.1'in kusurunun onarımı.
 *
 * `playerDetails` oyuncu başına birden çok satır döndürür, çünkü `P27`
 * (vatandaşlık) ve `P413` (mevki) çok değerlidir. Eski kod her satırı ayrı
 * bir kayıt yapıp diziye ekliyordu; yükleyici `wikidataId`'ye göre upsert
 * ettiği için SONUNCUSU kazanıyordu. Hangisinin kazanacağını hiçbir kural
 * seçmiyordu — Messi'nin üç vatandaşlığından `ES` kalıp onu İspanyol yapıyordu.
 *
 * Şimdi vatandaşlıklar TOPLANIYOR ve seçim BR-38'e bırakılıyor. Diğer alanlar
 * için ilk dolu değer korunur: aynı oyuncunun satırları arasında ad, doğum
 * tarihi ve cinsiyet zaten aynıdır; mevkide ise seçim yapılmıyor (ayrı bir
 * kusur sınıfı, §10.2'ye yazıldı).
 */
export function playersFrom(
  bindings: readonly SparqlBinding[],
): NormalizedPlayer[] {
  const byId = new Map<string, NormalizedPlayer>();

  for (const binding of bindings) {
    const player = toPlayer(binding);
    if (player === null) continue;

    const existing = byId.get(player.wikidataId);
    if (existing === undefined) {
      byId.set(player.wikidataId, player);
      continue;
    }

    byId.set(player.wikidataId, {
      ...existing,
      citizenships: [
        ...new Set([...existing.citizenships, ...player.citizenships]),
      ].sort(),
      birthCountry: existing.birthCountry ?? player.birthCountry,
      position: existing.position ?? player.position,
      birthDate: existing.birthDate ?? player.birthDate,
      genderQid: existing.genderQid ?? player.genderQid,
    });
  }

  return [...byId.values()];
}

/**
 * BR-38 — futbol uyruğu, hukuki vatandaşlık değil.
 *
 * SIRA KEYFÎ DEĞİL, ÖLÇÜLDÜ (§5.3.1). Üç sinyalin hiçbiri tek başına
 * yetmiyor:
 *
 *   vatandaşlık  → Messi İspanyol, Icardi İtalyan   (keyfî: son satır kazanır)
 *   doğum ülkesi → Thiago Motta Brezilyalı          (oysa İtalya'da oynadı)
 *   MİLLÎ TAKIM  → ikisi de doğru
 *
 * Çünkü sorulan şey zaten futbol uyruğudur. Millî takımı olmayanlarda doğum
 * ülkesi ikinci kademe; o da ayırmıyorsa alfabetik sıra ALINIR ama doğru
 * olduğu İDDİA EDİLMEZ — amacı yalnızca sonucun her koşuda aynı çıkmasıdır.
 */
export function pickNationality(input: {
  readonly citizenships: readonly string[];
  readonly nationalTeamCountry: string | null;
  readonly birthCountry: string | null;
}): string | null {
  if (input.nationalTeamCountry !== null) return input.nationalTeamCountry;

  const unique = [...new Set(input.citizenships)].sort();
  if (unique.length === 0) return null;
  if (unique.length === 1) return unique[0] ?? null;

  if (input.birthCountry !== null && unique.includes(input.birthCountry)) {
    return input.birthCountry;
  }

  return unique[0] ?? null;
}

/**
 * BR-14 — millî maç sayısı: tek takım için EN ÇOK maç, toplam DEĞİL.
 *
 * NEDEN TOPLAMA DEĞİL, ölçüldü (bilinen 8 oyuncu: toplama 4/8, en büyük 7/8):
 *
 *   Buffon       İtalya A 176  +  İtalya U-21  11  = 187   (doğrusu 176)
 *   Panucci      İtalya A  57  +  İtalya U-21  19  =  76   (doğrusu  57)
 *   Zubizarreta  İspanya  126  +  Bask Bölgesi  4  = 130   (doğrusu 126)
 *
 * İki ayrı kirlilik var ve ikisi de sınıfa bakarak ayıklanamıyor: U-21
 * takımları A millî takımla AYNI Wikidata sınıfını paylaşıyor (350 takımın
 * 2'si), Bask Bölgesi ise gerçek bir millî takım — sadece FIFA üyesi değil.
 *
 * "En çok maç yaptığı millî takım" ikisini birden çözüyor. Kusuru şudur:
 * A millî takımından çok U-21 maçı olan bir oyuncuda yanlış değeri verir.
 * Bu, listedeki 2 altyapı takımıyla sınırlı ve kabul edildi.
 *
 * `teamFilter` dışarıdan verilir çünkü millî takım listesi AĞDAN gelir; bu
 * dosyanın saf kalması (§8.1) test edilebilirliğin ön koşulu.
 *
 * TAKIM KİMLİĞİ DE DÖNER — BR-38 uyruğu buradan seçiyor. Eskiden yalnızca
 * sayı dönüyordu ve "en çok maç yapılan millî takım" bilgisi, hesaplandığı
 * yerde atılıyordu.
 */
export interface NationalTeamCaps {
  readonly caps: number;
  readonly teamQid: string;
}

export function nationalCapsFrom(
  bindings: readonly SparqlBinding[],
  isNationalTeam: (teamQid: string) => boolean,
): Map<string, NationalTeamCaps> {
  const best = new Map<string, NationalTeamCaps>();

  for (const binding of bindings) {
    const player = qid(binding, "player");
    const team = qid(binding, "team");
    const caps = int(binding, "caps");
    if (player === undefined || team === undefined || caps === undefined) {
      continue;
    }
    if (!isNationalTeam(team)) continue;

    const current = best.get(player);
    if (current === undefined || caps > current.caps) {
      best.set(player, { caps, teamQid: team });
    }
  }

  return best;
}

/**
 * Millî takım → ülke kodu (BR-38'in birinci kademesi).
 *
 * `P1532` (spor için ülke) ÖNCELİKLİ ama seyrek; ölçüldü, dört takımın
 * yalnızca birinde vardı. `P17` (ülke) yedek ve İngiltere millî takımını
 * `GB`'ye eşliyor — kulüp/oyuncu kodlamasıyla tutarlı.
 *
 * Kodu olmayan takım haritaya GİRMEZ: `undefined` dönmesi, uyruk seçiminin
 * bir sonraki kademeye düşmesi demektir.
 */
export function nationalTeamCountriesFrom(
  bindings: readonly SparqlBinding[],
): Map<string, string> {
  const byTeam = new Map<string, string>();

  for (const binding of bindings) {
    const team = qid(binding, "team");
    if (team === undefined) continue;

    const sport = normalizeCountryCode(str(binding, "sportCountryCode"));
    const admin = normalizeCountryCode(str(binding, "adminCountryCode"));
    const code = sport ?? admin;
    if (code === null) continue;

    // Aynı takım birden çok satır döndürebilir; `P1532`'li satır kazanmalı.
    if (sport !== null || !byTeam.has(team)) byTeam.set(team, code);
  }

  return byTeam;
}

/**
 * Boy/kilo bağlamalarını kimliğe göre eşler.
 *
 * Değerler AKLA YATKIN ARALIKTA olmalı. Wikidata'da birim karışıklığı olur
 * (metre yerine santimetre, pound yerine kilogram) ve aralık dışı bir değer
 * "bilinmiyor"dan daha kötüdür — kullanıcıya 2 cm boyunda bir futbolcu
 * gösterilir. Aralık dışı değer `null` sayılır (§2.7).
 */
const HEIGHT_RANGE = { min: 140, max: 220 } as const;
const WEIGHT_RANGE = { min: 40, max: 140 } as const;

export function physicalFrom(
  bindings: readonly SparqlBinding[],
): Map<string, { heightCm: number | null; weightKg: number | null }> {
  const result = new Map<
    string,
    { heightCm: number | null; weightKg: number | null }
  >();

  for (const binding of bindings) {
    const player = qid(binding, "player");
    if (player === undefined) continue;

    result.set(player, {
      heightCm: inRange(int(binding, "height"), HEIGHT_RANGE),
      weightKg: inRange(int(binding, "mass"), WEIGHT_RANGE),
    });
  }

  return result;
}

function inRange(
  value: number | undefined,
  range: { min: number; max: number },
): number | null {
  if (value === undefined) return null;
  return value >= range.min && value <= range.max ? value : null;
}

/**
 * Ayrı sorgulardan gelen istatistikleri oyuncu kayıtlarına işler.
 *
 * UYRUK DA BURADA SEÇİLİR (BR-38) ve başka bir yerde seçilemezdi: seçimin
 * birinci kademesi millî takımdır ve o bilgi ancak bu adımda elde olur.
 */
export function applyPlayerStats(
  players: readonly NormalizedPlayer[],
  caps: ReadonlyMap<string, NationalTeamCaps>,
  physical: ReadonlyMap<
    string,
    { heightCm: number | null; weightKg: number | null }
  >,
  nationalTeamCountries: ReadonlyMap<string, string>,
): NormalizedPlayer[] {
  return players.map((player) => {
    const size = physical.get(player.wikidataId);
    const national = caps.get(player.wikidataId);

    return {
      ...player,
      nationality: pickNationality({
        citizenships: player.citizenships,
        nationalTeamCountry:
          national === undefined
            ? null
            : (nationalTeamCountries.get(national.teamQid) ?? null),
        birthCountry: player.birthCountry,
      }),
      nationalCaps: national?.caps ?? null,
      heightCm: size?.heightCm ?? null,
      weightKg: size?.weightKg ?? null,
    };
  });
}

/**
 * Oyuncu, hedeflenen erkek liglerinin kapsamında mı?
 *
 * `P21` kaydı olmayan oyuncular kapsamda KALIR — eksik meta veri, dışlama
 * gerekçesi değildir (gerekçe: `OUT_OF_SCOPE_GENDER_QIDS`).
 */
export function isInScope(player: NormalizedPlayer): boolean {
  return (
    player.genderQid === null ||
    !OUT_OF_SCOPE_GENDER_QIDS.includes(player.genderQid)
  );
}

/**
 * Bir dönem kaydını normalize eder.
 *
 * @param clubWikidataId sorgunun hedef kulübü (bağlamada dönmüyor)
 * @param clubIsYouth kulübün kendisi altyapı/yedek takım mı (BR-2)
 */
export function toSpell(
  binding: SparqlBinding,
  clubWikidataId: string,
  clubIsYouth: boolean,
): NormalizedSpell | null {
  const statementId = statementIdFromUri(str(binding, "st"));
  const playerId = qid(binding, "player");

  if (statementId === null || playerId === undefined) return null;

  // Hassasiyete duyarlı (BR-6): yıl hassasiyetli tarihler iki uçta farklı
  // yorumlanır. Gerekçe ve ölçüm `seasonYearAt` üzerinde.
  const startYear = seasonYearAt(
    str(binding, "start"),
    int(binding, "startPrecision"),
    "start",
  );
  const rawEndYear = seasonYearAt(
    str(binding, "end"),
    int(binding, "endPrecision"),
    "end",
  );

  /**
   * TEK TAKVİM YILI İÇİNDE BAŞLAYIP BİTEN DÖNEM.
   *
   * Yıl hassasiyetli "2024 → 2024" kaydında iki kural birbirine ters düşer:
   * başlangıç 2024, bitiş 2023 çıkar. Bitiş kuralının (Y−1) dayanağı
   * "ayrılış, Y−1 sezonunun SONUNDADIR" varsayımıdır; oysa katılış aynı yıl
   * olduğunda bu varsayım geçersizdir — dönem tek sezonluktur.
   *
   * Düzeltilmezse `sanitizeSpells` bu kayıtları "başlangıç bitişten sonra"
   * diye atardı. Ölçüldü: veri kümesinde başlangıcı bitişine eşit 19.478
   * dönem var, yani ayıklama oranı %1'lik eşiği (MAX_REJECT_RATIO) katlayarak
   * aşar ve ETL hiç tamamlanamazdı.
   *
   * Takvim yılı iki sezona yayıldığı için hangi sezon olduğu KAYNAKTAN
   * OKUNAMAZ. Başlangıçla hizalamak, iki tutarsız değerden birini seçmek
   * yerine tek tutarlı değere indirger — dönemin başladığı sezonu kapsadığı
   * kesindir.
   */
  const endYear =
    startYear !== null && rawEndYear !== null && rawEndYear < startYear
      ? startYear
      : rawEndYear;

  // Başlangıcı olup bitişi olmayan kayıt, Wikidata'da "hâlâ kulüpte"
  // anlamına gelir. Bitiş yılı bilinmediği için null bırakılır (§2.7).
  const isCurrent = startYear !== null && endYear === null;

  return {
    wikidataStatementId: statementId,
    playerWikidataId: playerId,
    clubWikidataId,
    startYear,
    endYear,
    isCurrent,
    isLoan: qid(binding, "acq") === WD.VALUE_LOAN,
    isYouth: clubIsYouth,
    ...tallies(int(binding, "apps"), int(binding, "goals")),
  };
}

/**
 * Maç ve gol sayılarını akla yatkınlık denetiminden geçirir — BR-22.
 *
 * İki kural, ikisi de ÖLÇÜLMÜŞ hataya karşı:
 *
 * 1. `MAX_SPELL_TALLY` üstü değer `null` olur. Bu değerlerin çoğu maç/gol
 *    değil, kutuya yanlış yazılmış bir YILDIR (Maldini @ Milan: 1987).
 *
 * 2. Gol sayısı maç sayısını aşıyorsa karar BURADA VERİLMEZ. Eskiden mutlak
 *    bir eleme vardı ve öncülü yanlıştı: elit golcüler maç sayısından fazla
 *    gol atar (Ronaldo @ Real Madrid, 292 maç / 311 gol). Değer geçici olarak
 *    `null` olur ama `disputedGoals` alanında SAKLANIR; birleştirme aşaması
 *    Vikipedi aynı çifti veriyorsa geri koyar (§9.2 · `resolveDisputedTallies`).
 *    Düşürülen kayıtta yalnızca GOL gider: maç sayısı hem arama sıralamasının
 *    (BR-21) hem BR-15 aday havuzunun girdisi, dolayısıyla daha çok yerde
 *    kullanılıyor.
 *
 * Sıfırlamak DEĞİL `null` yapmak kasıtlı (§2.7): "0 maç oynadı" bir iddiadır,
 * "bilmiyoruz" ise gerçektir.
 */
export function tallies(
  rawAppearances: number | undefined,
  rawGoals: number | undefined,
): {
  appearances: number | null;
  goals: number | null;
  disputedGoals: number | null;
  disputedAppearances: number | null;
} {
  const plausible = (value: number | undefined): number | null =>
    value === undefined || value > MAX_SPELL_TALLY || value < 0 ? null : value;

  const appearances = plausible(rawAppearances);
  const goals = plausible(rawGoals);

  const disputed =
    goals !== null && appearances !== null && goals > appearances;

  return {
    appearances,
    goals: disputed ? null : goals,
    // Karar ERTELENİR: ikinci kaynak doğrularsa geri alınacak (§9.2, BR-22).
    disputedGoals: disputed ? goals : null,
    disputedAppearances: disputed ? appearances : null,
  };
}

/**
 * Aynı doğal anahtara sahip kayıtları teker: Wikidata'da bir ifade birden
 * çok satır olarak dönebilir (çok değerli niteleyiciler yüzünden).
 */
export function dedupeBy<T>(
  items: readonly T[],
  key: (item: T) => string,
): T[] {
  const seen = new Map<string, T>();
  for (const item of items) {
    const k = key(item);
    if (!seen.has(k)) seen.set(k, item);
  }
  return [...seen.values()];
}
