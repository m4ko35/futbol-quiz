// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlayerDto } from "@/application/dto/player-dto";
import { PlayerPicker } from "@/components/player-picker";

/**
 * Oyuncu seçici — erişilebilirlik, klavye ve arama davranışı.
 *
 * Görünümü DEĞİL sözleşmeyi denetler: hangi ARIA özniteliği hangi durumda ne
 * değer alır, hangi tuş neyi yapar, hangi girdi depoya gider.
 */

afterEach(cleanup);

const PLAYERS: PlayerDto[] = [
  {
    id: "p1",
    name: "Esteban Cambiasso",
    nationality: "AR",
    position: "Orta saha",
  },
  { id: "p2", name: "Andrea Cambiaso", nationality: "IT", position: "Defans" },
  { id: "p3", name: "Cesare Cambi", nationality: "IT", position: null },
];

function setup(overrides: Partial<Parameters<typeof PlayerPicker>[0]> = {}) {
  const onSelect = vi.fn();
  const onCancel = vi.fn();
  const search = vi.fn().mockResolvedValue(PLAYERS);

  render(
    <PlayerPicker
      label="Barcelona ve Brezilya için oyuncu seçin"
      onSelect={onSelect}
      onCancel={onCancel}
      usedPlayerIds={new Set()}
      search={search}
      {...overrides}
    />,
  );

  return { onSelect, onCancel, search, user: userEvent.setup() };
}

/** Arama gecikmeli (debounce); sonuçların gelmesini bekle. */
async function typeAndWait(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByRole("combobox"), "cambi");
  await waitFor(() => {
    expect(screen.getAllByRole("option").length).toBeGreaterThan(0);
  });
}

describe("PlayerPicker — ARIA sözleşmesi", () => {
  it("combobox rolü ve bağlantılı listbox sunar", () => {
    setup();
    const input = screen.getByRole("combobox");

    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(input).toHaveAttribute("aria-autocomplete", "list");
    expect(input).toHaveAttribute(
      "aria-controls",
      screen.getByRole("listbox").id,
    );
  });

  /**
   * Panel açıldığında odak arama kutusuna gitmeli; aksi hâlde klavye
   * kullanıcısı hücreye bastıktan sonra odağı elle taşımak zorunda kalır.
   */
  it("açılışta odağı arama kutusuna taşır", () => {
    setup();
    expect(document.activeElement).toBe(screen.getByRole("combobox"));
  });

  it("etkin seçeneği aria-activedescendant ile bildirir", async () => {
    const { user } = setup();
    await typeAndWait(user);

    const active = screen
      .getByRole("combobox")
      .getAttribute("aria-activedescendant");

    expect(active).not.toBeNull();
    expect(document.getElementById(active ?? "")).toHaveAttribute(
      "role",
      "option",
    );
  });

  it("odağı seçeneklere TAŞIMAZ", async () => {
    const { user } = setup();
    await typeAndWait(user);

    await user.keyboard("{ArrowDown}{ArrowDown}");

    expect(document.activeElement).toBe(screen.getByRole("combobox"));
  });

  it("yalnızca etkin seçenek aria-selected taşır", async () => {
    const { user } = setup();
    await typeAndWait(user);

    const selected = screen
      .getAllByRole("option")
      .filter((option) => option.getAttribute("aria-selected") === "true");

    expect(selected).toHaveLength(1);
  });
});

