import {
  GridUnavailableError,
  ValidationError,
} from "@/domain/errors/domain-error";
import {
  isCellRefInRange,
  type CellRef,
  type Grid,
  type GridCriterion,
} from "@/domain/services/grid";
import { dailySeed } from "@/domain/value-objects/daily-seed";
import type { PlayerId } from "@/domain/value-objects/identifiers";
import { generateGrid, type GridDeps } from "../game-modes/grid/generate";

/**
 * Günlük ızgara — PROJECT.md §9.1.
 *
 * SIZINTI KURALI: dışarı yalnızca KRİTERLER çıkar. Cevaplar bir yana, hücre
 * başına kaç cevap olduğu bile verilmez — sayı, tahmin alanını daraltan bir
 * ipucudur ve oyunun parçası olarak sunulmadıkça sızıntıdır (§2.4).
 */

export interface GridCriterionDto {
  readonly kind: "club" | "nationality";
  readonly label: string;
}

/**
 * Bir ızgaranın oynanabilir hâli — TARİHSİZ.
 *
 * Kullanıcının kurduğu ızgaranın (§9.1, BR-25) bir tarihi yoktur; oyun
 * bileşeni ikisini de bu şekille oynar. Tarih, saklanan ilerlemenin
 * anahtarıdır ve yalnızca günlük ızgarada anlamlıdır.
 */
export interface GridRoundDto {
  readonly rows: readonly GridCriterionDto[];
  readonly columns: readonly GridCriterionDto[];
}

export interface DailyGridDto extends GridRoundDto {
  /** Izgaranın ait olduğu gün (UTC, `YYYY-MM-DD`) — istemci gün dönümünü bilir. */
  readonly date: string;
}

