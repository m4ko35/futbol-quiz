import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";
import type { NormalizedSpell } from "./normalize";

/**
 * Elle düzeltmeler — PROJECT.md §8.2.
 *
 * Wikidata'da **hiç olmayan** dönemleri veri kümesine ekler. Gerekçe ölçüldü:
 * güncel kadronun veri kümesinde bulunma oranı Real Madrid'de 24/24 ve
 * Arsenal'de 23/24 iken Galatasaray'da 13/24, Beşiktaş'ta 10/22,
 * Trabzonspor'da 5/15. Boşluk kaynaktadır — Abdülkerim Bardakçı'nın yedi
 * `P54` kaydının hiçbiri Galatasaray değil ve alternatif bir Galatasaray
 * ögesi de yok.
 *
 * Neden uyarı değil de düzeltme: ızgara cevabı `matchesAll` ile veri kümesine
 * bakarak doğrulanır (BR-12), yani eksik dönem **doğru cevabı yanlış
 * saydırır**.
 *
 * BU MEKANİZMA KAYNAĞI DÜZELTMEZ. Wikidata'dan gelen bir dönemin üzerine
 * yazmaz; yalnızca hiç gelmeyeni ekler. Oradaki hatalı bir kayıt Wikidata'da
 * düzeltilir — burada maskelenmesi, ETL'in bir sonraki koşuda aynı hatayı
 * sessizce tekrar üretmesi demek olurdu.
 */

const OVERRIDES_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "overrides",
);

const SPELLS_FILE = path.join(OVERRIDES_DIR, "spells.json");

/** Wikidata QID biçimi — sentetik kimlik üretmeden önce doğrulanır. */
const qidSchema = z
  .string()
  .regex(/^Q\d+$/u, "Wikidata QID biçiminde olmalı (örn. Q318069)");

/**
 * Yıl aralığı kasten geniş: burada amaç makullük denetimi değil, açık bir
 * yazım hatasını (2205) yakalamak. Asıl denetimi `sanitizeSpells` yapar ve
 * override kayıtları da oradan geçer — ayrıcalıkları yoktur.
 */
const yearSchema = z.number().int().min(1850).max(2100).nullable();

const overrideSpellSchema = z
  .object({
    player: qidSchema,
    club: qidSchema,
    startYear: yearSchema,
    endYear: yearSchema,
    isLoan: z.boolean().default(false),
    /**
     * KAYNAK ZORUNLUDUR. Kaynaksız bir elle düzeltme, altı ay sonra kimsenin
     * doğrulayamayacağı bir iddiadır; o hâlde Wikidata'nın eksikliğinden daha
     * iyi değildir. Uzunluk alt sınırı "?" ya da "-" yazılmasını engeller.
     */
    note: z.string().min(10, "note bir kaynak/gerekçe içermeli"),
  })
  .strict()
  .refine(
    (s) =>
      s.startYear === null || s.endYear === null || s.startYear <= s.endYear,
    { message: "startYear, endYear'dan sonra olamaz" },
  );

const overridesFileSchema = z
  .object({
    spells: z.array(overrideSpellSchema),
  })
  .strict();

export type OverrideSpell = z.output<typeof overrideSpellSchema>;

export interface MergeResult {
  /** Wikidata dönemleri + gerçekten eklenen override'lar. */
  readonly spells: NormalizedSpell[];
  readonly added: number;
  /**
   * Wikidata artık aynı dönemi taşıdığı için yok sayılanlar.
   *
   * Bu sayı mekanizmanın KENDİNİ İPTAL ETME yoludur: dosyadan silinebilecek
   * kayıtları görünür kılar, böylece elle düzeltmeler sessizce birikmez.
   */
  readonly redundant: OverrideSpell[];
}

/**
 * Sentetik ifade kimliği.
 *
 * Wikidata'nınki `Q161089-AD66DA21-…` biçiminde; `override-` öneki onunla
 * çakışamaz. Kimlik (oyuncu, kulüp, yıl) üçlüsünden türetildiği için
 * DETERMİNİSTİKTİR — yükleme idempotent kalır, aynı dosya iki kez
 * yüklendiğinde satır çoğalmaz.
 */
export function overrideStatementId(spell: OverrideSpell): string {
  return `override-${spell.player}-${spell.club}-${spell.startYear ?? "x"}`;
}

/** Wikidata dönemleriyle karşılaştırma anahtarı. */
function identityKey(
  player: string,
  club: string,
  startYear: number | null,
): string {
  return `${player}|${club}|${String(startYear ?? "x")}`;
}

