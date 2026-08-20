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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlayerDto } from "@/application/dto/player-dto";
import type { DailyGridDto } from "@/application/use-cases/daily-grid";
import { GridGame } from "@/components/grid-game";
import { PUZZLE_ROLLOVER_HOUR } from "@/domain/value-objects/daily-seed";
import { GRID_SIZE, maxGuesses } from "@/domain/services/grid";
import { resetSavedGameCache } from "@/lib/grid-storage";

/** Günlük ızgaranın hak sayısı; testlerin çoğu 3×3 üzerinden konuşuyor. */
const MAX_GUESSES = maxGuesses(GRID_SIZE);

/**
 * 3×3 ızgara oyunu — durum makinesi ve erişilebilirlik.
 *
 * Bu testler İŞ KURALINI denetlemez: bir cevabın doğru olup olmadığına sunucu
 * karar verir (BR-12) ve burada sahtelenir. Denetlenen şey, bileşenin sunucunun
 * verdiği cevaba göre doğru davranıp davranmadığı.
 */

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

const PLAYER: PlayerDto = {
  id: "p1",
  name: "Ronaldinho",
  nationality: "BR",
  position: "forward",
};

function setup(
  overrides: Partial<Parameters<typeof GridGame>[0]> = {},
  players: readonly PlayerDto[] = [PLAYER],
) {
  const checkAnswer = vi.fn().mockResolvedValue(true);
  const searchPlayers = vi.fn().mockResolvedValue([...players]);

  render(
    <GridGame
      grid={GRID}
      date={GRID.date}
      checkAnswer={checkAnswer}
      searchPlayers={searchPlayers}
      {...overrides}
    />,
  );

  return { checkAnswer, searchPlayers, user: userEvent.setup() };
}

/** Bir hücreye cevap ver: hücreyi aç, ara, ilk sonucu seç. */
async function answerCell(
  user: ReturnType<typeof userEvent.setup>,
  cellName: RegExp,
) {
  await user.click(screen.getByRole("button", { name: cellName }));
  await user.type(screen.getByRole("combobox"), "ron");
  await waitFor(() => {
    expect(screen.getAllByRole("option").length).toBeGreaterThan(0);
  });
  await user.keyboard("{Enter}");
}

beforeEach(() => {
  window.localStorage.clear();
  resetSavedGameCache();
});

describe("GridGame — yapı ve erişilebilirlik", () => {
  /**
   * Izgara semantik olarak bir TABLODUR: hücrenin anlamı satır ve sütun
   * başlığının kesişimidir. `div`'lerden kurulsaydı ekran okuyucu bu bağı
   * kuramaz, kullanıcı hangi soruyu cevapladığını bilemezdi.
   */
  it("satır ve sütun başlıkları scope ile işaretlidir", () => {
    setup();

    const columnHeaders = screen.getAllByRole("columnheader");
    const rowHeaders = screen.getAllByRole("rowheader");

    expect(columnHeaders).toHaveLength(3);
    expect(rowHeaders).toHaveLength(3);
    expect(columnHeaders[0]).toHaveAttribute("scope", "col");
    expect(rowHeaders[0]).toHaveAttribute("scope", "row");
  });

  /**
   * "Monaco" satırının kulübü mü ülkeyi mi sorduğu belirsiz kalırsa oyun
   * doğrudan bozulur.
   */
  it("kulüp ve uyruk ölçütlerini ayırt eder", () => {
    setup();

    const rowHeaders = screen.getAllByRole("rowheader");
    expect(within(rowHeaders[0]!).getByText("kulüp")).toBeInTheDocument();
    expect(within(rowHeaders[2]!).getByText("uyruk")).toBeInTheDocument();
  });

  /**
   * SEÇİCİ HEDEF HÜCRENİN İÇİNDE DURUR.
   *
   * Önceki yerleşimde seçici tablonun TAMAMINDAN sonra basılıyordu: sol üst
   * hücreye tıklayan kullanıcı, doldurduğu hücreyi göremeyecek kadar aşağıda
   * bir girdiyle karşılaşıyordu ve hangi hücreyi doldurduğu yalnızca
   * seçicinin etiketindeki metinden anlaşılıyordu.
   *
   * Test KONUMU denetliyor, sınıf adını değil: seçici, tıklanan hücrenin
   * `td`'sinin içinde mi? Sayfa dibine geri taşıyan bir değişiklik burada
   * kırmızıya döner.
   */
  it("seçici tıklanan hücrenin İÇİNDE açılır", async () => {
    const { user } = setup();

    const cellButton = screen.getByRole("button", {
      name: "Barcelona ve Arsenal için oyuncu seçin",
    });
    await user.click(cellButton);

    const cell = cellButton.closest("td");
    const combobox = screen.getByRole("combobox");

    expect(cell).not.toBeNull();
    expect(cell?.contains(combobox)).toBe(true);
  });

  /**
   * Sol üst köşe bir BAŞLIK değildir: satır ya da sütun tanımlamıyor. Kalan
   * hak işaretleri oraya konduğunda `th`'ye dönüşseydi ekran okuyucu ızgarada
   * dört sütun başlığı sayardı.
   */
  it("sol üst köşe başlık SAYILMAZ", () => {
    setup();

    expect(screen.getAllByRole("columnheader")).toHaveLength(3);
  });

  it("dokuz boş hücre sunar", () => {
    setup();

    expect(
      screen.getAllByRole("button", { name: /için oyuncu seçin$/u }),
    ).toHaveLength(9);
  });

  it("her hücre hangi kesişimi sorduğunu söyler", () => {
    setup();

    expect(
      screen.getByRole("button", {
        name: "Barcelona ve Arsenal için oyuncu seçin",
      }),
    ).toBeInTheDocument();
  });

  it("başlangıçta dokuz hak ve sıfır doğru gösterir", () => {
    setup();

    expect(
      screen.getByText(`0/${String(MAX_GUESSES)} doğru · 9 hak kaldı`),
    ).toBeInTheDocument();
  });
});