function toCriterionDto(criterion: GridCriterion): GridCriterionDto {
  return {
    kind: criterion.type,
    label: criterion.label,
  };
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Üretilmiş ızgaraların gün bazlı belleği.
 *
 * NEDEN GEREKLİ — ölçüldü: üretim gerçek depolarla **384 ms** sürüyor (sonda
 * 2,9 ms'ti; fark, her kriter için ayrı veritabanı sorgusu atılmasından).
 * Bu maliyeti yalnızca günün ilk isteği ödemeli. `checkAnswer` ızgarayı her
 * cevapta yeniden üretiyor (istemciye güvenilmediği için) — bellek olmadan
 * her tıklama 384 ms beklerdi.
 *
 * Süreç içi ve sınırlı: sunucusuz ortamda her örnek kendi kopyasını tutar,
 * bu sorun değil çünkü ızgara deterministiktir — iki örnek aynı gün için
 * aynı sonucu üretir (BR-11).
 */
const cache = new Map<number, Grid>();

/** Gün değiştikçe eski anahtarlar birikmesin (§7.1: sınırsız büyüyen yapı yok). */
const MAX_CACHED_DAYS = 4;

async function gridFor(seed: number, deps: GridDeps): Promise<Grid> {
  const cached = cache.get(seed);
  if (cached !== undefined) return cached;

  const grid = await generateGrid(seed, deps);
  if (grid === null) throw new GridUnavailableError();

  if (cache.size >= MAX_CACHED_DAYS) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(seed, grid);
  return grid;
}

export async function getDailyGrid(
  now: Date,
  deps: GridDeps,
): Promise<DailyGridDto> {
  const grid = await gridFor(dailySeed(now), deps);

  return {
    date: isoDate(now),
    rows: grid.rows.map(toCriterionDto),
    columns: grid.columns.map(toCriterionDto),
  };
}

export interface CheckAnswerInput {
  readonly now: Date;
  readonly cell: CellRef;
  readonly playerId: PlayerId;
}

/**
 * Yanıt yalnızca doğruluğu taşır.
 *
 * Oyuncunun adı GERİ DÖNDÜRÜLMEZ: istemci o oyuncuyu zaten kendisi seçti,
 * elinde var. Sunucudan tekrar istemek gereksiz bir sorgu ve gereksiz bir
 * alan olurdu (§2.4).
 */
export interface CheckAnswerDto {
  readonly correct: boolean;
}

/**
 * BR-12 — cevap KİMLİKLE doğrulanır.
 *
 * Izgara burada YENİDEN ÜRETİLİR, istemciden gelen kriterlere GÜVENİLMEZ.
 * İstemci kriterleri gönderebilseydi kendi ızgarasını uydurup her cevabı
 * doğru yaptırabilirdi (§7.1: ayrıştırılmamış girdi iç katmanlara geçemez).
 * Üretim deterministik olduğu için bu ucuzdur — aynı gün, aynı ızgara.
 */
export async function checkAnswer(
  input: CheckAnswerInput,
  deps: GridDeps,
): Promise<CheckAnswerDto> {
  // Aralık dışı hücre bir SUNUCU hatası değil, geçersiz bir GİRDİDİR.
  if (!isCellRefInRange(input.cell)) {
    throw new ValidationError("Geçersiz hücre.");
  }

  const grid = await gridFor(dailySeed(input.now), deps);

  const row = grid.rows[input.cell.row];
  const column = grid.columns[input.cell.column];
  if (row === undefined || column === undefined) {
    throw new GridUnavailableError();
  }

  return {
    correct: await deps.players.matchesAll(input.playerId, [row, column]),
  };
}

export function gridDate(now: Date): string {
  return isoDate(now);
}

/**
 * Açığa çıkan bir hücrenin örnek cevabı — "Pes et → Cevapları gör" (BR-66).
 *
 * `index` KOORDİNAT DEĞİL, istekteki hücrenin SIRASIDIR: istemci gönderdiği
 * hücre dizisini biliyor ve `index`'i kendi hücresine geri eşler. Günlük ve
 * "Sen kur" turu aynı şekli paylaşır.
 */
export interface RevealedCellDto {
  readonly index: number;
  readonly playerId: string;
  readonly playerName: string;
}

export interface RevealDailyInput {
  readonly now: Date;
  /** Açığa çıkarılacak hücreler; sıra yanıttaki `index`'i belirler. */
  readonly cells: readonly CellRef[];
  /** Kullanıcının kendi yerleştirdiği oyuncular — örneklerden dışlanır (BR-10). */
  readonly used: readonly string[];
}

/**
 * BR-66 — günün ızgarasında pes eden kullanıcıya örnek cevaplar.
 *
 * Izgara BURADA DA yeniden üretilir, istemciden gelen koordinat kendi
 * ızgaramıza bakılarak ölçüte çevrilir (BR-11/BR-12 ile aynı güvensizlik).
 * Örnekler SIRAYLA seçilir ve her seçilen bir sonrakinin dışlama kümesine
 * eklenir: aynı futbolcu iki hücrede belirmez (BR-10 hissi). Sıra zorunlu —
 * dışlama kümesi büyüyerek ilerliyor.
 */
export async function revealDailyGrid(
  input: RevealDailyInput,
  deps: GridDeps,
): Promise<RevealedCellDto[]> {
  const grid = await gridFor(dailySeed(input.now), deps);

  const chosen = new Set<string>(input.used);
  const revealed: RevealedCellDto[] = [];

  for (const [index, cell] of input.cells.entries()) {
    // Aralık dışı hücre bir SUNUCU hatası değil, geçersiz bir GİRDİDİR.
    if (!isCellRefInRange(cell)) {
      throw new ValidationError("Geçersiz hücre.");
    }

    const row = grid.rows[cell.row];
    const column = grid.columns[cell.column];
    if (row === undefined || column === undefined) {
      throw new GridUnavailableError();
    }

    const example = await deps.players.findExampleMatching(
      [row, column],
      chosen,
    );
    // Örneği bulunamayan hücre (tüm cevapları `used`'da) SESSİZCE ATLANIR:
    // uydurulacak bir cevap yok (§2.7), o hücre boş kalır.
    if (example === undefined) continue;

    chosen.add(String(example.id));
    revealed.push({
      index,
      playerId: String(example.id),
      playerName: example.name,
    });
  }

  return revealed;
}