/** Yılsız karşılaştırma anahtarı — "bu oyuncu bu kulüpte oynadı". */
function pairKey(player: string, club: string): string {
  return `${player}|${club}`;
}

export async function readOverrideSpells(): Promise<OverrideSpell[]> {
  let raw: string;
  try {
    raw = await readFile(SPELLS_FILE, "utf8");
  } catch (error: unknown) {
    // Dosyanın olmaması normaldir (elle düzeltme gerekmiyor olabilir).
    // Başka bir okuma hatası ise yutulmaz — sessizce boş liste dönmek,
    // bozuk bir dosyayı "düzeltme yok" diye okumak olurdu.
    if (
      error instanceof Error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return [];
    }
    throw error;
  }

  const parsed = overridesFileSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  • spells.${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `scripts/etl/overrides/spells.json geçersiz:\n${issues}\n\n` +
        `Elle düzeltmeler de sınırda doğrulanır (§2.3).`,
    );
  }

  // Sentetik kimlik (oyuncu, kulüp, yıl) üçlüsünden türetiliyor; iki kayıt
  // aynı üçlüyü paylaşırsa yükleme sırasında biri diğerini sessizce ezerdi.
  // Yılı bilinmeyen ("x") iki dönem aynı kulüpte bu tuzağa kolayca düşer.
  const seen = new Set<string>();
  for (const spell of parsed.data.spells) {
    const id = overrideStatementId(spell);
    if (seen.has(id)) {
      throw new Error(
        `spells.json içinde yinelenen kayıt: ${id}. Aynı oyuncu-kulüp-yıl ` +
          `üçlüsü iki kez tanımlanmış; yılı bilinmeyen iki dönemi ayırmak ` +
          `için en az birine başlangıç yılı yazın.`,
      );
    }
    seen.add(id);
  }

  return parsed.data.spells;
}

/**
 * Override'ları Wikidata dönemlerinin üstüne EKLER.
 *
 * `isYouth` daima `false`: elle düzeltmeler A takım kadrosundaki boşluğu
 * kapatmak için var. Altyapı dönemi ne oyunun kuralına (BR-2) girer ne de
 * kullanıcının bildirdiği türden bir hataya yol açar.
 *
 * `appearances`/`goals` daima `null`: uydurulmaz (§2.7). Sonucu, o oyuncunun
 * istatistik eşleştirme modunda aday olmamasıdır (BR-15) — doğru davranış,
 * çünkü elimizde gerçekten o veri yok.
 */
export function mergeOverrides(
  wikidataSpells: readonly NormalizedSpell[],
  overrides: readonly OverrideSpell[],
): MergeResult {
  const existing = new Set(
    wikidataSpells.map((s) =>
      identityKey(s.playerWikidataId, s.clubWikidataId, s.startYear),
    ),
  );
  const existingPairs = new Set(
    wikidataSpells.map((s) => pairKey(s.playerWikidataId, s.clubWikidataId)),
  );

  const spells = [...wikidataSpells];
  const redundant: OverrideSpell[] = [];
  let added = 0;

  for (const override of overrides) {
    // YILSIZ override, yılı OLAN bir kaynak kaydıyla üçlü anahtarda eşleşmez;
    // yalnızca üçlüye bakmak bu durumda KOPYA dönem üretirdi. Yılsız kayıt
    // "bu oyuncu bu kulüpte oynadı" demektir, dolayısıyla kulüpteki herhangi
    // bir kaynak dönemi onu gereksiz kılar. Ölçüldü: Wikidata kadro
    // boşluklarını sürekli dolduruyor (bir günde 28 yeni dönem), yani bu
    // çakışma teorik değil, beklenen durum.
    const isRedundant =
      override.startYear === null
        ? existingPairs.has(pairKey(override.player, override.club))
        : existing.has(
            identityKey(override.player, override.club, override.startYear),
          );

    if (isRedundant) {
      redundant.push(override);
      continue;
    }

    spells.push({
      wikidataStatementId: overrideStatementId(override),
      playerWikidataId: override.player,
      clubWikidataId: override.club,
      startYear: override.startYear,
      endYear: override.endYear,
      isCurrent: override.startYear !== null && override.endYear === null,
      isLoan: override.isLoan,
      isYouth: false,
      appearances: null,
      goals: null,
    });
    added++;
  }

  return { spells, added, redundant };
}
