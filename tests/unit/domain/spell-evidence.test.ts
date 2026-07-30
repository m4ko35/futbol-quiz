import { describe, expect, it } from "vitest";
import { hasEvidence } from "@/domain/services/spell-evidence";
import { aSpell } from "../../helpers/builders";

/** BR-8 — PROJECT.md §5.4. Ölçüm ve gerekçe §1.4'te. */
describe("hasEvidence (BR-8)", () => {
  it("dört alanın da boş olduğu dönem KANITSIZDIR", () => {
    const spell = aSpell({
      years: { start: null, end: null },
      appearances: null,
      goals: null,
    });

    expect(hasEvidence(spell)).toBe(false);
  });

  it.each([
    ["yalnızca başlangıç yılı", { years: { start: 1932, end: null } }],
    ["yalnızca bitiş yılı", { years: { start: null, end: 1938 } }],
    ["yalnızca maç sayısı", { appearances: 17 }],
    ["yalnızca gol sayısı", { goals: 3 }],
  ])("tek bir alan bile dolu olsa kanıtlıdır: %s", (_label, patch) => {
    const spell = aSpell({
      years: { start: null, end: null },
      appearances: null,
      goals: null,
      ...patch,
    });

    expect(hasEvidence(spell)).toBe(true);
  });

  it("sıfır maç ve sıfır gol KANITTIR — `null` ile karıştırılmaz", () => {
    // Ölçülmüş örnek: Chedric Seedorf'un Milan dönemi 2007–2008, 0 maç 0 gol.
    // Kayıt gerçektir; oyuncu kadroda yer aldı ama hiç oynamadı. `0` bir
    // bilgidir, `null` bilgisizliktir (§2.7).
    const spell = aSpell({
      years: { start: null, end: null },
      appearances: 0,
      goals: 0,
    });

    expect(hasEvidence(spell)).toBe(true);
  });

  it("kanıt ölçütü kiralık/altyapı bayraklarına BAKMAZ", () => {
    // BR-8 bağımsız bir eksendir: bir dönem kiralık olabilir ve yine de
    // belgelenmiş olabilir. Bu iki kuralın karışması, "kiralıkları da eledik"
    // gibi sessiz bir kapsam daralmasına yol açardı.
    const belgelenmisKiralik = aSpell({
      years: { start: 2007, end: 2008 },
      isLoan: true,
    });
    const belgesizNormal = aSpell({
      years: { start: null, end: null },
      appearances: null,
      goals: null,
      isLoan: false,
    });

    expect(hasEvidence(belgelenmisKiralik)).toBe(true);
    expect(hasEvidence(belgesizNormal)).toBe(false);
  });
});
