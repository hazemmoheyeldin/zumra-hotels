/**
 * Financial Test Suite — 5 Key Scenarios
 *
 * Validates the core financial logic used across the application:
 *   - Running balance formula: Previous + Debits - Credits = New Balance
 *   - Cancellation symmetry: debit + reversal credit = net zero
 *   - Floating-point precision via round2/safeAdd/safeSubtract
 *
 * Run in dev mode on app startup — results are logged to the console.
 */

import { round2, safeAdd, safeSubtract, sumAmounts, absAmount, amountsEqual } from './finance';

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

// ─── Scenario 1: New Reservation Created (Debit Entry) ──────────────
function scenario1_NewReservation(): TestResult {
  const openingBalance = 0;
  const reservationTotal = 1500.50;

  // Debit entry: client owes us
  const runningBalance = safeAdd(openingBalance, reservationTotal);

  assert(
    amountsEqual(runningBalance, 1500.50),
    `Expected 1500.50, got ${runningBalance}`
  );

  return {
    name: 'Scenario 1: New reservation (debit entry)',
    passed: true,
    details: `Opening: ${openingBalance} | Debit: +${reservationTotal} | Balance: ${runningBalance} ✓`
  };
}

// ─── Scenario 2: Partial Payment Received (Credit Entry) ────────────
function scenario2_PartialPayment(): TestResult {
  const openingBalance = 1500.50;
  const paymentAmount = 800.00;

  // Credit entry: client paid part of what they owe
  const runningBalance = safeSubtract(openingBalance, paymentAmount);

  assert(
    amountsEqual(runningBalance, 700.50),
    `Expected 700.50, got ${runningBalance}`
  );

  // Verify remaining balance
  const remaining = safeSubtract(openingBalance, paymentAmount);
  assert(
    amountsEqual(remaining, 700.50),
    `Remaining should be 700.50, got ${remaining}`
  );

  return {
    name: 'Scenario 2: Partial payment (credit entry)',
    passed: true,
    details: `Opening: ${openingBalance} | Credit: -${paymentAmount} | Balance: ${runningBalance} | Remaining: ${remaining} ✓`
  };
}

// ─── Scenario 3: Full Payment Received (Zero Balance) ───────────────
function scenario3_FullPayment(): TestResult {
  const openingBalance = 700.50;
  const paymentAmount = 700.50;

  const runningBalance = safeSubtract(openingBalance, paymentAmount);

  assert(
    amountsEqual(runningBalance, 0),
    `Expected 0.00, got ${runningBalance}`
  );

  return {
    name: 'Scenario 3: Full payment (zero balance)',
    passed: true,
    details: `Opening: ${openingBalance} | Credit: -${paymentAmount} | Balance: ${runningBalance} ✓`
  };
}

// ─── Scenario 4: Cancellation with Reversal (Net Zero) ──────────────
function scenario4_CancellationReversal(): TestResult {
  const openingBalance = 2000.00;
  const reservationDebit = 2000.00;

  // Step 1: Original reservation creates a debit
  const afterDebit = safeAdd(openingBalance, reservationDebit);
  assert(
    amountsEqual(afterDebit, 4000.00),
    `After debit expected 4000.00, got ${afterDebit}`
  );

  // Step 2: Cancellation creates a reversal credit of the same amount
  const reversalCredit = reservationDebit;
  const afterReversal = safeSubtract(afterDebit, reversalCredit);

  assert(
    amountsEqual(afterReversal, openingBalance),
    `After reversal expected ${openingBalance}, got ${afterReversal}`
  );

  // Net effect of debit + credit = 0
  const netEffect = safeSubtract(reservationDebit, reversalCredit);
  assert(
    amountsEqual(netEffect, 0),
    `Net effect should be 0, got ${netEffect}`
  );

  return {
    name: 'Scenario 4: Cancellation reversal (net zero)',
    passed: true,
    details: `Opening: ${openingBalance} | Debit: +${reservationDebit} → ${afterDebit} | Reversal: -${reversalCredit} → ${afterReversal} | Net: ${netEffect} ✓`
  };
}

