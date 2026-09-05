import {
  findEmptyListMarkers,
  normalizeStrictOutliner,
} from "../normalizeStrictOutliner";

describe("normalizeStrictOutliner", () => {
  test("turns an empty document into an empty bullet", () => {
    expect(normalizeStrictOutliner("", "  ").text).toBe("- ");
  });

  test("turns every plain and blank line into a bullet", () => {
    const result = normalizeStrictOutliner(
      "one\n\n  note\n        - too deep",
      "  ",
    );

    expect(result.text).toBe("- one\n- \n  - note\n    - too deep");
  });

  test("canonicalizes indentation and clamps level jumps", () => {
    const result = normalizeStrictOutliner(
      "- root\n          - jumped\n    child note\n- back",
      "  ",
    );

    expect(result.text).toBe("- root\n  - jumped\n    - child note\n- back");
  });

  test("preserves supported bullet and checkbox content", () => {
    const result = normalizeStrictOutliner(
      "+ one\n  * [ ] two\n    3. three",
      "  ",
    );

    expect(result.text).toBe("+ one\n  * [ ] two\n    3. three");
  });

  test("maps a plain-line cursor to the new content", () => {
    const result = normalizeStrictOutliner("  plain", "  ");

    expect(result.mapPosition({ line: 0, ch: 4 })).toEqual({
      line: 0,
      ch: 4,
    });
  });

  test("maps a cursor out of a malformed bullet prefix", () => {
    const result = normalizeStrictOutliner("      - text", "  ");

    expect(result.text).toBe("- text");
    expect(result.mapPosition({ line: 0, ch: 0 })).toEqual({
      line: 0,
      ch: 2,
    });
  });

  test("preserves YAML frontmatter while normalizing the note body", () => {
    const result = normalizeStrictOutliner(
      [
        "---",
        "tags:",
        "  - person",
        'city: "[[Antakya]]"',
        "irl: true",
        "---",
        "Phone: 123",
      ].join("\n"),
      "  ",
    );

    expect(result.text).toBe(
      [
        "---",
        "tags:",
        "  - person",
        'city: "[[Antakya]]"',
        "irl: true",
        "---",
        "- Phone: 123",
      ].join("\n"),
    );
    expect(result.mapPosition({ line: 3, ch: 8 })).toEqual({
      line: 3,
      ch: 8,
    });
  });

  test("only treats a top-of-file delimiter as YAML frontmatter", () => {
    const result = normalizeStrictOutliner("one\n---\ntwo", "  ");

    expect(result.text).toBe("- one\n- ---\n- two");
  });

  test("preserves backtick fenced code blocks including blank lines", () => {
    const result = normalizeStrictOutliner(
      ["example", "", "```ts", "const value = 1;", "", "```", "", "after"].join(
        "\n",
      ),
      "  ",
    );

    expect(result.text).toBe(
      [
        "- example",
        "",
        "```ts",
        "const value = 1;",
        "",
        "```",
        "",
        "- after",
      ].join("\n"),
    );
  });

  test("preserves indented tilde fenced code blocks", () => {
    const result = normalizeStrictOutliner(
      ["- example", "  ~~~~", "  code", "  ~~~~", "plain"].join("\n"),
      "  ",
    );

    expect(result.text).toBe(
      ["- example", "  ~~~~", "  code", "  ~~~~", "- plain"].join("\n"),
    );
  });

  test("preserves fenced code blocks nested as list items", () => {
    const result = normalizeStrictOutliner(
      [
        "- example",
        "  - ```ts",
        "    const value = 1;",
        "  - ```",
        "after",
      ].join("\n"),
      "  ",
    );

    expect(result.text).toBe(
      [
        "- example",
        "  - ```ts",
        "    const value = 1;",
        "  - ```",
        "- after",
      ].join("\n"),
    );
  });

  test("preserves Markdown table rows", () => {
    const result = normalizeStrictOutliner(
      [
        "prices",
        "",
        "| Hospital | Cost |",
        "| --- | ---: |",
        "| Acibadem | 420 |",
        "",
        "after",
      ].join("\n"),
      "  ",
    );

    expect(result.text).toBe(
      [
        "- prices",
        "",
        "| Hospital | Cost |",
        "| --- | ---: |",
        "| Acibadem | 420 |",
        "",
        "- after",
      ].join("\n"),
    );
  });

  test("maps a cursor out of an existing empty bullet prefix", () => {
    const result = normalizeStrictOutliner("- ", "  ");

    expect(result.mapPosition({ line: 0, ch: 0 })).toEqual({
      line: 0,
      ch: 2,
    });
  });

  test("treats a bare marker as an empty bullet instead of content", () => {
    expect(normalizeStrictOutliner("-", "  ").text).toBe("- ");
    expect(normalizeStrictOutliner("  *", "  ").text).toBe("* ");
    expect(normalizeStrictOutliner("1.", "  ").text).toBe("1. ");
  });

  test("keeps the indent of a bare nested marker", () => {
    expect(normalizeStrictOutliner("- a\n  *", "  ").text).toBe("- a\n  * ");
  });

  test("maps a cursor out of a bare marker", () => {
    const result = normalizeStrictOutliner("-", "  ");

    expect(result.mapPosition({ line: 0, ch: 1 })).toEqual({
      line: 0,
      ch: 2,
    });
  });

  test("leaves table rows under construction alone", () => {
    expect(normalizeStrictOutliner("| a", "  ").text).toBe("| a");
    expect(normalizeStrictOutliner("- todo\n| a", "  ").text).toBe(
      "- todo\n| a",
    );
  });

  test("still bullets lines with pipes elsewhere", () => {
    expect(normalizeStrictOutliner("a | b", "  ").text).toBe("- a | b");
  });

  test("preserves tables without outer pipes", () => {
    const table = "a | b\n--- | ---\nc | d\ne | f";

    expect(normalizeStrictOutliner(table, "  ").text).toBe(table);
  });

  test("does not mistake setext headings for tables", () => {
    expect(normalizeStrictOutliner("Title\n---\nbody", "  ").text).toBe(
      "- Title\n- ---\n- body",
    );
  });

  test("unwraps a table swallowed by list syntax", () => {
    expect(
      normalizeStrictOutliner("- |  |  |\n|--|--|\n|  |  |", "  ").text,
    ).toBe("|  |  |\n|--|--|\n|  |  |");
  });

  test("unwraps a lone pipe-content bullet like its bare row", () => {
    expect(normalizeStrictOutliner("- | a |", "  ").text).toBe("| a |");
  });

  test("keeps a single-pipe bullet without table context", () => {
    expect(normalizeStrictOutliner("- x\n- | foo", "  ").text).toBe(
      "- x\n- | foo",
    );
  });
});

describe("findEmptyListMarkers", () => {
  test("finds unordered and numbered empty markers only", () => {
    expect(findEmptyListMarkers("- \n  *\n1. \n- content")).toEqual([
      { from: 0, to: 1 },
      { from: 5, to: 6 },
      { from: 7, to: 9 },
    ]);
  });
});
