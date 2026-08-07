import { ValidationError } from "@/domain/errors/domain-error";
import {
  isSameCriterion,
  GRID_SIZE,
  type GridCriterion,
} from "@/domain/services/grid";
import { clubId, type PlayerId } from "@/domain/value-objects/identifiers";
import { countryName } from "@/lib/country-name";
import type { GridDeps } from "../game-modes/grid/generate";
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
  if (input.against.length > GRID_SIZE) {
    throw new ValidationError(`En çok ${String(GRID_SIZE)} ölçüt verilebilir.`);
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