describe("GridGame — cevap verme", () => {
  it("hücreye tıklayınca seçici açılır", async () => {
    const { user } = setup();

    await user.click(
      screen.getByRole("button", {
        name: "Barcelona ve Arsenal için oyuncu seçin",
      }),
    );

    expect(
      screen.getByRole("combobox", {
        name: /Barcelona ve Arsenal için oyuncu seçin/u,
      }),
    ).toBeInTheDocument();
  });

  /**
   * BR-12 — doğrulama sunucuda, KİMLİK üzerinden. Bileşen kriterleri
   * göndermez; hangi ölçütün hangi hücrede olduğunu sunucu kendi bilir.
   */
  it("hücre koordinatı ve oyuncu kimliği ile doğrulatır", async () => {
    const { user, checkAnswer } = setup();

    await answerCell(user, /Milan ve Inter/u);

    expect(checkAnswer).toHaveBeenCalledWith({ row: 1, column: 1 }, "p1");
  });

  it("doğru cevabı işaretler ve sayacı artırır", async () => {
    const { user } = setup();

    await answerCell(user, /Barcelona ve Arsenal/u);

    await waitFor(() => {
      expect(
        screen.getByText(/Barcelona ve Arsenal: Ronaldinho — doğru/u),
      ).toBeInTheDocument();
    });
    expect(screen.getByText(/1\/9 doğru · 8 hak kaldı/u)).toBeInTheDocument();
  });

  /** Yanlış cevap da hücreyi kapatır ve bir hak harcar (BR-13). */
  it("yanlış cevap hücreyi harcar", async () => {
    const { user } = setup({ checkAnswer: vi.fn().mockResolvedValue(false) });

    await answerCell(user, /Barcelona ve Arsenal/u);

    await waitFor(() => {
      expect(
        screen.getByText(/Barcelona ve Arsenal: Ronaldinho — yanlış/u),
      ).toBeInTheDocument();
    });
    expect(screen.getByText(/0\/9 doğru · 8 hak kaldı/u)).toBeInTheDocument();
  });

  it("cevaplanmış hücre yeniden açılamaz", async () => {
    const { user } = setup();

    await answerCell(user, /Barcelona ve Arsenal/u);

    await waitFor(() => {
      expect(
        screen.queryByRole("button", {
          name: "Barcelona ve Arsenal için oyuncu seçin",
        }),
      ).not.toBeInTheDocument();
    });
  });

  /**
   * DURUM RENKLE DEĞİL METİNLE anlatılır (WCAG 1.4.1): renk körü kullanıcı ya
   * da tek renkli ekran oyunun durumunu yine de okuyabilmeli.
   */
  it("doğru/yanlış ayrımı metinle de verilir", async () => {
    const { user } = setup();

    await answerCell(user, /Barcelona ve Arsenal/u);

    await waitFor(() => {
      expect(screen.getByText(/— doğru/u)).toBeInTheDocument();
    });
  });

  /**
   * Ağ hatası yüzünden hücre kaybetmek, kullanıcının YAPMADIĞI bir hatanın
   * cezası olurdu.
   */
  it("doğrulanamayan cevap hak HARCAMAZ", async () => {
    const { user } = setup({
      checkAnswer: vi.fn().mockRejectedValue(new Error("ağ")),
    });

    await answerCell(user, /Barcelona ve Arsenal/u);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/doğrulanamadı/iu);
    });
    expect(screen.getByText(/0\/9 doğru · 9 hak kaldı/u)).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Barcelona ve Arsenal için oyuncu seçin",
      }),
    ).toBeEnabled();
  });

  /** BR-10 — bir oyuncu ızgarada tek hücrede kullanılabilir. */
  it("kullanılmış oyuncu ikinci hücrede listelenmez", async () => {
    const { user } = setup();

    await answerCell(user, /Barcelona ve Arsenal/u);
    await waitFor(() => {
      expect(screen.getByText(/1\/9 doğru/u)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /Milan ve Inter/u }));
    await user.type(screen.getByRole("combobox"), "ron");

    await waitFor(() => {
      expect(screen.getByText(/sonuç yok/iu)).toBeInTheDocument();
    });
  });
});

