/**
 * Pure payment computation function - zero side effects, fully testable
 * Centralized logic for payment method handling in sales
 */

export enum PaymentMethod {
  EFECTIVO = 'EFECTIVO',
  TRANSFERENCIA = 'TRANSFERENCIA',
  MIXTO = 'MIXTO',
}

export interface PaymentInput {
  cash?: number;
  transfer?: number;
}

export interface PaymentResult {
  amountPaid: number;
  pendingBalance: number;
}

/**
 * Computes payment allocation based on payment method
 * 
 * @param method - Payment method (EFECTIVO, TRANSFERENCIA, MIXTO)
 * @param total - Total sale amount
 * @param manualInput - For MIXTO: cash and/or transfer amounts
 * @returns { amountPaid, pendingBalance }
 */
export function computePayment(
  method: PaymentMethod,
  total: number,
  manualInput?: PaymentInput
): PaymentResult {
  let amountPaid = 0;

  switch (method) {
    case PaymentMethod.EFECTIVO:
      amountPaid = total;
      break;
    case PaymentMethod.TRANSFERENCIA:
      amountPaid = 0;
      break;
    case PaymentMethod.MIXTO:
      amountPaid = (manualInput?.cash ?? 0) + (manualInput?.transfer ?? 0);
      break;
  }

  const pendingBalance = Math.max(0, total - amountPaid);
  return { amountPaid, pendingBalance };
}