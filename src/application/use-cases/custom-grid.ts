import {
  GridUnavailableError,
  ValidationError,
} from "@/domain/errors/domain-error";
import {
  isSameCriterion,
  MAX_GRID_SIZE,
  type GridCriterion,
  type GridSize,
} from "@/domain/services/grid";
import { clubId, type PlayerId } from "@/domain/value-objects/identifiers";
import { countryName } from "@/lib/country-name";
import { generateGrid, type GridDeps } from "../game-modes/grid/generate";
import type { RevealedCellDto } from "./daily-grid";
import {
  DEFAULT_CLUB_RESULTS,
  MAX_CLUB_RESULTS,
  MAX_SEARCH_TERM_LENGTH,
} from "./search-clubs";

/**
 * "Sen kur" — ızgarayı kullanıcı kurar (PROJECT.md §9.1, BR-25, BR-26).
 *
 * GÜNLÜK IZGARADAN AYRILDIĞI YER TEK BİR CÜMLEDE: orada ölçütleri sunucu
 * üretir ve istemciden geleni asla dinlemez (BR-11/BR-12); burada ölçütleri
 * kullanıcı seçer, sunucu yalnızca var olduklarını doğrular.
 *
 * NEDEN GÜVENLİ. Uydurulacak bir şey yok — ızgarayı kuran zaten kullanıcı,
 * skor kaydedilmiyor, sıralama yok. "Kolay bir ızgara kurmak" bir açık değil,
 * modun kendisidir. Doğrulanan şey ölçütün VARLIĞI: kulüp seçilebilir mi,
 * ülke kodu alpha-2 biçiminde mi. Ayrıştırılmamış girdi iç katmanlara geçmez
 * (§2.3).
 */

/** İstemcinin gönderdiği ölçüt: yalnızca TÜR ve KİMLİK. */
export interface CriterionRef {
  readonly kind: "club" | "nationality";
  /** Kulüp kimliği ya da ISO 3166-1 alpha-2 ülke kodu. */
  readonly id: string;
}

/**
 * Dışarı çıkan ölçüt.
 *
 * ETİKETİ SUNUCU KOYAR, istemciden geleni geri yansıtmaz: aksi hâlde
 * "Barcelona" etiketli bir Göztepe kimliği gönderilebilir ve kullanıcı
 * cevabının neden yanlış sayıldığını anlayamazdı.
 */
export interface GridCriterionRefDto extends CriterionRef {
  readonly label: string;
}

/** Oynanmaya hazır bir ızgara — iki eksenin ölçüt referansları (BR-77, BR-26). */
export interface BuiltGridDto {
  readonly rows: GridCriterionRefDto[];
  readonly columns: GridCriterionRefDto[];
}

/**
 * BR-77 — "Rastgele ızgara": sunucu, kullanıcının seçtiği boyutta rastgele
 * oynanabilir bir ızgara üretir.
 *
 * NEDEN "SEN KUR" İLE AYNI YOL. Üretim günlük ızgarayla AYNI algoritmadır
 * (`generateGrid`) — fark yalnızca tohumdadır: günlük ızgara günün tohumunu
 * kullanır (BR-11), burada tohum rastgeledir. Dönen ızgara ölçüt referansları
 * olarak verilir; istemci onu tıpkı elle kurulmuş bir ızgara gibi oynar ve
 * cevaplar `custom-answer` / `custom-reveal` ile doğrulanır (BR-26). Böylece
 * yeni bir doğrulama ucu GEREKMEZ: üretilen ızgara kurulmuş bir ızgaradır.
 *
 * TOHUM SUNUCUDA SEÇİLİR. İstemci tohum gönderemez; aksi hâlde "rastgele"
 * ızgara kullanıcının elinde deterministik hâle gelir ve kolay ızgaralar
 * aranabilirdi. `seed` parametresi YALNIZCA testler için — üretimde her zaman
 * rastgeledir.
 *
 * ÜRETİLEMEZSE `GridUnavailableError`. Daha büyük boyutlarda (5×5) tek bir
 * tohum denemesi başarısız olabilir; `generateGrid` zaten 40 tohum dener
 * (§9.1). Hepsi tükenirse sessizce bozuk bir ızgara döndürmek yerine (§2.7)
 * hata verilir ve istemci "tekrar dene" der.
 */
