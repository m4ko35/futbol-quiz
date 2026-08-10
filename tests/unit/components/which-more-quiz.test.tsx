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
import { shareOf, WhichMoreQuiz } from "@/components/which-more-quiz";

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

    // Sayı ile birim ayrı düğümlerde (birim küçük puntoda, §9.3'ün düello
    // sahnesi); iddia bu yüzden kartın tamamının metnine bakıyor. Zaten
    // sorulan şey de bu: KART değeri gösteriyor mu?
    const sol = await screen.findByRole("button", { name: /Drogba/u });
    expect(sol).toHaveTextContent("164 maç");
    expect(screen.getByRole("button", { name: /Henry/u })).toHaveTextContent(
      "175 maç",
    );
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
    // Seri sayacı künye tabelasına taşındı (§7.15): etiket ve değer ayrı
    // düğümlerde, o yüzden tabelanın tamamına bakılıyor.
    expect(
      screen.getByRole("group", { name: "Koşu durumu" }),
    ).toHaveTextContent("Seri1");
  });

  /**
   * SEÇİM AÇIKÇA YAZILI — çıkarsamaya bırakılmıyor.
   *
   * Değerler açıldığında iki panelde de bir sayı duruyordu ve kullanıcı hangi
   * panele tıkladığını yalnızca RENKTEN çıkarsamak zorundaydı. O çıkarsama
   * renk ayırt edemeyen kullanıcıda hiç kurulmuyor (WCAG 1.4.1) ve doğru
   * cevapta zaten kurulmuyordu: orada hiçbir panel "yanlış" değil.
   */
  it("yanlış cevapta hangi paneli seçtiğini SÖYLER", async () => {
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

    const chosen = await screen.findByRole("button", { name: /Drogba/u });
    expect(chosen).toHaveTextContent("senin seçimin");
    expect(
      screen.getByRole("button", { name: /Henry/u }),
    ).not.toHaveTextContent("senin seçimin");
  });

  it("doğru cevapta kimin KALDIĞINI ve kimin elendiğini söyler", async () => {
    // Zincirin kuralı bugün yalnızca yardım metnindeydi; olduğu anda
    // gösterilmiyordu.
    const { user } = setup();
    await start(user);

    await user.click(screen.getByRole("button", { name: /Henry/u }));

    const winner = await screen.findByRole("button", { name: /Henry/u });
    expect(winner).toHaveTextContent("kalıyor");
    expect(screen.getByRole("button", { name: /Drogba/u })).toHaveTextContent(
      "eleniyor",
    );
  });

  it("YANLIŞ cevapta 'kalıyor' DEMEZ — koşu bitti, kimse kalmıyor", async () => {
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

    await screen.findByText("Yanlış");
    expect(screen.queryByText("kalıyor")).not.toBeInTheDocument();
    expect(screen.queryByText("eleniyor")).not.toBeInTheDocument();
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

/**
 * §9.3 — düello sahnesi.
 *
 * Buradaki testler GÖRÜNÜMÜ değil, görünümün taşıdığı BİLGİYİ tutuyor: hangi
 * kartın zincirde kaldığı, serinin ölçülmüş bandı, sonucun renkten bağımsız
 * okunabilmesi. Animasyonun kendisi (gecikme, süre, eğri) bir tasarım kararı
 * ve testin işi değil — jsdom'da zaten çalışmaz.
 */
describe("düello sahnesi", () => {
  /** Turu bitirip bir sonraki soruya geçer; iki değer de yeniden kapanır. */
  async function nextRound(user: UserEvent): Promise<void> {
    await user.click(await screen.findByRole("button", { name: "Devam" }));
    await waitFor(() => {
      expect(screen.getAllByLabelText("değer gizli")).toHaveLength(2);
    });
  }

  it("sonuç RENKTEN bağımsız da okunuyor", async () => {
    // İşaret (✓) renge EK bir göstergedir, yerine geçen değil (WCAG 1.4.1);
    // sözcüğün kendisi her koşulda ekranda olmalı.
    const { user } = setup();
    await start(user);

    await user.click(screen.getByRole("button", { name: /Henry/u }));

    expect(await screen.findByText("Doğru!")).toBeInTheDocument();
  });

  it("zincirde KALAN kart işaretlenir, rakibi 'yeni' olur", async () => {
    const { user } = setup();
    await start(user);

    // İlk turda zincir yok: iki oyuncu da havuzdan yeni geldi.
    expect(screen.queryByText("kalan")).not.toBeInTheDocument();
    expect(screen.queryByText("yeni")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Henry/u }));
    await nextRound(user);

    expect(screen.getByRole("button", { name: /Henry/u })).toHaveTextContent(
      "kalan",
    );
    expect(screen.getByRole("button", { name: /Drogba/u })).toHaveTextContent(
      "yeni",
    );
  });

  /**
   * Bandın eşiği ÖLÇÜMDEN geliyor: §9.3'ün BR-30 tablosunda dengeli rakiple
   * bilgisiz oynayan koşunun p90'ı 3. Dolayısıyla 4. doğru "on koşuda bir"
   * görülen yerdir. Ölçüm değişirse bu test de değişmek zorunda — uydurulmuş
   * bir eşik burada sessizce kalıcı olurdu.
   */
  it("seri bandı ancak DÖRDÜNCÜ doğruda çıkar", async () => {
    const { user } = setup();
    await start(user);

    for (let round = 0; round < 3; round += 1) {
      await user.click(screen.getByRole("button", { name: /Henry/u }));
      expect(screen.queryByText(/on koşuda bir/u)).not.toBeInTheDocument();
      await nextRound(user);
    }

    await user.click(screen.getByRole("button", { name: /Henry/u }));

    expect(await screen.findByText(/on koşuda bir/u)).toBeInTheDocument();
  });
});

/**
 * Karşılaştırma çubuğunun oranı.
 *
 * Çubuk `aria-hidden` olduğu için DOM'dan okunamaz; hesabın kendisi burada
 * doğrulanıyor. Asıl korunan şey ÖLÇEĞİN PAYLAŞILMASI: her kart kendi
 * ölçeğine göre çizilseydi iki çubuk da dolu görünür ve aradaki açıklık —
 * çubuğun var olma sebebi — kaybolurdu.
 */
describe("shareOf", () => {
  const answer = (
    leftValue: number,
    rightValue: number,
  ): WhichMoreAnswerDto => ({
    correct: true,
    left: { id: "sol", value: leftValue },
    right: { id: "sag", value: rightValue },
    winnerId: "sag",
    scoped: true,
  });

  it("büyük değer tam dolu, küçüğü ona ORANLA çiziliyor", () => {
    const a = answer(164, 175);

    expect(shareOf(a, "sag")).toBe(1);
    expect(shareOf(a, "sol")).toBeCloseTo(164 / 175, 3);
  });

  it("iki değer de sıfırken bölme yapılmıyor", () => {
    // Kulüp golünde ölçülen en küçük değer 0; iki oyuncu da golsüz olabilir.
    const a = answer(0, 0);

    expect(shareOf(a, "sol")).toBe(0);
    expect(shareOf(a, "sag")).toBe(0);
  });

  it("oran yuvarlanıyor — kayan nokta artığı style'a yazılmıyor", () => {
    // Yuvarlanmasaydı DOM'da `0.5714285714285714` gibi bir dize dururdu.
    const value = shareOf(answer(4, 7), "sol");

    expect(String(value).length).toBeLessThanOrEqual(6);
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
