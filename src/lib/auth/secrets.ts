/**
 * Anahtar türetme ve imzalama — PROJECT.md §11.10.
 *
 * TEK GİZLİ ANAHTAR (`AUTH_SECRET`), İKİ AMAÇ. Oturum çerezinin imzası ve
 * Google `sub` değerinin özeti aynı anahtardan **farklı etiketlerle**
 * türetilir. İki ayrı ortam değişkeni istemek yapılandırmayı büyütür ve
 * birinin unutulması ihtimalini doğurur; etiket ayrımı aynı yalıtımı sağlar.
 *
 * ETİKET AYRIMI NEDEN ÖNEMLİ: aynı anahtarla iki farklı şey imzalanırsa, bir
 * bağlamda üretilen imza diğerinde geçerli olabilir. Etiket, mesajın hangi
 * amaçla imzalandığını imzanın İÇİNE yazar.
 *
 * Web Crypto kullanılıyor, `node:crypto` değil: ikincisi çalışma ortamına
 * bağlar. `crypto.subtle` hem Node hem kenar çalışma zamanında yerleşiktir.
 */

const LABEL_SUBJECT = "futbol-quiz:sub:v1";
const LABEL_SESSION = "futbol-quiz:oturum:v1";

const encoder = new TextEncoder();

/**
 * Anahtar önbelleği.
 *
 * `importKey` her çağrıda yapılırsa her istek fazladan iş yapar. Anahtar
 * ETİKETE ve GİZLİ ANAHTARIN KENDİSİNE göre önbelleklenir; ayırıcı NUL
 * baytıdır, çünkü ne etikette ne base64 anahtarda geçebilir.
 *
 * ÖNBELLEK ANAHTARI ÖNCE `secret.length` İDİ VE BU BİR KUSURDU: aynı
 * uzunluktaki iki farklı gizli anahtar aynı önbellek girdisini paylaşıyor,
 * yani imza gizli anahtara bağlı olmaktan ÇIKIYORDU. Üretimde tek anahtar
 * kullanıldığı için hiç görünmezdi — bir test yakaladı.
 */
const keys = new Map<string, Promise<CryptoKey>>();

function keyFor(secret: string, label: string): Promise<CryptoKey> {
  const cacheKey = `${label}\u0000${secret}`;
  const cached = keys.get(cacheKey);
  if (cached !== undefined) return cached;

  const created = crypto.subtle.importKey(
    "raw",
    encoder.encode(`${label}\u0000${secret}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  keys.set(cacheKey, created);
  return created;
}

function toBase64Url(bytes: ArrayBuffer): string {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

async function hmac(
  secret: string,
  label: string,
  message: string,
): Promise<string> {
  const key = await keyFor(secret, label);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(message),
  );
  return toBase64Url(signature);
}

/**
 * Google `sub` değerinin özeti — ham değer HİÇBİR YERDE saklanmaz (§11.3).
 *
 * YALIN ÖZET DEĞİL, HMAC. Yalın özet (`sha256(sub)`) veritabanı sızdığında
 * yeterli olmazdı: elinde bir `sub` olan biri özeti hesaplayıp karşılaştırır
 * ve "bu Google hesabı burada oynuyor mu" sorusunu yanıtlardı. Sunucuya özel
 * anahtar bu karşılaştırmayı imkânsız kılıyor.
 */
export function hashSubject(secret: string, subject: string): Promise<string> {
  return hmac(secret, LABEL_SUBJECT, subject);
}

/** Oturum çerezinin gövdesini imzalar. */
export function signSession(secret: string, payload: string): Promise<string> {
  return hmac(secret, LABEL_SESSION, payload);
}

/**
 * İmzayı SABİT SÜREDE karşılaştırır.
 *
 * `a === b` erken çıkar ve ne kadar erken çıktığı, kaç karakterin doğru
 * tahmin edildiğini sızdırır. Bir saldırgan bunu ölçerek imzayı karakter
 * karakter kurabilir. Buradaki döngü her zaman TÜM uzunluğu gezer.
 *
 * Uzunluk farkı sızabilir ve bu kabul edilmiştir: HMAC-SHA256 çıktısı her
 * zaman aynı uzunlukta, yani farklı uzunluk zaten geçersiz bir imza demek.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** İmzayı doğrular — sabit süreli karşılaştırmayla. */
export async function verifySession(
  secret: string,
  payload: string,
  signature: string,
): Promise<boolean> {
  const expected = await signSession(secret, payload);
  return timingSafeEqual(expected, signature);
}

/** Kriptografik rastgele dizgi — `state`, `nonce` ve PKCE doğrulayıcısı için. */
export function randomToken(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes.buffer);
}

/** PKCE meydan okuması — doğrulayıcının SHA-256 özeti (S256 yöntemi). */
export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(verifier),
  );
  return toBase64Url(digest);
}
