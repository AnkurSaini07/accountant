import { describe, expect, test } from "bun:test";
import { fyEnd, fyLabel, fyOf, fyShortLabel, fyStart, parseFyLabel, recentFys, todayInIndia } from "./fy.ts";

describe("fyOf", () => {
  test.each([
    ["2026-03-31", 2025], // last day of FY 2025-26
    ["2026-04-01", 2026], // first day of FY 2026-27
    ["2026-01-01", 2025],
    ["2026-12-31", 2026],
    ["2028-02-29", 2027], // leap day belongs to the FY that started the previous April
    ["2000-02-29", 1999], // century leap year
    ["2099-04-01", 2099],
  ])("%s → FY starting %d", (date, start) => {
    expect(fyOf(date)).toBe(start);
  });

  test.each(["2026-02-29", "1900-02-29", "2026-04-31", "2026-13-01", "2026-00-10", "26-04-01", "2026-4-1", "2026-04-01T00:00", ""])(
    "rejects %p",
    (date) => {
      expect(() => fyOf(date)).toThrow(RangeError);
    },
  );
});

describe("labels and boundaries", () => {
  test("labels", () => {
    expect(fyLabel(2026)).toBe("2026-27");
    expect(fyLabel(2099)).toBe("2099-00"); // century rollover
    expect(fyLabel(2008)).toBe("2008-09");
    expect(fyShortLabel(2026)).toBe("26-27");
    expect(fyShortLabel(2099)).toBe("99-00");
  });

  test("start and end dates", () => {
    expect(fyStart(2026)).toBe("2026-04-01");
    expect(fyEnd(2026)).toBe("2027-03-31");
    expect(fyEnd(2027)).toBe("2028-03-31"); // leap year doesn't move the end
    expect(fyOf(fyStart(2026))).toBe(2026);
    expect(fyOf(fyEnd(2026))).toBe(2026);
  });

  test("parseFyLabel round-trips and rejects nonsense", () => {
    expect(parseFyLabel("2026-27")).toBe(2026);
    expect(parseFyLabel(" 2099-00 ")).toBe(2099);
    for (const bad of ["2026-28", "2026-2027", "26-27", "2026/27", "", "abcd-ef"]) {
      expect(() => parseFyLabel(bad)).toThrow(RangeError);
    }
  });
});

describe("today and recent years", () => {
  test("todayInIndia uses IST, not the machine's zone", () => {
    // 31 Mar 2026 19:00 UTC is already 1 Apr 00:30 in India, i.e. a new FY.
    const now = new Date("2026-03-31T19:00:00Z");
    expect(todayInIndia(now)).toBe("2026-04-01");
    expect(fyOf(todayInIndia(now))).toBe(2026);
    expect(todayInIndia(new Date("2026-03-31T18:29:59Z"))).toBe("2026-03-31");
  });

  test("recentFys lists newest first", () => {
    expect(recentFys(3, "2026-11-11")).toEqual([2026, 2025, 2024]);
    expect(recentFys(2, "2026-03-31")).toEqual([2025, 2024]);
    expect(recentFys(1)).toEqual([fyOf(todayInIndia())]);
  });
});
