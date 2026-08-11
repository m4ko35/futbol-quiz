// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyThemeChoice,
  isThemeChoice,
  readThemeChoice,
  resetThemeChoiceCache,
  THEME_BOOT_SCRIPT,
  THEME_STORAGE_KEY,
  writeThemeChoice,
} from "@/lib/theme";

/**
 * Görünüm tercihi — §7.12.
 *
 * Buradaki asıl konu doğru rengin uygulanması değil (onu CSS yapıyor), DIŞ
 * GİRDİNİN sınırda durdurulması: `localStorage` kullanıcı tarafından
 * düzenlenebilir ve deponun kendisi hiç açılmayabilir.
 */

afterEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  // Anlık görüntü modül düzeyinde tutuluyor; sıfırlanmazsa bir testin okuduğu
  // değer diğerine sızar.
  resetThemeChoiceCache();
  vi.restoreAllMocks();
});

describe("isThemeChoice", () => {
  it("yalnızca üç bilinen değeri kabul eder", () => {
    expect(isThemeChoice("system")).toBe(true);
    expect(isThemeChoice("light")).toBe(true);
    expect(isThemeChoice("dark")).toBe(true);

    expect(isThemeChoice("koyu")).toBe(false);
    expect(isThemeChoice(null)).toBe(false);
    expect(isThemeChoice(2)).toBe(false);
  });
});

describe("readThemeChoice", () => {
  it("kayıt yoksa sistem tercihini izler", () => {
    expect(readThemeChoice()).toBe("system");
  });

  it("saklanmış seçimi geri verir", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");

    expect(readThemeChoice()).toBe("dark");
  });

  it("BOZUK kayıt sessizce sisteme düşer", () => {
    // Depodan gelen veri dış girdidir (§2.3): kullanıcı elle düzenleyebilir,
    // eski bir sürüm başka bir şey yazmış olabilir.
    window.localStorage.setItem(THEME_STORAGE_KEY, '{"tema":"koyu"}');

    expect(readThemeChoice()).toBe("system");
  });

  it("depo ERİŞİLEMEZ olduğunda çökmez", () => {
    // Gizli mod ya da dolu kota: `getItem` fırlatabilir.
    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("depo kapalı");
    });

    expect(readThemeChoice()).toBe("system");
  });
});

describe("applyThemeChoice", () => {
  it("elle seçimi özniteliğe yazar", () => {
    applyThemeChoice("dark");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");

    applyThemeChoice("light");
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
  });

  /**
   * `system` özniteliği KALDIRIR, "system" diye bir değer YAZMAZ.
   *
   * CSS'teki medya sorgusu ancak öznitelik yokken devreye girer; oraya bir
   * değer yazmak sistemi izleme davranışını sessizce kapatırdı.
   */
  it("sisteme dönüş özniteliği kaldırır", () => {
    applyThemeChoice("dark");
    applyThemeChoice("system");

    expect(document.documentElement).not.toHaveAttribute("data-theme");
  });
});

describe("writeThemeChoice", () => {
  it("hem uygular hem saklar", () => {
    writeThemeChoice("light");

    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("saklayamamak uygulamayı durdurmaz", () => {
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("kota dolu");
    });

    expect(() => {
      writeThemeChoice("dark");
    }).not.toThrow();
    // Tercih oturum boyunca geçerli; yalnızca yenilemeye dayanmıyor.
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });
});

/**
 * Açılış script'i `<head>` içinde çalışır ve DEPODAN OKUDUĞUNU özniteliğe
 * yazar. Körlemesine yazsaydı kurcalanmış bir kayıt oraya rastgele içerik
 * sokabilirdi; script yalnızca iki bilinen dizeyi kabul ediyor.
 */
describe("THEME_BOOT_SCRIPT", () => {
  /**
   * Script'i tarayıcının çalıştırdığı gibi çalıştırır: `<head>`'e basılmış bir
   * `<script>` düğümü olarak. Kaynağı okuyup "şuna benziyor" demek, asıl
   * sorulan şeyi — GERÇEKTEN ne yaptığını — ölçmezdi. `new Function` ise §7.2
   * gereği yasak ve zaten teslim yolunu taklit etmezdi.
   */
  function run(): void {
    const element = document.createElement("script");
    element.textContent = THEME_BOOT_SCRIPT;
    document.head.append(element);
    element.remove();
  }

  it("saklanmış seçimi ilk boyamadan önce uygular", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");

    run();

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });

  it("KURCALANMIŞ değeri özniteliğe yazmaz", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark" onload="alert(1)');

    run();

    expect(document.documentElement).not.toHaveAttribute("data-theme");
  });

  it("'system' için öznitelik basmaz — medya sorgusu devrede kalır", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "system");

    run();

    expect(document.documentElement).not.toHaveAttribute("data-theme");
  });

  it("okuduğu anahtar, modülün sakladığı anahtarla AYNI", () => {
    // İkisi ayrı dizelere düşerse tercih sessizce hatırlanmaz olur.
    expect(THEME_BOOT_SCRIPT).toContain(JSON.stringify(THEME_STORAGE_KEY));
  });
});
