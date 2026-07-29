import { z } from "zod";

/**
 * ETL ortam yapılandırması — PROJECT.md §2.3 ve §7.6.
 *
 * Geçersiz veya eksik değişkende süreç BAŞLAMAZ (hızlı başarısızlık). Yarım
 * yapılandırmayla çalışıp veritabanını bozuk veriyle doldurmaktansa hemen
 * durmak yeğdir.
 */
const EtlEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL boş olamaz"),

  // Wikidata, kendisine kimlik bildirmeyen istemcileri engeller. Bir iletişim
  // adresi (URL veya e-posta) içermeyen User-Agent kabul edilmez.
  ETL_USER_AGENT: z
    .string()
    .min(10, "ETL_USER_AGENT çok kısa")
    .refine((v) => v.includes("http") || v.includes("@"), {
      message:
        "ETL_USER_AGENT bir iletişim adresi içermeli (URL veya e-posta). " +
        "Wikidata kimliksiz istemcileri engelliyor.",
    }),

  WIKIDATA_SPARQL_ENDPOINT: z.url("Geçerli bir URL olmalı"),

  // Wikidata'ya saniyede 2'den fazla istek atmak nezaketsizliktir ve
  // engellenmeye yol açar (§7.4).
  ETL_REQUESTS_PER_SECOND: z.coerce
    .number()
    .positive()
    .max(2, "Wikidata'ya saniyede 2'den fazla istek atmayın"),
});

export type EtlConfig = z.infer<typeof EtlEnvSchema>;

export function loadEtlConfig(): EtlConfig {
  // .env yoksa sorun değil: değerler gerçek ortam değişkenlerinden gelebilir
  // (CI, konteyner). Bu yüzden hata yutuluyor, doğrulama aşağıda yapılıyor.
  try {
    process.loadEnvFile();
  } catch {
    // yok sayılır — asıl denetim şema doğrulamasıdır
  }

  const parsed = EtlEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  • ${i.path.join(".") || "(kök)"}: ${i.message}`)
      .join("\n");
    throw new Error(
      `ETL yapılandırması geçersiz:\n${issues}\n\n` +
        `.env dosyanızı .env.example ile karşılaştırın.`,
    );
  }

  return parsed.data;
}
