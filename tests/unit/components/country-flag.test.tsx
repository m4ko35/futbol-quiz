// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CountryFlag } from "@/components/country-flag";

afterEach(cleanup);

/** BR-39 — lig bayrağı bileşeni (§7.14). */

const SUPER_LIG = { wikidataId: "Q193024", country: "TR" };

describe("CountryFlag", () => {
  it("ülkenin bayrağını yerel yoldan gösterir", () => {
    render(<CountryFlag league={SUPER_LIG} />);

    // `alt=""` olduğu için rol sorgusuyla bulunamaz — bilinçli (aşağıda).
    const img = document.querySelector("img");
    expect(img).toHaveAttribute("src", "/flags/tr.svg");
  });

  /**
   * BAYRAK EKRAN OKUYUCUYA GÖRÜNMEZ ve bu doğru: ülke adı bayrağın yanında
   * yazılı. "Türkiye bayrağı, Türkiye" demek aynı şeyi iki kez söylemektir
   * (WCAG 1.1.1). Bayrak bilgi taşımıyor, tekrarlıyor.
   */
  it("erişilebilirlik ağacından ÇIKARILIR", () => {
    render(<CountryFlag league={SUPER_LIG} />);

    const img = document.querySelector("img");
    expect(img).toHaveAttribute("alt", "");
    expect(img).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  /**
   * Boyut öznitelikleri resim inmeden yer ayırır. Olmazsa yirmi dört satırlık
   * lig listesi her bayrak indiğinde zıplar (CLS).
   */
  it("yerini ÖNCEDEN ayırır", () => {
    render(<CountryFlag league={SUPER_LIG} width={20} />);

    const img = document.querySelector("img");
    expect(img).toHaveAttribute("width", "20");
    // 4:3 oranı — kolon hizalı kalsın diye bütün bayraklar aynı orandan.
    expect(img).toHaveAttribute("height", "15");
    expect(img).toHaveAttribute("loading", "lazy");
  });

  it("iki İngiliz ligi FARKLI dosya ister", () => {
    const { container: premier } = render(
      <CountryFlag league={{ wikidataId: "Q9448", country: "GB" }} />,
    );
    const premierSrc = premier.querySelector("img")?.getAttribute("src");

    cleanup();

    const { container: iskocya } = render(
      <CountryFlag league={{ wikidataId: "Q14377162", country: "GB" }} />,
    );
    const iskocyaSrc = iskocya.querySelector("img")?.getAttribute("src");

    expect(premierSrc).toBe("/flags/gb-eng.svg");
    expect(iskocyaSrc).toBe("/flags/gb-sct.svg");
  });

  it("bayrağı olmayan ülkede KIRIK GÖRSEL değil, hiçbir şey", () => {
    // Olmayan bir dosyaya `src` vermek kırık simge gösterirdi; boş yuva
    // sessizdir, kırık simge kusurlu görünür (§7.13).
    const { container } = render(
      <CountryFlag league={{ wikidataId: "Q1", country: "JP" }} />,
    );

    expect(container.querySelector("img")).toBeNull();
  });
});
