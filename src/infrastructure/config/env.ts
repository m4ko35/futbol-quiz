import { z } from "zod";

/**
 * Sunucu tarafı ortam yapılandırması — PROJECT.md §7.6.
 *
 * DİKKAT: Bu modül YALNIZCA sunucuda çalışır. Bir istemci bileşeninden
 * import edilirse sırlar tarayıcıya sızabilir. ESLint katman kuralı
 * `src/components/**` içinden `@/infrastructure/**` importunu zaten
 * engelliyor (§2.1); bu yorum o kuralın gerekçesidir.
 *
 * Buradaki hiçbir değişkene `NEXT_PUBLIC_` öneki VERİLMEZ — o önek değeri
 * istemci paketine gömer.
 */
const ServerEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL zorunlu"),

  // §7.5 — IP başına istek limiti.
  RATE_LIMIT_REQUESTS_PER_MINUTE: z.coerce.number().int().positive(),
  RATE_LIMIT_BURST: z.coerce.number().int().positive(),

  /**
   * Önümüzdeki GÜVENİLEN ters vekil sayısı (§7.5).
   *
   * `0` = doğrudan internete açık; `X-Forwarded-For` tamamen yok sayılır ve
   * hız sınırı sunucu geneline düşer. Değeri gerçekte olduğundan BÜYÜK
   * vermek, istemcinin uydurduğu adresi gerçek sanmaya yol açar — bu yüzden
   * varsayılan iyimser değil, tek vekildir.
   */
  TRUSTED_PROXY_HOPS: z.coerce.number().int().min(0).default(1),
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

let cached: ServerEnv | undefined;

/**
 * Doğrulanmış ortam değişkenlerini döner.
 *
 * Eksik veya geçersiz bir değişkende uygulama BAŞLAMAZ. Yarım yapılandırmayla
 * ayakta kalıp isteklere yanlış cevap vermektense hemen durmak doğrudur.
 */
export function serverEnv(): ServerEnv {
  if (cached !== undefined) return cached;

  const parsed = ServerEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  • ${i.path.join(".") || "(kök)"}: ${i.message}`)
      .join("\n");
    // Hata mesajı sunucu loguna gider; kullanıcıya asla gösterilmez (§6.3).
    throw new Error(`Ortam yapılandırması geçersiz:\n${issues}`);
  }

  cached = parsed.data;
  return cached;
}
