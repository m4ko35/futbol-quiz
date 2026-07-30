/**
 * İstemci kimliğinin `X-Forwarded-For` başlığından çıkarılması (§7.5).
 *
 * TEHDİT: `X-Forwarded-For` istemcinin yazabildiği bir başlıktır. Ham hâline
 * güvenmek hız sınırlamasını tamamen etkisiz kılar — saldırgan her istekte
 * başka bir değer yazar ve her seferinde yeni bir kova alır.
 *
 * DOĞRU OKUMA: her ters vekil, başlığa KENDİ gördüğü adresi ekler. Önümüzde
 * `n` adet güvendiğimiz vekil varsa, sondan `n`. giriş bizim altyapımızın
 * yazdığı ilk değerdir; soldaki her şey istemcinin uydurmuş olabileceği
 * kısımdır ve atılır.
 *
 *   İstemci "sahte" yazar        → XFF: "sahte"
 *   Kenar vekil kendi gördüğünü ekler → XFF: "sahte, 203.0.113.7"
 *   n = 1  → sondan 1. giriş = 203.0.113.7  ✓ gerçek istemci
 */

/** Aşırı uzun başlıkların bellek şişirmesini önler (§7.1). */
const MAX_KEY_LENGTH = 64;

/**
 * Vekil arkasında olmadığımızda kullanılan tek ortak anahtar.
 *
 * Bu durumda hız sınırı istemci başına DEĞİL, sunucu geneli olur. Bilinçli bir
 * seçim: yanlış olduğunu bildiğimiz bir başlığa güvenip sınırlamayı işlevsiz
 * kılmaktansa, daha kaba ama gerçekten uygulanan bir sınır tercih edilir.
 */
export const SHARED_KEY = "shared";

export function resolveClientKey(
  headers: Headers,
  trustedProxyHops: number,
): string {
  if (trustedProxyHops <= 0) return SHARED_KEY;

  const forwarded = headers.get("x-forwarded-for");
  if (forwarded === null) return SHARED_KEY;

  const parts = forwarded
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  const candidate = parts[parts.length - trustedProxyHops];

  // Beklenenden az giriş var: zincir yapılandırıldığı gibi değil. Uydurma bir
  // değere düşmek yerine ortak anahtara düşülür — yanlış yapılandırma, hız
  // sınırını sessizce devre dışı bırakmamalı.
  if (candidate === undefined) return SHARED_KEY;

  return candidate.slice(0, MAX_KEY_LENGTH);
}
