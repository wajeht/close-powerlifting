import { describe, expect, it } from "vite-plus/test";

import { REQUIRED_COLUMNS, buildColumnIndex, normalizeRow } from "./csv-normalization";
import { parseWeightClass } from "./weight-class";

describe("weight classes", () => {
  it.each([
    { input: "84", kilograms: 84, over: false },
    { input: "84+", kilograms: 84, over: true },
    { input: " 82.5+ ", kilograms: 82.5, over: true },
    { input: "-93", kilograms: -93, over: false },
  ])("preserves the class boundary for $input", ({ input, kilograms, over }) => {
    expect(parseWeightClass(input)).toEqual({ kilograms, over });
  });

  it.each([undefined, "", "84garbage", "84++", "-84+", "0", "Infinity"])(
    "rejects invalid weight class %s",
    (input) => {
      expect(parseWeightClass(input)).toBeNull();
    },
  );

  it("keeps capped and open-ended classes distinct when ingesting CSV", () => {
    const columns = buildColumnIndex([...REQUIRED_COLUMNS]);
    const row = Array.from({ length: REQUIRED_COLUMNS.length }, () => "");
    row[columns.Name] = "Example Lifter";
    row[columns.Event] = "SBD";
    row[columns.Equipment] = "Raw";
    row[columns.Federation] = "IPF";
    row[columns.Date] = "2024-01-01";
    row[columns.MeetName] = "Example Meet";

    row[columns.WeightClassKg] = "84";
    const capped = normalizeRow(row, columns);
    row[columns.WeightClassKg] = "84+";
    const openEnded = normalizeRow(row, columns);

    expect(capped?.entry).toMatchObject({ weightClassKg: 84, weightClassOver: false });
    expect(openEnded?.entry).toMatchObject({ weightClassKg: 84, weightClassOver: true });
  });
});
