import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Renk kontrastı kapısı — PROJECT.md §7.12.
 *
 * NEDEN BU TEST VAR. `axe-core`'un `color-contrast` kuralı jsdom'da çalışamaz
 * (yerleşim motoru yok) ve bilerek kapatılı (§7.10). Kontrast bir kez elle
 * hesaplandığında, paleti değiştiren BİR SONRAKİ kişi sessizce AA'yı kırar —
 * ölçüm belgede kalır, kod ondan uzaklaşır.
 *
 * NEDEN CSS'İ OKUYOR. Değerler testin içine kopyalansaydı iki kaynak olurdu ve
 * asıl kaçırmak istediğimiz durumu — `globals.css`'te değişip testte
 * değişmeyen bir ton — hiç yakalayamazdı. Tek kaynak dosyanın kendisi.
 *
 * KAPSAM SINIRI — dürüstçe: bu test belirteçlerin ORANLARINI doğrular, hangi
 * bileşenin hangi belirteci kullandığını değil. `text-muted` yazılması
 * gereken yere `text-line` yazılırsa bu test görmez; onu ancak gerçek
 * tarayıcıda bir denetim yakalar (Faz 4.5).
 */

const CSS_PATH = new URL("../../../src/app/globals.css", import.meta.url);

/** Normal metin (WCAG 1.4.3). */
const TEXT = 4.5;
/** Arayüz bileşeni sınırı ve odak göstergesi (WCAG 1.4.11, 2.4.11). */
const UI = 3;

/** [ön plan, arka plan, asgari oran, nerede kullanıldığı] */
const PAIRS: readonly [string, string, number, string][] = [
  ["foreground", "background", TEXT, "ana metin, sayfa üzerinde"],
  ["foreground", "surface", TEXT, "ana metin, kart üzerinde"],
  ["muted", "background", TEXT, "ikincil metin, sayfa üzerinde"],
  ["muted", "surface", TEXT, "ikincil metin, kart üzerinde"],
  ["accent", "background", TEXT, "vurgu metni, sayfa üzerinde"],
  ["accent", "surface", TEXT, "vurgu metni, kart üzerinde"],
  ["accent-fg", "accent", TEXT, "birincil düğme metni"],
  ["accent", "accent-soft", TEXT, "seçili kulüp adı, vurgulu seçenek"],
  ["foreground", "accent-soft", TEXT, "vurgulu zemindeki ana metin"],
  ["muted", "accent-soft", TEXT, "vurgulu zemindeki ikincil metin"],
  ["correct", "correct-soft", TEXT, "doğru hücre işareti"],
  ["foreground", "correct-soft", TEXT, "doğru hücredeki oyuncu adı"],
  ["wrong", "wrong-soft", TEXT, "yanlış hücre işareti, hata kutusu"],
  ["foreground", "wrong-soft", TEXT, "yanlış hücredeki oyuncu adı"],
  ["wrong", "surface", TEXT, "kart üzerindeki hata metni"],
  ["warn", "warn-soft", TEXT, "kiralık rozeti, orta puan bandı"],

  ["line-strong", "background", UI, "girdi kenarlığı, boş ızgara hücresi"],
  ["line-strong", "surface", UI, "kart içindeki girdi kenarlığı"],
  ["accent", "background", UI, "odak konturu, sayfa üzerinde"],
  ["accent", "surface", UI, "odak konturu, kart üzerinde"],
  ["correct", "surface", UI, "doğru hücre kenarlığı"],
  ["wrong", "surface", UI, "yanlış hücre kenarlığı"],
];

function channel(value: number): number {
  const v = value / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.1 bağıl parlaklık. */
function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  );
}

function contrastRatio(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * `globals.css`'ten belirteçleri okur.
 *
 * Karanlık mod bildirimi `@media (prefers-color-scheme: dark)` içinde; dosya
 * o işaretten bölünüyor. `@theme inline` bloğu da bölmenin ikinci yarısına
 * düşüyor ama değerleri `var(...)` olduğu için altıgen desenine takılmıyor.
 */
function readTokens(): {
  light: Record<string, string>;
  dark: Record<string, string>;
} {
  const css = readFileSync(CSS_PATH, "utf8");
  const marker = "@media (prefers-color-scheme: dark)";
  const splitAt = css.indexOf(marker);

  expect(
    splitAt,
    `${marker} bulunamadı — karanlık mod bildirimi kaldırılmış olabilir`,
  ).toBeGreaterThan(-1);

  const collect = (section: string): Record<string, string> => {
    const found: Record<string, string> = {};
    for (const match of section.matchAll(
      /--([a-z-]+):\s*(#[0-9a-f]{6})\s*;/giu,
    )) {
      found[match[1]!.toLowerCase()] = match[2]!.toLowerCase();
    }
    return found;
  };

  return {
    light: collect(css.slice(0, splitAt)),
    dark: collect(css.slice(splitAt)),
  };
}

describe("renk kontrastı — WCAG 2.1 AA (§7.12)", () => {
  const { light, dark } = readTokens();

  it("ölçümün KENDİSİ çalışıyor — bilinen oranları doğru hesaplar", () => {
    // Hiç kırmızıya dönemeyen bir kapı kapı değildir (§7.10 ile aynı gerekçe).
    // Siyah/beyaz WCAG'ın tanımı gereği tam 21:1'dir.
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
    // Eşiğin altında kalan gerçek bir çift: bu ton §7.12'de ölçülüp elendi.
    expect(contrastRatio("#16a34a", "#ffffff")).toBeLessThan(TEXT);
  });

  it.each([
    ["açık", light],
    ["koyu", dark],
  ])("%s modda her belirteç tanımlı", (_mode, tokens) => {
    const required = new Set(PAIRS.flatMap(([fg, bg]) => [fg, bg]));

    for (const name of required) {
      expect(tokens[name], `--${name} tanımsız`).toMatch(/^#[0-9a-f]{6}$/u);
    }
  });

  describe.each([
    ["açık", light],
    ["koyu", dark],
  ])("%s mod", (_mode, tokens) => {
    it.each(PAIRS)("%s / %s ≥ %s:1 — %s", (foreground, background, minimum) => {
      const ratio = contrastRatio(tokens[foreground]!, tokens[background]!);

      expect(
        Number(ratio.toFixed(2)),
        `--${foreground} (${tokens[foreground]!}) / --${background} (${tokens[background]!}) = ${ratio.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(minimum);
    });
  });
});
