// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import type { ClubDto } from "@/application/dto/club-dto";
import type { CommonPlayersResultDto } from "@/application/dto/common-players-dto";
import { ClubPicker } from "@/components/club-picker";
import { CommonPlayersResult } from "@/components/common-players-result";
import { SiteFooter } from "@/components/site-footer";
import { describeViolations, findA11yViolations } from "../../helpers/a11y";

afterEach(cleanup);

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
});
