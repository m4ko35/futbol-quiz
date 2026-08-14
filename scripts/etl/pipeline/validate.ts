import { isPlausibleSeasonYear } from "../../../src/domain/value-objects/season";
import type { Contradiction } from "./cross-check";
import { MIN_SPELLS_FOR_SELECTABLE } from "../leagues";
import type {
  NormalizedClub,
  NormalizedPlayer,
  NormalizedSpell,
} from "./normalize";

/**
 * Veri doğruluğu — PROJECT.md §8.2.
 *
 * İki aşamalıdır ve ayrım kasıtlıdır:
 *
 *   1. AYIKLAMA (`sanitizeSpells`) — kendi içinde çelişen tekil kayıtlar
 *      atılır. Bir dönemin bitişi başlangıcından önceyse o kayıt yanlıştır;
 *      düzeltilemez, saklanamaz.
 *
 *   2. DENETİM (`validateDataset`) — atılan kayıtların ORANINA bakılır.
 *      Wikidata herkesin düzenleyebildiği bir kaynak; içinde her zaman birkaç
 *      yazım hatası olacak. 78 bin kaydın 11'i yüzünden yüklemeyi iptal etmek
 *      ETL'in hiç çalışamaması demektir. Ama oran yükselirse sorun artık
 *      "birkaç yazım hatası" değil, çıkarım sürecinde sistemik bir hatadır —
 *      o zaman durulur.
 */

export interface ValidationReport {
  readonly errors: string[];
  readonly warnings: string[];
}

export interface RejectedSpell {
  readonly id: string;
  readonly reason: string;
}

export interface SanitizeResult {
  readonly spells: NormalizedSpell[];
  readonly rejected: RejectedSpell[];
}

/** Bu oranın üstünde ayıklama sistemik hataya işaret eder; yükleme durur. */
const MAX_REJECT_RATIO = 0.01;

/**
 * Açık uçlu dönemin bitişi — `cross-check.ts` ile AYNI değer, aynı gerekçe.
 *
 * `null` bitiş "bilinmiyor VEYA hâlâ orada" demek; örtüşme sorusunda ikisi de
 * kaydı AÇIK sayar.
 */
const OPEN_END = 9999;

/** Uyarı listeleri log'u boğmasın diye kırpılır. */
const MAX_REPORTED = 8;

/**
 * Kullanılamaz dönem kayıtlarını ayıklar.
 *
 * Atılma sebepleri kayıt kayıt saklanır; sessiz veri kaybı olmaz (§2.7).
 */
export function sanitizeSpells(input: {
  readonly clubs: readonly NormalizedClub[];
  readonly players: readonly NormalizedPlayer[];
  readonly spells: readonly NormalizedSpell[];
}): SanitizeResult {
  const clubIds = new Set(input.clubs.map((c) => c.wikidataId));
  const playerIds = new Set(input.players.map((p) => p.wikidataId));

  const spells: NormalizedSpell[] = [];
  const rejected: RejectedSpell[] = [];

  for (const spell of input.spells) {
    const { startYear, endYear, wikidataStatementId: id } = spell;

    if (startYear !== null && endYear !== null && startYear > endYear) {
      rejected.push({
        id,
        reason: `başlangıç bitişten sonra (${startYear} → ${endYear})`,
      });
      continue;
    }

    const implausible = [startYear, endYear].find(
      (year) => year !== null && !isPlausibleSeasonYear(year),
    );
    if (implausible !== undefined) {
      rejected.push({
        id,
        reason: `yıl makul aralık dışında (${implausible})`,
      });
      continue;
    }

    // Oyuncunun hiçbir dilde etiketi yoksa `toPlayer` onu elemiştir; adsız
    // bir oyuncu arayüzde gösterilemeyeceği için dönemi de kullanılamaz.
    if (!playerIds.has(spell.playerWikidataId)) {
      rejected.push({ id, reason: "oyuncu bilgisi çekilemedi" });
      continue;
    }

    if (!clubIds.has(spell.clubWikidataId)) {
      rejected.push({ id, reason: "kulüp bilgisi çekilemedi" });
      continue;
    }

    spells.push(spell);
  }

  return { spells, rejected };
}