export async function generateRandomGrid(
  size: GridSize,
  deps: GridDeps,
  seed: number = Math.floor(Math.random() * 0x7fffffff),
): Promise<BuiltGridDto> {
  const grid = await generateGrid(seed, deps, size);
  if (grid === null) throw new GridUnavailableError();

  return {
    rows: grid.rows.map(toRefDto),
    columns: grid.columns.map(toRefDto),
  };
}

export interface ListPlayableCriteriaInput {
  /** Adayın kesişmesi gereken ölçütler — seçilmiş sütunlar. */
  readonly against: readonly CriterionRef[];
  readonly term?: string;
  readonly limit?: number;
}

/**
 * BR-25 — bir eksene konabilecek ölçütler.
 *
 * Süzgeç ile doğrulayıcı BİREBİR AYNI kaynaktan beslenir: liste, port'un
 * "BR-9 bandında kesişir" sözleşmesinden gelir. Ölçüldü (§9.1): süzgeçsiz
 * serbest seçimde rastgele altı kulübün yalnızca %0,1'i geçerli ızgara
 * veriyor — yani süzgeç olmadan mod kullanılamaz.
 */
export async function listPlayableCriteria(
  input: ListPlayableCriteriaInput,
  deps: GridDeps,
): Promise<GridCriterionRefDto[]> {
  if (input.against.length === 0) {
    throw new ValidationError("En az bir ölçüt seçilmelidir.");
  }
  // Üst sınır EN BÜYÜK ızgara boyutudur (BR-27): 5×5 kuran kullanıcı beş
  // sütunun hepsine karşı süzgeç ister.
  if (input.against.length > MAX_GRID_SIZE) {
    throw new ValidationError(
      `En çok ${String(MAX_GRID_SIZE)} ölçüt verilebilir.`,
    );
  }

  const against = await resolveCriteria(input.against, deps);

  const criteria = await deps.players.findPlayableCriteria({
    against,
    term: normalizeTerm(input.term),
    limit: clampLimit(input.limit),
  });

  return criteria.map(toRefDto);
}

export interface CheckCustomAnswerInput {
  readonly row: CriterionRef;
  readonly column: CriterionRef;
  readonly playerId: PlayerId;
}

/**
 * BR-12 — cevap KİMLİKLE doğrulanır; bu kural burada da aynen geçerli.
 *
 * Hücre koordinatı GÖNDERİLMEZ: sunucu ızgaranın yerleşimini bilmiyor ve
 * bilmesine gerek de yok. Doğrulanan şey "bu oyuncu bu iki ölçütü birden
 * sağlıyor mu" sorusudur; hücrenin ızgarada nerede durduğu istemcinin
 * görüntüleme meselesi.
 */
export async function checkCustomAnswer(
  input: CheckCustomAnswerInput,
  deps: GridDeps,
): Promise<{ readonly correct: boolean }> {
  const [row, column] = await resolveCriteria([input.row, input.column], deps);

  if (row === undefined || column === undefined) {
    throw new ValidationError("Satır ve sütun ölçütleri zorunludur.");
  }
  // "Barcelona × Barcelona" bir soru değildir (`isGridShapeValid`).
  if (isSameCriterion(row, column)) {
    throw new ValidationError("Satır ve sütun aynı ölçüt olamaz.");
  }

  return {
    correct: await deps.players.matchesAll(input.playerId, [row, column]),
  };
}

export interface RevealCustomInput {
  /** Açığa çıkarılacak hücreler; her biri satır ve sütun ölçütüyle (BR-26). */
  readonly cells: readonly {
    readonly row: CriterionRef;
    readonly column: CriterionRef;
  }[];
  /** Kullanıcının kendi yerleştirdiği oyuncular — örneklerden dışlanır (BR-10). */
  readonly used: readonly string[];
}

