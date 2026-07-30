import { describe, expect, it } from "vitest";
import { InvalidIdentifierError } from "@/domain/errors/domain-error";
import {
  clubId,
  isValidIdentifier,
  playerId,
} from "@/domain/value-objects/identifiers";

describe("kimlik doğrulama", () => {
  it("cuid biçimindeki kimlikleri kabul eder", () => {
    const raw = "clx3k9q1a0000abcdefghijkl";
    expect(clubId(raw)).toBe(raw);
    expect(playerId(raw)).toBe(raw);
  });

  it("tire ve alt çizgi içeren kimlikleri kabul eder", () => {
    expect(() => clubId("club_A-1")).not.toThrow();
  });

  it.each([
    ["boş dize", ""],
    ["boşluk", "abc def"],
    ["tek tırnak", "abc'def"],
    ["noktalı virgül", "abc;DROP"],
    ["yüzde işareti", "%25"],
    ["64 karakterden uzun", "a".repeat(65)],
  ])("%s reddedilir", (_label, raw) => {
    expect(() => clubId(raw)).toThrow(InvalidIdentifierError);
    expect(isValidIdentifier(raw)).toBe(false);
  });

  it("hata mesajı uzun girdiyi kırpar", () => {
    // Ham girdi kullanıcıya dönebilen bir mesaja giriyor; sınırsız uzunlukta
    // bir değeri yansıtmak log şişirme ve yansıtmalı içerik riskidir.
    const long = "z".repeat(500);
    expect(() => playerId(long)).toThrow(/z{16}…/u);
  });

  it("hata kodu §6.3 sözlüğünden gelir", () => {
    try {
      clubId("");
      expect.unreachable("geçersiz kimlik hata fırlatmalıydı");
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidIdentifierError);
      expect((error as InvalidIdentifierError).code).toBe("INVALID_IDENTIFIER");
    }
  });

  it("isValidIdentifier geçerli kimlikler için fırlatmadan doğrular", () => {
    expect(isValidIdentifier("clx3k9q1a0000abcdefghijkl")).toBe(true);
  });
});
