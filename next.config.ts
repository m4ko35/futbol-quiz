import type { NextConfig } from "next";

/**
 * Her yanıtta sabit kalan güvenlik başlıkları (PROJECT.md §7.3).
 *
 * CSP burada YOK: her istek için taze bir nonce gerektirdiğinden `src/proxy.ts`
 * içinde üretilir. Buradaki başlıklar isteğe bağlı değildir; biri kaldırılacaksa
 * önce PROJECT.md §7.3 güncellenir.
 */
const securityHeaders = [
  // HTTPS'i zorunlu kıl; tarayıcı bir daha düz HTTP denemesin.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Tarayıcının Content-Type'ı "tahmin etmesini" engelle (MIME sniffing → XSS).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Clickjacking. CSP frame-ancestors ile birlikte, eski tarayıcılar için.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // İhtiyacımız olmayan güçlü tarayıcı API'lerini tamamen kapat.
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  // Cross-origin pencere/kaynak yalıtımı.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  // DNS ön-getirme, ziyaret edilen alanları sızdırabilir.
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,

  /**
   * Veritabanı dosyasını sunucu paketine dâhil et (PROJECT.md §3.1).
   *
   * Veri bu projede bir DERLEME ÇIKTISIDIR: üretimde yazılmaz, salt-okunur
   * olarak dağıtımla birlikte gider. Next'in dosya izleme (file tracing)
   * mekanizması yalnızca `import` ile ulaşılan dosyaları bulur; `.db` dosyası
   * çalışma zamanında yol üzerinden açıldığı için izlenemez ve bu satır
   * olmadan pakete GİRMEZ — uygulama üretimde "veritabanı yok" diye ölür.
   *
   * Anahtar `/*`: bütün sunucu rotaları. Hem sayfa hem API uçları veriye
   * erişiyor, dolayısıyla daraltmanın kazancı yok.
   *
   * Kalıp TEK DOSYAYI adlar, `*.db` gibi bir joker DEĞİL. Ölçüldü: joker
   * kullanıldığında yanına bırakılmış bir yedek (`dev.db.bak`) de pakete
   * girdi. Dağıtım paketine ne gireceği tahmine bırakılamaz — 73 MB'lık bir
   * dosyanın yanlışlıkla ikizlenmesi paket sınırını (§3.1) sessizce tüketir.
   */
  outputFileTracingIncludes: {
    "/*": ["prisma/dev.db"],
  },

  // Sunucu parmak izini azalt: "X-Powered-By: Next.js" bilgisini gönderme.
  poweredByHeader: false,

  images: {
    // Kulüp armaları yalnızca bu alandan yüklenebilir (§7.3).
    // Beyaz liste dışı bir kaynak eklemek SSRF yüzeyi açar.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
        pathname: "/**",
      },
    ],
  },

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
