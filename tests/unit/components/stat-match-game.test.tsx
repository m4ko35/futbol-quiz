// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlayerDto } from "@/application/dto/player-dto";
import type { DailyStatMatchDto } from "@/application/use-cases/daily-stat-match";
import { StatMatchGame } from "@/components/stat-match-game";
import { resetStatMatchCache } from "@/lib/stat-match-storage";

/**
 * İstatistik eşleştirme oyunu — durum makinesi ve erişilebilirlik.
 *
 * Bu testler PUAN HESAPLAMAZ ve hesaplamamalı: puanı sunucu verir (BR-20),
 * burada sahtelenir. Denetlenen şey, bileşenin sunucunun verdiği yanıta göre
 * doğru davranıp davranmadığı.
 */

afterEach(cleanup);

const DAILY: DailyStatMatchDto = {
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

const PLAYER: PlayerDto = {
  id: "p1",
  name: "Dennis Bergkamp",
  nationality: "NL",
  position: "Forvet",
};

function setup(
  overrides: Partial<Parameters<typeof StatMatchGame>[0]> = {},
  players: readonly PlayerDto[] = [PLAYER],
) {
  const submitAnswer = vi.fn().mockResolvedValue({ value: 180, score: 93 });
  const searchPlayers = vi.fn().mockResolvedValue([...players]);

  render(
    <StatMatchGame
      daily={DAILY}
      submitAnswer={submitAnswer}
      searchPlayers={searchPlayers}
      {...overrides}
    />,
  );

  return { submitAnswer, searchPlayers, user: userEvent.setup() };
}

async function answerStat(
  user: ReturnType<typeof userEvent.setup>,
  statLabel: RegExp,
) {
  await user.click(screen.getByRole("button", { name: statLabel }));
  await user.type(screen.getByRole("combobox"), "berg");
  await waitFor(() => {
    expect(screen.getAllByRole("option").length).toBeGreaterThan(0);
  });
  await user.keyboard("{Enter}");
}

beforeEach(() => {
  window.localStorage.clear();
  resetStatMatchCache();
});

describe("StatMatchGame — sunum", () => {
  it("günün oyuncusunu ve altı istatistiği gösterir", () => {
    setup();

    expect(screen.getByText("Éric Cantona")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Oyuncu seç/u })).toHaveLength(
      6,
    );
  });

  /**
   * Hedef değerler AÇIKÇA gösterilir — ızgaranın tersine. Oyun onları bilmeyi
   * değil, onlara yakın başka oyuncuları bilmeyi sorar (§9.2).
   */
  it("hedef değerleri gösterir", () => {
    setup();

    expect(screen.getByText("194")).toBeInTheDocument();
    expect(screen.getByText("83")).toBeInTheDocument();
    expect(screen.getByText("188")).toBeInTheDocument();
  });

  /**
   * KAPSAM BİLDİRİMİ (§1.3). Söylenmezse kullanıcı bildiği gerçek toplamla
   * karşılaştırıp siteyi yanlış sanar.
   */
  it("kapsamlı istatistikleri işaretler ve açıklar", () => {
    setup();

    expect(screen.getAllByText("(yalnızca on dokuz lig)")).toHaveLength(3);
    // Dipnot kapsamı SÖYLEMELİ. Ülke listesi 12 ligde okunamaz hâle geldiği
    // için lig SAYISINA çevrildi; sınanan şey metnin harfi değil, kullanıcının
    // "bu sayı neyi kapsıyor" sorusunun yanıtlanmış olması (§1.3).
    expect(
      screen.getByText(/yalnızca kapsanan on dokuz Avrupa ligindeki/u),
    ).toBeInTheDocument();
  });

  it("uyruğu Türkçe adla gösterir", () => {
    setup();

    expect(screen.getByText("Fransa")).toBeInTheDocument();
  });

  it("başlangıçta hiç cevap yoktur", () => {
    setup();

    expect(screen.getByText("0/6 cevaplandı")).toBeInTheDocument();
  });
});

