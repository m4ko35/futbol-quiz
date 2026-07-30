import type { Player } from "../entities/player";
import type { Spell } from "../entities/spell";
import type { ClubId } from "../value-objects/identifiers";
import { latestKnownYear } from "../value-objects/year-range";
import { spellQualifies, type SpellFilter } from "./spell-filter";

/**
 * Ortak oyuncu çıkarımı — BR-1 ve BR-5.
 *
 * Bu dosya uygulamanın çekirdek sorusunu cevaplar ve bilinçli olarak SAFTIR:
 * veritabanı, HTTP, tarih/saat ya da yapılandırma bilmez. Girdi olarak aday
 * oyuncuları ve dönemlerini alır, kuralları uygular, sıralı sonucu döndürür.
 * Böylece kurallar gerçek veri olmadan, milisaniyeler içinde test edilebilir.
 */

/** Bir oyuncunun ve iki kulüpteki dönemlerinin ham hâli (port'tan gelir). */
export interface PlayerSpells {
  readonly player: Player;
  /** Yalnızca ilgilenilen iki kulüpteki dönemler; sıralı olmak zorunda değil. */
  readonly spells: readonly Spell[];
}

export interface CommonPlayer {
  readonly player: Player;
  readonly spellsAtA: readonly Spell[];
  readonly spellsAtB: readonly Spell[];

  /**
   * İki kulüpteki bilinen maç sayılarının toplamı.
   *
   * Hiçbir dönemde maç bilgisi yoksa `null` — 0 DEĞİL. Ayrım BR-5 için
   * belirleyicidir: "0 maç oynadı" ile "kaç maç oynadığı bilinmiyor" farklı
   * şeylerdir ve ikincisi sıralamada farklı davranır.
   */
  readonly totalAppearances: number | null;

  /** BR-5 ikincil sıralama anahtarı: iki kulüpteki en son bilinen yıl. */
  readonly latestYear: number | null;
}

export interface FindCommonPlayersInput {
  readonly clubA: ClubId;
  readonly clubB: ClubId;
  readonly candidates: readonly PlayerSpells[];
  readonly filter: SpellFilter;
}

/**
 * BR-1 — Ortak oyuncu tanımı.
 *
 * Bir oyuncu, A'da en az bir ve B'de en az bir NİTELİKLİ döneme sahipse
 * ortaktır. Dönemlerin zaman olarak örtüşmesi GEREKMEZ; zaten aynı anda iki
 * kulüpte olunamaz. (Bu, ilk bakışta ters gelen ama doğru olan kuraldır:
 * "ortak" burada "aynı anda" değil, "her ikisinde de bir zaman" demektir.)
 *
 * Girdi `candidates` port tarafından zaten daraltılmış gelir; buradaki eleme
 * onu tekrarlamak için değil, kuralın tek doğruluk merci olması içindir.
 * Port bozulursa sonuç sessizce yanlış olmaz, sadece boşalır.
 */
export function findCommonPlayers(
  input: FindCommonPlayersInput,
): CommonPlayer[] {
  const { clubA, clubB, filter } = input;
  const common: CommonPlayer[] = [];

  for (const candidate of input.candidates) {
    const spellsAtA: Spell[] = [];
    const spellsAtB: Spell[] = [];

    for (const spell of candidate.spells) {
      if (!spellQualifies(spell, filter)) continue;

      if (spell.clubId === clubA) spellsAtA.push(spell);
      else if (spell.clubId === clubB) spellsAtB.push(spell);
      // Başka kulüpteki dönemler sessizce yok sayılır: port sözleşmesi
      // gereği gelmemeleri gerekir, geldiklerinde de sonucu kirletmemeliler.
    }

    if (spellsAtA.length === 0 || spellsAtB.length === 0) continue;

    const all = [...spellsAtA, ...spellsAtB];
    common.push({
      player: candidate.player,
      spellsAtA: sortSpellsChronologically(spellsAtA),
      spellsAtB: sortSpellsChronologically(spellsAtB),
      totalAppearances: sumAppearances(all),
      latestYear: latestYearOf(all),
    });
  }

  return common.sort(compareByRelevance);
}

/**
 * BR-5 — Sıralama.
 *
 * Öncelik maç sayısıdır; maç bilgisi olmayan oyuncular en son dönem yılına
 * göre sıralanır.
 *
 * YORUM KARARI: kural iki farklı anahtar tanımlıyor ama bunların birbirine
 * göre yerini söylemiyor. Maç sayısı bilinenler öne alınır, bilinmeyenler
 * arkaya. Gerekçe: maç sayısı bilinen oyuncu neredeyse her zaman daha iyi
 * belgelenmiş ve daha tanınan oyuncudur; kullanıcı listenin başında onu
 * görmeyi bekler. İki grubu yıla göre harmanlamak, 3 maç oynamış bir oyuncuyu
 * 200 maç oynamış birinin üstüne çıkarabilirdi.
 *
 * Son eşitlik bozucu ad ve kimliktir. Bu keyfi değil, ZORUNLUDUR: sırası
 * belirsiz bir liste, aynı istek iki kez yapıldığında farklı sıralanır ve
 * hem sayfalama hem de test tekrarlanabilirliği bozulur.
 */
export function compareByRelevance(a: CommonPlayer, b: CommonPlayer): number {
  // Karşılaştırma doğrudan değerler üzerinden yapılıyor, `aHasApps` gibi
  // yardımcı boolean'lar üzerinden değil: derleyici boolean'lar üzerinden
  // daraltma yapamadığı için gövdede `?? 0` gibi ULAŞILAMAZ bir yedek
  // gerekirdi. Ulaşılamaz kod test edilemez, test edilemeyen kod da zamanla
  // yanlış olduğu fark edilmeden durur.
  const aApps = a.totalAppearances;
  const bApps = b.totalAppearances;

  if ((aApps === null) !== (bApps === null)) return aApps === null ? 1 : -1;

  if (aApps !== null && bApps !== null) {
    const diff = bApps - aApps;
    if (diff !== 0) return diff;
  } else {
    // Yılı bilinmeyen, yılı bilinenin arkasına düşer.
    const aYear = a.latestYear;
    const bYear = b.latestYear;
    if (aYear !== bYear) {
      if (aYear === null) return 1;
      if (bYear === null) return -1;
      return bYear - aYear;
    }
  }

  const byName = a.player.name.localeCompare(b.player.name, "tr");
  if (byName !== 0) return byName;

  return a.player.id.localeCompare(b.player.id);
}

/** Dönemler kullanıcıya kronolojik gösterilir; tarihsizler sona. */
function sortSpellsChronologically(spells: Spell[]): Spell[] {
  return [...spells].sort((a, b) => {
    const aStart = a.years.start;
    const bStart = b.years.start;
    if (aStart === bStart) return 0;
    if (aStart === null) return 1;
    if (bStart === null) return -1;
    return aStart - bStart;
  });
}

/** Bilinen maç sayılarının toplamı; hiçbiri bilinmiyorsa `null`. */
function sumAppearances(spells: readonly Spell[]): number | null {
  let total = 0;
  let known = false;

  for (const spell of spells) {
    if (spell.appearances === null) continue;
    total += spell.appearances;
    known = true;
  }

  return known ? total : null;
}

function latestYearOf(spells: readonly Spell[]): number | null {
  let latest: number | null = null;

  for (const spell of spells) {
    const year = latestKnownYear(spell.years);
    if (year === null) continue;
    if (latest === null || year > latest) latest = year;
  }

  return latest;
}
