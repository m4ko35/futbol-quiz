// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ModeHeader, Scoreboard } from "@/components/mode-header";

/**
 * Mod künyesi ve skor tabelası — §7.15.
 *
 * Bu testler görünümü değil SÖZLEŞMEYİ denetler: hangi metin hangi rolde
 * duyuruluyor, tabela ne zaman görünüyor. Sınıf adları serbestçe değişebilmeli.
 */

afterEach(cleanup);

describe("ModeHeader", () => {
  it("modun adını sayfanın tek h1'i yapar", () => {
    render(
      <ModeHeader
        eyebrow="Mod 1 · Kesişim"
        title="Ortak Oyuncu"
        task="İki kulüp seç."
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Ortak Oyuncu" }),
    ).toBeInTheDocument();
  });

  it("üst etiketi ve görev cümlesini gösterir", () => {
    render(
      <ModeHeader
        eyebrow="Mod 2 · Matris"
        title="Günün Izgarası"
        task="Her hücre için bir futbolcu bul."
      />,
    );

    expect(screen.getByText("Mod 2 · Matris")).toBeInTheDocument();
    expect(
      screen.getByText("Her hücre için bir futbolcu bul."),
    ).toBeInTheDocument();
  });

  /**
   * TABELASIZ MOD BOŞ KUTU GÖSTERMEZ. Gösterecek gerçek bir sayısı olmayan
   * modda boş ya da uydurma bir sayaç, sayacın kendisini anlamsızlaştırır.
   */
  it("tabela verilmezse hiç basılmaz", () => {
    render(
      <ModeHeader eyebrow="Mod 4 · Düello" title="Hangisi Daha" task="Seç." />,
    );

    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });

  it("tabela verilirse künyenin içinde durur", () => {
    render(
      <ModeHeader
        eyebrow="Mod 1 · Kesişim"
        title="Ortak Oyuncu"
        task="İki kulüp seç."
        scoreboard={
          <Scoreboard
            label="Veri kümesi"
            cells={[{ label: "Lig", value: "24" }]}
          />
        }
      />,
    );

    const header = screen.getByRole("banner");
    expect(
      within(header).getByRole("group", { name: "Veri kümesi" }),
    ).toBeInTheDocument();
  });
});

describe("Scoreboard", () => {
  it("her hücreyi etiketi ve değeriyle gösterir", () => {
    render(
      <Scoreboard
        label="Veri kümesi"
        cells={[
          { label: "Kulüp", value: "906" },
          { label: "Lig", value: "24" },
          { label: "Oyuncu", value: "132.263" },
        ]}
      />,
    );

    const board = screen.getByRole("group", { name: "Veri kümesi" });
    expect(within(board).getByText("Kulüp")).toBeInTheDocument();
    expect(within(board).getByText("906")).toBeInTheDocument();
    expect(within(board).getByText("132.263")).toBeInTheDocument();
  });

  /**
   * SAYI KISALTILMAZ, KÜÇÜLTÜLÜR (§2.7). "132 bin" ölçülmüş bir sayı gibi
   * görünür ama değildir; punto küçültmek bilgiyi bozmadan sığdırır.
   */
  it("uzun sayı için küçük punto ister, sayıyı DEĞİŞTİRMEZ", () => {
    render(
      <Scoreboard
        label="Veri kümesi"
        cells={[{ label: "Oyuncu", value: "132.263", small: true }]}
      />,
    );

    expect(screen.getByText("132.263")).toBeInTheDocument();
    expect(screen.queryByText(/bin|K$/u)).not.toBeInTheDocument();
  });

  it("sonuç geldiğinde vurgulanır", () => {
    const { container: sonuc } = render(
      <Scoreboard
        label="Sonuç"
        lit
        cells={[{ label: "Ortak oyuncu", value: "55" }]}
      />,
    );
    const { container: bos } = render(
      <Scoreboard
        label="Sonuç"
        cells={[{ label: "Ortak oyuncu", value: "0" }]}
      />,
    );

    // Vurgulu ve vurgusuz tabela AYNI görünmemeli: sonucun gelişi bir olay.
    expect(sonuc.firstElementChild?.className).not.toBe(
      bos.firstElementChild?.className,
    );
  });
});
