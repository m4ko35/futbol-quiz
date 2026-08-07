// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import type { ClubDto } from "@/application/dto/club-dto";
import type { CommonPlayersResultDto } from "@/application/dto/common-players-dto";
import type { DailyGridDto } from "@/application/use-cases/daily-grid";
import type { DailyStatMatchDto } from "@/application/use-cases/daily-stat-match";
import { ClubPicker } from "@/components/club-picker";
import { CommonPlayersResult } from "@/components/common-players-result";
import { GridBuilder } from "@/components/grid-builder";
import { GridGame } from "@/components/grid-game";
import { ModeNav } from "@/components/mode-nav";
import { SiteFooter } from "@/components/site-footer";
import { StatMatchGame } from "@/components/stat-match-game";
import { describeViolations, findA11yViolations } from "../../helpers/a11y";

afterEach(cleanup);

const GRID: DailyGridDto = {
  date: "2026-07-31",
  rows: [
    { kind: "club", label: "Barcelona" },
    { kind: "club", label: "Milan" },
    { kind: "nationality", label: "Brezilya" },
  ],
  columns: [
    { kind: "club", label: "Arsenal" },
    { kind: "club", label: "Inter" },
    { kind: "club", label: "Galatasaray" },
  ],
};

const DAILY_STATS: DailyStatMatchDto = {
  date: "2026-07-31",
  player: { id: "gunun", name: "Éric Cantona", nationality: "FR" },
  stats: [
    { key: "appearances", label: "Kulüp maçı", value: 194, scoped: true },
    { key: "goals", label: "Kulüp golü", value: 83, scoped: true },
    { key: "clubs", label: "Oynadığı kulüp", value: 3, scoped: true },
    { key: "nationalCaps", label: "A millî maç", value: 45, scoped: false },
    { key: "heightCm", label: "Boy (cm)", value: 188, scoped: false },
    { key: "weightKg", label: "Kilo (kg)", value: 86, scoped: false },
  ],
};

const club = (id: string, shortName: string): ClubDto => ({
  id,
  name: `${shortName} Kulübü`,
  shortName,
  country: "TR",
  crestUrl: "https://upload.wikimedia.org/wikipedia/commons/d/d0/X.svg",
});

const RESULT: CommonPlayersResultDto = {
  clubA: club("a", "Galatasaray"),
  clubB: club("b", "Arsenal"),
  count: 2,
  players: [
    {
      id: "p1",
      name: "Emmanuel Eboué",
      nationality: "CI",
      position: "Defans",
      spellsAtA: [
        {
          startYear: 2011,
          endYear: 2014,
          isLoan: false,
          appearances: 64,
          goals: 3,
          hasEvidence: true,
        },
      ],
      spellsAtB: [
        {
          startYear: 2005,
          endYear: 2011,
          isLoan: true,
          appearances: 214,
          goals: 9,
          hasEvidence: true,
        },
      ],
    },
    {
      id: "p2",
      name: "Bill Dale",
      nationality: null,
      position: null,
      spellsAtA: [
        {
          startYear: null,
          endYear: null,
          isLoan: false,
          appearances: null,
          goals: null,
          hasEvidence: false,
        },
      ],
      spellsAtB: [
        {
          startYear: 1931,
          endYear: 1937,
          isLoan: false,
          appearances: null,
          goals: null,
          hasEvidence: true,
        },
      ],
    },
  ],
};

async function expectNoViolations(container: Element) {
  const violations = await findA11yViolations(container);
  expect(violations, describeViolations(violations)).toEqual([]);
}

