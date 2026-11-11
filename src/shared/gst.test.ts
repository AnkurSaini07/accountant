import { describe, expect, test } from "bun:test";
import { calculateGst, type GstLineInput } from "./gst.ts";

const HARYANA = "06";
const DELHI = "07";
const CHANDIGARH = "04";

const line = (over: Partial<GstLineInput> = {}): GstLineInput => ({ hsn: "7318", qty: 1, rate: 100000, gstPercent: 18, ...over });
const intra = (lines: GstLineInput[]) => calculateGst({ supplierState: HARYANA, placeOfSupply: HARYANA, lines });
const inter = (lines: GstLineInput[]) => calculateGst({ supplierState: HARYANA, placeOfSupply: DELHI, lines });

describe("tax type by place of supply", () => {
  test("intra-state: CGST + SGST", () => {
    const r = intra([line()]); // ₹1,000 @ 18%
    expect(r.interState).toBe(false);
    expect(r.sgstLabel).toBe("SGST");
    expect([r.taxable, r.cgst, r.sgst, r.igst]).toEqual([100000, 9000, 9000, 0]);
    expect(r.grandTotal).toBe(118000);
  });

  test("inter-state: IGST", () => {
    const r = inter([line()]);
    expect(r.interState).toBe(true);
    expect([r.taxable, r.cgst, r.sgst, r.igst]).toEqual([100000, 0, 0, 18000]);
    expect(r.grandTotal).toBe(118000);
  });

  test("within a UT without a legislature the second half is UTGST", () => {
    const r = calculateGst({ supplierState: CHANDIGARH, placeOfSupply: CHANDIGARH, lines: [line()] });
    expect(r.sgstLabel).toBe("UTGST");
    expect([r.cgst, r.sgst]).toEqual([9000, 9000]);
    // Delhi has a legislature: SGST.
    expect(calculateGst({ supplierState: DELHI, placeOfSupply: DELHI, lines: [line()] }).sgstLabel).toBe("SGST");
  });

  test("state codes accept numbers-as-strings like '6'", () => {
    expect(calculateGst({ supplierState: "6", placeOfSupply: "06", lines: [line()] }).interState).toBe(false);
  });
});

describe("the CGST/SGST split never loses a paisa", () => {
  test("odd tax: CGST takes the extra paisa", () => {
    const [l] = intra([line({ rate: 1003 })]).lines; // ₹10.03 @ 18% = 180.54 → 181 paise
    expect([l!.cgst, l!.sgst]).toEqual([91, 90]);
    expect(l!.cgst + l!.sgst).toBe(inter([line({ rate: 1003 })]).lines[0]!.igst);
  });

  test("for many amounts and rates, CGST + SGST equals IGST and CGST − SGST is 0 or 1", () => {
    for (let rate = 1; rate <= 2000; rate += 7) {
      for (const gstPercent of [0, 0.25, 3, 5, 12, 18, 28, 40]) {
        const a = intra([line({ rate, gstPercent, qty: "1.5", discountPercent: "2.5" })]).lines[0]!;
        const b = inter([line({ rate, gstPercent, qty: "1.5", discountPercent: "2.5" })]).lines[0]!;
        expect(a.cgst + a.sgst).toBe(b.igst);
        expect(a.cgst - a.sgst === 0 || a.cgst - a.sgst === 1).toBe(true);
      }
    }
  });
});

