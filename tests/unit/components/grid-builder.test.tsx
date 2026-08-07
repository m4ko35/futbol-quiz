// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UserEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GridCriterionRefDto } from "@/application/use-cases/custom-grid";
import { GridBuilder, type BuiltGrid } from "@/components/grid-builder";

/**
 * §9.1 — "Sen kur" kurucusu (BR-25).
 *
 * BURADA DENETLENEN ŞEY SÜZGECİN İÇERİĞİ DEĞİL, kurucunun süzgeci DOĞRU
 * BESLEYİP beslemediği: satır adayları seçilmiş sütunlara göre isteniyor mu,
 * sütun değişince eski satırlar düşüyor mu. Hangi ölçütün oynanabilir olduğuna
 * sunucu karar verir (port sözleşmesi) ve burada sahtelenir.
 */

afterEach(cleanup);

const CLUBS: GridCriterionRefDto[] = [
  { kind: "club", id: "c1", label: "Barcelona" },
  { kind: "club", id: "c2", label: "Milan" },
  { kind: "club", id: "c3", label: "Arsenal" },
  { kind: "club", id: "c4", label: "Inter" },
];

const ROWS: GridCriterionRefDto[] = [
  { kind: "club", id: "r1", label: "Galatasaray" },
  { kind: "nationality", id: "BR", label: "Brezilya" },
  { kind: "club", id: "r2", label: "Ajax" },
];

function setup() {
  const searchColumns = vi.fn().mockResolvedValue([...CLUBS]);
  const searchRows = vi.fn().mockResolvedValue([...ROWS]);
  const onBuilt = vi.fn<(grid: BuiltGrid) => void>();

  render(
    <GridBuilder
      searchColumns={searchColumns}
      searchRows={searchRows}
      onBuilt={onBuilt}
    />,
  );

  return { searchColumns, searchRows, onBuilt, user: userEvent.setup() };
}

/** Bir yuvayı açar ve listeden verilen etiketi seçer. */
async function pick(
  user: UserEvent,
  slotName: RegExp,
  optionLabel: string,
): Promise<void> {
  // Dolan yuva artık "seç" düğmesi göstermez; ilk eşleşen, sıradaki BOŞ yuva.
  await user.click(screen.getAllByRole("button", { name: slotName })[0]!);

  const option = await screen.findByRole("option", {
    name: new RegExp(optionLabel, "u"),
  });
  await user.click(option);
}

async function pickColumns(user: UserEvent): Promise<void> {
  await pick(user, /Kulüp seç/u, "Barcelona");
  await pick(user, /Kulüp seç/u, "Milan");
  await pick(user, /Kulüp seç/u, "Arsenal");
}

describe("GridBuilder — §9.1", () => {
  it("üç sütun seçilmeden satır seçilemez", async () => {
    const { user } = setup();

    // Satır yuvaları başlangıçta kapalı: süzgeç sütunlara dayanıyor ve
    // sütunlar yokken "oynanabilir satır" sorusunun cevabı yok.
    for (const button of screen.getAllByRole("button", {
      name: /Ölçüt seç/u,
    })) {
      expect(button).toBeDisabled();
    }

    await pickColumns(user);

    await waitFor(() => {
      expect(
        screen.getAllByRole("button", { name: /Ölçüt seç/u })[0],
      ).toBeEnabled();
    });
  });

  it("satır adayları SEÇİLMİŞ SÜTUNLARA göre istenir", async () => {
    const { user, searchRows } = setup();

    await pickColumns(user);
    await user.click(screen.getAllByRole("button", { name: /Ölçüt seç/u })[0]!);

    await waitFor(() => {
      expect(searchRows).toHaveBeenCalled();
    });

    const against = searchRows.mock.calls[0]?.[1] as GridCriterionRefDto[];
    expect(against.map((one) => one.id)).toEqual(["c1", "c2", "c3"]);
  });

  it("seçilmiş bir ölçüt listede TEKRAR sunulmaz", async () => {
    const { user } = setup();

    await pick(user, /Kulüp seç/u, "Barcelona");
    await user.click(screen.getAllByRole("button", { name: /Kulüp seç/u })[0]!);

    // Aynı kulüp iki sütunda olamaz (`isGridShapeValid`); seçicinin bunu
    // göstermesi kesin reddedilecek bir seçim sunmak olurdu.
    await waitFor(() => {
      expect(
        screen.getByRole("option", { name: /Milan/u }),
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("option", { name: /Barcelona/u }),
    ).not.toBeInTheDocument();
  });

  it("sütun kaldırılınca seçilmiş satırlar DÜŞER", async () => {
    const { user } = setup();

    await pickColumns(user);
    await pick(user, /Ölçüt seç/u, "Galatasaray");
    expect(screen.getByText("Galatasaray")).toBeInTheDocument();

    // Satırların geçerliliği sütunlara bağlıydı; dayanak değişti.
    await user.click(screen.getAllByRole("button", { name: /Kaldır/u })[0]!);

    expect(screen.queryByText("Galatasaray")).not.toBeInTheDocument();
  });

  it("altı ölçüt seçilince ızgara kurulur", async () => {
    const { user, onBuilt } = setup();

    const build = screen.getByRole("button", { name: /Izgarayı kur/u });
    expect(build).toBeDisabled();

    await pickColumns(user);
    await pick(user, /Ölçüt seç/u, "Galatasaray");
    await pick(user, /Ölçüt seç/u, "Brezilya");
    await pick(user, /Ölçüt seç/u, "Ajax");

    await waitFor(() => {
      expect(build).toBeEnabled();
    });
    await user.click(build);

    expect(onBuilt).toHaveBeenCalledTimes(1);
    const grid = onBuilt.mock.calls[0]?.[0];
    expect(grid?.columns.map((one) => one.label)).toEqual([
      "Barcelona",
      "Milan",
      "Arsenal",
    ]);
    expect(grid?.rows.map((one) => one.label)).toEqual([
      "Galatasaray",
      "Brezilya",
      "Ajax",
    ]);
  });
});

/**
 * Üç sütun hiç satır bırakmayabilir; kullanıcının yapabileceği tek şey bir
 * sütunu değiştirmektir. "Sonuç yok" demek bunu söylemiyordu.
 */
it("satır adayı kalmadıysa ne yapılacağını söyler", async () => {
  const searchColumns = vi.fn().mockResolvedValue([...CLUBS]);
  const searchRows = vi.fn().mockResolvedValue([]);

  render(
    <GridBuilder
      searchColumns={searchColumns}
      searchRows={searchRows}
      onBuilt={vi.fn()}
    />,
  );

  const user = userEvent.setup();
  await pickColumns(user);
  await user.click(screen.getAllByRole("button", { name: /Ölçüt seç/u })[0]!);

  expect(await screen.findByText(/bir sütunu kaldırıp/iu)).toBeInTheDocument();
});