describe("PlayerPicker — arama", () => {
  /**
   * 76.358 kayıtlık tabloda tek harflik arama hem pahalı hem işe yaramaz.
   * Kullanıcı hata GÖRMEZ, yönlendirme görür.
   */
  it("kısa metinde arama yapmaz ve ne yapılacağını söyler", async () => {
    const { user, search } = setup();

    await user.type(screen.getByRole("combobox"), "c");

    expect(search).not.toHaveBeenCalled();
    expect(screen.getByText(/en az 2 karakter/iu)).toBeInTheDocument();
  });

  it("iki karakterden sonra arar", async () => {
    const { user, search } = setup();

    await user.type(screen.getByRole("combobox"), "ca");

    await waitFor(() => {
      expect(search).toHaveBeenCalled();
    });
  });

  it("uyruğu ham KOD olarak değil Türkçe adla gösterir", async () => {
    const { user } = setup();
    await typeAndWait(user);

    expect(screen.getByText(/Arjantin/u)).toBeInTheDocument();
    expect(screen.queryByText(/^AR$/u)).not.toBeInTheDocument();
  });

  /**
   * BR-10 — bir oyuncu ızgarada tek hücrede kullanılabilir. Kullanıcıyı kesin
   * reddedilecek bir seçimden korumak için listede gösterilmez.
   */
  it("kullanılmış oyuncuları listeden çıkarır", async () => {
    const { user } = setup({ usedPlayerIds: new Set(["p1"]) });
    await typeAndWait(user);

    expect(screen.queryByText("Esteban Cambiasso")).not.toBeInTheDocument();
    expect(screen.getByText("Andrea Cambiaso")).toBeInTheDocument();
  });

  it("arama başarısız olursa bunu söyler", async () => {
    const { user } = setup({
      search: vi.fn().mockRejectedValue(new Error("ağ")),
    });

    await user.type(screen.getByRole("combobox"), "cambi");

    await waitFor(() => {
      expect(screen.getByText(/başarısız/iu)).toBeInTheDocument();
    });
  });

  it("sonuç yoksa bunu söyler", async () => {
    const { user } = setup({ search: vi.fn().mockResolvedValue([]) });

    await user.type(screen.getByRole("combobox"), "cambi");

    await waitFor(() => {
      expect(screen.getByText(/sonuç yok/iu)).toBeInTheDocument();
    });
  });

  /**
   * Metin kısalınca eski sonuçlar EKRANDA KALMAMALI: kullanıcı sildiği bir
   * aramanın sonuçlarını görmeye devam ederse hangi listeyi okuduğunu bilemez.
   */
  it("metin kısalınca önceki sonuçları gizler", async () => {
    const { user } = setup();
    await typeAndWait(user);

    await user.clear(screen.getByRole("combobox"));
    await user.type(screen.getByRole("combobox"), "c");

    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });
});

describe("PlayerPicker — klavye", () => {
  it("Enter etkin seçeneği seçer", async () => {
    const { user, onSelect } = setup();
    await typeAndWait(user);

    await user.keyboard("{Enter}");

    expect(onSelect).toHaveBeenCalledWith(PLAYERS[0]);
  });

  it("ok tuşları listede gezinir", async () => {
    const { user, onSelect } = setup();
    await typeAndWait(user);

    await user.keyboard("{ArrowDown}{Enter}");

    expect(onSelect).toHaveBeenCalledWith(PLAYERS[1]);
  });

  it("sonda ArrowDown başa sarar", async () => {
    const { user, onSelect } = setup();
    await typeAndWait(user);

    await user.keyboard("{End}{ArrowDown}{Enter}");

    expect(onSelect).toHaveBeenCalledWith(PLAYERS[0]);
  });

  it("Escape vazgeçer", async () => {
    const { user, onCancel } = setup();
    await typeAndWait(user);

    await user.keyboard("{Escape}");

    expect(onCancel).toHaveBeenCalled();
  });

  it("boş listede Enter hiçbir şey seçmez", async () => {
    const { user, onSelect } = setup({
      search: vi.fn().mockResolvedValue([]),
    });

    await user.type(screen.getByRole("combobox"), "cambi");
    await waitFor(() => {
      expect(screen.getByText(/sonuç yok/iu)).toBeInTheDocument();
    });
    await user.keyboard("{Enter}");

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("Vazgeç düğmesi de kapatır", async () => {
    const { user, onCancel } = setup();

    await user.click(screen.getByRole("button", { name: "Vazgeç" }));

    expect(onCancel).toHaveBeenCalled();
  });
});