describe("lines", () => {
  test("discount applies before tax", () => {
    const [l] = intra([line({ qty: 10, rate: 25050, discountPercent: 10 })]).lines; // 10 × ₹250.50, 10% off
    expect(l).toMatchObject({ gross: 250500, discount: 25050, taxable: 225450, cgst: 20291, sgst: 20290, total: 266031 });
  });

  test("fractional quantity is exact", () => {
    expect(intra([line({ qty: "2.345", rate: 1999, gstPercent: 0 })]).lines[0]!.taxable).toBe(4688); // 46.87655 → 46.88
  });

  test("0% (nil-rated) and exempt lines carry no tax", () => {
    const r = intra([line({ gstPercent: 0 }), line({ hsn: "1001", gstPercent: 5, exempt: true })]);
    expect(r.lines.map((l) => [l.cgst + l.sgst + l.igst, l.exempt])).toEqual([[0, false], [0, true]]);
    expect(r.grandTotal).toBe(200000);
  });

  test.each([
    [{ hsn: "73" }, /HSN\/SAC must be 4, 6 or 8 digits/],
    [{ hsn: "73181" }, /HSN/],
    [{ qty: 0 }, /quantity must be more than 0/],
    [{ qty: "-1" }, /quantity/],
    [{ qty: "abc" }, /quantity/],
    [{ rate: -1 }, /rate can't be negative/],
    [{ rate: 1.5 }, /Not a valid paise amount/],
    [{ discountPercent: 101 }, /discount % must be between 0 and 100/],
    [{ gstPercent: -5 }, /GST % must be between 0 and 100/],
    [{ gstPercent: "x" }, /GST %/],
  ] as const)("rejects %p", (over, message) => {
    expect(() => intra([line(), line(over as Partial<GstLineInput>)])).toThrow(message);
    expect(() => intra([line(), line(over as Partial<GstLineInput>)])).toThrow(/^Line 2:|Not a valid/);
  });

  test("rejects unknown states", () => {
    expect(() => calculateGst({ supplierState: "99", placeOfSupply: HARYANA, lines: [] })).toThrow(/supplier state/);
    expect(() => calculateGst({ supplierState: HARYANA, placeOfSupply: "00", lines: [] })).toThrow(/place of supply/);
  });
});

describe("totals and round-off", () => {
  test("rounds down below 50 paise", () => {
    const r = intra([line({ rate: 10000, gstPercent: 0 }), line({ rate: 49, gstPercent: 0 })]); // ₹100.49
    expect([r.totalBeforeRoundOff, r.roundOff, r.grandTotal]).toEqual([10049, -49, 10000]);
  });

  test("rounds up at and above 50 paise", () => {
    expect(intra([line({ rate: 10050, gstPercent: 0 })]).roundOff).toBe(50);
    expect(intra([line({ rate: 10050, gstPercent: 0 })]).grandTotal).toBe(10100);
    expect(intra([line({ rate: 10099, gstPercent: 0 })]).roundOff).toBe(1);
  });

  test("already whole rupees: no round-off", () => {
    expect(intra([line()]).roundOff).toBe(0);
  });

  test("totals equal the sum of lines", () => {
    const r = intra([line({ rate: 1003 }), line({ rate: 2507, qty: 3, discountPercent: 5, gstPercent: 12 }), line({ rate: 999, gstPercent: 28 })]);
    expect(r.totalBeforeRoundOff).toBe(r.lines.reduce((t, l) => t + l.total, 0));
    expect(r.grandTotal % 100).toBe(0);
    expect(r.grandTotal - r.roundOff).toBe(r.totalBeforeRoundOff);
  });

  test("no lines: all zero", () => {
    expect(intra([])).toMatchObject({ taxable: 0, grandTotal: 0, roundOff: 0, hsnSummary: [] });
  });
});

describe("HSN summary", () => {
  test("groups by HSN and rate, sorted, with exempt kept apart", () => {
    const r = intra([
      line({ hsn: "8481", rate: 50000 }),
      line({ hsn: "7318", rate: 10000 }),
      line({ hsn: "8481", rate: 30000 }),
      line({ hsn: "8481", rate: 20000, gstPercent: 12 }),
      line({ hsn: "1001", rate: 5000, gstPercent: 5, exempt: true }),
    ]);
    expect(r.hsnSummary).toEqual([
      { hsn: "1001", gstPercent: 0, taxable: 5000, cgst: 0, sgst: 0, igst: 0 },
      { hsn: "7318", gstPercent: 18, taxable: 10000, cgst: 900, sgst: 900, igst: 0 },
      { hsn: "8481", gstPercent: 12, taxable: 20000, cgst: 1200, sgst: 1200, igst: 0 },
      { hsn: "8481", gstPercent: 18, taxable: 80000, cgst: 7200, sgst: 7200, igst: 0 },
    ]);
    const summed = (k: "taxable" | "cgst") => r.hsnSummary.reduce((t, s) => t + s[k], 0);
    expect([summed("taxable"), summed("cgst")]).toEqual([r.taxable, r.cgst]);
  });
});
