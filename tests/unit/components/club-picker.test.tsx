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
      // İkinci argüman lig süzgeci (BR-37); lig seçili değilken null.
      expect(search).toHaveBeenCalledWith("gala", null, expect.anything());
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

/**
 * BR-37 / §7.14 — iki kademeli gözat.
 *
 * Ad yazarak arama yalnızca kulübün adını BİLEN kullanıcı için çalışır.
 * Bu testler, gözatmanın ad aramasını KAYBETMEDEN eklendiğini kilitliyor.
 */
describe("ClubPicker — lige göre gözat", () => {
  const LEAGUES = [
    { wikidataId: "Q485568", name: "Süper Lig", country: "TR", clubCount: 41 },
    {
      wikidataId: "Q9448",
      name: "Premier League",
      country: "GB",
      clubCount: 51,
    },
    { wikidataId: "Q15804", name: "Serie A", country: "IT", clubCount: 83 },
  ];

  function setupLeagues(
    overrides: Partial<Parameters<typeof ClubPicker>[0]> = {},
  ) {
    const onSelect = vi.fn();
    const search = vi.fn().mockResolvedValue(CLUBS);
    render(
      <ClubPicker
        label="Birinci kulüp"
        selected={null}
        onSelect={onSelect}
        initialOptions={CLUBS}
        leagues={LEAGUES}
        search={search}
        {...overrides}
      />,
    );
    return { onSelect, search, user: userEvent.setup() };
  }

  it("boş kutuda lig listesini gösterir", async () => {
    const { user } = setupLeagues();
    await user.click(screen.getByRole("combobox"));

    const list = screen.getByRole("listbox");
    expect(within(list).getByText("Süper Lig")).toBeInTheDocument();
    expect(within(list).getByText("Serie A")).toBeInTheDocument();
    // Kulüp sayısı listede görünür — kullanıcı ne kadar büyük olduğunu bilir.
    expect(within(list).getByText("83")).toBeInTheDocument();
  });

  it("YAZINCA ad araması geri gelir — özellik eskisini yemez", async () => {
    const { user, search } = setupLeagues();
    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByRole("combobox"), "gala");

    await waitFor(() => {
      expect(search).toHaveBeenCalledWith("gala", null, expect.anything());
    });
    const list = screen.getByRole("listbox");
    expect(within(list).getByText("Galatasaray")).toBeInTheDocument();
    expect(within(list).queryByText("Süper Lig")).not.toBeInTheDocument();
  });

  it("lige tıklayınca o ligin kulüpleri istenir, liste KAPANMAZ", async () => {
    const { user, search, onSelect } = setupLeagues();
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByText("Süper Lig"));

    await waitFor(() => {
      expect(search).toHaveBeenCalledWith("", "Q485568", expect.anything());
    });
    // Lig seçmek bir KULÜP seçimi değildir.
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("kademe 2'de yazmak ligin İÇİNDE arar", async () => {
    const { user, search } = setupLeagues();
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByText("Süper Lig"));
    await user.type(screen.getByRole("combobox"), "bes");

    await waitFor(() => {
      expect(search).toHaveBeenCalledWith("bes", "Q485568", expect.anything());
    });
  });

  it("Escape kademe 2'de GERİ gider, kapatmaz", async () => {
    // Tek tuşla kapanmak, ligin içine girmiş kullanıcıyı tek yanlış tuşta en
    // başa atardı; kademeli geri alma gezinmeyi tersine çevrilebilir kılar.
    const { user } = setupLeagues();
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByText("Süper Lig"));

    await user.keyboard("{Escape}");

    const list = screen.getByRole("listbox");
    expect(within(list).getByText("Süper Lig")).toBeInTheDocument();
  });

  it("Escape kademe 1'de listeyi kapatır", async () => {
    const { user } = setupLeagues();
    await user.click(screen.getByRole("combobox"));

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("klavyeyle lige girilebilir — fare zorunlu değil", async () => {
    const { user, search } = setupLeagues();
    await user.click(screen.getByRole("combobox"));
    await user.keyboard("{ArrowDown}{Enter}");

    await waitFor(() => {
      expect(search).toHaveBeenCalledWith(
        "",
        expect.stringMatching(/^Q\d+$/u),
        expect.anything(),
      );
    });
  });

  it("kademe 2'de kulüp seçilince süzgeç sıfırlanır", async () => {
    const { user, onSelect } = setupLeagues();
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByText("Süper Lig"));
    await waitFor(() => {
      expect(screen.getByText("Galatasaray")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Galatasaray"));

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ shortName: "Galatasaray" }),
    );
  });

  /**
   * KESME SESSİZ OLAMAZ (BR-37). Ölçüldü: Serie A'da 83 seçilebilir kulüp
   * var, üst sınır 50. Söylenmezse kullanıcı ligin tamamını gördüğünü sanar
   * ve aradığı kulübü "veri kümesinde yok" diye okur.
   */
  it("liste kesildiğinde kaç kulüpten kaçının gösterildiğini söyler", async () => {
    const { user } = setupLeagues();
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByText("Serie A"));

    await waitFor(() => {
      expect(screen.getByText(/83 kulüpten 3 tanesi/u)).toBeInTheDocument();
    });
  });

  it("liste kesilmediyse uyarı GÖSTERİLMEZ", async () => {
    // Her listede duran bir uyarı, uyarı olmaktan çıkar.
    const { user } = setupLeagues({
      leagues: [
        { wikidataId: "Q1", name: "Küçük Lig", country: "TR", clubCount: 3 },
      ],
    });
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByText("Küçük Lig"));

    await waitFor(() => {
      expect(screen.getByText("Galatasaray")).toBeInTheDocument();
    });
    expect(screen.queryByText(/gösteriliyor/u)).not.toBeInTheDocument();
  });

  it("lig verilmezse tek kademeli çalışır — özellik veri olmadan kapanır", async () => {
    const { user } = setupLeagues({ leagues: [] });
    await user.click(screen.getByRole("combobox"));

    const list = screen.getByRole("listbox");
    expect(within(list).getByText("Galatasaray")).toBeInTheDocument();
  });
});

