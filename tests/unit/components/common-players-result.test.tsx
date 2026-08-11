// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type {
  CommonPlayersResultDto,
  SpellDto,
} from "@/application/dto/common-players-dto";
import {
  CommonPlayersResult,
  formatSpell,
} from "@/components/common-players-result";

afterEach(cleanup);

const spell = (overrides: Partial<SpellDto> = {}): SpellDto => ({
  startYear: 2010,
  endYear: 2012,
  isLoan: false,
  appearances: null,
  goals: null,
  hasEvidence: true,
  ...overrides,
});

const result = (
  overrides: Partial<CommonPlayersResultDto> = {},
): CommonPlayersResultDto => ({
  clubA: {
    id: "a",
    name: "Galatasaray SK",
    shortName: "Galatasaray",
    country: "TR",
    crestUrl: null,
  },
  clubB: {
    id: "b",
    name: "Arsenal F.C.",
    shortName: "Arsenal",
    country: "GB",
    crestUrl: null,
  },
  count: 1,
  players: [
    {
      id: "p1",
      name: "Emmanuel Eboué",
      nationality: "CI",
      position: "defender",
      spellsAtA: [spell({ startYear: 2011, endYear: 2014, appearances: 64 })],
      spellsAtB: [spell({ startYear: 2005, endYear: 2011, appearances: 214 })],
    },
  ],
  degenerate: null,
  ...overrides,
});

describe("formatSpell — §2.7, bilinmeyen uydurulmaz", () => {
  it.each([
    ["normal aralık", spell({ startYear: 2010, endYear: 2012 }), "2010 – 2012"],
    ["tek yıl", spell({ startYear: 2010, endYear: 2010 }), "2010"],
    ["bitiş bilinmiyor", spell({ startYear: 2020, endYear: null }), "2020 – ?"],
    [
      "başlangıç bilinmiyor",
      spell({ startYear: null, endYear: 2012 }),
      "? – 2012",
    ],
    [
      "hiçbiri bilinmiyor",
      spell({ startYear: null, endYear: null }),
      "tarih bilinmiyor",
    ],
  ])("%s", (_label, input, expected) => {
    expect(formatSpell(input)).toBe(expected);
  });

  it("bilinmeyen tarihi 0 veya bugüne çevirmez", () => {
    const text = formatSpell(spell({ startYear: null, endYear: null }));

    expect(text).not.toMatch(/\d/u);
  });

  it("bitişi olmayan dönemi 'hâlâ kadroda' SAYMAZ", () => {
    // Wikidata'da bitiş tarihinin yokluğu "hâlâ kulüpte" değil "girilmemiş"
    // demek. Ölçüm: Bayern'in "güncel kadrosunda" 1899 başlangıçlı kayıtlar
    // çıkıyor. Yanlış bir kesinlik vermektense bilinmediğini söylüyoruz.
    expect(formatSpell(spell({ startYear: 1899, endYear: null }))).toBe(
      "1899 – ?",
    );
    expect(formatSpell(spell({ startYear: 2025, endYear: null }))).not.toMatch(
      /kadro/iu,
    );
  });
});