describe("GridGame — ilerlemenin saklanması", () => {
  /**
   * Saklanmasaydı BR-13'ün "dokuz hak" kuralı anlamsız olurdu: sayfayı
   * yenileyen kullanıcı sıfırdan başlardı.
   */
  it("yeniden yüklemede ilerleme korunur", async () => {
    const { user } = setup();

    await answerCell(user, /Barcelona ve Arsenal/u);
    await waitFor(() => {
      expect(screen.getByText(/1\/9 doğru/u)).toBeInTheDocument();
    });

    cleanup();
    setup();

    expect(screen.getByText(/1\/9 doğru · 8 hak kaldı/u)).toBeInTheDocument();
  });

  /** Başka bir güne ait kayıt bugünün oyunu değildir (BR-11). */
  it("gün değişince kaydedilmiş oyun atılır", async () => {
    const { user } = setup();

    await answerCell(user, /Barcelona ve Arsenal/u);
    await waitFor(() => {
      expect(screen.getByText(/1\/9 doğru/u)).toBeInTheDocument();
    });

    cleanup();
    resetSavedGameCache();
    render(
      <GridGame
        grid={GRID}
        date="2026-08-01"
        checkAnswer={vi.fn().mockResolvedValue(true)}
        searchPlayers={vi.fn().mockResolvedValue([PLAYER])}
      />,
    );

    expect(screen.getByText(/0\/9 doğru · 9 hak kaldı/u)).toBeInTheDocument();
  });

  /**
   * Depodan gelen veri DIŞ GİRDİDİR: kullanıcı elle düzenleyebilir. Bozuk bir
   * kayıt oyunu çökertmemeli, yok sayılmalı (§2.3).
   */
  it.each([
    ["geçersiz JSON", "{bozuk"],
    ["yanlış şekil", JSON.stringify({ date: 5 })],
    [
      "bozuk hücre",
      JSON.stringify({
        date: "2026-07-31",
        cells: { "0:0": 1 },
        guessesUsed: 1,
      }),
    ],
    ["dizi", JSON.stringify([])],
  ])("bozuk kayıt (%s) yok sayılır", (_label, raw) => {
    window.localStorage.setItem("futbol-quiz:grid", raw);
    resetSavedGameCache();

    setup();

    expect(screen.getByText(/0\/9 doğru · 9 hak kaldı/u)).toBeInTheDocument();
  });
});

