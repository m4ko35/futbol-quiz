// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlayerDto } from "@/application/dto/player-dto";
import type { DailyStatMatchDto } from "@/application/use-cases/daily-stat-match";
import { StatMatchGame } from "@/components/stat-match-game";
import { PUZZLE_ROLLOVER_HOUR } from "@/domain/value-objects/daily-seed";
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
    { key: "birthYear", label: "Doğum yılı", value: 1969, scoped: false },
  ],
};

const PLAYER: PlayerDto = {
  id: "p1",
  name: "Dennis Bergkamp",
  nationality: "NL",
  position: "forward",
};

function setup(
  overrides: Partial<Parameters<typeof StatMatchGame>[0]> = {},
  players: readonly PlayerDto[] = [PLAYER],
) {
  const submitAnswer = vi.fn().mockResolvedValue({ value: 180, score: 93 });
  const searchPlayers = vi.fn().mockResolvedValue([...players]);

  render(
    <StatMatchGame
      round={DAILY}
      date={DAILY.date}
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

/** Altı cevabı depoya yazarak turu bitmiş hâle getirir; ortalama %50. */
function finishRoundInStorage(): void {
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

    expect(screen.getAllByText("(yalnızca yirmi dört lig)")).toHaveLength(3);
    // Dipnot kapsamı SÖYLEMELİ. Ülke listesi 12 ligde okunamaz hâle geldiği
    // için lig SAYISINA çevrildi; sınanan şey metnin harfi değil, kullanıcının
    // "bu sayı neyi kapsıyor" sorusunun yanıtlanmış olması (§1.3).
    expect(
      screen.getByText(/yalnızca kapsanan yirmi dört ligdeki/u),
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
        round={DAILY}
        date="2026-08-01"
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
    finishRoundInStorage();
    setup();

    expect(screen.getByRole("status")).toHaveTextContent(/Tur bitti/u);
    expect(screen.getByRole("status")).toHaveTextContent(/%50/u);
  });
});

/**
 * §9.2 — "Sen seç" turu (BR-24).
 *
 * Ayırt edici davranış SAKLANMAMAKTIR: `date` verilmeyince ilerleme depoya
 * yazılmaz. Bu, kullanıcının açtığı sınırsız sayıda turun depoyu şişirmesini
 * ve "hangi tur devam ediyor" belirsizliğini önler.
 */