describe("StatMatchGame — cevap verme", () => {
  it("istatistik anahtarı ve oyuncu kimliğiyle gönderir", async () => {
    const { user, submitAnswer } = setup();

    await answerStat(user, /Kulüp maçı/u);

    expect(submitAnswer).toHaveBeenCalledWith("appearances", "p1");
  });

  it("sunucunun verdiği değeri ve puanı gösterir", async () => {
    const { user } = setup();

    await answerStat(user, /Kulüp maçı/u);

    await waitFor(() => {
      expect(screen.getByText("Dennis Bergkamp")).toBeInTheDocument();
    });
    expect(screen.getByText("180 · %93")).toBeInTheDocument();
  });

  it("cevaplanan istatistik yeniden açılamaz", async () => {
    const { user } = setup();

    await answerStat(user, /Kulüp maçı/u);

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /Kulüp maçı/u }),
      ).not.toBeInTheDocument();
    });
  });

  it("ortalama puanı gösterir", async () => {
    const { user } = setup();

    await answerStat(user, /Kulüp maçı/u);

    await waitFor(() => {
      expect(
        screen.getByText(/1\/6 cevaplandı · ortalama %93/u),
      ).toBeInTheDocument();
    });
  });

  /**
   * BR-16 — sunucu "bu oyuncunun verisi yok" diyorsa mesaj OLDUĞU GİBİ
   * gösterilir; kullanıcı neden reddedildiğini bilmezse aynı hatayı tekrarlar.
   */
  it("sunucunun ret gerekçesini gösterir", async () => {
    const { user } = setup({
      submitAnswer: vi
        .fn()
        .mockRejectedValue(
          new Error("Bu oyuncunun bu istatistikte verisi yok"),
        ),
    });

    await answerStat(user, /Kulüp maçı/u);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/verisi yok/u);
    });
  });

  it("başarısız cevap istatistiği harcamaz", async () => {
    const { user } = setup({
      submitAnswer: vi.fn().mockRejectedValue(new Error("ağ")),
    });

    await answerStat(user, /Kulüp maçı/u);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(screen.getByText("0/6 cevaplandı")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Kulüp maçı/u })).toBeEnabled();
  });

  /** BR-17 — bir oyuncu yalnızca bir istatistikte kullanılabilir. */
  it("kullanılmış oyuncuyu ikinci istatistikte listelemez", async () => {
    const { user } = setup();

    await answerStat(user, /Kulüp maçı/u);
    await waitFor(() => {
      expect(screen.getByText(/1\/6 cevaplandı/u)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /Kulüp golü/u }));
    await user.type(screen.getByRole("combobox"), "berg");

    await waitFor(() => {
      expect(screen.getByText(/sonuç yok/iu)).toBeInTheDocument();
    });
  });

  /** Günün oyuncusunun kendisi bedava %100 olurdu. */
  it("günün oyuncusunu listede göstermez", async () => {
    const { user } = setup({}, [
      PLAYER,
      { id: "gunun", name: "Éric Cantona", nationality: "FR", position: null },
    ]);

    await user.click(screen.getByRole("button", { name: /Kulüp maçı/u }));
    await user.type(screen.getByRole("combobox"), "berg");

    await waitFor(() => {
      expect(screen.getAllByRole("option")).toHaveLength(1);
    });
    expect(screen.getAllByRole("option")[0]).toHaveTextContent(
      "Dennis Bergkamp",
    );
  });
});

describe("StatMatchGame — ilerlemenin saklanması", () => {
  it("yeniden yüklemede korunur", async () => {
    const { user } = setup();

    await answerStat(user, /Kulüp maçı/u);
    await waitFor(() => {
      expect(screen.getByText(/1\/6 cevaplandı/u)).toBeInTheDocument();
    });

    cleanup();
    setup();

    expect(screen.getByText(/1\/6 cevaplandı/u)).toBeInTheDocument();
  });

  it("gün değişince atılır", async () => {
    const { user } = setup();

    await answerStat(user, /Kulüp maçı/u);
    await waitFor(() => {
      expect(screen.getByText(/1\/6 cevaplandı/u)).toBeInTheDocument();
    });

    cleanup();
    resetStatMatchCache();
    render(
      <StatMatchGame
        daily={{ ...DAILY, date: "2026-08-01" }}
        submitAnswer={vi.fn()}
        searchPlayers={vi.fn().mockResolvedValue([])}
      />,
    );

    expect(screen.getByText("0/6 cevaplandı")).toBeInTheDocument();
  });

  /** Depodan gelen veri dış girdidir; bozuk kayıt oyunu çökertmez (§2.3). */
  it.each([
    ["geçersiz JSON", "{bozuk"],
    ["yanlış şekil", JSON.stringify({ date: 5 })],
    [
      "tanınmayan istatistik anahtarı",
      JSON.stringify({
        date: "2026-07-31",
        answers: {
          kupa: { playerId: "x", playerName: "y", value: 1, score: 1 },
        },
      }),
    ],
    ["dizi", JSON.stringify([])],
  ])("bozuk kayıt (%s) yok sayılır", (_label, raw) => {
    window.localStorage.setItem("futbol-quiz:stat-match", raw);
    resetStatMatchCache();

    setup();

    expect(screen.getByText("0/6 cevaplandı")).toBeInTheDocument();
  });
});

describe("StatMatchGame — tur sonu", () => {
  it("altı cevaptan sonra biter ve ortalamayı gösterir", () => {
    window.localStorage.setItem(
      "futbol-quiz:stat-match",
      JSON.stringify({
        date: DAILY.date,
        answers: Object.fromEntries(
          DAILY.stats.map((stat, i) => [
            stat.key,
            {
              playerId: `p${String(i)}`,
              playerName: `Oyuncu ${String(i)}`,
              value: 100,
              score: i < 3 ? 100 : 0,
            },
          ]),
        ),
      }),
    );
    resetStatMatchCache();

    setup();

    expect(screen.getByRole("status")).toHaveTextContent(/Tur bitti/u);
    expect(screen.getByRole("status")).toHaveTextContent(/%50/u);
  });
});
