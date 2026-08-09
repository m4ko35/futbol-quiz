// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClubDto } from "@/application/dto/club-dto";
import { CommonPlayersQuiz } from "@/components/common-players-quiz";

/**
 * Ekranın durum akışı: boşta → yükleniyor → sonuç / hata.
 *
 * `fetch` sahteleniyor; gerçek uçlar sözleşme testlerinde ayrıca denetleniyor
 * (`tests/integration/api-routes.test.ts`). Buradaki soru "arayüz yanıtlara
 * doğru tepki veriyor mu".
 */

const CLUBS: ClubDto[] = [
  {
    id: "a",
    name: "Galatasaray SK",
    shortName: "Galatasaray",
    country: "TR",
    crestUrl: null,
  },
  {
    id: "b",
    name: "Arsenal F.C.",
    shortName: "Arsenal",
    country: "GB",
    crestUrl: null,
  },
];

const SUCCESS_BODY = {
  data: {
    clubA: CLUBS[0],
    clubB: CLUBS[1],
    count: 1,
    degenerate: null,
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
            isCurrent: false,
            isLoan: false,
            appearances: 64,
            goals: 3,
          },
        ],
        spellsAtB: [
          {
            startYear: 2005,
            endYear: 2011,
            isCurrent: false,
            isLoan: false,
            appearances: 214,
            goals: 9,
          },
        ],
      },
    ],
  },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith("/api/clubs")) {
      return Promise.resolve(jsonResponse({ data: CLUBS }));
    }
    return Promise.resolve(jsonResponse(SUCCESS_BODY));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** İki kulübü de seçer; sonuç isteğini tetikler. */
async function selectBothClubs(user: ReturnType<typeof userEvent.setup>) {
  const [first, second] = screen.getAllByRole("combobox");

  await user.click(first as HTMLElement);
  await user.keyboard("{Enter}");

  await user.click(second as HTMLElement);
  await user.keyboard("{ArrowDown}{Enter}");
}

describe("CommonPlayersQuiz", () => {
  it("başlangıçta iki kulüp seçilmesini ister", () => {
    render(<CommonPlayersQuiz initialClubs={CLUBS} />);

    expect(screen.getByText(/iki kulüp seçin/iu)).toBeInTheDocument();
    expect(screen.getAllByRole("combobox")).toHaveLength(2);
  });

  it("tek kulüp seçiliyken istek ATMAZ", async () => {
    const user = userEvent.setup();
    render(<CommonPlayersQuiz initialClubs={CLUBS} />);

    await user.click(screen.getAllByRole("combobox")[0] as HTMLElement);
    await user.keyboard("{Enter}");

    const calls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(calls.some((url) => url.includes("common-players"))).toBe(false);
  });

  it("iki kulüp seçilince sonucu getirir ve gösterir", async () => {
    const user = userEvent.setup();
    render(<CommonPlayersQuiz initialClubs={CLUBS} />);

    await selectBothClubs(user);

    expect(await screen.findByText("Emmanuel Eboué")).toBeInTheDocument();
    expect(screen.getByText(/1 ortak oyuncu/u)).toBeInTheDocument();
  });

  it("istek sırasında yükleniyor durumunu bildirir", async () => {
    // Yanıtı elimizde tutup ara durumu gözlemliyoruz.
    let release: (value: Response) => void = () => undefined;
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/clubs")) {
        return Promise.resolve(jsonResponse({ data: CLUBS }));
      }
      return new Promise<Response>((resolve) => {
        release = resolve;
      });
    });

    const user = userEvent.setup();
    render(<CommonPlayersQuiz initialClubs={CLUBS} />);
    await selectBothClubs(user);

    const live = await screen.findByText(/aranıyor/iu);
    expect(live).toBeInTheDocument();
    expect(live.closest("[aria-live]")).toHaveAttribute("aria-busy", "true");

    release(jsonResponse(SUCCESS_BODY));
    expect(await screen.findByText("Emmanuel Eboué")).toBeInTheDocument();
  });

  it("API hata mesajını kullanıcıya gösterir", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/clubs")) {
        return Promise.resolve(jsonResponse({ data: CLUBS }));
      }
      return Promise.resolve(
        jsonResponse(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "İki farklı kulüp seçilmelidir.",
              traceId: "T1",
            },
          },
          400,
        ),
      );
    });

    const user = userEvent.setup();
    render(<CommonPlayersQuiz initialClubs={CLUBS} />);
    await selectBothClubs(user);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("İki farklı kulüp seçilmelidir.");
  });

  it("ağ hatasında çökmez, anlaşılır mesaj verir", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/clubs")) {
        return Promise.resolve(jsonResponse({ data: CLUBS }));
      }
      return Promise.reject(new TypeError("Failed to fetch"));
    });

    const user = userEvent.setup();
    render(<CommonPlayersQuiz initialClubs={CLUBS} />);
    await selectBothClubs(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /sunucuya ulaşılamadı/iu,
    );
  });

  it("JSON olmayan hata gövdesinde de mesaj gösterir", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/clubs")) {
        return Promise.resolve(jsonResponse({ data: CLUBS }));
      }
      return Promise.resolve(new Response("<html>502</html>", { status: 502 }));
    });

    const user = userEvent.setup();
    render(<CommonPlayersQuiz initialClubs={CLUBS} />);
    await selectBothClubs(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /sonuçlar alınamadı/iu,
    );
  });

  it("kulüp değişince eski sonucu göstermeye devam ETMEZ", async () => {
    const user = userEvent.setup();
    render(<CommonPlayersQuiz initialClubs={CLUBS} />);
    await selectBothClubs(user);
    await screen.findByText("Emmanuel Eboué");

    // İkinci kulübü kaldır: sonuç artık geçerli değil.
    const [, secondChange] = screen.getAllByRole("button", {
      name: "Değiştir",
    });
    await user.click(secondChange as HTMLElement);

    await waitFor(() => {
      expect(screen.queryByText("Emmanuel Eboué")).not.toBeInTheDocument();
    });
    expect(screen.getByText(/iki kulüp seçin/iu)).toBeInTheDocument();
  });

  it("seçilen kulüp diğer listede görünmez (BR-4'e düşmeyi önler)", async () => {
    const user = userEvent.setup();
    render(<CommonPlayersQuiz initialClubs={CLUBS} />);

    await user.click(screen.getAllByRole("combobox")[0] as HTMLElement);
    await user.keyboard("{Enter}"); // Galatasaray seçildi

    // Geriye tek combobox kalır; onu açtığımızda Galatasaray listelenmemeli.
    const remaining = screen.getByRole("combobox");
    await user.click(remaining);

    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options.some((text) => text?.includes("Galatasaray"))).toBe(false);
  });
});
