// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { ThemeToggle } from "@/components/theme-toggle";
import { resetThemeChoiceCache, THEME_STORAGE_KEY } from "@/lib/theme";

/**
 * Görünüm seçicisi — §7.12.
 *
 * ÜÇ SEÇENEK, İKİ DEĞİL. Asıl korunan şey `Sistem`'e GERİ DÖNEBİLMEK: iki
 * durumlu bir anahtarda bir kez seçim yapan kullanıcı, işletim sistemi
 * ayarını izleme davranışına bir daha dönemezdi.
 */

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  resetThemeChoiceCache();
});

describe("ThemeToggle", () => {
  it("üç seçeneği de adlarıyla sunar", () => {
    render(<ThemeToggle />);

    for (const name of ["Sistem", "Açık", "Koyu"]) {
      expect(screen.getByRole("radio", { name })).toBeInTheDocument();
    }
  });

  it("koyu seçimi belgeye uygulanır ve saklanır", async () => {
    render(<ThemeToggle />);

    await userEvent.click(screen.getByRole("radio", { name: "Koyu" }));

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  /**
   * `Sistem` özniteliği KALDIRIR, "system" diye bir değer yazmaz: CSS'teki
   * medya sorgusu ancak öznitelik yokken devreye girer. Buraya bir değer
   * yazmak, sistemi izleme davranışını sessizce kapatırdı.
   */
  it("sisteme dönüş özniteliği kaldırır", async () => {
    render(<ThemeToggle />);

    await userEvent.click(screen.getByRole("radio", { name: "Koyu" }));
    await userEvent.click(screen.getByRole("radio", { name: "Sistem" }));

    expect(document.documentElement).not.toHaveAttribute("data-theme");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("system");
  });

  it("saklanmış seçim bağlandıktan sonra DOLU görünür", async () => {
    // Sunucu depoyu göremez; ilk render'da farklı bir değer varsaymak
    // hidrasyon uyuşmazlığı olurdu. Doğru değer hemen ardından okunuyor.
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");

    render(<ThemeToggle />);

    expect(await screen.findByRole("radio", { name: "Açık" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Koyu" })).not.toBeChecked();
  });
});