describe("GridGame — oyun sonu", () => {
  it("dokuz cevaptan sonra biter ve skor gösterir", async () => {
    window.localStorage.setItem(
      "futbol-quiz:grid",
      JSON.stringify({
        date: GRID.date,
        guessesUsed: MAX_GUESSES,
        cells: Object.fromEntries(
          Array.from({ length: MAX_GUESSES }, (_, i) => [
            `${String(Math.floor(i / 3))}:${String(i % 3)}`,
            {
              status: i < 4 ? "correct" : "wrong",
              playerId: `p${String(i)}`,
              playerName: `Oyuncu ${String(i)}`,
            },
          ]),
        ),
      }),
    );
    resetSavedGameCache();

    setup();

    expect(screen.getByRole("status")).toHaveTextContent(/Oyun bitti/u);
    expect(screen.getByRole("status")).toHaveTextContent(/4\/9/u);
  });

  /**
   * §11.11 — yayın saati arayüzde ELLE YAZILMAZ.
   *
   * Ekran aylarca "03.00" dedi: sınır 06:00'ya taşınmıştı (BR-49) ama iki
   * oyun bileşeninin metni de geride kalmıştı ve hiçbir test metni saatle
   * karşılaştırmıyordu.
   */
  it("yayın saati, gün sınırı sabitinden türer", () => {
    window.localStorage.setItem(
      "futbol-quiz:grid",
      JSON.stringify({
        date: GRID.date,
        guessesUsed: MAX_GUESSES,
        cells: Object.fromEntries(
          Array.from({ length: MAX_GUESSES }, (_, i) => [
            `${String(Math.floor(i / 3))}:${String(i % 3)}`,
            {
              status: "wrong",
              playerId: `p${String(i)}`,
              playerName: `Oyuncu ${String(i)}`,
            },
          ]),
        ),
      }),
    );
    resetSavedGameCache();

    setup();

    const expected = `${String(PUZZLE_ROLLOVER_HOUR).padStart(2, "0")}.00`;
    expect(screen.getByRole("status")).toHaveTextContent(expected);
  });

  /** Haklar tükendiyse kalan boş hücreler açılamaz. */
  it("haklar tükendiğinde boş hücreler kapalıdır", () => {
    window.localStorage.setItem(
      "futbol-quiz:grid",
      JSON.stringify({
        date: GRID.date,
        guessesUsed: MAX_GUESSES,
        cells: {
          "0:0": {
            status: "wrong",
            playerId: "p1",
            playerName: "Oyuncu",
          },
        },
      }),
    );
    resetSavedGameCache();

    setup();

    for (const button of screen.getAllByRole("button", {
      name: /için oyuncu seçin$/u,
    })) {
      expect(button).toBeDisabled();
    }
  });
});

/**
 * §9.1 — "Sen kur" ızgarası (BR-25): tarih YOK, dolayısıyla ilerleme de
 * saklanmaz.
 */
