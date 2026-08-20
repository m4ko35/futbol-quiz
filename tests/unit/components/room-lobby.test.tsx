// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RoomLobby } from "@/components/room-lobby";
import { rememberInvite, resetInviteCache } from "@/lib/room-invite";

/**
 * Oda lobisi — PROJECT.md §12.
 *
 * BURADA ÖLÇÜLEN ŞEY, KULLANICI GİRDİSİNİN ALAN KURALIYLA BULUŞTUĞU YER:
 * yazılan kod nasıl ayıklanıyor, geçersiz kod nasıl durduruluyor, bekleyen
 * davet nasıl sunuluyor. Sunucunun kendi doğrulaması ayrı sınanıyor
 * (`rooms.test.ts`); bu ekran onun önündeki ilk süzgeç.
 */

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}));

afterEach(cleanup);

beforeEach(() => {
  push.mockClear();
  resetInviteCache();
  sessionStorage.clear();
  vi.restoreAllMocks();
});

/** `ok` yanıtı veren sahte uç. */
function stubFetch(code = "BKJ7TZ") {
  const fetchMock = vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ data: { code } }),
    } as Response),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("kod alanı", () => {
  /**
   * KULLANICI "bkj-7tz" YAZAR. Ayıklama kuralı alan katmanından geliyor
   * (`normalizeRoomCode`) ve alanda GÖRÜNÜR olması bilinçli: gönderilecek şey
   * ile ekranda duran şey aynı olmalı.
   */
  it("yazılanı büyük harfe çevirir, tire ve boşluğu atar", async () => {
    const user = userEvent.setup();
    render(<RoomLobby />);

    const alan = screen.getByLabelText(/Arkadaşının verdiği kod/u);
    await user.type(alan, "bkj-7tz");

    expect(alan).toHaveValue("BKJ7TZ");
  });

  it("kod tamamlanmadan Katıl düğmesi kapalıdır", async () => {
    const user = userEvent.setup();
    render(<RoomLobby />);

    const katil = screen.getByRole("button", { name: "Katıl" });
    expect(katil).toBeDisabled();

    await user.type(screen.getByLabelText(/Arkadaşının verdiği kod/u), "BKJ");
    expect(katil).toBeDisabled();
  });

  /**
   * ALFABEDE SESLİ HARF YOK (BR-55). Altı işaret yazılmış ama alfabe dışı bir
   * harf içeriyorsa düğme açılmamalı ve kullanıcı NEDEN olduğunu görmeli —
   * yoksa alanı doğru doldurduğunu sanıp arıza arar.
   */
  it("alfabe dışı harf içeren altı işaretlik kodu reddeder ve sebebini yazar", async () => {
    const user = userEvent.setup();
    render(<RoomLobby />);

    await user.type(
      screen.getByLabelText(/Arkadaşının verdiği kod/u),
      "BAKJ7Z",
    );

    expect(screen.getByRole("button", { name: "Katıl" })).toBeDisabled();
    expect(screen.getByText(/sesli harf/u)).toBeInTheDocument();
    expect(screen.getByLabelText(/Arkadaşının verdiği kod/u)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("geçerli kodla katılma isteğini gönderir ve odaya gider", async () => {
    const user = userEvent.setup();
    const fetchMock = stubFetch();
    render(<RoomLobby />);

    await user.type(
      screen.getByLabelText(/Arkadaşının verdiği kod/u),
      "BKJ7TZ",
    );
    await user.click(screen.getByRole("button", { name: "Katıl" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/oda/BKJ7TZ/katil", {
        method: "POST",
      });
    });
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/oda/BKJ7TZ");
    });
  });

  it("sunucunun ret gerekçesini OLDUĞU GİBİ gösterir", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: { message: "Bu oda dolu." } }),
        } as Response),
      ),
    );
    render(<RoomLobby />);

    await user.type(
      screen.getByLabelText(/Arkadaşının verdiği kod/u),
      "BKJ7TZ",
    );
    await user.click(screen.getByRole("button", { name: "Katıl" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Bu oda dolu.");
  });
});

describe("bekleyen davet", () => {
  /**
   * BAĞLANTIYLA GELİP GİRİŞ YAPAN KULLANICI BURAYA DÜŞÜYOR. Google akışı onu
   * `/istatistik`'e bırakıyor ve kod adres çubuğundan kayboluyor; alan hazır
   * dolu gelmezse kullanıcı kodu geçmişte aramak zorunda kalır.
   */
  it("davet varsa alanı doldurur ve bunu söyler", () => {
    rememberInvite("BKJ7TZ");
    render(<RoomLobby />);

    expect(screen.getByLabelText(/Arkadaşının verdiği kod/u)).toHaveValue(
      "BKJ7TZ",
    );
    expect(screen.getByText(/kodu hazır/u)).toBeInTheDocument();
  });

  /** KENDİLİĞİNDEN KATILMAZ: koltuğa oturmak açık bir eylem ister (BR-54). */
  it("kendiliğinden katılmaz — istek atılmaz", () => {
    const fetchMock = stubFetch();
    rememberInvite("BKJ7TZ");
    render(<RoomLobby />);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  /**
   * ALANI TEMİZLEYEN KULLANICIYA DAVET GERİ YAZILMAZ. "Yazılmadı" ile "yazılıp
   * silindi" ayrı durumlar; ayrım olmasaydı silme eylemi geri alınırdı.
   */
  it("kullanıcı alanı temizlerse davet geri gelmez", async () => {
    const user = userEvent.setup();
    rememberInvite("BKJ7TZ");
    render(<RoomLobby />);

    const alan = screen.getByLabelText(/Arkadaşının verdiği kod/u);
    await user.clear(alan);

    expect(alan).toHaveValue("");
    expect(screen.queryByText(/kodu hazır/u)).not.toBeInTheDocument();
  });
});
