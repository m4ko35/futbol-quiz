import { describe, expect, it, vi } from "vitest";
import { TransientHttpError } from "../../../scripts/etl/sources/http";
import { WikidataClient } from "../../../scripts/etl/sources/wikidata/client";
import type { SparqlBinding } from "../../../scripts/etl/sources/wikidata/schemas";

/**
 * §8.3 — düşen grubu ikiye bölerek yeniden deneme.
 *
 * ÖLÇÜLMÜŞ ARIZA: 308. oyuncu grubu iki ayrı koşuda, 45 dakika arayla,
 * sekizer denemede `HTTP 504` verdi. `504` ağ geçidi zaman aşımıdır — sorgu
 * Wikidata'nın süre sınırını aşıyor, yani sorun yük değil sorgunun maliyeti.
 *
 * Testler `query`'yi taklit ediyor: burada sınanan şey ağ değil, BÖLME
 * KARARI — ne zaman bölünür, ne zaman bölünmez, etiket ne olur.
 */

const ENDPOINT_FAILURE = () =>
  new Error("İstek başarısız (x): HTTP 504", {
    cause: new TransientHttpError(504, "", undefined),
  });

function makeClient(): WikidataClient {
  return new WikidataClient(
    {
      ETL_USER_AGENT: "test/1.0 (test@example.com)",
      WIKIDATA_SPARQL_ENDPOINT: "https://example.invalid/sparql",
      ETL_REQUESTS_PER_SECOND: 1,
    } as never,
    "/tmp/does-not-matter",
  );
}

const binding = (id: string): SparqlBinding =>
  ({ player: { type: "uri", value: id } }) as unknown as SparqlBinding;

const ids = (n: number): string[] =>
  Array.from({ length: n }, (_, i) => `Q${String(i)}`);

describe("queryBatch — bölme kararı", () => {
  it("sorgu geçerse BÖLMEZ ve etiketi değiştirmez", async () => {
    const client = makeClient();
    const query = vi.spyOn(client, "query").mockResolvedValue([binding("Q1")]);

    const result = await client.queryBatch(ids(250), () => "SPARQL", {
      label: "players-0-250",
    });

    expect(result).toHaveLength(1);
    expect(query).toHaveBeenCalledTimes(1);
    // ETİKET ÖNBELLEK DOSYA ADININ PARÇASI: değişirse var olan önbellek
    // görünmez olur ve saatlerce iş tekrarlanır.
    expect(query.mock.calls[0]?.[1].label).toBe("players-0-250");
  });

  it("uç nokta hatasında ikiye böler", async () => {
    const client = makeClient();
    const query = vi
      .spyOn(client, "query")
      .mockRejectedValueOnce(ENDPOINT_FAILURE())
      .mockResolvedValue([binding("Q1")]);

    const result = await client.queryBatch(ids(250), () => "SPARQL", {
      label: "players-308-250",
    });

    // 1 başarısız + 2 yarı = 3 çağrı; iki yarının sonucu BİRLEŞTİRİLİR.
    expect(query).toHaveBeenCalledTimes(3);
    expect(result).toHaveLength(2);

    const labels = query.mock.calls.map((call) => call[1].label);
    expect(labels).toEqual([
      "players-308-250",
      "players-308-250-a",
      "players-308-250-b",
    ]);
  });

  it("bölünen yarılar gerçekten yarıdır", async () => {
    const client = makeClient();
    const sizes: number[] = [];
    vi.spyOn(client, "query").mockImplementation((sparql) => {
      const count = Number(sparql);
      sizes.push(count);
      if (sizes.length === 1) return Promise.reject(ENDPOINT_FAILURE());
      return Promise.resolve([]);
    });

    await client.queryBatch(ids(250), (batch) => String(batch.length), {
      label: "players-0-250",
    });

    expect(sizes).toEqual([250, 125, 125]);
  });

  it("tabana inince BÖLMEYİ BIRAKIR ve hatayı yükseltir", async () => {
    // Bu boyutun altında sorun büyüklük değildir; bölmeye devam etmek
    // gerçek sebebi gizler.
    const client = makeClient();
    vi.spyOn(client, "query").mockRejectedValue(ENDPOINT_FAILURE());

    await expect(
      client.queryBatch(ids(25), () => "SPARQL", { label: "kucuk" }),
    ).rejects.toThrow(/HTTP 504/u);
  });

  it("uç nokta kaynaklı OLMAYAN hatada bölmez", async () => {
    // Şema uyuşmazlığı bölünerek çözülmez; küçülen gruplarla aynı hatayı
    // tekrarlamak sebebi gizlerdi.
    const client = makeClient();
    const query = vi
      .spyOn(client, "query")
      .mockRejectedValue(new Error("Yanıt beklenen şemaya uymuyor"));

    await expect(
      client.queryBatch(ids(250), () => "SPARQL", { label: "sema" }),
    ).rejects.toThrow(/şemaya uymuyor/u);

    expect(query).toHaveBeenCalledTimes(1);
  });

  it("ısrarlı hatada tabana kadar iner", async () => {
    const client = makeClient();
    const query = vi
      .spyOn(client, "query")
      .mockRejectedValue(ENDPOINT_FAILURE());

    await expect(
      client.queryBatch(ids(100), () => "SPARQL", { label: "inatci" }),
    ).rejects.toThrow(/HTTP 504/u);

    // 100 → 50 → 25 (taban). Her düzeyde sol dal önce tükenir.
    expect(query.mock.calls.length).toBeGreaterThan(1);
  });
});
