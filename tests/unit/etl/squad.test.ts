import { describe, expect, it } from "vitest";

import {
  parseSquadBlocks,
  pickFirstTeam,
  squadArticleTitles,
} from "../../../scripts/etl/sources/wikipedia/squad";
import {
  DEPORTIVO_SQUAD,
  GALATASARAY_SQUAD,
  MANCHESTER_UNITED_SQUAD,
} from "../../fixtures/wikipedia-squads";

/**
 * Kadro şablonu ayrıştırıcısı — §4.3 Aşama 3.
 *
 * Fikstürler GERÇEK makale metinleridir. Testlerin ağırlık merkezi "kaç oyuncu
 * okundu" değil, **hangi bloğun seçildiği** ve **boru işaretinin nerede
 * bölündüğü**: ölçüm betiği iki kez tam bu iki noktadan kırıldı.
 */
describe("parseSquadBlocks", () => {
  it("her bloğu kendi başlığıyla, belgedeki sırayla döner", () => {
    const blocks = parseSquadBlocks(MANCHESTER_UNITED_SQUAD);

    expect(blocks.map((b) => b.heading)).toEqual([
      "First-team squad",
      "Out on loan",
      "Under-21s and Academy",
    ]);
  });

  it("şablon adı büyük harfle yazılmış olsa da okur", () => {
    // Fikstürde `{{Fs player}}` ve `{{fs player}}` birlikte geçiyor.
    const blocks = parseSquadBlocks(DEPORTIVO_SQUAD);

    expect(blocks[0]?.entries).toHaveLength(6);
  });

  it("forma numarası ve mevkiyi olduğu gibi taşır", () => {
    const first = parseSquadBlocks(MANCHESTER_UNITED_SQUAD)[0];

    expect(first?.entries[0]).toEqual({
      title: "Senne Lammens",
      shirt: "1",
      position: "GK",
    });
  });

  it("boş `no=` alanını null yapar, sıfır ya da boş dize DEĞİL", () => {
    const loan = parseSquadBlocks(MANCHESTER_UNITED_SQUAD)[1];
    const bayindir = loan?.entries.find((e) => e.title === "Altay Bayındır");

    expect(bayindir?.shirt).toBeNull();
  });

  it("bağlantısız oyuncuyu düşürmez, başlığını null bırakır", () => {
    // Galatasaray'ın altyapı bloğunda adlar düz metin.
    const academy = parseSquadBlocks(GALATASARAY_SQUAD).find((b) =>
      b.heading.startsWith("Academy"),
    );

    expect(academy?.entries.length).toBeGreaterThan(0);
    expect(academy?.entries.every((e) => e.title === null)).toBe(true);
  });

  it("kadro şablonu olmayan metinde boş dizi döner", () => {
    expect(parseSquadBlocks("== Tarihçe ==\nKulüp 1905'te kuruldu.")).toEqual(
      [],
    );
  });

  it("kapanmamış `{{fs player` şablonunu yarım ayrıştırmaz", () => {
    const broken = "== Squad ==\n{{fs start}}\n{{fs player|no=1|name=[[A]]\n";

    expect(parseSquadBlocks(broken)).toEqual([]);
  });
});

/**
 * ASIL REGRESYON. `name=[[Hedef|Görünen ad]]` alanını naif bir `split("|")`
 * ikiye böler ve geriye kapanmamış bir bağlantı bırakır — sonuç hata değil,
 * SESSİZ veri kaybıdır. Ölçüm betiğinde 1.503 oyuncu bu yüzden "makalesi yok"
 * sayıldı ve kapsam %38 yerine %34,4 göründü.
 */
