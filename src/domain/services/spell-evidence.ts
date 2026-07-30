import type { Spell } from "../entities/spell";
import { hasAnyYear } from "../value-objects/year-range";

/**
 * BR-8 — bu dönemin arkasında herhangi bir kanıt var mı? (PROJECT.md §5.4)
 *
 * Kanıt, Wikidata ifadesinin niteliklerinden gelen dört alandır: başlangıç
 * yılı, bitiş yılı, maç sayısı, gol sayısı. Dördü de boşsa elimizde "bu oyuncu
 * bu kulüpte oynadı" iddiasından başka hiçbir şey yoktur.
 *
 * NEDEN BU KAYITLAR ELENMİYOR — ölçüldü (§1.4). Elemek denendi; dönemlerin
 * %11,7'sini götürüyor ve götürdükleri karışık:
 *
 *   Bill Dale (Q4908654)      Man Utd + Man City   → DOĞRU, ikisinde de oynadı
 *   Harry McShane (Q48724)    Man Utd + Man City   → DOĞRU
 *   Emmanuel Petit (Q269883)  Barça + Real Madrid  → YANLIŞ, Real'de hiç yok
 *   Manuel Sanchís (Q776310)  Barça + Real Madrid  → YANLIŞ, Barça'da hiç yok
 *
 * Ardından Wikidata'da ayırt edici bir sinyal arandı — ifade `rank`'ı ve
 * kaynakça sayısı canlı sorguyla okundu. Yok: rank hepsinde `NormalRank`,
 * kaynakça ise TERS yönde çalışıyor (uydurma Petit kaydının kaynağı var,
 * doğru Bill Dale kaydının yok).
 *
 * Elemek doğruyu siler, tutmak yanlışı gösterir, veri ikisini ayırmaz. Geriye
 * tek dürüst davranış kalıyor: kaydı tut, kanıtının eksik olduğunu SÖYLE.
 * §2'nin 7. ilkesi bunu zaten söylüyordu — belirsizlik veri kaybından iyidir.
 *
 * Girdi tam bir `Spell` değil: kural yalnızca bu üç alana bakar ve imzanın
 * bunu söylemesi, çağıranın ilgisiz alanları uydurmasını gereksiz kılar.
 */
export function hasEvidence(
  spell: Pick<Spell, "years" | "appearances" | "goals">,
): boolean {
  return (
    hasAnyYear(spell.years) ||
    spell.appearances !== null ||
    spell.goals !== null
  );
}