export function validateDataset(input: {
  readonly clubs: readonly NormalizedClub[];
  /** AYIKLANMIŞ dönemler. */
  readonly spells: readonly NormalizedSpell[];
  readonly rejected: readonly RejectedSpell[];
  /**
   * Dönemleri gerçekten çekilen kulüpler. Kısmi koşularda (`--max-clubs`)
   * yalnızca bunlar "yeterli dönem geldi mi" denetimine girer; aksi hâlde
   * hiç sorgulanmamış kulüpler boş görünüp yanlış uyarı üretir.
   */
  readonly fetchedClubIds: ReadonlySet<string>;
  /**
   * BR-42 — Vikipedi'nin çürüttüğü Wikidata dönemleri (`cross-check.ts`).
   *
   * Vikipedi katmanı atlandıysa (`--skip-wikipedia`) verilmez; o koşuda
   * ikinci kaynak yoktur ve denetim susar.
   */
  readonly contradictions?: readonly Contradiction[];
}): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  const clubsById = new Map(input.clubs.map((c) => [c.wikidataId, c]));
  const beforeFounding: string[] = [];
  const spellsPerClub = new Map<string, number>();
  const permanentByPlayer = new Map<string, NormalizedSpell[]>();

  for (const spell of input.spells) {
    const club = clubsById.get(spell.clubWikidataId);

    // Dönem, kulübün kuruluşundan önce başlamış görünüyor. Genellikle
    // kulübün selefine ait kayıtlardır (Liverpool 1892'de kuruldu ama
    // 1891 dönemleri var) — hatalı değil, eksik modellenmiş.
    if (
      club?.foundedYear != null &&
      spell.startYear !== null &&
      spell.startYear < club.foundedYear
    ) {
      beforeFounding.push(
        `${club.shortName}: kuruluş ${club.foundedYear}, dönem ${spell.startYear}`,
      );
    }

    spellsPerClub.set(
      spell.clubWikidataId,
      (spellsPerClub.get(spell.clubWikidataId) ?? 0) + 1,
    );

    if (!spell.isLoan && !spell.isYouth && spell.startYear !== null) {
      const list = permanentByPlayer.get(spell.playerWikidataId) ?? [];
      list.push(spell);
      permanentByPlayer.set(spell.playerWikidataId, list);
    }
  }

  /*
    Aynı oyuncunun zaman olarak örtüşen iki kalıcı dönemi olamaz — ama
    Wikidata'da bu sık görülür (kiralık işaretlenmemiş transferler).

    SÜREN DÖNEM DE SAYILIR (13 Ağustos 2026'da kapatılan boşluk). Eski kural
    `prev.endYear === null` olduğunda ATLIYORDU; oysa süren iki dönem,
    örtüşmenin en güçlü hâlidir. Ölçülen bedeli: Rafael Leão'nun vandalize
    edilmiş kaydında Real Madrid ve Milan dönemlerinin İKİSİ de sürüyordu,
    dolayısıyla bu uyarı hiç basılmadı ve kayıt üretime çıktı (BR-42).

    AMA YALNIZCA `isCurrent` OLANLAR. Şema `null` bitişi iki anlamda kullanıyor
    ve ayrımı bu bayrak yapıyor (§5.1): "hâlâ orada" ile "bitişi bilinmiyor".
    İkincisini örtüşme saymak ölçüldü — bitişi bilinmeyen ikinci bir kalıcı
    dönemi olan 3.588 oyuncu var ve çoğu eski, kaydı eksik oyuncular. Onları
    da saymak uyarıyı okunmaz hâle getirirdi; bilinmeyen bitiş bir iddia
    değildir (§2.7).

    `cross-check.ts` bunun AKSİNİ yapıyor ve bu bilinçli: orada bitişi
    bilinmeyen kayıt da açık sayılıyor, çünkü oradaki iddiayı tek başına
    örtüşme değil İKİNCİ KAYNAK kuruyor — kanıt yükü zaten karşılanmış oluyor.
  */
  const overlaps: string[] = [];
  for (const [playerId, spells] of permanentByPlayer) {
    if (spells.length < 2) continue;

    const sorted = [...spells].sort(
      (a, b) => (a.startYear ?? 0) - (b.startYear ?? 0),
    );
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      if (prev === undefined || curr === undefined) continue;
      if (curr.startYear === null) continue;

      // Sınıra değmek örtüşme değildir; transfer yılı iki kayıtta da geçer.
      const prevEnd = prev.endYear ?? (prev.isCurrent ? OPEN_END : null);
      if (prevEnd === null) continue;
      if (curr.startYear < prevEnd) {
        overlaps.push(
          `${playerId}: ${prev.startYear}–${prev.endYear ?? "…"} ve ${curr.startYear}–${curr.endYear ?? "…"}`,
        );
      }
    }
  }

  const thinClubs = input.clubs
    .filter(
      (c) =>
        input.fetchedClubIds.has(c.wikidataId) &&
        (spellsPerClub.get(c.wikidataId) ?? 0) < MIN_SPELLS_FOR_SELECTABLE,
    )
    .map((c) => `${c.shortName} (${spellsPerClub.get(c.wikidataId) ?? 0})`);

  // ─── Bloklayıcı denetim: ayıklama oranı ───────────────────────────────
  const total = input.spells.length + input.rejected.length;
  const ratio = total === 0 ? 0 : input.rejected.length / total;
  const percent = (ratio * 100).toFixed(3);

  if (input.rejected.length > 0) {
    const byReason = new Map<string, number>();
    for (const item of input.rejected) {
      // Sebebi sayısal ayrıntılardan arındırıp grupla.
      const key = item.reason.replace(/\s*\([^)]*\)/, "");
      byReason.set(key, (byReason.get(key) ?? 0) + 1);
    }
    const summary = [...byReason]
      .sort((a, b) => b[1] - a[1])
      .map(([reason, count]) => `${reason}: ${count}`)
      .join(", ");

    const line = `${input.rejected.length}/${total} dönem ayıklandı (%${percent}) — ${summary}`;
    if (ratio > MAX_REJECT_RATIO) {
      errors.push(
        `${line}. Oran %${(MAX_REJECT_RATIO * 100).toFixed(0)} eşiğini aştı; ` +
          `bu artık tekil yazım hatası değil, çıkarım sürecinde sistemik bir sorun.`,
      );
    } else {
      warnings.push(line);
    }
  }

  /*
    ─── Bloklayıcı denetim: çapraz kaynak çelişkisi (BR-42) ───────────────

    KAPI KAPALI BAŞLAR. Ayıklama oranının aksine burada beklenen değer SIFIR:
    iki bağımsız kaynağın aynı yıllar için farklı kulüp söylemesi normal bir
    gürültü değil, birinin yanlış olmasıdır. Bir tanesi bile üretime çıkarsa
    kullanıcı onu oyun içinde görür — nitekim öyle oldu (Real Madrid ∩ Milan
    sorgusunda Rafael Leão).

    ORAN DEĞİL SAYI: 78 bin dönemde tek bir vandalizm, oranı hiçbir eşiğin
    üstüne çıkarmaz. Ayıklama oranı sistemik bozulmayı ölçer, bu kapı ise
    HEDEFLİ bozulmayı; ikisinin eşiği aynı biçimde konulamaz.

    KABUL EDİLEN RİSK, açıkça yazılıyor: eşik ÖLÇÜLMEDİ. Kural gerçek bir tam
    koşuda hiç çalışmadı, çünkü çalıştırmak iki saatlik bir ETL koşusu ister.
    İlk koşuda beklenenden çok çelişki çıkarsa doğru tepki eşiği sessizce
    yükseltmek DEĞİL, listeye bakıp sebebi anlamaktır: her satır ifade
    kimliğiyle basılıyor, tek tek Wikidata'da açılabilir.
  */
  const contradictions = input.contradictions ?? [];
  if (contradictions.length > 0) {
    const detay = contradictions
      .slice(0, MAX_REPORTED)
      .map(
        (c) =>
          `${c.playerWikidataId} → ${c.clubWikidataId} ` +
          `(${c.startYear ?? "?"}–${c.endYear ?? "…"}, ${c.appearances ?? "?"} maç) ` +
          `ama Vikipedi: ${c.wikipediaClubs.join("/")} [${c.spellId}]`,
      )
      .join("; ");
    const more =
      contradictions.length > MAX_REPORTED
        ? ` … (+${contradictions.length - MAX_REPORTED})`
        : "";

    errors.push(
      `${contradictions.length} dönemde Vikipedi ile Wikidata AYNI YILLAR için ` +
        `farklı kulüp söylüyor (BR-42): ${detay}${more}. ` +
        `Her biri elle incelenmeli — kaynaktaki kayıt düzeltilmeden yüklenmemeli.`,
    );
  }

  pushIssue(warnings, beforeFounding, "dönem kulüp kuruluşundan önce");
  pushIssue(warnings, overlaps, "örtüşen kalıcı dönem");
  pushIssue(
    warnings,
    thinClubs,
    `kulüpten ${MIN_SPELLS_FOR_SELECTABLE}'den az dönem geldi (seçilebilir sayılmayacak)`,
  );

  return { errors, warnings };
}

function pushIssue(target: string[], items: string[], label: string): void {
  if (items.length === 0) return;

  const shown = items.slice(0, MAX_REPORTED).join("; ");
  const more =
    items.length > MAX_REPORTED ? ` … (+${items.length - MAX_REPORTED})` : "";
  target.push(`${label} — ${items.length} kayıt: ${shown}${more}`);
}
