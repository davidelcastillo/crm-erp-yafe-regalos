/**
 * Unit tests for computePayment pure function
 * Tests all payment methods and edge cases
 */
import { computePayment, PaymentMethod } from "./payment";

describe("computePayment - Pure Function", () => {
  describe("EFECTIVO", () => {
    it("should return full amount as paid, zero pending", () => {
      const result = computePayment(PaymentMethod.EFECTIVO, 500);
      expect(result).toEqual({ amountPaid: 500, pendingBalance: 0 });
    });

    it("should handle zero total", () => {
      const result = computePayment(PaymentMethod.EFECTIVO, 0);
      expect(result).toEqual({ amountPaid: 0, pendingBalance: 0 });
    });

    it("should handle decimal amounts", () => {
      const result = computePayment(PaymentMethod.EFECTIVO, 123.45);
      expect(result).toEqual({ amountPaid: 123.45, pendingBalance: 0 });
    });
  });

  describe("TRANSFERENCIA", () => {
    it("should return zero paid, full amount pending", () => {
      const result = computePayment(PaymentMethod.TRANSFERENCIA, 500);
      expect(result).toEqual({ amountPaid: 0, pendingBalance: 500 });
    });

    it("should handle zero total", () => {
      const result = computePayment(PaymentMethod.TRANSFERENCIA, 0);
      expect(result).toEqual({ amountPaid: 0, pendingBalance: 0 });
    });

    it("should handle decimal amounts", () => {
      const result = computePayment(PaymentMethod.TRANSFERENCIA, 123.45);
      expect(result).toEqual({ amountPaid: 0, pendingBalance: 123.45 });
    });
  });

  describe("MIXTO", () => {
    it("should sum cash and transfer as paid", () => {
      const result = computePayment(PaymentMethod.MIXTO, 500, { cash: 200, transfer: 300 });
      expect(result).toEqual({ amountPaid: 500, pendingBalance: 0 });
    });

    it("should handle partial payment (cash only)", () => {
      const result = computePayment(PaymentMethod.MIXTO, 500, { cash: 100 });
      expect(result).toEqual({ amountPaid: 100, pendingBalance: 400 });
    });

    it("should handle partial payment (transfer only)", () => {
      const result = computePayment(PaymentMethod.MIXTO, 500, { transfer: 300 });
      expect(result).toEqual({ amountPaid: 300, pendingBalance: 200 });
    });

    it("should handle zero manual input", () => {
      const result = computePayment(PaymentMethod.MIXTO, 500, {});
      expect(result).toEqual({ amountPaid: 0, pendingBalance: 500 });
    });

    it("should handle undefined manual input", () => {
      const result = computePayment(PaymentMethod.MIXTO, 500);
      expect(result).toEqual({ amountPaid: 0, pendingBalance: 500 });
    });

    it("should cap pending at zero when overpaid", () => {
      const result = computePayment(PaymentMethod.MIXTO, 500, { cash: 300, transfer: 300 });
      expect(result).toEqual({ amountPaid: 600, pendingBalance: 0 });
    });
  });
});