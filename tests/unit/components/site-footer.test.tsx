// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { formatDataDate, SiteFooter } from "@/components/site-footer";

afterEach(cleanup);

describe("formatDataDate", () => {
  it("Türkçe ve gün hassasiyetinde yazar", () => {
    expect(formatDataDate(new Date("2026-07-30T16:45:00Z"))).toBe(
      "30 Temmuz 2026",
    );
  });

  it("zaman dilimi UTC'ye sabitlenmiştir", () => {
    // Sunucunun yerel dilimi bir dağıtım tesadüfüdür. Sabitlenmeseydi UTC'de
    // 23:30 olan bir an, doğu dilimindeki bir sunucuda ERTESİ günü gösterirdi.
    expect(formatDataDate(new Date("2026-07-30T23:30:00Z"))).toBe(
      "30 Temmuz 2026",
    );
    expect(formatDataDate(new Date("2026-07-30T00:30:00Z"))).toBe(
      "30 Temmuz 2026",
    );
  });
});

describe("SiteFooter", () => {
  it("veri tarihini ve tazelenme sıklığını söyler", () => {
    render(<SiteFooter dataGeneratedAt={new Date("2026-07-30T00:00:00Z")} />);

    expect(screen.getByText(/30 Temmuz 2026/u)).toBeInTheDocument();
    expect(screen.getByText(/yılda iki kez/u)).toBeInTheDocument();
  });

  it("tarihi makine okunur biçimde de verir", () => {
    render(<SiteFooter dataGeneratedAt={new Date("2026-07-30T00:00:00Z")} />);

    expect(screen.getByText(/30 Temmuz 2026/u).closest("time")).toHaveAttribute(
      "datetime",
      "2026-07-30T00:00:00.000Z",
    );
  });

  it("tarih bilinmiyorsa UYDURMAZ", () => {
    // `null` "bugün" sayılsaydı bir yıl önce üretilmiş veri taze görünürdü —
    // yani alanın engellemek için var olduğu hatanın ta kendisi (§2.7).
    render(<SiteFooter dataGeneratedAt={null} />);

    expect(screen.queryByText(/son güncelleme/iu)).not.toBeInTheDocument();
    // Kaynak bilgisi yine de durur.
    expect(screen.getByRole("link", { name: "Wikidata" })).toBeInTheDocument();
  });

  it("dış bağlantı sekme ele geçirmeye kapalıdır", () => {
    render(<SiteFooter dataGeneratedAt={null} />);

    const link = screen.getByRole("link", { name: "Wikidata" });
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });
});
