import { describe, expect, it } from "vitest";
import {
  DEFAULT_SPELL_FILTER,
  spellQualifies,
} from "@/domain/services/spell-filter";
import { aSpell } from "../../helpers/builders";

describe("spellQualifies — BR-2 ve BR-3", () => {
  it("varsayılan: altyapı hariç, kiralık dahil", () => {
    expect(DEFAULT_SPELL_FILTER).toEqual({
      includeYouth: false,
      includeLoans: true,
    });
  });

  it("normal dönem her ölçütte geçer", () => {
    const spell = aSpell({ isYouth: false, isLoan: false });

    expect(spellQualifies(spell, DEFAULT_SPELL_FILTER)).toBe(true);
    expect(
      spellQualifies(spell, { includeYouth: true, includeLoans: false }),
    ).toBe(true);
  });

  it("altyapı dönemi varsayılanla elenir", () => {
    expect(
      spellQualifies(aSpell({ isYouth: true }), DEFAULT_SPELL_FILTER),
    ).toBe(false);
  });

  it("kiralık dönem varsayılanla geçer", () => {
    expect(spellQualifies(aSpell({ isLoan: true }), DEFAULT_SPELL_FILTER)).toBe(
      true,
    );
  });

  it("hem altyapı hem kiralık: tek bir ölçüt açmak yetmez", () => {
    const spell = aSpell({ isYouth: true, isLoan: true });

    expect(
      spellQualifies(spell, { includeYouth: true, includeLoans: false }),
    ).toBe(false);
    expect(
      spellQualifies(spell, { includeYouth: false, includeLoans: true }),
    ).toBe(false);
    expect(
      spellQualifies(spell, { includeYouth: true, includeLoans: true }),
    ).toBe(true);
  });
});
