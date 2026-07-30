// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ClubDto } from "@/application/dto/club-dto";
import { ClubPicker } from "@/components/club-picker";

/**
 * Kulüp seçici — erişilebilirlik ve klavye davranışı.
 *
 * Bu testler görünümü DEĞİL sözleşmeyi denetler: hangi ARIA öznitelikleri
 * hangi durumda ne değer alır, hangi tuş neyi yapar. Sınıf adları ve düzen
 * serbestçe değişebilmeli, testler kırılmamalı.
 */

afterEach(cleanup);

const CLUBS: ClubDto[] = [
  {
    id: "c1",
    name: "Arsenal F.C.",
    shortName: "Arsenal",
    country: "GB",
    crestUrl: null,
  },
  {
    id: "c2",
    name: "Beşiktaş JK",
    shortName: "Beşiktaş",
    country: "TR",
    crestUrl: null,
  },
  {
    id: "c3",
    name: "Galatasaray SK",
    shortName: "Galatasaray",
    country: "TR",
    crestUrl: null,
  },
];

function setup(overrides: Partial<Parameters<typeof ClubPicker>[0]> = {}) {
  const onSelect = vi.fn();
  const search = vi.fn().mockResolvedValue(CLUBS);

  render(
    <ClubPicker
      label="Birinci kulüp"
      selected={null}
      onSelect={onSelect}
      initialOptions={CLUBS}
      search={search}
      {...overrides}
    />,
  );

  return { onSelect, search, user: userEvent.setup() };
}

describe("ClubPicker — ARIA sözleşmesi", () => {
  it("combobox rolü ve bağlantılı listbox sunar", async () => {
    const { user } = setup();
    const input = screen.getByRole("combobox", { name: "Birinci kulüp" });

    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(input).toHaveAttribute("aria-autocomplete", "list");

    await user.click(input);

    expect(input).toHaveAttribute("aria-expanded", "true");
    const listbox = screen.getByRole("listbox");
    expect(input).toHaveAttribute("aria-controls", listbox.id);
  });

  it("etkin seçeneği aria-activedescendant ile bildirir", async () => {
    const { user } = setup();
    const input = screen.getByRole("combobox");

    await user.click(input);

    const active = input.getAttribute("aria-activedescendant");
    expect(active).not.toBeNull();
    // Bildirilen kimlik gerçekten listedeki bir seçeneğe ait olmalı.
    expect(document.getElementById(active ?? "")).toHaveAttribute(
      "role",
      "option",
    );
  });

  it("odağı seçeneklere TAŞIMAZ — metin kutusunda kalır", async () => {
    // Odak listeye taşınsaydı ekran okuyucu yazılan metni bırakır ve
    // kullanıcı nerede olduğunu kaybederdi.
    const { user } = setup();
    const input = screen.getByRole("combobox");

    await user.click(input);
    await user.keyboard("{ArrowDown}{ArrowDown}");

    expect(document.activeElement).toBe(input);
  });

  it("yalnızca etkin seçenek aria-selected taşır", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("combobox"));
    await user.keyboard("{ArrowDown}");

    const selected = screen
      .getAllByRole("option")
      .filter((option) => option.getAttribute("aria-selected") === "true");

    expect(selected).toHaveLength(1);
  });
});

