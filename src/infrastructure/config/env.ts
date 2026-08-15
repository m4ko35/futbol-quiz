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
const ServerEnvSchema = z
  .object({
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

    /**
     * Sitenin herkese açık kök adresi — paylaşım meta verisi bunun üzerine
     * kurulur (§7.11). Göreli adresler paylaşımda çalışmaz: bir sohbet
     * uygulaması `og:image="/x.png"` değerini çözemez, mutlak adres ister.
     *
     * Yerelde varsayılan yeterli; dağıtımda gerçek alan adı verilir.
     */
    SITE_URL: z.url().default("http://localhost:3000"),

    /**
     * Site arama motorlarına açık mı? (§7.11)
     *
     * TEK ANAHTAR olması bilinçli: hem `robots.txt` hem sayfa meta etiketi
     * bunu okur. İki ayrı yerde tutulsaydı biri açılıp diğeri kapalı kalır ve
     * sonuç sessizce yanlış olurdu — üstelik yanlışlığı fark etmek aylar
     * sürebilirdi.
     *
     * `z.coerce.boolean()` KULLANILMAZ: o dönüşüm boş olmayan HER dizgiyi
     * `true` yapar, yani "false" da `true` olurdu.
     */
    SITE_INDEXABLE: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),

    /**
     * KVKK aydınlatma metnindeki başvuru adresi (§7.18).
     *
     * İsteğe bağlı görünür ama DEĞİLDİR: aşağıdaki çapraz kontrol, siteyi
     * indekslenebilir yapan yapılandırmanın bu adres olmadan geçmesini
     * engeller. Geliştirmede gerekmez, çünkü `SITE_INDEXABLE` öntanımlı `false`.
     */
    CONTACT_EMAIL: z.email().optional(),

    /**
     * Hesaplar ve lider tablosu (§11) — BEŞİ BİRLİKTE İSTEĞE BAĞLIDIR.
     *
     * Tek tek zorunlu yapmak, bugün yayında olan siteyi ilk dağıtımda
     * DÜŞÜRÜRDÜ: üretimde bu değişkenlerin hiçbiri tanımlı değil ve
     * `serverEnv()` eksik değişkende uygulamayı hiç başlatmıyor.
     *
     * Tehlikeli olan hâl "hiç yok" değil, YARIM: hesap yolları açık görünüp
     * giriş akışının ortasında patlamak. Aşağıdaki çapraz denetim tam da bunu
     * yasaklıyor — ya beşi de var ya hiçbiri.
     */
    ACCOUNTS_DATABASE_URL: z.string().min(1).optional(),
    ACCOUNTS_DATABASE_TOKEN: z.string().min(1).optional(),
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),

    /**
     * Oturum imzası ve `sub` özeti bundan türetilir (§11.10).
     *
     * ALT SINIR 32 KARAKTER bir biçim tercihi değil: kısa bir anahtar HMAC'i
     * tahmin edilebilir kılar ve oturum çerezi imzası da, `sub` özeti de o
     * anahtara dayanıyor.
     */
    AUTH_SECRET: z.string().min(32).optional(),
  })
  .superRefine((env, ctx) => {
    /**
     * Yayına açma anahtarı, aydınlatma metnini TAMAMLANMIŞ olmaya zorlar.
     *
     * Gerekçe §7.11'in gerekçesiyle aynı: unutulan bir yapılandırma siteyi
     * sessizce yanlış hâlde yayına sokmamalı. Burada "yanlış hâl", başvuru
     * adresi olmayan bir gizlilik bildirimidir — KVKK m.10 bunu eksik sayar.
     *
     * Kontrol ÇAPRAZ olmak zorunda: `CONTACT_EMAIL`i tek başına zorunlu yapmak
     * her geliştiricinin makinesinde ve CI'da gereksiz bir engel olurdu.
     */
    if (env.SITE_INDEXABLE && env.CONTACT_EMAIL === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["CONTACT_EMAIL"],
        message:
          "SITE_INDEXABLE=true ise zorunlu — gizlilik bildirimi başvuru adresi ister (§7.18)",
      });
    }

    /**
     * Hesap yapılandırması YA TAM YA HİÇ (§11).
     *
     * Yarım yapılandırma en kötü hâldir: site açılır, "Google ile gir"
     * düğmesi görünür ve akış ortasında patlar. Kullanıcı için bu, çalışmayan
     * bir siteden daha kötü — çünkü çalışıyor sanıp deniyor.
     *
     * Eksikleri TEK TEK saymak da bilinçli: "hesap yapılandırması eksik"
     * demek, hangisini unuttuğunu aramaya bırakır.
     */
    const missing = ACCOUNT_ENV_KEYS.filter(
      (key) => env[key] === undefined || env[key] === "",
    );

    if (missing.length > 0 && missing.length < ACCOUNT_ENV_KEYS.length) {
      ctx.addIssue({
        code: "custom",
        path: [missing[0] ?? "AUTH_SECRET"],
        message:
          `Hesap yapılandırması YARIM (§11): eksik olan(lar) ${missing.join(", ")}. ` +
          "Ya beşi birden tanımlanır ya hiçbiri — yarım yapılandırma, giriş " +
          "akışının ortasında patlayan bir site demektir.",
      });
    }
  });

