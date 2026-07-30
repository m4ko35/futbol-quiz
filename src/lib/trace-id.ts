/**
 * İstek izleme kimliği — PROJECT.md §6.3.
 *
 * Hata yanıtı kullanıcıya hiçbir iç ayrıntı vermez; ama destek istendiğinde
 * "şu kimlikle bir hata aldım" denebilmelidir. `traceId` yanıtla sunucu logunu
 * birbirine bağlayan TEK bağdır: yanıtta kimlik, logda kimlik + tam ayrıntı.
 */

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford Base32
const LENGTH = 16;

/**
 * Rastgele, çakışması pratikte imkânsız bir kimlik üretir.
 *
 * Neden Crockford Base32: `I`, `L`, `O`, `U` harfleri yok. Kullanıcı bu
 * kimliği telefonla okuyacak ya da elle yazacak; `0`/`O` ve `1`/`I`
 * karışıklığını en baştan ortadan kaldırmak destek maliyetini düşürür.
 *
 * Kimlik tahmin edilebilir olmamalıdır ama bir SIR değildir: yanıtta açıkça
 * döner. Yine de `Math.random` yerine Web Crypto kullanılıyor — sıralı ya da
 * tahmin edilebilir kimlikler istek hacmini dışarıya sızdırır.
 */
export function generateTraceId(): string {
  const bytes = new Uint8Array(LENGTH);
  crypto.getRandomValues(bytes);

  let id = "";
  for (const byte of bytes) {
    // `% 32` sapması ihmal edilebilir: kimlik bir güvenlik jetonu değil,
    // yalnızca çakışmaması gereken bir etikettir.
    id += ALPHABET[byte % ALPHABET.length];
  }
  return id;
}
