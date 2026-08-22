import type { WikipediaSpell } from "./merge-wikipedia";

/**
 * BR-60 — Wikidata omurgası olmayan oyuncunun ikinci kaynak şartı
 * (PROJECT.md §4.3, Aşama 3).
 *
 * SAF FONKSİYON: ağ yok, veritabanı yok.
 *
 * NEDEN GEREKLİ. Kadro keşfiyle bulunan oyuncunun hiçbir `P54` ifadesi yoktur;
 * kariyerinin TEK kaynağı Vikipedi bilgi kutusudur. Bugüne kadar her dönemin
 * bir Wikidata dayanağı vardı ve Vikipedi ya onu tamamlıyor ya ona itiraz
 * ediyordu — Leão vandalizmini yakalayan da bu ikilikti (§8.2). BR-42 bu
 * oyuncuları KORUYAMAZ, çünkü o kural iki kaynağın çelişmesini ölçer ve burada
 * çelişecek ikinci kaynak yoktur.
 *
 * NEDEN BİRLEŞTİRMEDEN ÖNCE ÇALIŞIR. Kanıt `WikipediaSpell.sites` alanında
 * duruyor ve birleştirme onu taşımıyor (`toNewSpell` yalnızca `NormalizedSpell`
 * üretir). Kuralı sonraya bırakmak, kanıtı geri getirmek için `NormalizedSpell`
 * içine geçici bir alan açmayı gerektirirdi; kural kanıtın yanında durursa
 * böyle bir alana ihtiyaç kalmıyor.
 *
 * ÇITA `wikipedia-verdict.ts` İLE AYNI ve bu bilinçli: orada bir dönemi
 * REDDETMEK için iki bağımsız dil isteniyor, burada bir dönemi KABUL etmek
 * için. İki yönde farklı çıta koymak, aynı kanıta iki değer biçmek olurdu.
 *
 * KAPSAM DAR. Yalnızca `discoveredIds` içindeki oyuncular. Wikidata dayanağı
 * olan hiçbir dönemin davranışı değişmez — o dönemler zaten iki kaynaklı.
 */

/** BR-60 çıtası: bir dil karantina, iki dil kabul. */
export const MIN_SITES_FOR_DISCOVERED = 2;

export interface SquadVerdictStats {
  /** Keşfedilen oyunculara ait okunan dönem kaydı. */
  discoveredRecords: number;
  /** ≥2 dil yazdığı için kabul edilen. */
  admitted: number;
  /** Tek dil yazdığı için karantinaya alınan. */
  quarantined: number;
  /** En az bir dönemi kabul edilen oyuncu. */
  playersAdmitted: number;
  /** Hiçbir dönemi kabul edilmeyen oyuncu — evrene hiç girmez. */
  playersFullyQuarantined: number;
}

export interface SquadVerdictResult {
  /**
   * Birleştirmeye GİRECEK kayıtlar.
   *
   * Keşfedilmemiş oyuncuların kayıtları olduğu gibi geçer; kural onlara
   * dokunmaz.
   */
  readonly spells: WikipediaSpell[];
  /**
   * Tek dilin yazdığı, bu yüzden yüklenmeyen kayıtlar.
   *
   * SİLİNMEZ, RAPORLANIR. Karantina "hafifçe sil" değil "karar veremedim"
   * demektir (§4.3, BR-42 ile aynı ayrım): kayıt listede durur ve bir sonraki
   * koşuda ikinci bir dil yazarsa kendiliğinden kabul edilir.
   */
  readonly quarantined: WikipediaSpell[];
  readonly stats: SquadVerdictStats;
}

export function applySquadVerdict(input: {
  readonly spells: readonly WikipediaSpell[];
  readonly discoveredIds: ReadonlySet<string>;
  readonly minSites?: number;
}): SquadVerdictResult {
  const minSites = input.minSites ?? MIN_SITES_FOR_DISCOVERED;

  const spells: WikipediaSpell[] = [];
  const quarantined: WikipediaSpell[] = [];
  const admittedPlayers = new Set<string>();
  const touchedPlayers = new Set<string>();
  let discoveredRecords = 0;

  for (const spell of input.spells) {
    if (!input.discoveredIds.has(spell.playerWikidataId)) {
      spells.push(spell);
      continue;
    }

    discoveredRecords++;
    touchedPlayers.add(spell.playerWikidataId);

    // `sites` aynı dönemi yazan BÜTÜN dilleri biriktirir; ikinci dilin kopyası
    // atılırken kanıtı bu alana ekleniyor (§4.3).
    if (new Set(spell.sites).size >= minSites) {
      spells.push(spell);
      admittedPlayers.add(spell.playerWikidataId);
    } else {
      quarantined.push(spell);
    }
  }

  return {
    spells,
    quarantined,
    stats: {
      discoveredRecords,
      admitted: discoveredRecords - quarantined.length,
      quarantined: quarantined.length,
      playersAdmitted: admittedPlayers.size,
      playersFullyQuarantined: [...touchedPlayers].filter(
        (id) => !admittedPlayers.has(id),
      ).length,
    },
  };
}
