/**
 * Geri bildirim postacısı port'u — PROJECT.md §7.4.
 *
 * Uygulama katmanı "geri bildirimi ilet" der; NASIL iletildiği (Resend, SMTP,
 * bir kuyruk) altyapının bilgisidir. Port bu sınırı çizer: use-case yalnızca
 * bu arayüzü görür, somut postacıyı route enjekte eder (kompozisyon kökü).
 * Böylece use-case testi ağ olmadan, sahte bir postacıyla koşar.
 */

export interface FeedbackEmail {
  /**
   * Kullanıcının yanıt adresi — postanın `reply_to` başlığına gider, böylece
   * işletmeci doğrudan yanıtlayabilir. Zod ile e-posta biçimi doğrulandığından
   * satır sonu (CRLF) taşıyamaz; başlık enjeksiyonu bu yüzden mümkün değil.
   */
  readonly replyTo: string;
  /** Kullanıcının yazdığı görüş/öneri/şikayet — postanın gövdesi. */
  readonly message: string;
}

export type FeedbackSendResult =
  | { readonly ok: true }
  /** Ağ hatası/zaman aşımı: sağlayıcıya ULAŞILAMADI. */
  | { readonly ok: false; readonly reason: "ulasilamadi" }
  /** Sağlayıcı isteği REDDETTİ (yanlış anahtar, biçim, kota). */
  | { readonly ok: false; readonly reason: "reddedildi" };

export interface FeedbackMailer {
  send(email: FeedbackEmail): Promise<FeedbackSendResult>;
}
