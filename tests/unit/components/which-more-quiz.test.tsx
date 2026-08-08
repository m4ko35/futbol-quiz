// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UserEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  WhichMoreAnswerDto,
  WhichMoreRoundDto,
} from "@/application/use-cases/which-more";
import { WhichMoreQuiz } from "@/components/which-more-quiz";

/**
 * §9.3 — "Hangisi daha" arayüzü.
 *
 * BURADA DENETLENEN ŞEY OYUNUN DOĞRULUĞU DEĞİL, arayüzün sözleşmeyi doğru
 * kullanıp kullanmadığı: değerler cevaptan önce gösteriliyor mu (BR-32),
 * kazanan bir sonraki tura taşınıyor mu (BR-28), görülenler dışlanıyor mu.
 * Hangi cevabın doğru olduğuna sunucu karar verir ve burada sahtelenir.
 */

afterEach(cleanup);

const PAIR = {
  left: { id: "sol", name: "Drogba", clubs: ["Chelsea"] },
  right: { id: "sag", name: "Henry", clubs: ["Arsenal"] },
};

function setup(options?: {
  round?: WhichMoreRoundDto;
  answer?: WhichMoreAnswerDto;
}) {
  const fetchRound = vi.fn<(body: unknown) => Promise<WhichMoreRoundDto>>(() =>
    Promise.resolve(options?.round ?? { statKey: "appearances", pair: PAIR }),
  );
  const fetchAnswer = vi.fn<(body: unknown) => Promise<WhichMoreAnswerDto>>(
    () =>
      Promise.resolve(
        options?.answer ?? {
          correct: true,
          left: { id: "sol", value: 164 },
          right: { id: "sag", value: 175 },
          winnerId: "sag",
          scoped: true,
        },
      ),
  );

  render(<WhichMoreQuiz fetchRound={fetchRound} fetchAnswer={fetchAnswer} />);
  return { fetchRound, fetchAnswer, user: userEvent.setup() };
}

async function start(user: UserEvent): Promise<void> {
  await user.click(screen.getByRole("button", { name: "Başla" }));
  await screen.findByRole("button", { name: /Drogba/u });
}

describe("kurulum ekranı", () => {
  it("altı istatistiği de sunar", () => {
    setup();

    for (const name of [
      "Kulüp maçı",
      "Kulüp golü",
      "Oynadığı kulüp",
      "A millî maç",
      "Boy",
      "Kilo",
    ]) {
      expect(screen.getByRole("radio", { name })).toBeInTheDocument();
    }
  });

  it("yön etiketleri SEÇİLEN istatistiğe göre değişir", async () => {
    const { user } = setup();

    // Türkçede "daha az uzun" diye bir şey yok; karşıtı "daha kısa".
    expect(
      screen.getByRole("radio", { name: "daha çok kulüp maçı yaptı" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Boy" }));

    expect(
      screen.getByRole("radio", { name: "daha uzun" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: "daha kısa" }),
    ).toBeInTheDocument();
  });
});

describe("BR-32 — değerler cevaptan önce görünmez", () => {
  it("soru sorulurken hiçbir sayı yok", async () => {
    const { user } = setup();
    await start(user);

    expect(
      screen.getByRole("button", { name: /Drogba/u }),
    ).not.toHaveTextContent("164");
    expect(
      screen.getByRole("button", { name: /Henry/u }),
    ).not.toHaveTextContent("175");
    expect(screen.getAllByLabelText("değer gizli")).toHaveLength(2);
  });

  it("cevaptan SONRA iki değer de açılır", async () => {
    const { user } = setup();
    await start(user);

    await user.click(screen.getByRole("button", { name: /Drogba/u }));

    expect(await screen.findByText(/164 maç/u)).toBeInTheDocument();
    expect(screen.getByText(/175 maç/u)).toBeInTheDocument();
  });
});

describe("BR-28 — zincir", () => {
  it("doğru cevapta seri artar ve KAZANAN bir sonraki tura geçer", async () => {
    const { user, fetchRound } = setup();
    await start(user);

    await user.click(screen.getByRole("button", { name: /Henry/u }));
    await user.click(await screen.findByRole("button", { name: "Devam" }));

    await waitFor(() => {
      expect(fetchRound).toHaveBeenCalledTimes(2);
    });

    const body = fetchRound.mock.calls[1]?.[0] as { stayingId?: string };
    expect(body.stayingId).toBe("sag");
    expect(screen.getByText(/Seri:/u)).toHaveTextContent("1");
  });

  it("görülen oyuncular dışlama listesine yazılır", async () => {
    const { user, fetchRound } = setup();
    await start(user);

    await user.click(screen.getByRole("button", { name: /Henry/u }));
    await user.click(await screen.findByRole("button", { name: "Devam" }));

    await waitFor(() => {
      expect(fetchRound).toHaveBeenCalledTimes(2);
    });

    const body = fetchRound.mock.calls[1]?.[0] as { exclude?: string[] };
    expect(body.exclude).toEqual(["sol", "sag"]);
  });

  it("yanlış cevapta koşu biter ve skor gösterilir", async () => {
    const { user } = setup({
      answer: {
        correct: false,
        left: { id: "sol", value: 164 },
        right: { id: "sag", value: 175 },
        winnerId: "sag",
        scoped: true,
      },
    });
    await start(user);

    await user.click(screen.getByRole("button", { name: /Drogba/u }));

    expect(await screen.findByText("Yanlış")).toBeInTheDocument();
    expect(screen.getByText(/Skorun:/u)).toHaveTextContent("0");
    expect(
      screen.queryByRole("button", { name: "Devam" }),
    ).not.toBeInTheDocument();
  });
});

describe("koşunun diğer sonları", () => {
  it("havuz tükenince hata değil, koşu sonu gösterilir", async () => {
    const { user } = setup({ round: { statKey: "appearances", pair: null } });

    await user.click(screen.getByRole("button", { name: "Başla" }));

    expect(await screen.findByText("Havuz tükendi")).toBeInTheDocument();
    expect(screen.getByText(/Skorun:/u)).toBeInTheDocument();
  });

  it("sunucu hatası kullanıcıya söylenir", async () => {
    const fetchRound = vi.fn<(body: unknown) => Promise<WhichMoreRoundDto>>(
      () => Promise.reject(new Error("Sunucuya ulaşılamadı.")),
    );
    render(
      <WhichMoreQuiz
        fetchRound={fetchRound}
        fetchAnswer={vi.fn<(body: unknown) => Promise<WhichMoreAnswerDto>>()}
      />,
    );

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Başla" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Sunucuya ulaşılamadı.",
    );
  });
});

describe("kapsam bildirimi", () => {
  it("maç/gol/kulüp sorularında 24 lig uyarısı görünür", async () => {
    const { user } = setup();
    await start(user);

    expect(
      screen.getByText(/yalnızca kapsamdaki 24 ligi/u),
    ).toBeInTheDocument();
  });

  it("boy sorusunda kapsam uyarısı YOKTUR", async () => {
    const { user } = setup({
      round: { statKey: "heightCm", pair: PAIR },
    });

    await user.click(screen.getByRole("radio", { name: "Boy" }));
    await start(user);

    // Boy ve kilo oyuncunun kendi kaydından gelir; lig kapsamıyla ilgisi yok.
    expect(
      screen.queryByText(/yalnızca kapsamdaki 24 ligi/u),
    ).not.toBeInTheDocument();
  });
});
