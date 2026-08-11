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
    render(<ModeHeader title="Ortak Oyuncu" task="İki kulüp seç." />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Ortak Oyuncu" }),
    ).toBeInTheDocument();
  });

  it("üst etiketi ve görev cümlesini gösterir", () => {
    render(
      <ModeHeader
        eyebrow="10 Ağustos 2026"
        title="Günün Izgarası"
        task="Her hücre için bir futbolcu bul."
      />,
    );

    expect(screen.getByText("10 Ağustos 2026")).toBeInTheDocument();
    expect(
      screen.getByText("Her hücre için bir futbolcu bul."),
    ).toBeInTheDocument();
  });

  /**
   * ÜST ETİKET İSTEĞE BAĞLI — ve boş bir satır BASILMAMALI.
   *
   * Bir süre "Mod 1 · Kesişim" gibi numaralı adlar taşıdı; modun adı hem
   * gezinme şeridinde hem `h1`'de zaten yazılı olduğu için kaldırıldı.
   * Etiketsiz künyede geriye ölü bir aralık kalmamalı.
   */
  it("üst etiket verilmezse boş satır basmaz", () => {
    const { container } = render(
      <ModeHeader title="Hangisi Daha" task="Seç." />,
    );

    // Künyenin metin taşıyan tek paragrafı görev cümlesi olmalı.
    const paragraphs = [...container.querySelectorAll("p")];
    expect(paragraphs).toHaveLength(1);
    expect(paragraphs[0]).toHaveTextContent("Seç.");
  });

  /**
   * TABELASIZ MOD BOŞ KUTU GÖSTERMEZ. Gösterecek gerçek bir sayısı olmayan
   * modda boş ya da uydurma bir sayaç, sayacın kendisini anlamsızlaştırır.
   */
  it("tabela verilmezse hiç basılmaz", () => {
    render(<ModeHeader title="Hangisi Daha" task="Seç." />);

    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });

  it("tabela verilirse künyenin içinde durur", () => {
    render(
      <ModeHeader
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