// ─── Scenario 5: Correction / Credit Note Applied ───────────────────
function scenario5_CreditNoteAdjustment(): TestResult {
  const openingBalance = 3000.00;

  // A credit note of 150.75 is applied to correct an overcharge
  const creditNote = 150.75;
  const afterAdjustment = safeSubtract(openingBalance, creditNote);

  assert(
    amountsEqual(afterAdjustment, 2849.25),
    `Expected 2849.25, got ${afterAdjustment}`
  );

  // Verify with multiple running balance steps
  const steps = [
    { debit: 3000.00, credit: 0 },       // Original reservation
    { debit: 0, credit: 150.75 },         // Credit note applied
    { debit: 0, credit: 500.00 },         // Partial payment
  ];

  let bal = 0;
  for (const step of steps) {
    bal = safeSubtract(safeAdd(bal, step.debit), step.credit);
  }

  // 3000.00 - 150.75 - 500.00 = 2349.25
  assert(
    amountsEqual(bal, 2349.25),
    `Multi-step balance expected 2349.25, got ${bal}`
  );

  return {
    name: 'Scenario 5: Credit note adjustment',
    passed: true,
    details: `Opening: ${openingBalance} | CreditNote: -${creditNote} → ${afterAdjustment} | Multi-step final: ${bal} ✓`
  };
}

// ─── Bonus: Floating-Point Precision Guard ──────────────────────────
function bonusPrecisionGuard(): TestResult {
  // Classic IEEE 754 trap: 0.1 + 0.2 ≠ 0.3
  const raw = 0.1 + 0.2;
  const safe = safeAdd(0.1, 0.2);

  assert(raw !== 0.3, `Raw should NOT equal 0.3 (got ${raw})`);
  assert(
    amountsEqual(safe, 0.3),
    `safeAdd(0.1, 0.2) should equal 0.30, got ${safe}`
  );

  // Sum of many small amounts
  const values = [0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90, 1.00];
  const rawSum = values.reduce((a, b) => a + b, 0);
  const safeSum = sumAmounts(values);

  assert(
    amountsEqual(safeSum, 5.50),
    `sumAmounts expected 5.50, got ${safeSum}`
  );

  // round2 edge cases
  assert(amountsEqual(round2(1.005), 1.01), `round2(1.005) should be 1.01`);
  assert(amountsEqual(round2(NaN), 0), `round2(NaN) should be 0`);
  assert(amountsEqual(round2(Infinity), 0), `round2(Infinity) should be 0`);
  assert(amountsEqual(absAmount(-500.75), 500.75), `absAmount(-500.75) should be 500.75`);

  return {
    name: 'Bonus: Floating-point precision guard',
    passed: true,
    details: `raw(0.1+0.2)=${raw} vs safe=${safe} | rawSum=${rawSum} vs safeSum=${safeSum} | round2/absAmount OK ✓`
  };
}

// ─── Runner ─────────────────────────────────────────────────────────
export function runFinancialTests(): void {
  const tests = [
    scenario1_NewReservation,
    scenario2_PartialPayment,
    scenario3_FullPayment,
    scenario4_CancellationReversal,
    scenario5_CreditNoteAdjustment,
    bonusPrecisionGuard,
  ];

  const results: TestResult[] = [];
  console.group('%c💰 Financial Test Suite', 'font-weight:bold;font-size:14px;color:#C1A168');

  for (const testFn of tests) {
    try {
      const result = testFn();
      results.push(result);
      console.log(`%c✅ PASS%c ${result.name}\n   ${result.details}`, 'color:green;font-weight:bold', 'color:inherit');
    } catch (err: any) {
      results.push({ name: testFn.name, passed: false, details: err.message });
      console.error(`%c❌ FAIL%c ${testFn.name}\n   ${err.message}`, 'color:red;font-weight:bold', 'color:inherit');
    }
  }

  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  console.log(`\n%c${passed}/${total} tests passed`, `font-weight:bold;color:${passed === total ? 'green' : 'red'}`);
  console.groupEnd();
}
