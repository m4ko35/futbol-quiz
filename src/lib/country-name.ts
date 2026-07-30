/**
 * ISO 3166-1 alpha-2 kodu → Türkçe ülke adı.
 *
 * NEDEN ELLE YAZILMIŞ BİR TABLO DEĞİL. İlk sürümde ızgara havuzundaki 30 kod
 * için elle yazılmış bir eşleme vardı; oyuncu seçicisi ise veri kümesindeki
 * **170** kodun tamamını göstermek zorunda ve o tabloda olmayan kodlar ham
 * hâliyle ("IT", "AR") görünüyordu. İki ayrı eşleme olsaydı aynı ülke iki
 * ekranda iki farklı adla çıkabilirdi.
 *
 * ÖLÇÜLDÜ: `Intl.DisplayNames(["tr"], {type:"region"})` veri kümesindeki 170
 * kodun **170'ini** çözüyor ve elle yazılmış 30 etiketin **28'iyle birebir**
 * aynı sonucu veriyor. Kalan ikisi bilinçli tercih olarak aşağıda kalıyor.
 *
 * ICU SÜRÜMÜ NOTU: çıktı çalışma zamanının ICU verisinden gelir; sürümler
 * arasında bir ad değişebilir. Bu yalnızca GÖRÜNEN etiketi etkiler — ızgaranın
 * kimliği ülke KODUNA bağlıdır (BR-11), etikete değil.
 */

/**
 * Bilinçli sapmalar.
 *
 * `US` — CLDR "Amerika Birleşik Devletleri" verir; ızgara başlığında üç
 * satıra sarardı, kısaltma yaygın ve anlaşılır.
 * `CI` — CLDR Türkçesi endonimi ("Côte d'Ivoire") kullanıyor; Türkçede
 * yerleşik ad "Fildişi Sahili".
 */
const OVERRIDES: Readonly<Record<string, string>> = {
  US: "ABD",
  CI: "Fildişi Sahili",
};

/**
 * Biçimlendirici bir kez kurulur.
 *
 * `Intl.DisplayNames` kurulumu ucuz değildir ve oyuncu listesinde satır başına
 * bir kez çağrılıyor. Tembel kurulum, ortamın desteklemediği durumda modülün
 * yüklenmesini de engellemez.
 */
let display: Intl.DisplayNames | null | undefined;

function formatter(): Intl.DisplayNames | null {
  if (display !== undefined) return display;

  try {
    display = new Intl.DisplayNames(["tr"], { type: "region" });
  } catch {
    // Ortamda bölge verisi yoksa kodun kendisi gösterilir; çökmek gereksiz.
    display = null;
  }
  return display;
}

/**
 * Kod çözülemezse KODUN KENDİSİ döner — boş bir etiket göstermekten iyidir.
 *
 * BÜYÜK HARFE ÇEVİRME ZORUNLU: `Intl` küçük harfli kodu çözmez, sessizce
 * girdiyi geri verir (`"tr"` → `"tr"`, `"TR"` → `"Türkiye"`). ETL şu an kodları
 * büyütüyor ama bu fonksiyonun sözleşmesi "alpha-2 kodu → Türkçe ad" olmalı,
 * "büyük harfli alpha-2 kodu" değil.
 */
export function countryName(code: string): string {
  const upper = code.toUpperCase();

  const override = OVERRIDES[upper];
  if (override !== undefined) return override;

  try {
    // Çözülemeyen kodda `of()` girdiyi geri verir; biçimsiz kodda fırlatır.
    return formatter()?.of(upper) ?? code;
  } catch {
    return code;
  }
}