describe("saklanmayan ızgara — §9.1", () => {
  /** Dokuz hücre, dokuz FARKLI oyuncu: BR-10 aynısını ikinci kez göstermez. */
  const NINE = Array.from({ length: 9 }, (_, index) => ({
    ...PLAYER,
    id: `p${String(index)}`,
    name: `Ronaldinho ${String(index)}`,
  }));

  function setupCustom() {
    const checkAnswer = vi.fn().mockResolvedValue(true);
    const onRestart = vi.fn();

    render(
      <GridGame
        grid={GRID}
        onRestart={onRestart}
        checkAnswer={checkAnswer}
        searchPlayers={vi.fn().mockResolvedValue(NINE)}
      />,
    );

    return { checkAnswer, onRestart, user: userEvent.setup() };
  }

  it("cevap sayılır ama DEPOYA yazılmaz", async () => {
    const { user } = setupCustom();

    await answerCell(user, /Barcelona ve Arsenal/u);

    // Oyun ilerledi…
    await waitFor(() => {
      expect(
        screen.getByText(new RegExp("1/9 doğru", "u")),
      ).toBeInTheDocument();
    });
    // …ama depoya hiçbir şey yazılmadı: saklanan tek şey "bugünün ızgarası".
    expect(window.localStorage.getItem("futbol-quiz:grid")).toBeNull();
  });

  it("günlük ilerlemeyi EZMEZ", async () => {
    window.localStorage.setItem(
      "futbol-quiz:grid",
      JSON.stringify({
        date: GRID.date,
        guessesUsed: 3,
        cells: {
          "0:0": { status: "correct", playerId: "px", playerName: "Başkası" },
        },
      }),
    );
    resetSavedGameCache();

    const { user } = setupCustom();
    await answerCell(user, /Barcelona ve Arsenal/u);
    await waitFor(() => {
      expect(
        screen.getByText(new RegExp("1/9 doğru", "u")),
      ).toBeInTheDocument();
    });

    const saved = JSON.parse(
      window.localStorage.getItem("futbol-quiz:grid") ?? "null",
    ) as { guessesUsed: number };
    expect(saved.guessesUsed).toBe(3);
  });

  /**
   * BU TESTİN BÜTÇESİ ÖLÇÜLDÜ — vitest'in 5 sn varsayılanı yetmiyor.
   *
   * Test dokuz hücreyi SIRAYLA cevaplıyor ve her hücre tam bir etkileşim
   * turu: seçiciyi aç, yaz, sonuçları bekle, seç, ızgaranın güncellenmesini
   * bekle. İzole koşumda 3,6 sn sürüyor, yani varsayılanla marj 1,4 kat;
   * 87 test dosyası paralel koşarken bu marj düzenli olarak tükeniyordu ve
   * `verify` ara sıra burada düşüyordu (20 Ağustos 2026).
   *
   * SINIR KALDIRILMADI, bu teste özel olarak ölçüye oturtuldu: diğer 1.572
   * testin bütçesi 5 sn olarak duruyor. Genel `testTimeout`'u büyütmek,
   * gerçekten kilitlenen bir testi de yirmi saniye bekletirdi.
   */
  it("bitince yeni ızgara kurma yolu sunar", async () => {
    const { user, onRestart } = setupCustom();

    // Dokuz hak dokuz hücre (BR-13); hepsini harcamak yerine dokuz doğru.
    for (const cell of [
      /Barcelona ve Arsenal/u,
      /Barcelona ve Inter/u,
      /Barcelona ve Galatasaray/u,
      /Milan ve Arsenal/u,
      /Milan ve Inter/u,
      /Milan ve Galatasaray/u,
      /Brezilya ve Arsenal/u,
      /Brezilya ve Inter/u,
      /Brezilya ve Galatasaray/u,
    ]) {
      await answerCell(user, cell);
    }

    const restart = await screen.findByRole("button", {
      name: /Yeni ızgara kur/u,
    });
    await user.click(restart);
    expect(onRestart).toHaveBeenCalledTimes(1);
  }, 20_000);
});

/** BR-27 — oyun bileşeni boyutu IZGARADAN okur, sabitten değil. */
describe("boyut (BR-27)", () => {
  function bigGrid(size: number) {
    return {
      rows: Array.from({ length: size }, (_, i) => ({
        kind: "club" as const,
        label: `Satır ${String(i)}`,
      })),
      columns: Array.from({ length: size }, (_, i) => ({
        kind: "club" as const,
        label: `Sütun ${String(i)}`,
      })),
    };
  }

  it("5×5 ızgarada yirmi beş hücre ve yirmi beş hak vardır", () => {
    render(
      <GridGame
        grid={bigGrid(5)}
        checkAnswer={vi.fn().mockResolvedValue(true)}
        searchPlayers={vi.fn().mockResolvedValue([PLAYER])}
      />,
    );

    expect(
      screen.getAllByRole("button", { name: /için oyuncu seçin$/u }),
    ).toHaveLength(25);
    expect(screen.getByText("0/25 doğru · 25 hak kaldı")).toBeInTheDocument();
  });

  it("2×2 ızgarada dört hücre ve dört hak vardır", () => {
    render(
      <GridGame
        grid={bigGrid(2)}
        checkAnswer={vi.fn().mockResolvedValue(true)}
        searchPlayers={vi.fn().mockResolvedValue([PLAYER])}
      />,
    );

    expect(
      screen.getAllByRole("button", { name: /için oyuncu seçin$/u }),
    ).toHaveLength(4);
    expect(screen.getByText("0/4 doğru · 4 hak kaldı")).toBeInTheDocument();
  });
});
