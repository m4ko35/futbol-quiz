import { readTemplate, splitTop } from "./wikitext";

/**
 * Vikipedi kulüp makalesindeki kadro şablonu ayrıştırıcısı — PROJECT.md §4.3,
 * Aşama 3.
 *
 * SAF MODÜL: ağ yok, veritabanı yok. Girdisi kulüp makalesinin wikitext'i,
 * çıktısı kadro bloklarıdır.
 *
 * NE İŞE YARIYOR. Oyuncu evrenimizi Wikidata'nın `P54` ifadeleri tanımlıyor ve
 * ölçüldü (§4.3 Aşama 3): güncel kadroların **%43'ü** o ifadelerde yok. Eksik
 * 5.547 oyuncunun **hiçbirinde** evrendeki bir kulübe `P54` bağı bulunmuyor —
 * yani boşluk bizim kaçırdığımız bir şey değil, kaynağın söylemediği bir şey.
 * Bu ayrıştırıcı, kaynağın söylemediğini İKİNCİ bir kaynaktan bulur.
 *
 * YALNIZCA İNGİLİZCE. `{{fs player}}` ailesi tek bir şablon ailesidir ve
 * evrendeki kulüplerin 877/889'unda mevcut. Her dilin kendi kadro şablonunu
 * ayrıştırmak gereksiz: keşfin dili ile doğrulamanın dili aynı olmak zorunda
 * değil. Keşif `en`'de yapılır, kariyer beş dilde doğrulanır (BR-60).
 *
 * BU MODÜL KİMLİK ÜRETMEZ. Döndürdüğü şey makale BAŞLIĞIDIR; QID çözümü ağ
 * gerektirir ve `WikipediaClient.entityIds` işidir.
 */

/** Kadro şablonundaki tek bir satır. */
export interface SquadEntry {
  /**
   * Oyuncunun makale başlığı — bağlantı HEDEFİ, gösterilen ad değil.
   *
   * `null` ise oyuncunun makalesi yoktur (kırmızı bağlantı ya da düz metin).
   * Bu satır keşifte kullanılamaz ve kullanılmaya ÇALIŞILMAZ: makalesi olmayan
   * oyuncu tanınırlık havuzuna da giremez. Ölçüldü — 19.666 kadro yerinin
   * 6.169'u (%31,4) bu sınıfta ve büyük kulüplerde payı %2,5'e düşüyor.
   */
  readonly title: string | null;
  /** Forma numarası; `-` ya da boş olabilir. */
  readonly shirt: string | null;
  /** `GK` / `DF` / `MF` / `FW` — şablonun kendi kısaltması, normalize EDİLMEZ. */
  readonly position: string | null;
}

/** Bir `{{fs start}}…{{fs end}}` bloğu ve onu açan başlık. */
export interface SquadBlock {
  /** Bloktan önce gelen en yakın `==` başlığı; yoksa boş dizi. */
  readonly heading: string;
  readonly entries: readonly SquadEntry[];
}

