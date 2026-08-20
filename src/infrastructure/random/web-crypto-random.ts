import type { RandomSource } from "@/application/ports/random-source";

/**
 * `RandomSource`'un çalışma zamanı uygulaması — PROJECT.md §12, BR-55.
 *
 * `crypto.getRandomValues` hem Node 20+ hem Edge çalışma zamanında KÜRESEL
 * olarak var; `node:crypto` içe aktarılmıyor çünkü o, aynı kodun Edge'de
 * çalışmasını engellerdi (§7.3'ün `proxy.ts` kısıtıyla aynı sınıf).
 *
 * `Math.random` KULLANILAMAZ ve bu bir üslup tercihi değil: oda kodu tahmin
 * edilemez olmak zorunda (BR-55) ve `Math.random` tahmin edilebilir bir
 * üreteçtir — ardışık birkaç çıktısını gören biri sonrakini hesaplayabilir.
 */
export class WebCryptoRandomSource implements RandomSource {
  bytes(count: number): Uint8Array {
    const buffer = new Uint8Array(count);
    crypto.getRandomValues(buffer);
    return buffer;
  }
}