describe("boru işaretli bağlantı — bölme derinlik sayarak yapılır", () => {
  it("`[[Hedef|Görünen]]` alanında HEDEFİ alır", () => {
    const loan = parseSquadBlocks(DEPORTIVO_SQUAD).find(
      (b) => b.heading === "Out on loan",
    );

    expect(loan?.entries[0]?.title).toBe("Diego Gómez (footballer, born 2004)");
  });

  it("`other=` alanındaki ikinci bağlantı `name=` alanını bozmaz", () => {
    // `other=at [[Trabzonspor]] until 30 June 2027` — hem `|` hem `[[…]]`.
    const loan = parseSquadBlocks(MANCHESTER_UNITED_SQUAD)[1];

    expect(loan?.entries.map((e) => e.title)).toEqual([
      "André Onana",
      "Altay Bayındır",
    ]);
  });

  it("boş `other=` alanı adı yutmaz", () => {
    const squad = parseSquadBlocks(GALATASARAY_SQUAD)[0];

    expect(squad?.entries[0]?.title).toBe("Uğurcan Çakır");
  });

  it("iç içe şablon taşıyan satırda `name=` yine okunur", () => {
    const text =
      "== Squad ==\n{{fs start}}\n" +
      "{{fs player|no=8|nat=POR|pos=MF|name=[[Bruno Fernandes]]" +
      "|other={{flagicon|POR}} [[Captain (association football)|captain]]}}\n" +
      "{{fs end}}";

    expect(parseSquadBlocks(text)[0]?.entries[0]?.title).toBe(
      "Bruno Fernandes",
    );
  });
});

describe("pickFirstTeam", () => {
  it("kiralık ve altyapı bloklarını eler", () => {
    const picked = pickFirstTeam(parseSquadBlocks(MANCHESTER_UNITED_SQUAD));

    expect(picked?.heading).toBe("First-team squad");
  });

  it("`Current squad` başlığını da tanır", () => {
    const picked = pickFirstTeam(parseSquadBlocks(GALATASARAY_SQUAD));

    expect(picked?.heading).toBe("Current squad");
  });

  it("yedek takım bloğu birinci takımın önüne geçemez", () => {
    const picked = pickFirstTeam(parseSquadBlocks(DEPORTIVO_SQUAD));

    expect(picked?.heading).toBe("First-team squad");
  });

  it("DIŞLAMA, kabulden önce bakılır", () => {
    // "Out on loan squad" hem dışlama hem kabul kalıbına uyuyor; dışlama kazanır.
    const blocks = [
      { heading: "Out on loan squad", entries: [] },
      { heading: "First-team squad", entries: [] },
    ];

    expect(pickFirstTeam(blocks)?.heading).toBe("First-team squad");
  });

  it("hiçbir başlık kabul kalıbına uymazsa DIŞLANMAYAN ilk blok alınır", () => {
    const blocks = [
      { heading: "Out on loan", entries: [] },
      { heading: "2026–27 kadrosu", entries: [] },
    ];

    expect(pickFirstTeam(blocks)?.heading).toBe("2026–27 kadrosu");
  });

  it("bütün bloklar dışlanmışsa null döner", () => {
    const blocks = [
      { heading: "Out on loan", entries: [] },
      { heading: "Youth academy", entries: [] },
    ];

    expect(pickFirstTeam(blocks)).toBeNull();
  });

  it("blok yoksa null döner", () => {
    expect(pickFirstTeam([])).toBeNull();
  });
});

describe("squadArticleTitles", () => {
  it("yalnızca birinci takımın bağlantılı başlıklarını döner", () => {
    expect(squadArticleTitles(MANCHESTER_UNITED_SQUAD)).toEqual([
      "Senne Lammens",
      "Diogo Dalot",
      "Noussair Mazraoui",
      "Matthijs de Ligt",
      "Harry Maguire",
      "Lisandro Martínez",
    ]);
  });

  it("kiralıktakiler LİSTEYE GİRMEZ", () => {
    // Onana o an Trabzonspor kadrosunda; keşfi oradan yapılacak.
    expect(squadArticleTitles(MANCHESTER_UNITED_SQUAD)).not.toContain(
      "André Onana",
    );
  });

  it("bağlantısız satırlar sessizce düşer", () => {
    const titles = squadArticleTitles(GALATASARAY_SQUAD);

    expect(titles).toHaveLength(6);
    expect(titles).toContain("Uğurcan Çakır");
  });

  it("aynı oyuncu iki kez yazılmışsa bir kez döner", () => {
    const text =
      "== Squad ==\n{{fs start}}\n" +
      "{{fs player|no=1|name=[[A Player]]}}\n" +
      "{{fs player|no=2|name=[[A Player]]}}\n" +
      "{{fs end}}";

    expect(squadArticleTitles(text)).toEqual(["A Player"]);
  });

  it("kadro şablonu olmayan makalede boş dizi döner", () => {
    expect(squadArticleTitles("== Tarihçe ==\nMetin.")).toEqual([]);
  });
});
