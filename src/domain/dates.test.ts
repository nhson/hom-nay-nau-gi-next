import { describe, expect, it } from "vitest";
import { daysBetween, formatDayMonth, localDateString } from "./dates";

describe("localDateString", () => {
  it("formats the device-local calendar date with zero padding", () => {
    expect(localDateString(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
    expect(localDateString(new Date(2026, 9, 13, 0, 1))).toBe("2026-10-13");
  });
});

describe("daysBetween", () => {
  it("counts whole days, including across month and leap-year boundaries", () => {
    expect(daysBetween("2026-10-10", "2026-10-13")).toBe(3);
    expect(daysBetween("2026-09-30", "2026-10-01")).toBe(1);
    expect(daysBetween("2028-02-28", "2028-03-01")).toBe(2);
  });

  it("is negative for a later `from` and zero for the same day", () => {
    expect(daysBetween("2026-10-13", "2026-10-13")).toBe(0);
    expect(daysBetween("2026-10-14", "2026-10-13")).toBe(-1);
  });

  it("is NaN for malformed dates", () => {
    expect(daysBetween("not-a-date", "2026-10-13")).toBeNaN();
    expect(daysBetween("2026-10-13", "13/10/2026")).toBeNaN();
  });
});

describe("formatDayMonth", () => {
  it("renders dd/mm", () => {
    expect(formatDayMonth("2026-10-13")).toBe("13/10");
  });

  it("returns malformed input unchanged", () => {
    expect(formatDayMonth("oops")).toBe("oops");
  });
});