describe("StatMatchGame — saklanmayan tur", () => {
  function setupChosen(onRestart?: () => void) {
    const submitAnswer = vi.fn().mockResolvedValue({ value: 180, score: 93 });
    const searchPlayers = vi.fn().mockResolvedValue([PLAYER]);

    render(
      <StatMatchGame
        round={DAILY}
        submitAnswer={submitAnswer}
        searchPlayers={searchPlayers}
        {...(onRestart === undefined ? {} : { onRestart })}
      />,
    );

    return { submitAnswer, user: userEvent.setup() };
  }

  it("cevabı gösterir ama depoya YAZMAZ", async () => {
    const { user } = setupChosen();

    await answerStat(user, /Kulüp maçı/u);

    await waitFor(() => {
      expect(screen.getByText("180 · %93")).toBeInTheDocument();
    });
    expect(window.localStorage.getItem("futbol-quiz:stat-match")).toBeNull();
  });

  /** Günlük turun kaydı, yanında oynanan seçmeli turdan ETKİLENMEZ. */
  it("günlük ilerlemeyi bozmaz", async () => {
    window.localStorage.setItem(
      "futbol-quiz:stat-match",
      JSON.stringify({
        date: DAILY.date,
        answers: {
          goals: { playerId: "x", playerName: "Y", value: 10, score: 50 },
        },
      }),
    );
    resetStatMatchCache();

    const { user } = setupChosen();
    await answerStat(user, /Kulüp maçı/u);

    await waitFor(() => {
      expect(screen.getByText("180 · %93")).toBeInTheDocument();
    });
    const stored: unknown = JSON.parse(
      window.localStorage.getItem("futbol-quiz:stat-match") ?? "null",
    );
    expect(stored).toEqual({
      date: DAILY.date,
      answers: {
        goals: { playerId: "x", playerName: "Y", value: 10, score: 50 },
      },
    });
  });

  /**
   * Tur GERÇEKTEN bitirilir. Depo kullanılmadığı için altı cevap önceden
   * kurulamaz; altısı da arayüzden verilir ve düğmenin varlığı öyle sınanır.
   */
  it("tur bitince yeni hedef seçme düğmesi verir", async () => {
    const onRestart = vi.fn();
    const submitAnswer = vi.fn().mockResolvedValue({ value: 180, score: 93 });
    // BR-17 kullanılmış oyuncuyu listeden düşürdüğü için her istatistiğe
    // ayrı bir isim gerekiyor.
    const players = Array.from({ length: 6 }, (_, i) => ({
      id: `berg${String(i)}`,
      name: `Bergkamp ${String(i)}`,
      nationality: "NL",
      position: "forward",
    }));

    render(
      <StatMatchGame
        round={DAILY}
        submitAnswer={submitAnswer}
        searchPlayers={vi.fn().mockResolvedValue(players)}
        onRestart={onRestart}
      />,
    );

    const user = userEvent.setup();
    for (const stat of DAILY.stats) {
      // Etiketler regex'e GÖMÜLMEZ, kaçırılır: "Boy (cm)" içindeki parantez
      // aksi hâlde bir grup olarak okunur ve düğme bulunamaz.
      await answerStat(
        user,
        new RegExp(stat.label.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"),
      );
      await waitFor(() => {
        expect(submitAnswer).toHaveBeenCalledWith(stat.key, expect.any(String));
      });
    }

    const restart = await screen.findByRole("button", {
      name: /Başka oyuncu seç/u,
    });
    await user.click(restart);
    expect(onRestart).toHaveBeenCalled();
  });
});

/**
 * §11.11 — kaydedilme durumu HER ZAMAN ekranda yazılıdır.
 *
 * Bu testler bir kusurdan doğdu: lider tablosu çalışıyordu ama oyun ekranı
 * ondan hiç söz etmiyordu, yani kullanıcı giriş yapmadan oynuyor ve turunun
 * hiçbir yere yazılmadığını öğrenemiyordu. Her katman ayrı ayrı sınanmıştı;
 * hiçbir test "kullanıcı bu özelliğin varlığını nereden öğrenecek" diye
 * sormamıştı.
 */
describe("StatMatchGame — kayıt şeridi (§11.11)", () => {
  it("durum verilmezse HİÇBİR ŞEY yazmaz", () => {
    setup();

    expect(screen.queryByText(/kaydedilmiyor/u)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Giriş yap/u }),
    ).not.toBeInTheDocument();
  });

  it("misafire turun kaydedilmediğini söyler ve girişe bağlar", () => {
    setup({ recording: { kind: "misafir" } });

    expect(screen.getByText(/kaydedilmiyor/u)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Giriş yap" })).toHaveAttribute(
      "href",
      "/giris",
    );
  });

  /**
   * DAVET TURUN BAŞINDA VERİLİR, sonunda değil: bitmiş bir misafir turu giriş
   * yapılınca sunucuya taşınmıyor, yani sonunda davet etmek kullanıcıya
   * kaçırdığı şeyi haber vermek olurdu.
   */
  it("davet tur BAŞLAMADAN önce görünür", () => {
    setup({ recording: { kind: "misafir" } });

    expect(screen.queryByText(/Tur bitti/u)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Giriş yap" })).toBeVisible();
  });

  it("girişli kullanıcıya hangi adla oynadığını söyler", () => {
    setup({ recording: { kind: "kayitli", displayName: "mako" } });

    expect(screen.getByText("mako")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "lider tablosuna" }),
    ).toHaveAttribute("href", "/lider-tablosu");
  });

  it("girişli kullanıcıya tur bitince tabloya bağlantı verir", () => {
    finishRoundInStorage();
    setup({ recording: { kind: "kayitli", displayName: "mako" } });

    expect(
      screen.getByRole("link", { name: "Lider tablosunu gör" }),
    ).toHaveAttribute("href", "/lider-tablosu");
  });

  it("misafire tur bitince tablo bağlantısı VERMEZ", () => {
    finishRoundInStorage();
    setup({ recording: { kind: "misafir" } });

    expect(
      screen.queryByRole("link", { name: "Lider tablosunu gör" }),
    ).not.toBeInTheDocument();
  });
});

/**
 * §11.11 — yayın saati arayüzde ELLE YAZILMAZ.
 *
 * Ekran aylarca "03.00" dedi: sınır 06:00'ya taşınmıştı (BR-49) ama metin
 * geride kalmıştı ve hiçbir test metni saatle karşılaştırmıyordu. Bu test o
 * boşluğu kapatıyor — sabit değişirse metin onunla birlikte değişmeli.
 */
describe("StatMatchGame — yayın saati (BR-49)", () => {
  it("tur sonundaki saat, gün sınırı sabitinden türer", () => {
    finishRoundInStorage();
    setup();

    const expected = `${String(PUZZLE_ROLLOVER_HOUR).padStart(2, "0")}.00`;
    expect(screen.getByRole("status")).toHaveTextContent(expected);
  });
});
