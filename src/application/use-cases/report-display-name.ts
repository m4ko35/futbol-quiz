import { displayNameKey } from "@/domain/value-objects/display-name";
import type { ReportReason } from "@/domain/value-objects/report-reason";
import type { Account, AccountsRepository } from "../ports/accounts-repository";

/**
 * Bir görünen adı bildirme — PROJECT.md §11.12, BR-53.
 *
 * BİLDİRİM HİÇBİR OTOMATİK İŞLEM TETİKLEMEZ ve bu kuralın kalbi. Eşik koyup
 * "üç bildirim alan ad gizlenir" demek çekiciydi; reddedildi, çünkü anlaşmış
 * üç kişi hoşlanmadıkları meşru bir adı tablodan sildirebilirdi. Yani kötüye
 * kullanımı önlemek için konan mekanizma kendisi bir kötüye kullanım aracına
 * dönüşürdü. Burada yapılan tek şey KAYDETMEK; karar insana ait.
 *
 * HEDEF ADLA BELİRTİLİR, KİMLİKLE DEĞİL. Satırın kullanıcı kimliğini herkese
 * açık sayfaya basmak, bugün hiçbir yerde görünmeyen iç tanımlayıcıları
 * dışarıya sızdırırdı. Görünen ad ZATEN herkese açık ve zaten tekil (BR-46) —
 * yani kimliği eklemek yeni bir yetenek getirmez, yalnızca yeni bir yüzey
 * açardı.
 */

export type ReportOutcome =
  /** Kayıt alındı (ilk kez ya da zaten vardı — ikisi ayırt edilmez). */
  | "alindi"
  /** Kullanıcı kendi adını bildirmeye çalıştı. */
  | "kendini-bildiremez"
  /** Böyle bir ad yok (silinmiş hesap ya da uydurulmuş ad). */
  | "kullanici-yok";

export interface ReportDisplayNameInput {
  /** Oturum sahibi — SUNUCUDAN gelir, istemciden değil. */
  readonly reporter: Account;
  /** Bildirilen görünen ad; tekillik anahtarına burada çevrilir. */
  readonly reportedName: string;
  readonly reason: ReportReason;
}

export interface ReportDisplayNameDeps {
  readonly accounts: AccountsRepository;
}

export async function reportDisplayName(
  input: ReportDisplayNameInput,
  deps: ReportDisplayNameDeps,
): Promise<ReportOutcome> {
  /**
   * ARAMA NORMALLEŞTİRİLMİŞ ANAHTARLA: "Mehmet" yazan da "mehmet" yazan da
   * aynı kişiyi bildirmiş olmalı. Ham adla arasaydık büyük/küçük harf farkı
   * bildirimi sessizce boşa düşürürdü.
   */
  const reported = await deps.accounts.findByDisplayNameKey(
    displayNameKey(input.reportedName),
  );
  if (reported === null) return "kullanici-yok";

  /**
   * KENDİ ADINI BİLDİREMEZSİN.
   *
   * Anlamsız olduğu için değil, SAYIMI bozduğu için: işletmeci listeye
   * baktığında gördüğü sayı "kaç kişi rahatsız oldu" sorusunun cevabı olmalı.
   * Kişinin kendi satırı o sayıya karışmamalı.
   */
  if (reported.id === input.reporter.id) return "kendini-bildiremez";

  /**
   * "yazildi" ve "zaten-bildirdi" AYNI SONUCA çevriliyor.
   *
   * Bildiren kişi kendi bildirimini zaten biliyor, yani ayrımı taşımamak bir
   * bilgi kaybı değil; buna karşılık arayüzü sadeleştiriyor — kullanıcı her
   * koşulda aynı teşekkürü görür ve iki kez bildirmeye çalışmak bir hata
   * gibi görünmez.
   */
  await deps.accounts.saveNameReport({
    reporterId: input.reporter.id,
    reportedId: reported.id,
    reason: input.reason,
  });

  return "alindi";
}
