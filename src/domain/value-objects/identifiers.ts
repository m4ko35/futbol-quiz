import { InvalidIdentifierError } from "../errors/domain-error";

/**
 * Markalı (branded) kimlikler — PROJECT.md §4.2.
 *
 * NEDEN düz `string` değil: bu sistemde kulüp ve oyuncu kimlikleri aynı biçimi
 * paylaşır (cuid). Düz string kullanıldığında derleyici `findSpells(playerId,
 * clubId)` çağrısında argümanların yer değiştirmesini göremez; hata ancak
 * çalışma zamanında, boş sonuç olarak ortaya çıkar. Marka bunu derleme
 * zamanında yakalar ve hiçbir çalışma zamanı maliyeti getirmez — marka alanı
 * yalnızca tip düzeyinde vardır, üretilen JavaScript'te iz bırakmaz.
 */

declare const brand: unique symbol;

type Branded<TValue, TBrand extends string> = TValue & {
  readonly [brand]: TBrand;
};

export type ClubId = Branded<string, "ClubId">;
export type PlayerId = Branded<string, "PlayerId">;

/**
 * Kimlik biçimi. Prisma `cuid()` üretir; desen buna uyar ama ona kilitlenmez.
 *
 * Bu bir güvenlik denetimi değil — Prisma parametreli sorgu kullandığı için
 * enjeksiyon riski zaten yok (§7.2). Amaç, anlamsız bir dizenin (boş, çok
 * uzun, kontrol karakterli) sisteme sessizce girmesini engellemek.
 */
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

function assertIdentifier(raw: string, kind: string): void {
  if (!ID_PATTERN.test(raw)) {
    throw new InvalidIdentifierError(kind, raw);
  }
}

export function clubId(raw: string): ClubId {
  assertIdentifier(raw, "kulüp");
  return raw as ClubId;
}

export function playerId(raw: string): PlayerId {
  assertIdentifier(raw, "oyuncu");
  return raw as PlayerId;
}

/** Doğrulamadan geçip geçmeyeceğini fırlatmadan sorar (sınır katmanı için). */
export function isValidIdentifier(raw: string): boolean {
  return ID_PATTERN.test(raw);
}