/**
 * BR-66 — "Sen kur" ızgarasında pes eden kullanıcıya örnek cevaplar.
 *
 * `revealDailyGrid`'in kullanıcı ızgarası karşılığı: fark yalnızca ölçütlerin
 * KAYNAĞINDA (BR-26 — gövdeden gelir, tohumdan üretilmez), `checkCustomAnswer`
 * ile `checkAnswer` arasındaki farkın aynısı. Örnekler yine sırayla seçilir ve
 * dışlama kümesi büyür: aynı futbolcu iki hücrede belirmez (BR-10 hissi).
 */
export async function revealCustomGrid(
  input: RevealCustomInput,
  deps: GridDeps,
): Promise<RevealedCellDto[]> {
  const chosen = new Set<string>(input.used);
  const revealed: RevealedCellDto[] = [];

  for (const [index, pair] of input.cells.entries()) {
    const [row, column] = await resolveCriteria([pair.row, pair.column], deps);

    if (row === undefined || column === undefined) {
      throw new ValidationError("Satır ve sütun ölçütleri zorunludur.");
    }
    // "Barcelona × Barcelona" bir soru değildir (`isGridShapeValid`).
    if (isSameCriterion(row, column)) {
      throw new ValidationError("Satır ve sütun aynı ölçüt olamaz.");
    }

    const example = await deps.players.findExampleMatching(
      [row, column],
      chosen,
    );
    // Örneği bulunamayan hücre (tüm cevapları `used`'da) sessizce atlanır.
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

/**
 * Ölçüt referanslarını domain ölçütlerine çevirir — VARLIK DOĞRULAMASI (BR-26).
 *
 * Kulüpler TEK SORGUDA çözülür: üç sütun için üç gidiş-dönüş, seçicinin her
 * tuş vuruşunda ödenecek bir maliyet olurdu.
 *
 * Bulunamayan ya da seçilemez bir kulüp SESSİZCE ATLANMAZ. Atlansaydı ızgara
 * eksik kurulur ve kullanıcı neyin düştüğünü göremezdi — BR-24'te ölçülen
 * kalıbın aynısı.
 */
async function resolveCriteria(
  refs: readonly CriterionRef[],
  deps: GridDeps,
): Promise<GridCriterion[]> {
  const clubIds = refs
    .filter((ref) => ref.kind === "club")
    .map((ref) => clubId(ref.id));

  const clubs = clubIds.length === 0 ? [] : await deps.clubs.findByIds(clubIds);
  const byId = new Map(clubs.map((club) => [String(club.id), club]));

  return refs.map((ref) => {
    if (ref.kind === "nationality") {
      if (!ALPHA2.test(ref.id)) {
        throw new ValidationError("Geçersiz ülke kodu.");
      }
      return { type: "nationality", code: ref.id, label: countryName(ref.id) };
    }

    const club = byId.get(ref.id);
    // Seçilemez kulüp de "yok" sayılır: kullanıcıya sunulmayan bir kulüple
    // kurulan ızgara, seçicinin gösterdiğinden başka bir oyundur (§5.3).
    if (club === undefined || !club.isSelectable) {
      throw new ValidationError("Seçilen kulüp bulunamadı.");
    }
    return { type: "club", clubId: club.id, label: club.shortName };
  });
}

/** ISO 3166-1 alpha-2; etiketi `countryName` çözer (§9.1). */
const ALPHA2 = /^[A-Z]{2}$/;

function toRefDto(criterion: GridCriterion): GridCriterionRefDto {
  return criterion.type === "club"
    ? { kind: "club", id: String(criterion.clubId), label: criterion.label }
    : { kind: "nationality", id: criterion.code, label: criterion.label };
}

/** Kulüp aramasıyla aynı kural: boş metin "arama yok" demektir (§6.1). */
function normalizeTerm(term: string | undefined): string | null {
  if (term === undefined) return null;

  const trimmed = term.trim().slice(0, MAX_SEARCH_TERM_LENGTH);
  return trimmed.length === 0 ? null : trimmed;
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) {
    return DEFAULT_CLUB_RESULTS;
  }

  const asInteger = Math.trunc(limit);
  if (asInteger < 1) return 1;
  return Math.min(asInteger, MAX_CLUB_RESULTS);
}
