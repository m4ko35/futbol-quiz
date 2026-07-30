import type { Spell } from "../entities/spell";

/**
 * Bir dönemin ortaklık sayımına girip girmeyeceğini belirleyen ölçüt
 * (BR-2, BR-3).
 *
 * Bu tip yalnızca bir "seçenek torbası" değil, bir **sözleşmedir**: aynı ölçüt
 * hem burada (bellekte, `spellQualifies` ile) hem de repository'de (SQL WHERE
 * olarak) uygulanır. İkisi ayrışırsa kullanıcı, ekranda gördüğü sayıyla
 * listelenen oyuncuların uyuşmadığı bir durum yaşar. Bu yüzden ayrışmanın
 * olmadığı entegrasyon testiyle ölçülür (tests/integration).
 */
export interface SpellFilter {
  /** BR-2 — altyapı dönemleri varsayılan olarak SAYILMAZ. */
  readonly includeYouth: boolean;
  /** BR-3 — kiralık dönemler varsayılan olarak SAYILIR. */
  readonly includeLoans: boolean;
}

/** §6.2'deki varsayılanlar; tek kaynaktan okunur. */
export const DEFAULT_SPELL_FILTER: SpellFilter = {
  includeYouth: false,
  includeLoans: true,
};

/**
 * BR-2 + BR-3: bu dönem ortaklık sayımına girer mi?
 *
 * Kuralın tek yazılı hâli budur. Repository'deki SQL karşılığı bunun
 * çevirisidir, kopyası değil — çeviri sadakati test edilir.
 *
 * Girdi tam bir `Spell` değil, yalnızca gereken iki bayrak: kural başka hiçbir
 * alana bakmaz ve imzanın bunu söylemesi, çağıranın (özellikle testlerin)
 * ilgisiz on alanı uydurmasını gereksiz kılar.
 */
export function spellQualifies(
  spell: Pick<Spell, "isYouth" | "isLoan">,
  filter: SpellFilter,
): boolean {
  if (spell.isYouth && !filter.includeYouth) return false;
  if (spell.isLoan && !filter.includeLoans) return false;
  return true;
}
