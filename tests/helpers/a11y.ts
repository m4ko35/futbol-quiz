import axe from "axe-core";

/**
 * Erişilebilirlik denetimi — PROJECT.md §7.10.
 *
 * NEDEN OTOMATİK: WCAG denetimi elle bir kez yapılırsa, bir sonraki değişiklikte
 * sessizce bozulur. Bu proje "ölçülemeyen hedef hedef değildir" diyor (§1.4);
 * erişilebilirlik de bir hedefse bir kapısı olmalı.
 *
 * NEDEN SARMALAYICI PAKET DEĞİL: `axe-core` doğrudan kullanılıyor. Aradaki
 * eşleştirici (matcher) paketleri birkaç satırlık iş yapıyor ve §7.7 bağımlılık
 * disiplini küçük yardımcı paketler yerine yerel fonksiyonu tercih ediyor.
 *
 * KAPSAM SINIRI — dürüstçe: jsdom'un yerleşim (layout) motoru yok, dolayısıyla
 * `color-contrast` kuralı burada ÇALIŞAMAZ; açık bırakılırsa "eksik" değil
 * "geçti" der ve bu yanıltıcıdır. Kural bilerek kapatıldı ve kontrast AYRICA,
 * hesaplanarak ölçüldü (§7.10'daki tablo). Aynı sebeple görünürlük,
 * odak sırası ve hedef boyutu gibi yerleşime bağlı ölçütler de bu denetimin
 * dışındadır.
 */

/** jsdom'da anlamlı sonuç veremeyen kurallar. */
const UNSUPPORTED_IN_JSDOM = ["color-contrast"];

export interface A11yViolation {
  readonly id: string;
  readonly impact: string;
  readonly help: string;
  readonly nodes: readonly string[];
}

export async function findA11yViolations(
  container: Element,
): Promise<A11yViolation[]> {
  const results = await axe.run(container, {
    runOnly: {
      type: "tag",
      values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
    },
    rules: Object.fromEntries(
      UNSUPPORTED_IN_JSDOM.map((id) => [id, { enabled: false }]),
    ),
  });

  return results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact ?? "bilinmiyor",
    help: violation.help,
    nodes: violation.nodes.map((node) => node.html),
  }));
}

/** Test çıktısında okunabilir olsun diye: kural adı + hangi düğüm. */
export function describeViolations(
  violations: readonly A11yViolation[],
): string {
  if (violations.length === 0) return "ihlal yok";
  return violations
    .map(
      (v) =>
        `[${v.impact}] ${v.id}: ${v.help}\n    ${v.nodes.slice(0, 3).join("\n    ")}`,
    )
    .join("\n  ");
}