describe("ClubPicker — klavye", () => {
  it("Enter etkin seçeneği seçer", async () => {
    const { user, onSelect } = setup();

    await user.click(screen.getByRole("combobox"));
    await user.keyboard("{Enter}");

    expect(onSelect).toHaveBeenCalledWith(CLUBS[0]);
  });

  it("ArrowDown ile ilerleyip seçim yapar", async () => {
    const { user, onSelect } = setup();

    await user.click(screen.getByRole("combobox"));
    await user.keyboard("{ArrowDown}{Enter}");

    expect(onSelect).toHaveBeenCalledWith(CLUBS[1]);
  });

  it("liste sonunda başa sarar", async () => {
    const { user, onSelect } = setup();

    await user.click(screen.getByRole("combobox"));
    // 0 → 1 → 2 → 0
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{Enter}");

    expect(onSelect).toHaveBeenCalledWith(CLUBS[0]);
  });

  it("ArrowUp başlangıçta sona sarar", async () => {
    const { user, onSelect } = setup();

    await user.click(screen.getByRole("combobox"));
    await user.keyboard("{ArrowUp}{Enter}");

    expect(onSelect).toHaveBeenCalledWith(CLUBS[2]);
  });

  it("Home ve End uçlara gider", async () => {
    const { user, onSelect } = setup();

    await user.click(screen.getByRole("combobox"));
    await user.keyboard("{End}{Enter}");
    expect(onSelect).toHaveBeenCalledWith(CLUBS[2]);

    onSelect.mockClear();
    await user.keyboard("{ArrowDown}{Home}{Enter}");
    expect(onSelect).toHaveBeenCalledWith(CLUBS[0]);
  });

  it("Escape listeyi kapatır ama seçim yapmaz", async () => {
    const { user, onSelect } = setup();
    const input = screen.getByRole("combobox");

    await user.click(input);
    await user.keyboard("{Escape}");

    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("liste kapalıyken ArrowDown listeyi açar, seçim yapmaz", async () => {
    const { user, onSelect } = setup();
    const input = screen.getByRole("combobox");

    await user.click(input);
    await user.keyboard("{Escape}{ArrowDown}");

    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe("ClubPicker — arama ve durumlar", () => {
  it("yazınca aramayı çağırır", async () => {
    const { user, search } = setup();

    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByRole("combobox"), "gala");

    await waitFor(() => {
      expect(search).toHaveBeenCalledWith("gala", expect.anything());
    });
  });

  it("diğer seçicide seçili kulübü listelemez (BR-4'e düşmeyi önler)", async () => {
    const { user } = setup({ excludeId: "c2" });

    await user.click(screen.getByRole("combobox"));

    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options.some((text) => text?.includes("Beşiktaş"))).toBe(false);
    expect(options.some((text) => text?.includes("Arsenal"))).toBe(true);
  });

  it("sonuç yoksa bunu söyler", async () => {
    const { user } = setup({ initialOptions: [] });

    await user.click(screen.getByRole("combobox"));

    expect(await screen.findByText(/sonuç yok/iu)).toBeInTheDocument();
  });

  it("arama başarısız olursa çökmez, kullanıcıya bildirir", async () => {
    const { user } = setup({
      initialOptions: [],
      search: vi.fn().mockRejectedValue(new Error("ağ hatası")),
    });

    await user.click(screen.getByRole("combobox"));

    expect(await screen.findByText(/başarısız/iu)).toBeInTheDocument();
  });

  it("hata mesajı iç ayrıntıyı göstermez", async () => {
    const { user } = setup({
      initialOptions: [],
      search: vi
        .fn()
        .mockRejectedValue(new Error("SQLITE_ERROR: no such table")),
    });

    await user.click(screen.getByRole("combobox"));
    await screen.findByText(/başarısız/iu);

    expect(document.body.textContent).not.toMatch(/SQLITE|no such table/iu);
  });

  it("seçim yapıldığında seçili kulübü ve değiştir düğmesini gösterir", () => {
    setup({ selected: CLUBS[0] ?? null });

    expect(screen.getByText("Arsenal")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Değiştir" }),
    ).toBeInTheDocument();
    // Seçim yapılmışken arama kutusu görünmez.
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("Değiştir seçimi temizler", async () => {
    const { user, onSelect } = setup({ selected: CLUBS[0] ?? null });

    await user.click(screen.getByRole("button", { name: "Değiştir" }));

    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("fare ile seçim yapılabilir", async () => {
    const { user, onSelect } = setup();

    await user.click(screen.getByRole("combobox"));
    const listbox = screen.getByRole("listbox");
    await user.click(within(listbox).getByText("Galatasaray"));

    expect(onSelect).toHaveBeenCalledWith(CLUBS[2]);
  });
});
