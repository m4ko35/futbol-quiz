// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ModeNav } from "@/components/mode-nav";

/**
 * Mod gezinmesi — §9.
 *
 * Dar ekranda görünen etiketler kısalıyor (dört tam ad 390 px'e sığmıyor ve
 * şerit iki satıra sarıyordu). Bu testlerin koruduğu şey, kısaltmanın YALNIZCA
 * GÖRÜNTÜYE dokunması: ekran okuyucu kullanıcısı için gezinme, tarayıcı
 * penceresinin genişliğine göre değişmemeli.
 */

afterEach(cleanup);

const TAM_ADLAR = [
  "Ortak Oyuncu",
  "3×3 Izgara",
  "İstatistik",
  "Hangisi Daha",
] as const;

describe("ModeNav", () => {
  it("erişilebilir ad her genişlikte TAM addır", () => {
    render(<ModeNav current="grid" />);

    for (const name of TAM_ADLAR) {
      expect(screen.getByRole("link", { name })).toBeInTheDocument();
    }
  });

  /**
   * WCAG 2.5.3 (Label in Name): erişilebilir ad, GÖRÜNEN metni içermeli.
   * Sesle komut veren kullanıcı gördüğü sözcüğü söyler; ad onu içermezse
   * komut eşleşmez. "Ortak" ⊂ "Ortak Oyuncu" olduğu için kural sağlanıyor —
   * ama kısa adı bağımsız bir sözcüğe çeviren bir değişiklik bunu bozardı.
   */
  it("kısa ad, tam adın İÇİNDE geçer", () => {
    render(<ModeNav current="grid" />);

    for (const name of TAM_ADLAR) {
      const link = screen.getByRole("link", { name });
      const gorunen = (link.textContent ?? "").trim();

      // Bağlantı iki etiket taşıyor (kısa + tam); ikisi de adın parçası olmalı.
      for (const parca of gorunen.split(name).filter((p) => p.length > 0)) {
        expect(name).toContain(parca);
      }
    }
  });

  it("bulunulan modu aria-current ile bildirir", () => {
    render(<ModeNav current="grid" />);

    expect(screen.getByRole("link", { name: "3×3 Izgara" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: "Ortak Oyuncu" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("bilinmeyen sayfada hiçbir mod SEÇİLİ görünmez", () => {
    // 404'te rastgele birini dolu göstermek, kullanıcıya yanlış yer bildirmek
    // olurdu.
    render(<ModeNav current={null} />);

    for (const name of TAM_ADLAR) {
      expect(screen.getByRole("link", { name })).not.toHaveAttribute(
        "aria-current",
      );
    }
  });
});
