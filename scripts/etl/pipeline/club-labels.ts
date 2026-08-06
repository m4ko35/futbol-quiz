import type { NormalizedClub } from "./normalize";

/**
 * Seçicide AYIRT EDİLEBİLİR kısa ad — PROJECT.md §5.3.
 *
 * §5.3'ün ikiz birleştirmesi, birleştirilmesi DOĞRU OLAN çiftleri tek kulübe
 * indiriyor. Geriye kalanlar gerçekten ayrı kulüplerdir — `Toulouse FC`
 * (1937–1967) ile `Toulouse FC` (1970–) gibi — ve birleştirilmemeleri gerekir.
 * Ama kulüp seçici ikisini de aynı satırla basıyor: `shortName`, ülke ve arma.
 *
 * Arma ayırt edici SAYILMAZ; Wikidata'da sık sık boştur ve ölçülen üç kümenin
 * ikisinde en az bir taraf, Toulouse'da ise İKİ taraf da armasız. Geriye kalan
 * iki alan çakıştığında kullanıcının seçecek bir dayanağı kalmıyor.
 *
 * Bu geçiş yalnızca ÇAKIŞAN kümelere dokunur: 383 kulübün 380'i kısa adını
 * olduğu gibi korur.
 */

export interface ClubLabelResult {
  readonly clubs: NormalizedClub[];
  readonly stats: ClubLabelStats;
}

export interface ClubLabelStats {
  /** Kısa adı + ülkesi çakışan küme sayısı. */
  readonly collidingGroups: number;
  /** Kısa adı değiştirilen kulüp sayısı. */
  readonly renamed: number;
  /**
   * Üç kademe de tükendiği için hâlâ çakışan etiketler.
   *
   * Bu noktada elde kalan şey bir GÖSTERİM sorunu değildir: kısa adı, tam adı,
   * ülkesi ve kuruluş yılı aynı olan iki kayıt, kaynakta birleştirilmesi
   * gereken gerçek bir ikizdir (§5.3'ün "bağsız ikizler" boşluğu). Sessizce
   * geçilmez, rapor edilir.
   */
  readonly unresolved: readonly string[];
}

/**
 * Çakışmayı ÜLKEYLE BİRLİKTE arar, çünkü seçici ülkeyi de basıyor: aynı adı
 * taşıyan iki farklı ülke kulübü kullanıcı için zaten ayırt edilebilir.
 *
 * KARŞILAŞTIRMA BİREBİRDİR ve bu bilinçli. Sorulan soru "bu iki satır aynı
 * anlama mı geliyor" değil, "kullanıcı ekranda ikisini ayırt edebiliyor mu";
 * bir harfi bile farklı olan iki etiket ayırt edilebilir.
 *
 * ÖLÇÜLMÜŞ TUZAK: ilk sürüm `toLocaleLowerCase("tr")` ile karşılaştırıyordu.
 * Türkçe yerel ayarında `I` → `ı` olduğu için "REAL MADRID" ile "Real Madrid"
 * eşleşmiyordu — çok dilli bir veri kümesinde yerel ayara bağlı harf çevirimi
 * sessizce yanlış sonuç veriyor. Birim testi yakaladı.
 */
function groupKey(label: string, country: string | null): string {
  return `${label}|${country ?? ""}`;
}

function groupBy(
  clubs: readonly NormalizedClub[],
  key: (club: NormalizedClub) => string,
): Map<string, NormalizedClub[]> {
  const groups = new Map<string, NormalizedClub[]>();
  for (const club of clubs) {
    const k = key(club);
    const bucket = groups.get(k);
    if (bucket === undefined) groups.set(k, [club]);
    else bucket.push(club);
  }
  return groups;
}

/**
 * Çakışan bir kümede bu kulübü tek başına bırakan ilk etiketi döner.
 *
 * Kademeler ÖLÇÜLEREK sıralandı (§5.3): tam ad üç kümenin ikisini çözüyor,
 * kuruluş yılı sonuncuyu. Yıl en sona bırakıldı çünkü `P571` gürültülü
 * (§10.2) — başka hiçbir alanın ayırmadığı yerde kullanılıyor.
 */
function resolveLabel(
  club: NormalizedClub,
  group: readonly NormalizedClub[],
): string | null {
  const sameName = group.filter(
    (other) =>
      groupKey(other.name, other.country) === groupKey(club.name, club.country),
  );
  if (sameName.length === 1) return club.name;

  if (club.foundedYear === null) return null;
  const sameYear = sameName.filter(
    (other) => other.foundedYear === club.foundedYear,
  );
  if (sameYear.length === 1)
    return `${club.name} (${String(club.foundedYear)})`;

  return null;
}

export function disambiguateShortNames(
  clubs: readonly NormalizedClub[],
): ClubLabelResult {
  const groups = groupBy(clubs, (c) => groupKey(c.shortName, c.country));

  let collidingGroups = 0;
  for (const bucket of groups.values())
    if (bucket.length > 1) collidingGroups++;

  let renamed = 0;
  const relabelled = clubs.map((club) => {
    const group = groups.get(groupKey(club.shortName, club.country));
    if (group === undefined || group.length === 1) return club;

    const label = resolveLabel(club, group);
    if (label === null || label === club.shortName) return club;

    renamed++;
    return { ...club, shortName: label };
  });

  /**
   * SON DENETİM AYRI BİR GEÇİŞ. Kademe 1 kısa adı tam ada çevirdiği için,
   * ürettiği etiketin evrende BAŞKA bir kulübün kısa adıyla çakışması
   * kuramsal olarak mümkün. Ölçümde böyle bir durum yok (0), ama sessiz
   * kalmaktansa saymak: bu geçişin var oluş sebebi tam olarak bu.
   */
  const unresolved: string[] = [];
  for (const [, bucket] of groupBy(relabelled, (c) =>
    groupKey(c.shortName, c.country),
  )) {
    const first = bucket[0];
    if (bucket.length > 1 && first !== undefined)
      unresolved.push(first.shortName);
  }

  return {
    clubs: relabelled,
    stats: { collidingGroups, renamed, unresolved },
  };
}