const BLOCK_START = /\{\{\s*fs\s+start/giu;
const BLOCK_END = /\{\{\s*fs\s+end\s*\}\}/giu;
const PLAYER_OPEN = /\{\{\s*fs\s+player\s*\|/giu;
const HEADING = /^[ \t]*(={2,4})[ \t]*(.+?)[ \t]*\1[ \t]*$/gmu;
const LINK = /\[\[\s*([^\]|#]+?)\s*(?:\|[^\]]*)?\]\]/u;

/**
 * Kadro sayılmayacak bloklar.
 *
 * SIRA ÖNEMLİ: dışlama, kabulden ÖNCE bakılır. "Out on loan" başlığı da
 * "squad" kelimesini taşıyabiliyor ve önce kabul kuralına bakılsaydı kiralık
 * listesi birinci takım sanılırdı.
 *
 * Kiralıktakiler bilerek dışarıda: oyuncu o an başka bir kulübün kadrosunda ve
 * keşfi oradan yapılacak. Altyapı/yedek blokları da dışarıda — BR-16 zaten
 * eleyeceği kayıtlar için istek harcamanın anlamı yok.
 */
const EXCLUDED_HEADING =
  /out on loan|loaned|on loan|reserve|academy|under[\s-]?\d|youth|other players|retired|notable|former|women|b team|ii\b/iu;

/** Birinci takım kadrosu olduğu AÇIKÇA yazan başlıklar. */
const FIRST_TEAM_HEADING =
  /first[\s-]?team|current squad|current roster|^squad$|^players$|^roster$|^first team$/iu;

/**
 * Makaledeki bütün kadro bloklarını belgedeki SIRAYLA döner.
 *
 * Blok eşleştirme konumsaldır: her `{{fs start}}` kendinden sonraki ilk
 * `{{fs end}}` ile eşlenir. İç içe kadro bloğu diye bir şey yok, bu yüzden
 * derinlik saymaya gerek kalmıyor — ama şablon GÖVDESİ okunurken derinlik
 * sayılıyor (`readTemplate`), çünkü `{{fs player}}` içinde `{{Captain}}` gibi
 * iç şablonlar bulunuyor.
 */
export function parseSquadBlocks(wikitext: string): SquadBlock[] {
  const starts = positionsOf(wikitext, BLOCK_START);
  const ends = positionsOf(wikitext, BLOCK_END);
  const blocks: SquadBlock[] = [];

  let endCursor = 0;
  for (const start of starts) {
    while (endCursor < ends.length && ends[endCursor]! < start) endCursor++;
    if (endCursor >= ends.length) break;

    const end = ends[endCursor]!;
    blocks.push({
      heading: headingBefore(wikitext, start),
      entries: parseEntries(wikitext.slice(start, end)),
    });
    endCursor++;
  }

  return blocks;
}

/**
 * Birinci takım kadrosunu seçer; bulunamazsa `null`.
 *
 * İKİ KADEMELİ ve ikinci kademe bilinçli olarak gevşek. Başlıklar standart
 * değil: ölçülen 730 kulüpte "Current squad" 579 kez, "First-team squad" 86
 * kez geçiyor ama "Players", "Roster", "Last squad" gibi tekil biçimler de var.
 * Kabul kuralı tutmazsa DIŞLANMAYAN ilk blok alınır — bir kulübün ilk kadro
 * bloğu pratikte birinci takımıdır.
 */
export function pickFirstTeam(
  blocks: readonly SquadBlock[],
): SquadBlock | null {
  const eligible = blocks.filter((b) => !EXCLUDED_HEADING.test(b.heading));
  return (
    eligible.find((b) => FIRST_TEAM_HEADING.test(b.heading)) ??
    eligible[0] ??
    null
  );
}

/**
 * Kulüp makalesinden birinci takım kadrosunun makale başlıkları.
 *
 * Bağlantısız satırlar DÜŞER ve bu bir kayıp değil, tanım gereğidir (bkz.
 * `SquadEntry.title`). Çağıranın kaç satırın düştüğünü bilmesi gerekiyorsa
 * `pickFirstTeam` ile bloğun kendisini okumalı.
 */
export function squadArticleTitles(wikitext: string): string[] {
  const block = pickFirstTeam(parseSquadBlocks(wikitext));
  if (block === null) return [];

  const titles = block.entries
    .map((e) => e.title)
    .filter((t): t is string => t !== null);

  return [...new Set(titles)];
}

function positionsOf(text: string, pattern: RegExp): number[] {
  const found: number[] = [];
  const re = new RegExp(pattern.source, pattern.flags);

  for (let m = re.exec(text); m !== null; m = re.exec(text)) {
    found.push(m.index);
    // Sıfır uzunlukta eşleşme mümkün değil ama sonsuz döngü riski ucuz kapanır.
    if (m[0].length === 0) re.lastIndex++;
  }

  return found;
}

/**
 * Bloktan ÖNCE gelen en yakın başlık.
 *
 * Baştan taranıp sonuncusu alınıyor: başlıklar makale boyunca seyrek ve
 * geriye doğru arama regex'le yapılamaz.
 */
function headingBefore(text: string, position: number): string {
  const re = new RegExp(HEADING.source, HEADING.flags);
  let heading = "";

  for (let m = re.exec(text); m !== null; m = re.exec(text)) {
    if (m.index >= position) break;
    heading = m[2] ?? "";
  }

  return heading.trim();
}

function parseEntries(block: string): SquadEntry[] {
  const entries: SquadEntry[] = [];

  for (const open of positionsOf(block, PLAYER_OPEN)) {
    const body = readTemplate(block, open);
    if (body === null) continue;

    const fields = new Map<string, string>();
    // İlk parça şablon adı (`fs player`); alanlar ondan sonra başlıyor.
    for (const part of splitTop(body).slice(1)) {
      const eq = part.indexOf("=");
      if (eq === -1) continue;
      fields.set(
        part.slice(0, eq).trim().toLowerCase(),
        part.slice(eq + 1).trim(),
      );
    }

    const name = fields.get("name") ?? "";
    const link = LINK.exec(name);
    entries.push({
      title: link?.[1]?.trim() ?? null,
      shirt: emptyToNull(fields.get("no")),
      position: emptyToNull(fields.get("pos")),
    });
  }

  return entries;
}

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  // "-" numarasız oyuncu için kullanılıyor; boş dizeyle aynı anlama geliyor.
  return trimmed === "" || trimmed === "-" ? null : trimmed;
}