/**
 * Hesap özelliğini açan değişkenler — hepsi birlikte gerekir (§11).
 *
 * Liste BURADA, tek yerde: hem çapraz denetim hem `accountsEnv()` bunu okur.
 * İki ayrı listede tutulsaydı biri güncellenip diğeri unutulurdu.
 */
const ACCOUNT_ENV_KEYS = [
  "ACCOUNTS_DATABASE_URL",
  "ACCOUNTS_DATABASE_TOKEN",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "AUTH_SECRET",
] as const;

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

/**
 * Hesap özelliğinin yapılandırması — kapalıysa `null` (§11).
 *
 * `null` BİR HATA DEĞİLDİR ve çağıranlar onu bir hata gibi ele almamalıdır:
 * hesap özelliği kapalı bir kurulum tamamen geçerlidir (yerel geliştirme, CI,
 * ve bugünkü üretim). Çağıran ya özelliği gizler ya `404` döner — ama
 * `500` VERMEZ, çünkü yanlış olan bir şey yok.
 *
 * Değerler burada TOPLU dönüyor: tek tek `serverEnv().GOOGLE_CLIENT_ID`
 * okuyan bir çağıran, tipin `string | undefined` olması yüzünden ya `!` ya
 * kontrol yazmak zorunda kalırdı. Burada bir kez daraltılıyor.
 */
export interface AccountsEnv {
  readonly databaseUrl: string;
  readonly databaseToken: string;
  readonly googleClientId: string;
  readonly googleClientSecret: string;
  readonly authSecret: string;
}

export function accountsEnv(): AccountsEnv | null {
  const env = serverEnv();

  // Çapraz denetim yarım yapılandırmayı zaten reddetti; buraya gelen ya tam
  // ya boş. Yine de tek tek bakılıyor — tip daraltması bunu gerektiriyor ve
  // çalışma zamanı varsayımı yazılı olmalı.
  if (
    env.ACCOUNTS_DATABASE_URL === undefined ||
    env.ACCOUNTS_DATABASE_TOKEN === undefined ||
    env.GOOGLE_CLIENT_ID === undefined ||
    env.GOOGLE_CLIENT_SECRET === undefined ||
    env.AUTH_SECRET === undefined
  ) {
    return null;
  }

  return {
    databaseUrl: env.ACCOUNTS_DATABASE_URL,
    databaseToken: env.ACCOUNTS_DATABASE_TOKEN,
    googleClientId: env.GOOGLE_CLIENT_ID,
    googleClientSecret: env.GOOGLE_CLIENT_SECRET,
    authSecret: env.AUTH_SECRET,
  };
}

/** Hesap özelliği bu kurulumda açık mı? (§11) */
export function accountsEnabled(): boolean {
  return accountsEnv() !== null;
}
