/**
 * Unit tests for getNextCode pure function
 * Run: npm test -- product-code.test.ts
 */

import { getNextCode, getNextCodeDetail } from "./product-code";

describe("getNextCode - Product Code Generation", () => {
  describe("Happy paths", () => {
    it("generates PREFIX000 for new prefix (no existing codes)", () => {
      expect(getNextCode("NEW", [])).toBe("NEW000");
    });

    it("increments existing sequence correctly", () => {
      expect(getNextCode("AA", ["AA000", "AA001", "AA002"])).toBe("AA003");
    });

    it("handles gaps in sequence (uses max + 1)", () => {
      expect(getNextCode("BB", ["BB000", "BB005", "BB002"])).toBe("BB006");
    });

    it("case-insensitive prefix input", () => {
      expect(getNextCode("aa", ["AA001"])).toBe("AA002");
      expect(getNextCode("Aa", ["AA001"])).toBe("AA002");
      expect(getNextCode("prod", ["PROD000"])).toBe("PROD001");
    });

    it("different prefixes are independent", () => {
      expect(getNextCode("AA", ["BB000", "BB001"])).toBe("AA000");
      expect(getNextCode("BB", ["AA000", "AA001"])).toBe("BB000");
    });

    it("handles 3-letter and 4-letter prefixes", () => {
      expect(getNextCode("ABC", [])).toBe("ABC000");
      expect(getNextCode("ABCD", [])).toBe("ABCD000");
      expect(getNextCode("ABC", ["ABC005"])).toBe("ABC006");
    });
  });

  describe("Edge cases", () => {
    it("throws at sequence 999 (max limit)", () => {
      const codes = Array.from({ length: 1000 }, (_, i) => 
        `MAX${String(i).padStart(3, "0")}`
      );
      expect(() => getNextCode("MAX", codes)).toThrow("agotado");
    });

    it("throws at sequence 1000 (over limit)", () => {
      const codes = Array.from({ length: 1001 }, (_, i) => 
        `OVR${String(i).padStart(3, "0")}`
      );
      expect(() => getNextCode("OVR", codes)).toThrow("agotado");
    });

    it("ignores codes with different prefix", () => {
      expect(getNextCode("AA", ["BB000", "CC999", "DD001"])).toBe("AA000");
    });

    it("ignores non-numeric suffixes", () => {
      expect(getNextCode("AA", ["AA000", "AAABC", "AA001"])).toBe("AA002");
    });

    it("handles empty strings in existing codes", () => {
      expect(getNextCode("AA", ["", "AA001"])).toBe("AA002");
    });
  });

  describe("Validation errors", () => {
    it("throws for prefix too short (1 letter)", () => {
      expect(() => getNextCode("A", [])).toThrow("inválido");
    });

    it("throws for prefix too long (5 letters)", () => {
      expect(() => getNextCode("ABCDE", [])).toThrow("inválido");
    });

    it("throws for prefix with numbers", () => {
      expect(() => getNextCode("AA1", [])).toThrow("inválido");
    });

    it("throws for prefix with special chars", () => {
      expect(() => getNextCode("AA-", [])).toThrow("inválido");
    });

    it("throws for empty prefix", () => {
      expect(() => getNextCode("", [])).toThrow("inválido");
    });
  });

  describe("getNextCodeDetail - returns structured result", () => {
    it("returns code, prefix, and sequence", () => {
      const result = getNextCodeDetail("TEST", ["TEST005"]);
      expect(result).toEqual({
        code: "TEST006",
        prefix: "TEST",
        sequence: 6,
      });
    });

    it("normalizes prefix in detail result", () => {
      const result = getNextCodeDetail("test", ["TEST001"]);
      expect(result.prefix).toBe("TEST");
    });
  });
});