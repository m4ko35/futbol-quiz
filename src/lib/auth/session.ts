import { signSession, verifySession } from "./secrets";

/**
 * Oturum çerezi — PROJECT.md §11.10.
 *
 * DURUM SUNUCUDA TUTULMAZ. Her istekte bir oturum tablosuna bakmak, §11.3'te
 * hizaladığımız gecikme bütçesini iki katına çıkarırdı. Çerez kendi kendini
 * doğrular: gövde artı imza.
 *
 * ÇEREZ KENDİ BAŞINA YETKİ VERMEZ. Kullanıcı zaten her istekte veritabanından
 * okunuyor (ad, tur, puan). Silinmiş bir hesabın çerezi bu yüzden işe yaramaz
 * (BR-48) — kayıt yoksa istek reddedilir, çerezin ömrü dolmasa bile.
 */

/**
 * Çerez adları.
 *
 * `__Host-` ÖNEKİ KULLANILMIYOR ve sebebi ölçülebilir: o önek `Secure` ister,
 * yerel geliştirme ise `http://localhost` üzerinden çalışıyor. Aynı kodun iki
 * ortamda iki farklı çerez adı kullanması, yerelde çalışıp üretimde çalışmayan
 * bir sınıf hata açardı. Korumanın kendisi `Secure`, `HttpOnly` ve `SameSite`
 * ile zaten sağlanıyor.
 */
export const SESSION_COOKIE = "fq_oturum";
export const STATE_COOKIE = "fq_state";
export const NONCE_COOKIE = "fq_nonce";
export const VERIFIER_COOKIE = "fq_pkce";
export const PENDING_COOKIE = "fq_yeni";

/**
 * Oturum ömrü — 30 gün.
 *
 * Uzun tutmanın gerekçesi ürüne ait: bu bir günlük alışkanlık oyunu ve her
 * hafta yeniden giriş istemek tam da teşvik etmeye çalıştığımız dönüşü
 * caydırır. Bedeli sınırlı, çünkü çerezin koruduğu şey bir lider tablosu
 * sırası — ödeme yok, kişisel veri yok (§11.2).
 */
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/**
 * Giriş akışının ara çerezleri KISA ÖMÜRLÜ: 10 dakika.
 *
 * Google'a gidip dönmek saniyeler sürer. Uzun ömür, yarım kalmış bir giriş
 * denemesinin günler sonra tamamlanabilmesi demekti.
 */
export const FLOW_MAX_AGE_SECONDS = 10 * 60;

const SEPARATOR = ".";

/**
 * Çerez gövdesi: `kullanıcıKimliği.sonKullanma`.
 *
 * SON KULLANMA İMZANIN İÇİNDE. Yalnızca çerezin `Max-Age` alanına
 * yazılsaydı, tarayıcı üzerinden değiştirilebilir bir sınır olurdu — çerezi
 * saklayan biri süresiz kullanırdı. İmzalı gövde bunu imkânsız kılar.
 */
function payloadOf(userId: string, expiresAt: number): string {
  return `${userId}${SEPARATOR}${expiresAt}`;
}

export async function createSessionValue(
  secret: string,
  userId: string,
  now: Date,
): Promise<string> {
  const expiresAt = now.getTime() + SESSION_MAX_AGE_SECONDS * 1_000;
  const payload = payloadOf(userId, expiresAt);
  const signature = await signSession(secret, payload);

  return `${payload}${SEPARATOR}${signature}`;
}

/**
 * Çerezden kullanıcı kimliği; geçersizse `null`.
 *
 * "Geçersiz" hepsini kapsar: bozuk biçim, yanlış imza, süresi geçmiş. Çağıran
 * için hepsi aynı sonucu doğurur — oturum yok — ve ayırt etmek bir saldırgana
 * hangi kısmı doğru tahmin ettiğini söylerdi.
 */
export async function readSessionValue(
  secret: string,
  value: string | undefined,
  now: Date,
): Promise<string | null> {
  if (value === undefined) return null;

  const parts = value.split(SEPARATOR);
  if (parts.length !== 3) return null;

  const [userId, expiresText, signature] = parts;
  if (
    userId === undefined ||
    expiresText === undefined ||
    signature === undefined
  ) {
    return null;
  }

  const payload = payloadOf(userId, Number(expiresText));

  // İMZA ÖNCE. Süre denetimi imzasız gövdeye güvenmek olurdu; sıra tersine
  // çevrilirse saldırgan uydurduğu bir süreyle denetimi atlatır.
  if (!(await verifySession(secret, payload, signature))) return null;

  const expiresAt = Number(expiresText);
  if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) return null;
  if (userId.length === 0) return null;

  return userId;
}

/**
 * Hesabı olmayan ama Google'da doğrulanmış kullanıcı — ad seçme adımı için.
 *
 * NEDEN AYRI BİR ÇEREZ. Kullanıcı doğrulandı ama henüz hesabı yok (BR-46 adı
 * kendisi seçecek). Oturum çerezi verilseydi hesapsız bir oturum doğardı ve
 * her çağıranın "peki ya kullanıcı yoksa" durumunu ayrıca düşünmesi
 * gerekirdi. Ayrı çerez, o durumu tek bir yola hapsediyor.
 *
 * İçeriği `sub` ÖZETİDİR, ham `sub` değil — ham değer hiçbir yere yazılmaz.
 */
export async function createPendingValue(
  secret: string,
  subjectHash: string,
  now: Date,
): Promise<string> {
  const expiresAt = now.getTime() + FLOW_MAX_AGE_SECONDS * 1_000;
  const payload = payloadOf(subjectHash, expiresAt);
  const signature = await signSession(secret, payload);

  return `${payload}${SEPARATOR}${signature}`;
}

/** Bekleyen kaydın `sub` özeti; geçersizse `null`. */
export function readPendingValue(
  secret: string,
  value: string | undefined,
  now: Date,
): Promise<string | null> {
  // Biçim ve doğrulama oturumla AYNI; ayrı bir çözümleyici yazmak ikisinin
  // zamanla ayrışması demekti.
  return readSessionValue(secret, value, now);
}
