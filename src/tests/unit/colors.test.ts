import { expect, it } from "vitest";
import { hexToRgba, rgbaEquals, rgbaToHex } from "@/lib/pixels/colors";

it.each(["#00000000", "#FFFFFFFF", "#12345680", "#ABCDEF00", "#010203FF"])("conserva exactamente %s", (hex) => {
  expect(rgbaToHex(hexToRgba(hex.toLowerCase()))).toBe(hex);
});

it.each(["#FFFFFF", "#000000000", "FFFFFFFF", "#GG000000", " #00000000", "#00000000\n", "", null])("rechaza %s", (hex) => {
  expect(() => hexToRgba(hex as string)).toThrowError(expect.objectContaining({ code: "INVALID_COLOR" }));
});

it("compara alfa y conserva RGB con transparencia total", () => {
  expect(hexToRgba("#12345600")).toEqual([18, 52, 86, 0]);
  expect(rgbaEquals([1, 2, 3, 0], [1, 2, 3, 128])).toBe(false);
  expect(rgbaEquals([1, 2, 3, 255], [1, 2, 3, 255])).toBe(true);
  expect(() => rgbaToHex([256, 0, 0, 0])).toThrow();
});