/**
 * §7.14 — listeden çıkış yolları.
 *
 * KULLANILIRKEN BULUNAN KUSUR: liste yalnızca `Escape` ile ya da seçim
 * yapılarak kapanıyordu; dışarı tıklamak işe yaramıyor, arayüz kilitlenmiş
 * gibi görünüyordu. Bu testler üç çıkış yolunun da çalıştığını ve
 * anlamlarının AYRIŞTIĞINI kilitliyor.
 */
describe("ClubPicker — listeden çıkış", () => {
  it("dışarı tıklamak listeyi kapatır", async () => {
    const { user } = setup();
    const input = screen.getByRole("combobox");

    await user.click(input);
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    await user.click(document.body);

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("dışarı tıklamak YAZILANI KORUR", async () => {
    // Yanlışlıkla dışarı tıklayan kullanıcı yazdığını kaybetmemeli.
    const { user } = setup();
    const input = screen.getByRole("combobox");

    await user.click(input);
    await user.type(input, "gala");
    await user.click(document.body);

    expect(input).toHaveValue("gala");
  });

  it("dışarı tıklamak seçim YAPMAZ", async () => {
    const { user, onSelect } = setup();

    await user.click(screen.getByRole("combobox"));
    await user.click(document.body);

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("liste içindeki boşluğa tıklamak listeyi kapatmaz", async () => {
    // Kaydırma çubuğuna ya da boşluğa tıklayan kullanıcı gezinmeyi amaçlıyor.
    const { user } = setup();

    await user.click(screen.getByRole("combobox"));
    const list = screen.getByRole("listbox");
    await user.click(list);

    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("Vazgeç kapatır ve yazılanı SİLER", async () => {
    const { user, onSelect } = setup();
    const input = screen.getByRole("combobox");

    await user.click(input);
    await user.type(input, "gala");
    await user.click(screen.getByRole("button", { name: "Vazgeç" }));

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(input).toHaveValue("");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("Vazgeç lig seçimini de sıfırlar", async () => {
    const { user } = setup({
      leagues: [
        {
          wikidataId: "Q485568",
          name: "Süper Lig",
          country: "TR",
          clubCount: 41,
        },
      ],
    });

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByText("Süper Lig"));
    await user.click(screen.getByRole("button", { name: "Vazgeç" }));

    // Yeniden açıldığında kademe 1'de olmalı.
    await user.click(screen.getByRole("combobox"));
    expect(screen.getByText("Süper Lig")).toBeInTheDocument();
  });

  it("Vazgeç dokunmatikte de erişilebilir — odak kutudan çıkmaz", async () => {
    // `tabIndex={-1}` ve `onMouseDown`: odak kutudan çıkarsa `blur` tetiklenir
    // ve düğme kendi tıklamasından ÖNCE listeyi kapatırdı.
    const { user } = setup();
    const input = screen.getByRole("combobox");

    await user.click(input);
    const cancelButton = screen.getByRole("button", { name: "Vazgeç" });
    expect(cancelButton).toHaveAttribute("tabindex", "-1");

    await user.click(cancelButton);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});

/**
 * Kapandıktan sonra yeniden açılabilmeli — testle bulunan kusur.
 *
 * `Escape` ve "Vazgeç" listeyi kapatırken odak kutuda KALIR. Açma yalnızca
 * `onFocus`'a bağlı olsaydı aynı kutuya tekrar tıklamak hiçbir şey yapmazdı:
 * odak zaten oradaydı, yeni bir `focus` olayı doğmuyor.
 */
describe("ClubPicker — kapandıktan sonra yeniden açılır", () => {
  it("Vazgeç'ten sonra tıklamak listeyi yeniden açar", async () => {
    const { user } = setup();
    const input = screen.getByRole("combobox");

    await user.click(input);
    await user.click(screen.getByRole("button", { name: "Vazgeç" }));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    await user.click(input);

    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("Escape'ten sonra tıklamak listeyi yeniden açar", async () => {
    const { user } = setup();
    const input = screen.getByRole("combobox");

    await user.click(input);
    await user.keyboard("{Escape}");

    await user.click(input);

    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });
});
