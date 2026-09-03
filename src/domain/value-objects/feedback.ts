/**
 * Geri bildirim mesajı — kullanıcının siteyle ilgili görüş/öneri/şikayeti.
 *
 * Bu modül domain'dedir ve hiçbir şeye bağımlı değildir (§2.1): yalnızca
 * uzunluk sınırlarını taşır. Sınırlar TEK yerde durur çünkü üç yer okur —
 * sınır kontrolündeki Zod şeması, istemci formunun `maxLength`'i ve testler.
 * Ayrı ayrı yazılsalardı biri değişip diğerleri sessizce ayrışırdı.
 */

/**
 * ALT SINIR 10: "asd", "test" gibi mesajlar bir geri bildirim değil, gürültü.
 * On karakter, en azından bir cümlenin başladığını gösterir; kesin bir eşik
 * değil ama boş/anlamsız gönderimleri elemeye yeter.
 *
 * ÜST SINIR 2000: bir e-posta gövdesini sınırlar. Sınırsız bir metin hem posta
 * sağlayıcısının gövde sınırına takılabilir hem de tek bir istekle büyük bir
 * yük göndermeyi mümkün kılardı; 2000 karakter uzun bir paragraf için fazlasıyla
 * yeterli.
 */
export const FEEDBACK_MESSAGE_MIN_LENGTH = 10;
export const FEEDBACK_MESSAGE_MAX_LENGTH = 2000;