describe("CommonPlayersResult", () => {
  it("oyuncuyu ve iki kulüpteki dönemlerini gösterir", () => {
    render(<CommonPlayersResult result={result()} />);

    expect(screen.getByText("Emmanuel Eboué")).toBeInTheDocument();
    expect(screen.getByText(/2011 – 2014/u)).toBeInTheDocument();
    expect(screen.getByText(/2005 – 2011/u)).toBeInTheDocument();
  });

  /**
   * BR-40 ve §7.12 — İKİ ALAN DA ÇEVRİLİR.
   *
   * Veritabanı ikisini de ham tutar: `position` dilden bağımsız anahtar
   * (`defender`), `nationality` ISO kodu (`CI`). Bu satır bir zamanlar ikisini
   * de ham basıyordu; kullanıcı "defender · CI" görürdü. Oyuncu seçicisi ise
   * uyruğu çeviriyordu, yani aynı oyuncu iki ekranda iki farklı biçimde
   * görünüyordu.
   */
  it("mevkiyi ve uyruğu ÇEVİRİR, ham değeri basmaz", () => {
    render(<CommonPlayersResult result={result()} />);

    expect(screen.getByText(/Defans/u)).toBeInTheDocument();
    expect(screen.getByText(/Fildişi Sahili/u)).toBeInTheDocument();

    expect(screen.queryByText(/defender/u)).not.toBeInTheDocument();
    expect(screen.queryByText(/\bCI\b/u)).not.toBeInTheDocument();
  });

  it("BR-3: kiralık dönemi açıkça işaretler", () => {
    const data = result({
      players: [
        {
          id: "p1",
          name: "Kiralık Oyuncu",
          nationality: null,
          position: null,
          spellsAtA: [spell({ isLoan: true })],
          spellsAtB: [spell()],
        },
      ],
    });

    render(<CommonPlayersResult result={data} />);

    expect(screen.getAllByText("kiralık")).toHaveLength(1);
  });

  it("maç sayısı bilinmiyorsa 0 GÖSTERMEZ", () => {
    const data = result({
      players: [
        {
          id: "p1",
          name: "Bilinmeyen",
          nationality: null,
          position: null,
          spellsAtA: [spell({ appearances: null })],
          spellsAtB: [spell({ appearances: null })],
        },
      ],
    });

    render(<CommonPlayersResult result={data} />);

    expect(screen.queryByText(/0 maç/u)).not.toBeInTheDocument();
  });

  it("mevki ve uyruk yoksa 'bilgi yok' der", () => {
    const data = result({
      players: [
        {
          id: "p1",
          name: "Adsız",
          nationality: null,
          position: null,
          spellsAtA: [spell()],
          spellsAtB: [spell()],
        },
      ],
    });

    render(<CommonPlayersResult result={data} />);

    expect(screen.getByText("bilgi yok")).toBeInTheDocument();
  });

  it("boş sonuçta neden boş olduğunu açıklar", () => {
    render(<CommonPlayersResult result={result({ count: 0, players: [] })} />);

    expect(screen.getByText(/bulunamadı/iu)).toBeInTheDocument();
    // Kapsam sınırı kullanıcıya söylenmeli; aksi hâlde sonucu hata sanar.
    expect(screen.getByText(/veri kümesi/iu)).toBeInTheDocument();
  });

  it("başlık sonuç bölgesine bağlıdır (erişilebilirlik)", () => {
    render(<CommonPlayersResult result={result()} />);

    // Erişilebilir ad "∩" DEĞİL "ve" içerir ve bu bilinçli: seslendiriciler
    // "∩" karakterini tutarsız okur — kimi "kesişim" der, kimi tamamen atlar.
    // Simge gözde kalıyor (`aria-hidden`), sözcük ekran okuyucuya gidiyor.
    const section = screen.getByRole("region", {
      name: /Galatasaray ve Arsenal/u,
    });
    expect(within(section).getByText("Emmanuel Eboué")).toBeInTheDocument();
  });

  it("ortak oyuncu sayısını gösterir", () => {
    render(<CommonPlayersResult result={result({ count: 42 })} />);

    expect(screen.getByText(/42 ortak oyuncu/u)).toBeInTheDocument();
  });
});

describe("defter düzeni", () => {
  /**
   * KULÜP ADI HER SATIRDA KALIR — geniş ekranda gözden kalksa bile.
   *
   * Ad, defterin sabit başlığında bir kez yazılı ve her satırda tekrarlanması
   * 55 oyunculuk bir sonuçta aynı iki adı 110 kez basmak demekti. Ama
   * gizlemenin yolu `display:none` OLAMAZ: o, yardımcı teknolojiden de gizler
   * ve ekran okuyucu kullanıcısı "1993 – 2002, 240 maç" satırını hangi kulübe
   * ait olduğunu bilmeden okurdu — ızgara başlığı ile hücre arasında
   * programatik bir bağ yok.
   *
   * Bu test o bağı koruyor: satırın içinde iki kulübün adı da OKUNABİLİR
   * olmalı. `sm:hidden`'a dönen bir "sadeleştirme" burada kırmızıya döner.
   */
  it("kulüp adı satırın içinde okunabilir kalır", () => {
    render(<CommonPlayersResult result={result()} />);

    const row = screen.getByText("Emmanuel Eboué").closest("li");
    if (row === null) throw new Error("oyuncu satırı basılmadı");

    expect(within(row).getByText("Galatasaray")).toBeInTheDocument();
    expect(within(row).getByText("Arsenal")).toBeInTheDocument();
  });

  it("sabit başlık ekran okuyucuda TEKRARLANMAZ", () => {
    // Başlık görsel bir yardımcı: adlar zaten her hücrede yazılı. Gizlenmeseydi
    // ekran okuyucu iki kulüp adını da iki kez duyururdu.
    render(<CommonPlayersResult result={result()} />);

    const head = screen.getByText("Oyuncu");
    expect(head.closest('[aria-hidden="true"]')).not.toBeNull();
  });
});

