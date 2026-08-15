import type { CareerTotal } from "../sources/wikipedia/career-total";
import type { NormalizedSpell } from "./normalize";

/**
 * KARİYER TOPLAMI ÇAPRAZ DENETİMİ — PROJECT.md §9.2, BR-42 ile aynı sınıf.
 *
 * NEDEN VAR, ölçülmüş bir artıktan. `parseCareerTotal` üç turluk sıkılaştırma
 * sonunda BR-15 aday havuzunda %78,3 okuyor ve okuduklarının **%3,5'i hâlâ
 * yanlış**: Gheorghe Popescu için 642 maç / 77 gol veriyor, oysa bizim yalnız
 * LİG sayımız 623/87 — yani "bütün kulvarların toplamı", lig golünden az
 * çıkıyor. Habib Beye'de 262/5 ↔ 359/15.
 *
 * BU KUSUR AYRIŞTIRICININ İÇİNDEN ÇÖZÜLEMEZ ve çözülmeye çalışılmamalı:
 * `career-total.ts` saftır (§8.1), bizim lig sayımızı bilmez ve bilmemeli.
 * Elimizdeki ikinci ölçü buradadır; denetim de buraya aittir.
 *
 * KURAL TEK CÜMLE: bütünü kapsayan sayı, parçasından küçük olamaz. Kulüp
 * kariyeri lig + kupa + Avrupa'dır; lig onun ALT KÜMESİDİR. Küçükse ya tablo
 * eksik, ya yanlış satır okunmuş, ya da iki kaynak farklı oyuncudan
 * bahsediyor. Üçünde de doğru davranış aynı: **sayıyı yazma**.
 *
 * SESSİZCE DÜZELTMEZ. Değeri lig sayımıza yükseltmek ya da farkı kapatmak
 * akla gelebilir; ikisi de uydurma olurdu. `null` sıfır olmadığı gibi tahmin
 * de değildir (§2.7) — kayıt düşer, gerekçesi raporlanır.
 */

/** Lig sayımızla çelişen bir kariyer toplamı. */
export interface CareerTotalConflict {
  readonly playerWikidataId: string;
  /** Vikipedi'nin söylediği kulüp kariyeri. */
  readonly parsed: CareerTotal;
  /** Bizim kapsamdaki 24 ligden topladığımız. */
  readonly leagueAppearances: number | null;
  readonly leagueGoals: number | null;
  readonly reason: "appearances" | "goals";
}

export interface CareerTotalCheckResult {
  /** Denetimi geçen kayıtlar — yazılabilir. */
  readonly accepted: ReadonlyMap<string, CareerTotal>;
  /** Düşen kayıtlar, gerekçesiyle. */
  readonly conflicts: readonly CareerTotalConflict[];
}

/**
 * Lig toplamlarını oyuncu başına hesaplar.
 *
 * EKSİK DEĞER TAŞIYAN OYUNCU KIYASLANMAZ. Depodaki `valueOf` ile aynı kural
 * (BR-16): tek bir dönemde bile `null` varsa toplam yanıltıcıdır ve
 * yanıltıcı bir sayıyla denetim yapmak, denetimin kendisini yanıltıcı yapar.
 * O oyuncularda kıyas ölçüsü YOK sayılır — kayıt kapıdan geçer.
 */
function leagueTallies(
  spells: readonly NormalizedSpell[],
): Map<string, { appearances: number | null; goals: number | null }> {
  const sums = new Map<
    string,
    { appearances: number; goals: number; broken: boolean }
  >();

  for (const spell of spells) {
    if (spell.isYouth) continue;

    const current = sums.get(spell.playerWikidataId) ?? {
      appearances: 0,
      goals: 0,
      broken: false,
    };

    if (spell.appearances === null || spell.goals === null) {
      current.broken = true;
    } else {
      current.appearances += spell.appearances;
      current.goals += spell.goals;
    }

    sums.set(spell.playerWikidataId, current);
  }

  const result = new Map<
    string,
    { appearances: number | null; goals: number | null }
  >();
  for (const [playerId, sum] of sums) {
    result.set(
      playerId,
      sum.broken
        ? { appearances: null, goals: null }
        : { appearances: sum.appearances, goals: sum.goals },
    );
  }
  return result;
}

/**
 * Kariyer toplamlarını kendi lig sayımızla karşılaştırır.
 *
 * KİRALIK DÖNEMLER DIŞARIDA DEĞİL — ve bu, `cross-check.ts`'ten kasıtlı bir
 * ayrımdır. Orada soru "oyuncu bu kulüpte miydi" idi ve kiralık dönem iki
 * kulübün aynı anda görünmesini meşru kılıyordu. Burada soru bir TOPLAM'ın
 * büyüklüğü; kiralıkta oynanan maç da kariyerin parçasıdır ve Vikipedi'nin
 * toplamına dâhildir. Dışarıda bırakmak lig sayımızı yapay olarak küçültür,
 * yani kapıyı gereğinden gevşek yapardı.
 */
export function checkCareerTotals(input: {
  readonly careerTotals: ReadonlyMap<string, CareerTotal>;
  readonly spells: readonly NormalizedSpell[];
}): CareerTotalCheckResult {
  const league = leagueTallies(input.spells);

  const accepted = new Map<string, CareerTotal>();
  const conflicts: CareerTotalConflict[] = [];

  for (const [playerId, parsed] of input.careerTotals) {
    const ours = league.get(playerId);
    const leagueAppearances = ours?.appearances ?? null;
    const leagueGoals = ours?.goals ?? null;

    const reason: CareerTotalConflict["reason"] | null =
      parsed.appearances !== null &&
      leagueAppearances !== null &&
      parsed.appearances < leagueAppearances
        ? "appearances"
        : parsed.goals !== null &&
            leagueGoals !== null &&
            parsed.goals < leagueGoals
          ? "goals"
          : null;

    if (reason === null) {
      accepted.set(playerId, parsed);
    } else {
      conflicts.push({
        playerWikidataId: playerId,
        parsed,
        leagueAppearances,
        leagueGoals,
        reason,
      });
    }
  }

  return { accepted, conflicts };
}
