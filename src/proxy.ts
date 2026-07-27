import { NextResponse, type NextRequest } from "next/server";

/**
 * Nonce tabanlı Content-Security-Policy (PROJECT.md §7.3).
 *
 * Next 16'da bu dosya `middleware.ts` değil `proxy.ts` adını taşır ve dışa
 * aktarılan fonksiyon `proxy` olmalıdır.
 *
 * Nonce'un anlamı: sayfaya yalnızca bu istek için üretilmiş rastgele değeri
 * taşıyan script'ler çalışabilir. Saldırgan enjekte ettiği script'e doğru
 * nonce'u yazamaz, çünkü değeri önceden bilemez. Bu yüzden nonce her istekte
 * yeniden üretilir — sabitlenirse koruma tamamen kaybolur.
 */
function generateNonce(): string {
  // 128 bit entropi. Web Crypto kullanıyoruz: hem Node hem Edge çalışma
  // zamanında mevcut, Buffer'a bağımlı değil.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

function buildContentSecurityPolicy(nonce: string, isDev: boolean): string {
  const directives = [
    "default-src 'self'",

    // 'strict-dynamic': nonce ile güvenilen script'in yüklediği alt script'ler
    // de güvenilir sayılır — Next'in parça (chunk) yükleyicisi böyle çalışır.
    // 'unsafe-eval' YALNIZCA geliştirmede: React, sunucu hata yığınlarını
    // tarayıcıda yeniden kurmak için eval kullanıyor. Üretimde asla açılmaz.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,

    // Geliştirmede HMR stilleri satır içi enjekte edildiği için nonce alamıyor.
    `style-src 'self' ${isDev ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,

    // Bilinçli ve dar kapsamlı taviz: `next/image` her görsele
    // style="color:transparent" özniteliği basar ve özniteliklere nonce
    // eklenemez. Bu direktif YALNIZCA style="..." özniteliklerini kapsar;
    // <style> blokları ve harici stil sayfaları hâlâ yukarıdaki katı
    // style-src kuralına tabidir. Kod çalıştırma riski yoktur.
    "style-src-attr 'unsafe-inline'",

    // Kulüp armaları Wikimedia'dan; blob:/data: Next görsel optimizasyonu için.
    "img-src 'self' https://upload.wikimedia.org blob: data:",

    "font-src 'self'",

    // Geliştirmede HMR websocket bağlantısı gerekiyor.
    `connect-src 'self'${isDev ? " ws: wss:" : ""}`,

    // Bu uygulama eklenti, applet veya iframe kullanmıyor — hepsini kapat.
    "object-src 'none'",
    "frame-src 'none'",
    "frame-ancestors 'none'",

    // <base> etiketi ile göreli URL'lerin kaçırılmasını engelle.
    "base-uri 'self'",

    // Form gönderimi yalnızca kendi kökenimize yapılabilir.
    "form-action 'self'",

    "upgrade-insecure-requests",
  ];

  return directives.join("; ");
}

export function proxy(request: NextRequest): NextResponse {
  const isDev = process.env.NODE_ENV === "development";
  const nonce = generateNonce();
  const csp = buildContentSecurityPolicy(nonce, isDev);

  // Next, render sırasında CSP başlığını okuyup nonce'u kendi script
  // etiketlerine otomatik ekliyor; bu yüzden İSTEK başlıklarına da yazıyoruz.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);

  return response;
}

export const config = {
  matcher: [
    {
      // Statik varlıklar ve görsel optimizasyonu CSP'ye ihtiyaç duymaz;
      // API rotaları JSON döner ve script çalıştırmaz.
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      // Prefetch istekleri render edilmediğinden nonce üretmek boşuna maliyet.
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
