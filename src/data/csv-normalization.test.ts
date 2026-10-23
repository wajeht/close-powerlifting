import { describe, expect, it } from "vite-plus/test";

import {
  REQUIRED_COLUMNS,
  buildColumnIndex,
  nameToSlug,
  normalizeRow,
  usernameFor,
} from "./csv-normalization";

// ---------- Normalization (CSV row → typed values) ----------

describe("nameToSlug", () => {
  it("strips spaces and lowercases", () => {
    expect(nameToSlug("Ed Coan")).toBe("edcoan");
  });

  it("preserves alphanumerics in disambiguation suffixes", () => {
    expect(nameToSlug("John Smith #1")).toBe("johnsmith1");
  });

  it("strips diacritics via NFKD", () => {
    expect(nameToSlug("Māris Rāzmanis")).toBe("marisrazmanis");
  });

  it("returns empty string for names with no ASCII alphanumerics", () => {
    expect(nameToSlug("山田太郎")).toBe("");
  });
});

describe("usernameFor", () => {
  it("preserves existing ASCII and Latin-name slugs", () => {
    expect(usernameFor("Ed Coan")).toBe("edcoan");
    expect(usernameFor("Māris Rāzmanis")).toBe("marisrazmanis");
    expect(usernameFor("John Smith #1")).toBe("johnsmith1");
    expect(usernameFor("John Smith #2")).toBe("johnsmith2");
    expect(usernameFor("123")).toBe("123");
  });

  it("creates stable identities from the full non-ASCII name", () => {
    const username = usernameFor("山田太郎");
    expect(username).toMatch(/^anon-[a-f0-9]{64}$/);
    expect(usernameFor("山田太郎")).toBe(username);
    expect(usernameFor("田中太郎")).not.toBe(username);
  });

  it("normalizes whitespace and canonically equivalent Unicode names", () => {
    expect(usernameFor("  ガク  ")).toBe(usernameFor("カ\u3099ク"));
  });

  it("keeps non-ASCII names and disambiguation suffixes distinct", () => {
    const usernames = [
      usernameFor("山田太郎 #1"),
      usernameFor("山田太郎 #2"),
      usernameFor("田中太郎 #1"),
      usernameFor("山田太郎"),
    ];
    expect(new Set(usernames).size).toBe(usernames.length);
    for (const username of usernames) {
      expect(username).toMatch(/^anon-[a-f0-9]{64}$/);
    }
  });
});

describe("buildColumnIndex", () => {
  it("returns indexes for every required column", () => {
    const header = REQUIRED_COLUMNS.map((c) => c);
    const idx = buildColumnIndex(header);
    expect(idx.Name).toBe(0);
    expect(idx.Sanctioned).toBe(header.length - 1);
  });

  it("throws if a required column is missing", () => {
    const header = REQUIRED_COLUMNS.slice(1) as unknown as string[];
    expect(() => buildColumnIndex(header)).toThrow(/CSV header missing required column: Name/);
  });
});

describe("normalizeRow", () => {
  const header = REQUIRED_COLUMNS.map((c) => c);
  const cols = buildColumnIndex(header);

  function buildRow(
    overrides: Partial<Record<(typeof REQUIRED_COLUMNS)[number], string>>,
  ): string[] {
    const row: string[] = Array.from({ length: REQUIRED_COLUMNS.length }, () => "");
    const defaults: Record<string, string> = {
      Name: "John Smith",
      Event: "SBD",
      Equipment: "Raw",
      Date: "2024-05-12",
      Federation: "WRPF",
      MeetName: "Demo Meet",
      Sex: "M",
      Tested: "No",
      Sanctioned: "Yes",
      TotalKg: "1000",
      Best3SquatKg: "400",
      Best3BenchKg: "250",
      Best3DeadliftKg: "350",
      Dots: "700",
      Wilks: "680",
      Place: "1",
    };
    const merged = { ...defaults, ...overrides };
    for (const [key, value] of Object.entries(merged)) {
      const idx = cols[key as (typeof REQUIRED_COLUMNS)[number]];
      row[idx] = value;
    }
    return row;
  }

  it("returns null when the date is malformed", () => {
    const row = buildRow({ Date: "not-a-date" });
    expect(normalizeRow(row, cols)).toBeNull();
  });

  it("returns null when the event is unrecognised", () => {
    const row = buildRow({ Event: "XYZ" });
    expect(normalizeRow(row, cols)).toBeNull();
  });

  it("synthesises the meet path from federation/date/meetName", () => {
    const row = buildRow({
      Federation: "WRPF-UK",
      Date: "2024-05-12",
      MeetName: "British Open #2",
    });
    const result = normalizeRow(row, cols);
    expect(result).not.toBeNull();
    expect(result!.meetPath).toBe("wrpfuk/2024-05-12/britishopen2");
    expect(result!.meet.path).toBe("wrpfuk/2024-05-12/britishopen2");
  });

  it("splits Place into rank vs status", () => {
    const placed = normalizeRow(buildRow({ Place: "3" }), cols)!;
    expect(placed.entry.placeRank).toBe(3);
    expect(placed.entry.placeStatus).toBeNull();

    const dq = normalizeRow(buildRow({ Place: "DQ" }), cols)!;
    expect(dq.entry.placeRank).toBeNull();
    expect(dq.entry.placeStatus).toBe("DQ");
  });

  it("coerces Yes/No → boolean for tested + sanctioned", () => {
    const row = buildRow({ Tested: "Yes", Sanctioned: "No" });
    const result = normalizeRow(row, cols)!;
    expect(result.entry.tested).toBe(true);
    expect(result.meet.sanctioned).toBe(false);
  });

  it("treats negative WeightClassKg as the under-class encoding", () => {
    const result = normalizeRow(buildRow({ WeightClassKg: "-93" }), cols)!;
    expect(result.entry.weightClassKg).toBe(-93);
  });

  it("emits a username via the OPL slug rule", () => {
    const result = normalizeRow(buildRow({ Name: "John Smith #1" }), cols)!;
    expect(result.lifterUsername).toBe("johnsmith1");
    expect(result.lifterName).toBe("John Smith #1");
  });

  it("keeps repeated non-ASCII athlete rows together after reordering", () => {
    const firstMeet = buildRow({ Name: "山田太郎", Date: "2024-05-12" });
    const secondMeet = buildRow({ Name: "山田太郎", Date: "2025-05-12" });
    const otherAthlete = buildRow({ Name: "田中太郎" });
    const originalRows = [firstMeet, otherAthlete, secondMeet];
    const reorderedRows = [secondMeet, firstMeet, otherAthlete];
    const originalUsernames = [];
    const reorderedUsernames = [];
    for (const row of originalRows) {
      originalUsernames.push(normalizeRow(row, cols)?.lifterUsername);
    }
    for (const row of reorderedRows) {
      reorderedUsernames.push(normalizeRow(row, cols)?.lifterUsername);
    }

    expect(originalUsernames[0]).toBe(usernameFor("山田太郎"));
    expect(originalUsernames[2]).toBe(originalUsernames[0]);
    expect(reorderedUsernames).toEqual([
      originalUsernames[2],
      originalUsernames[0],
      originalUsernames[1],
    ]);
    expect(originalUsernames[1]).not.toBe(originalUsernames[0]);
  });
});
