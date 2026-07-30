/**
 * Günlük ızgara tohumu ve deterministik rastgelelik — PROJECT.md §9.1 (BR-11).
 *
 * NEDEN DETERMİNİSTİK. İki sebep, ikisi de mimariye bağlı:
 *
 * 1. Rastgele bir ızgara CDN önbelleğini işlevsiz kılardı (§7.9). Aynı gün
 *    aynı cevap dönüyorsa yanıt önbelleklenebilir; her istekte farklı ızgara
 *    üretilseydi her istek fonksiyona ulaşırdı.
 * 2. Skor tablosu (§9) ancak herkes aynı soruyu çözerse anlamlıdır.
 *
 * `Math.random()` KULLANILMAZ: hem tekrarlanabilir değildir hem de test
 * edilemez. Aynı gün, aynı ızgara — bu bir davranış, bir tesadüf değil.
 */

/**
 * Tarihten gün tohumu. Zaman dilimi UTC'ye sabitlenmiştir.
 *
 * Sunucunun yerel dilimi bir dağıtım tesadüfüdür; sabitlenmeseydi ızgara,
 * hangi bölgedeki sunucunun yanıt verdiğine göre değişebilirdi — yani "herkes
 * aynı ızgarayı görür" kuralı sessizce bozulurdu.
 */
export function dailySeed(date: Date): number {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  return year * 10_000 + month * 100 + day;
}

/** Aynı günün ızgarası bir kez üretilemezse denenecek alternatif tohumlar. */
export function seedVariant(seed: number, attempt: number): number {
  return seed * 1_000 + attempt;
}

/**
 * mulberry32 — küçük, hızlı, deterministik sözde-rastgele üreteç.
 *
 * Kriptografik DEĞİLDİR ve olması da gerekmez: burada üretilen şey bir sır
 * değil, herkese açık bir bulmacadır. Yerel yazılmasının sebebi §7.7'deki
 * bağımlılık disiplini — on satırlık bir iş için paket eklenmez.
 */
export function createRandom(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/**
 * Diziyi deterministik olarak karıştırır (Fisher–Yates).
 *
 * Girdi DEĞİŞTİRİLMEZ: çağıranın elindeki havuz listesi, üretim denemeleri
 * arasında sabit kalmalı.
 */
export function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const a = result[i];
    const b = result[j];
    if (a !== undefined && b !== undefined) {
      result[i] = b;
      result[j] = a;
    }
  }
  return result;
}
