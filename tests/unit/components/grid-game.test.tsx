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
import { MAX_GUESSES } from "@/domain/services/grid";
import { resetSavedGameCache } from "@/lib/grid-storage";

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
  position: "Forvet",
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
        grid={{ ...GRID, date: "2026-08-01" }}
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
