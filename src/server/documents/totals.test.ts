// Fictional but realistic Faridabad (Haryana, 06) invoices, every amount worked out by hand.
import { describe, expect, test } from "bun:test";
import { documentTotals, type TotalsInput } from "./totals.ts";

const HR = "06";
const DL = "07";
type Line = TotalsInput["lines"][number];
const line = (hsn: string | null, qty: number, unit_decimals: number, rate: number, gst_rate: number, discount_bp = 0): Line => ({ hsn, qty, unit_decimals, rate, discount_bp, gst_rate });
const sale = (placeOfSupply: string, lines: Line[]) => documentTotals({ type: "invoice", companyState: HR, partyState: placeOfSupply, placeOfSupply, lines });

describe("sales invoices", () => {
  test("within Haryana: bolts and rod by weight with a discount, CGST + SGST, rounded to the rupee", () => {
    const t = sale(HR, [
      // 5,000 NOS × ₹12.50 = ₹62,500.00; 9% + 9% = ₹5,625.00 each.
      line("73181500", 5000, 0, 12_50, 18),
      // 1,250.500 KGS × ₹62.40 = ₹78,031.20, less 2.5% (₹1,950.78) = ₹76,080.42;
      // 18% = ₹13,694.4756 → ₹13,694.48 → ₹6,847.24 each.
      line("72142090", 1_250_500, 3, 62_40, 18, 250),
    ]);
    expect(t.lines).toEqual([
      { taxable: 62_500_00, cgst: 5_625_00, sgst: 5_625_00, igst: 0 },
      { taxable: 76_080_42, cgst: 6_847_24, sgst: 6_847_24, igst: 0 },
    ]);
    // ₹1,38,580.42 + ₹12,472.24 + ₹12,472.24 = ₹1,63,524.90 → ₹1,63,525 (+₹0.10).
    expect(t).toMatchObject({ taxable_total: 1_38_580_42, cgst_total: 12_472_24, sgst_total: 12_472_24, igst_total: 0, round_off: 10, grand_total: 1_63_525_00, sgst_label: "SGST" });
  });

  test("to Delhi: IGST; the odd paisa of a ₹1,333.33 job-work rate", () => {
    // 3 × ₹1,333.33 = ₹3,999.99; 18% = ₹719.9982 → ₹720.00; ₹4,719.99 → ₹4,720 (+₹0.01).
    const t = sale(DL, [line("998898", 3, 0, 1_333_33, 18)]);
    expect(t.lines).toEqual([{ taxable: 3_999_99, cgst: 0, sgst: 0, igst: 720_00 }]);
    expect(t).toMatchObject({ igst_total: 720_00, round_off: 1, grand_total: 4_720_00 });
  });

  test("an odd tax splits with CGST taking the extra paisa; round-off can go down", () => {
    // 7 × ₹15.23 = ₹106.61; 5% = ₹5.3305 → ₹5.33 → CGST ₹2.67, SGST ₹2.66; ₹111.94 → ₹112 (+6).
    expect(sale(HR, [line("73181500", 7, 0, 15_23, 5)])).toMatchObject({ lines: [{ taxable: 106_61, cgst: 2_67, sgst: 2_66 }], round_off: 6, grand_total: 112_00 });
    // Down: 1 × ₹1,234.49 at 0% → ₹1,234 (−₹0.49).
    expect(sale(HR, [line("7318", 1, 0, 1_234_49, 0)])).toMatchObject({ round_off: -49, grand_total: 1_234_00 });
  });

  test("HSN summary: lines with the same HSN and rate add up", () => {
    const t = sale(HR, [line("73181500", 100, 0, 10_00, 18), line("72142090", 1000, 3, 50_00, 18), line("73181500", 50, 0, 20_00, 18)]);
    expect(t.hsn_summary).toEqual([
      { hsn: "72142090", gstPercent: 18, taxable: 50_00, cgst: 4_50, sgst: 4_50, igst: 0 },
      { hsn: "73181500", gstPercent: 18, taxable: 2_000_00, cgst: 180_00, sgst: 180_00, igst: 0 },
    ]);
  });
});

describe("purchases: the party is the supplier", () => {
  const purchase = (partyState: string, type = "purchase_bill") =>
    documentTotals({ type, companyState: HR, partyState, placeOfSupply: HR, lines: [line("72142090", 2_000_000, 3, 58_00, 18)] }); // 2 t × ₹58/kg = ₹1,16,000
  test("from a Delhi supplier, delivered to us in Haryana: IGST", () => {
    expect(purchase(DL)).toMatchObject({ taxable_total: 1_16_000_00, igst_total: 20_880_00, cgst_total: 0, grand_total: 1_36_880_00 });
    expect(purchase(DL, "purchase_order")).toMatchObject({ igst_total: 20_880_00 });
  });
  test("from a Haryana supplier: CGST + SGST", () => {
    expect(purchase(HR)).toMatchObject({ cgst_total: 10_440_00, sgst_total: 10_440_00, igst_total: 0 });
  });
});

test("a line without an HSN/SAC is named in the error", () => {
  expect(() => sale(HR, [line("7318", 1, 0, 100, 18), line(null, 1, 0, 100, 18)])).toThrow("Line 2: HSN/SAC must be 4, 6 or 8 digits");
});
