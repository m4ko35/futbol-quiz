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
import { MIN_GAP } from "@/domain/services/which-more";

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
      /Kulüp maçı/u,
      /Kulüp golü/u,
      /Oynadığı kulüp/u,
      /A millî maç/u,
      /Boy/u,
      /Doğum yılı/u,
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

    await user.click(screen.getByRole("radio", { name: /Boy/u }));

    expect(
      screen.getByRole("radio", { name: "daha uzun" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: "daha kısa" }),
    ).toBeInTheDocument();
  });

  /**
   * BR-29'un bandı seçim ANINDA okunabilmeli.
   *
   * Oyunun zorluğunu ayarlayan tek sayı budur ve arayüzün hiçbir yerinde
   * görünmüyordu: kullanıcı "kulüp sayısı" ile "kulüp maçı"nın neden bambaşka
   * zorlukta olduğunu bilemiyordu. Sayı `MIN_GAP`'ten okunuyor — testin içine
   * kopyalansaydı kural değiştiğinde arayüz sessizce yanlış söylerdi.
   *
   * ADIN TAMAMI DEĞİL PARÇASI aranıyor. Erişilebilir ad, kardeş düğümlerin
   * metinlerini birleştirerek kurulur ve aradaki boşluk YERLEŞİMDEN türetilir
   * (blok kutular boşlukla ayrılır, satır içi olanlar ayrılmaz). jsdom'un
   * yerleşim motoru olmadığı için burada ad "Kulüp maçıen az …" diye
   * birleşiyor; tarayıcıda boşlukla. Bu bir işaretleme kusuru değil, ortam
   * kısıtı — testin iddiası bu yüzden bandın adın İÇİNDE geçmesi.
   */
  it("her istatistik BR-29 bandını erişilebilir adında taşır", () => {
    setup();

    expect(
      screen.getByRole("radio", { name: /Kulüp maçı/u }),
    ).toHaveAccessibleName(
      new RegExp(`en az ${String(MIN_GAP.appearances)} maç fark`, "u"),
    );
    expect(
      screen.getByRole("radio", { name: /Oynadığı kulüp/u }),
    ).toHaveAccessibleName(
      new RegExp(`en az ${String(MIN_GAP.clubs)} kulüp fark`, "u"),
    );
  });

  it("sorulacak soru seçimlerle birlikte kurulur", async () => {
    // Kurulumun çıktısı bir CÜMLEDİR ve o cümle hiçbir yerde bir bütün olarak
    // görünmüyordu; kullanıcı ne soracağını ancak oyun başladıktan sonra
    // okuyordu.
    const { user } = setup();

    expect(
      screen.getByText("Hangisi daha çok kulüp maçı yaptı?"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: /Boy/u }));
    await user.click(screen.getByRole("radio", { name: "daha kısa" }));

    expect(screen.getByText("Hangisi daha kısa?")).toBeInTheDocument();
  });

  /**
   * WCAG 2.5.3 (Label in Name): erişilebilir ad GÖRÜNEN metni içermeli.
   * Yön düğmesinde görünen metin kısaldı (cümlenin tamamı önizlemede duruyor)
   * ama ad tam cümle kaldı; sesle komut veren kullanıcı gördüğü sözcüğü söyler.
   */
  it("yön düğmesinde görünen metin, erişilebilir adın İÇİNDE geçer", () => {
    setup();

    for (const name of [
      "daha çok kulüp maçı yaptı",
      "daha az kulüp maçı yaptı",
    ]) {
      const label = screen.getByRole("radio", { name }).closest("label");
      const visible = label?.querySelector('[aria-hidden="true"]');

      expect(visible?.textContent).toBeTruthy();
      expect(name).toContain(visible?.textContent ?? "");
    }
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

/**
 * BR-41 — seviye.
 *
 * Arayüz tarafında denetlenen üç şey var: seçim SUNULUYOR mu, VARSAYILANI
 * doğru mu, ve gövdeye KOŞU BOYUNCA taşınıyor mu. Üçüncüsü en kolay kaçandır:
 * sunucu koşuyu hatırlamadığı için seviyeyi her turda istemci söylemek
 * zorunda ve ilk turda çalışıp ikinci turda düşen bir kod sessizce havuzu
 * genişletirdi.
 */
describe("BR-41 — seviye seçimi", () => {
  it("iki seviyeyi sunar ve KOLAY olan seçilidir", () => {
    setup();

    expect(screen.getByRole("radio", { name: /^Kolay/u })).toBeChecked();
    expect(screen.getByRole("radio", { name: /^Zor/u })).not.toBeChecked();
  });

  it("seçim ölçütü YAZILI — 'Kolay' tek başına neyin kolay olduğunu söylemez", () => {
    setup();

    // Erişilebilir adın PARÇASI: gizlenseydi ekran okuyucu kullanıcısı iki
    // seçenek arasındaki farkı hiç öğrenemezdi.
    expect(
      screen.getByRole("radio", { name: /A millî takımda 20/u }),
    ).toBeInTheDocument();
  });

  it("varsayılan gövdede 'easy' gider", async () => {
    const { user, fetchRound } = setup();
    await start(user);

    const body = fetchRound.mock.calls[0]?.[0] as { level?: string };
    expect(body.level).toBe("easy");
  });

  it("'Zor' seçilince gövdede 'hard' gider", async () => {
    const { user, fetchRound } = setup();

    await user.click(screen.getByRole("radio", { name: /^Zor/u }));
    await start(user);

    const body = fetchRound.mock.calls[0]?.[0] as { level?: string };
    expect(body.level).toBe("hard");
  });

  it("seviye SONRAKİ turlara da taşınır", async () => {
    const { user, fetchRound } = setup();

    await user.click(screen.getByRole("radio", { name: /^Zor/u }));
    await start(user);

    await user.click(screen.getByRole("button", { name: /Henry/u }));
    await user.click(await screen.findByRole("button", { name: "Devam" }));

    await waitFor(() => {
      expect(fetchRound).toHaveBeenCalledTimes(2);
    });

    const body = fetchRound.mock.calls[1]?.[0] as { level?: string };
    expect(body.level).toBe("hard");
  });

  it("hangi havuzda oynandığı TUR ekranında da yazar", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("radio", { name: /^Zor/u }));
    await start(user);

    // Kullanıcı tanımadığı bir isim gördüğünde bunun kendi seçimi olduğunu
    // görebilmeli; yoksa modun kusuru sanır.
    expect(screen.getByText("Bütün oyuncular arasından")).toBeInTheDocument();
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

    await user.click(screen.getByRole("radio", { name: /Boy/u }));
    await start(user);

    // Boy ve kilo oyuncunun kendi kaydından gelir; lig kapsamıyla ilgisi yok.
    expect(
      screen.queryByText(/yalnızca kapsamdaki 24 ligi/u),
    ).not.toBeInTheDocument();
  });
});