describe("erişilebilirlik — WCAG 2.1 AA (§7.10)", () => {
  it("denetimin KENDİSİ çalışıyor — bilinen bir ihlali yakalar", () => {
    // Hiç kırmızıya dönemeyen bir kapı, kapı değildir. Bu test, yukarıdaki
    // "ihlal yok" sonuçlarının denetimin çalışmasından mı yoksa sessizce
    // hiçbir şey yapmamasından mı geldiğini ayırt eder.
    const container = document.createElement("div");
    container.innerHTML = `
      <img src="x.png">
      <input type="text">
      <button></button>
    `;
    document.body.append(container);

    return findA11yViolations(container).then((violations) => {
      const ids = violations.map((v) => v.id);
      expect(ids).toContain("image-alt");
      expect(ids).toContain("button-name");
      container.remove();
    });
  });

  it("sonuç listesinde ihlal yok", async () => {
    const { container } = render(<CommonPlayersResult result={RESULT} />);

    await expectNoViolations(container);
  });

  it("boş sonuç ekranında ihlal yok", async () => {
    const { container } = render(
      <CommonPlayersResult result={{ ...RESULT, count: 0, players: [] }} />,
    );

    await expectNoViolations(container);
  });

  it("altbilgide ihlal yok", async () => {
    const { container } = render(
      <SiteFooter dataGeneratedAt={new Date("2026-07-30T00:00:00Z")} />,
    );

    await expectNoViolations(container);
  });

  it("kulüp seçicide — kapalıyken — ihlal yok", async () => {
    const { container } = render(
      <ClubPicker
        label="A kulübü"
        selected={null}
        onSelect={() => undefined}
        search={() => Promise.resolve([])}
      />,
    );

    await expectNoViolations(container);
  });

  it("kulüp seçicide — liste AÇIKKEN — ihlal yok", async () => {
    // Asıl risk burada: combobox deseninin `aria-*` bağlantıları yalnızca
    // liste açıldığında değerlendirilebilir.
    const { container } = render(
      <ClubPicker
        label="A kulübü"
        selected={null}
        onSelect={() => undefined}
        initialOptions={[club("a", "Galatasaray"), club("b", "Beşiktaş")]}
        search={() => Promise.resolve([])}
      />,
    );

    await userEvent.click(screen.getByRole("combobox"));
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    await expectNoViolations(container);
  });

  /**
   * BOŞ LİSTE AYRI BİR DURUMDUR ve uzun süre denetlenmiyordu.
   * `role="listbox"` yalnızca `option` çocuğu barındırabilir; "Sonuç yok"
   * metni listenin içine konduğunda kritik bir `aria-required-children` ihlali
   * oluşuyordu. Dolu listeyle çalışan testler bunu göremezdi.
   */
  it("kulüp seçicide — liste BOŞKEN — ihlal yok", async () => {
    const { container } = render(
      <ClubPicker
        label="A kulübü"
        selected={null}
        onSelect={() => undefined}
        initialOptions={[]}
        search={() => Promise.resolve([])}
      />,
    );

    await userEvent.click(screen.getByRole("combobox"));
    expect(screen.getByText("Sonuç yok.")).toBeInTheDocument();

    await expectNoViolations(container);
  });

  it("seçim yapıldıktan sonra ihlal yok", async () => {
    const { container } = render(
      <ClubPicker
        label="A kulübü"
        selected={club("a", "Galatasaray")}
        onSelect={() => undefined}
        search={() => Promise.resolve([])}
      />,
    );

    await expectNoViolations(container);
  });

  it("boş ızgarada ihlal yok", async () => {
    const { container } = render(
      <GridGame
        grid={GRID}
        checkAnswer={() => Promise.resolve(true)}
        searchPlayers={() => Promise.resolve([])}
      />,
    );

    await expectNoViolations(container);
  });

  /**
   * Asıl risk burada: tablo başlıkları, hücre düğmeleri ve seçici paneli aynı
   * anda ekranda. `scope` bağları ancak dolu bir tabloda değerlendirilebilir.
   */
  it("seçici AÇIKKEN ızgarada ihlal yok", async () => {
    const { container } = render(
      <GridGame
        grid={GRID}
        checkAnswer={() => Promise.resolve(true)}
        searchPlayers={() => Promise.resolve([])}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", {
        name: "Barcelona ve Arsenal için oyuncu seçin",
      }),
    );
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    await expectNoViolations(container);
  });

  it("ızgara kurucusunda ihlal yok", async () => {
    const { container } = render(
      <GridBuilder
        searchColumns={() => Promise.resolve([])}
        searchRows={() => Promise.resolve([])}
        onBuilt={() => undefined}
      />,
    );

    await expectNoViolations(container);
  });

  /**
   * Asıl risk: ölçüt seçicisi iki TÜR gösteriyor (kulüp/uyruk) ve rozet
   * seçeneğin İÇİNDE duruyor. `role="option"` yalnızca metin içeriği
   * taşıyabilir; rozetin ayrı bir etkileşimli öğeye dönüşmediği ancak dolu bir
   * listede ölçülebilir.
   */
  it("ölçüt seçicisi AÇIKKEN ihlal yok", async () => {
    const { container } = render(
      <GridBuilder
        searchColumns={() =>
          Promise.resolve([
            { kind: "club" as const, id: "c1", label: "Barcelona" },
            { kind: "nationality" as const, id: "BR", label: "Brezilya" },
          ])
        }
        searchRows={() => Promise.resolve([])}
        onBuilt={() => undefined}
      />,
    );

    await userEvent.click(
      screen.getAllByRole("button", { name: /Kulüp seç/u })[0]!,
    );
    // Liste GERÇEKTEN DOLANA kadar beklenir: boş bir listede denetim, iddia
    // ettiği şeyi ölçmeden geçerdi (arama 200 ms gecikmeli).
    await screen.findByRole("option", { name: /Brezilya/u });

    await expectNoViolations(container);
  });

  it("mod gezinmesinde ihlal yok", async () => {
    const { container } = render(<ModeNav current="grid" />);

    await expectNoViolations(container);
  });

  it("istatistik eşleştirmede ihlal yok", async () => {
    const { container } = render(
      <StatMatchGame
        round={DAILY_STATS}
        date={DAILY_STATS.date}
        submitAnswer={() => Promise.resolve({ value: 1, score: 1 })}
        searchPlayers={() => Promise.resolve([])}
      />,
    );

    await expectNoViolations(container);
  });

  it("istatistik seçicisi AÇIKKEN ihlal yok", async () => {
    const { container } = render(
      <StatMatchGame
        round={DAILY_STATS}
        date={DAILY_STATS.date}
        submitAnswer={() => Promise.resolve({ value: 1, score: 1 })}
        searchPlayers={() => Promise.resolve([])}
      />,
    );

    await userEvent.click(
      screen.getAllByRole("button", { name: /Oyuncu seç/u })[0]!,
    );
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    await expectNoViolations(container);
  });
});