describe("BR-8 — kanıtsız dönem işareti", () => {
  const withUnevidenced = () =>
    result({
      players: [
        {
          id: "p1",
          name: "Bill Dale",
          nationality: null,
          position: null,
          spellsAtA: [
            spell({
              startYear: null,
              endYear: null,
              appearances: null,
              hasEvidence: false,
            }),
          ],
          spellsAtB: [spell({ startYear: 1931, endYear: 1937 })],
        },
      ],
    });

  it("kanıtsız dönem LİSTEDEN ÇIKARILMAZ", () => {
    // Elemenin bedeli ölçüldü (§1.4): Bill Dale gerçekten iki kulüpte de
    // oynadı ve eleme onu da siliyordu. Bu testin koruduğu şey, ileride
    // "temizlik" niyetiyle eklenecek bir filtrenin sessizce doğru cevapları
    // kaldırmasını engellemektir.
    render(<CommonPlayersResult result={withUnevidenced()} />);

    expect(screen.getByText("Bill Dale")).toBeInTheDocument();
  });

  it("kanıtsız dönem işaretlenir ve açıklaması gösterilir", () => {
    render(<CommonPlayersResult result={withUnevidenced()} />);

    expect(screen.getAllByText(/kaynakta ayrıntı yok/u).length).toBeGreaterThan(
      0,
    );
    expect(screen.getByText(/doğrulukları teyit edilemiyor/u)).toBeVisible();
  });

  it("bütün dönemler kanıtlıysa açıklama GÖSTERİLMEZ", () => {
    // Her listede duran bir uyarı, uyarı olmaktan çıkar.
    render(<CommonPlayersResult result={result()} />);

    expect(screen.queryByText(/kaynakta ayrıntı yok/u)).not.toBeInTheDocument();
  });

  it("işaret rengin yanında METİNLE de verilir (WCAG 1.4.1)", () => {
    // Bilgi yalnızca kesik çizgiyle taşınırsa renk/biçim ayırt edemeyen
    // kullanıcı için kaybolur. Metin bu yüzden zorunludur.
    render(<CommonPlayersResult result={withUnevidenced()} />);

    const badges = screen.getAllByText(/kaynakta ayrıntı yok/u);
    expect(badges[0]?.textContent?.trim().length).toBeGreaterThan(0);
  });
});

describe("BR-36 — dejenere çift uyarısı", () => {
  const degenerate = () =>
    result({
      degenerate: {
        sharedPlayers: 52,
        smallerClubPlayers: 65,
        smallerClubName: "Condal",
      },
    });

  it("dejenere değilken uyarı YOK", () => {
    render(<CommonPlayersResult result={result()} />);

    expect(screen.queryByText(/kadrolarının neredeyse tamamını/)).toBeNull();
  });

  it("ham sayıları gösterir — kullanıcı iddiayı denetleyebilmeli", () => {
    render(<CommonPlayersResult result={degenerate()} />);

    const note = screen.getByRole("complementary");
    expect(note).toHaveTextContent("Condal");
    expect(note).toHaveTextContent("65");
    expect(note).toHaveTextContent("52");
  });

  it("KİMLİK İDDİA ETMEZ: 'aynı kulüp' demez", () => {
    // Kuralın tetiklendiği yedi çiftin ikisi gerçekten ayrı kulüptür
    // (Condal/Barcelona, Kharkiv/Metalist 1925). Kesin bir kimlik ifadesi
    // orada düpedüz yanlış olurdu — §5.3.
    render(<CommonPlayersResult result={degenerate()} />);

    const text = screen.getByRole("complementary").textContent ?? "";
    expect(text).not.toMatch(/aynı kulüp(tür|ler)\b/);
    expect(text).toMatch(/olabilir/);
  });

  it("uyarı bir SÜZGEÇ değil: liste olduğu gibi kalır", () => {
    render(<CommonPlayersResult result={degenerate()} />);

    expect(screen.getByText("Emmanuel Eboué")).toBeInTheDocument();
    expect(screen.getByRole("complementary")).toHaveTextContent(
      "Liste değiştirilmedi",
    );
  });

  it("listenin ÜSTÜNDE durur — uyarı listeyi çerçeveler", () => {
    const { container } = render(<CommonPlayersResult result={degenerate()} />);

    const note = container.querySelector("aside");
    // Oyuncu listesi: sayfadaki tek `li`'li `ul` — dönem rozetleri kendi
    // `ul`'larında ve onlar satırların İÇİNDE.
    const list = screen.getByText("Emmanuel Eboué").closest("ul");
    if (note === null || list === null) {
      throw new Error("uyarı ya da oyuncu listesi basılmadı");
    }

    // Uyarı listeyi ÇERÇEVELİYOR, dipnotu değil: sıra bozulursa kullanıcı
    // listeyi okuduktan sonra "aslında bu liste şüpheli" uyarısını görür.
    expect(
      note.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
