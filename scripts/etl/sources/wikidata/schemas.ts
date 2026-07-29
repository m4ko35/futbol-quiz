import { z } from "zod";

/**
 * Wikidata SPARQL JSON yanıt şeması (PROJECT.md §2.3).
 *
 * Dış dünyadan gelen hiçbir veri doğrulanmadan iç katmanlara geçmez. Wikidata
 * herkesin düzenleyebildiği bir kaynak; alan tipleri beklediğimizden farklı
 * gelebilir ve bunu sessizce yutmak veritabanını bozar.
 */

const SparqlValueSchema = z.object({
  type: z.string(),
  value: z.string(),
  datatype: z.string().optional(),
  "xml:lang": z.string().optional(),
});

export const SparqlResponseSchema = z.object({
  head: z.object({ vars: z.array(z.string()) }),
  results: z.object({
    bindings: z.array(z.record(z.string(), SparqlValueSchema)),
  }),
});

export type SparqlBinding = z.infer<
  typeof SparqlResponseSchema
>["results"]["bindings"][number];

/** Bağlamadan düz metin değeri okur; alan yoksa undefined döner. */
export function str(binding: SparqlBinding, key: string): string | undefined {
  return binding[key]?.value;
}

/**
 * `http://www.wikidata.org/entity/Q495299` → `Q495299`
 *
 * Beklenen biçimde değilse undefined döner — bozuk URI'yi QID sanıp
 * veritabanına yazmaktansa kaydı atlamak doğrudur.
 */
export function qid(binding: SparqlBinding, key: string): string | undefined {
  const value = str(binding, key);
  if (value === undefined) return undefined;

  const last = value.split("/").pop();
  return last !== undefined && /^Q\d+$/.test(last) ? last : undefined;
}

/** Sayısal niteleyiciyi okur. Negatif veya sayı olmayan değerler elenir. */
export function int(binding: SparqlBinding, key: string): number | undefined {
  const value = str(binding, key);
  if (value === undefined) return undefined;

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}
