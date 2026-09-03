// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { FeedbackWidget } from "@/components/feedback-widget";

/**
 * Öneri/şikayet formu — §7.4.
 *
 * jsdom `<dialog>`'un `showModal`/`close`'unu tam uygulamaz; deterministik
 * olması için taklit ediliyor (yalnız `open` bayrağı + `close` olayı).
 */
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close() {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
});

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) =>
    Promise.resolve(new Response(JSON.stringify({ data: { sent: true } }))),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function openForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /geri bildirim/iu }));
}

describe("FeedbackWidget", () => {
  it("geçerli formu sunucuya POST eder ve teşekkür gösterir", async () => {
    const user = userEvent.setup();
    render(<FeedbackWidget />);
    await openForm(user);

    await user.type(screen.getByLabelText(/e-posta/iu), "sen@ornek.test");
    await user.type(
      screen.getByLabelText(/mesaj/iu),
      "Sitede bir oyuncu eksik gibi.",
    );
    await user.click(screen.getByRole("button", { name: /gönder/iu }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/geri-bildirim");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      email: "sen@ornek.test",
      message: "Sitede bir oyuncu eksik gibi.",
    });

    expect(await screen.findByText(/teşekkürler/iu)).toBeInTheDocument();
  });

  it("kısa mesajda istek ATMAZ ve hata gösterir", async () => {
    const user = userEvent.setup();
    render(<FeedbackWidget />);
    await openForm(user);

    await user.type(screen.getByLabelText(/e-posta/iu), "sen@ornek.test");
    await user.type(screen.getByLabelText(/mesaj/iu), "kısa");
    await user.click(screen.getByRole("button", { name: /gönder/iu }));

    expect(await screen.findByText(/en az 10 karakter/iu)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("geçersiz e-postada istek ATMAZ", async () => {
    const user = userEvent.setup();
    render(<FeedbackWidget />);
    await openForm(user);

    await user.type(screen.getByLabelText(/e-posta/iu), "eposta-degil");
    await user.type(
      screen.getByLabelText(/mesaj/iu),
      "On karakterden uzun bir mesaj.",
    );
    await user.click(screen.getByRole("button", { name: /gönder/iu }));

    expect(
      await screen.findByText(/geçerli bir e-posta/iu),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("hız sınırında (429) 'çok fazla' mesajı gösterir", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: {} }), { status: 429 }),
    );
    const user = userEvent.setup();
    render(<FeedbackWidget />);
    await openForm(user);

    await user.type(screen.getByLabelText(/e-posta/iu), "sen@ornek.test");
    await user.type(
      screen.getByLabelText(/mesaj/iu),
      "On karakterden uzun bir mesaj.",
    );
    await user.click(screen.getByRole("button", { name: /gönder/iu }));

    expect(await screen.findByText(/çok fazla/iu)).toBeInTheDocument();
  });
});
