import {
  decideEmptyBulletBackspace,
  isEmptyBullet,
  isEmptyTopLevelBullet,
  isListItem,
  isProtectedLine,
  isProtectedLineInDoc,
  splitPlainLine,
} from "../../keys";

describe("splitPlainLine", () => {
  test("Enter turns a plain line into two outliner items", () => {
    expect(
      splitPlainLine({ line: "plain text", anchorCh: 5, headCh: 5 }),
    ).toEqual({
      insert: "- plain\n-  text",
      cursorOffset: "- plain".length + 1 + 2,
    });
  });

  test("Enter removes a same-line selection while splitting", () => {
    expect(
      splitPlainLine({ line: "plain selected text", anchorCh: 6, headCh: 15 }),
    ).toEqual({
      insert: "- plain \n- text",
      cursorOffset: "- plain ".length + 1 + 2,
    });
  });

  test("preserves indentation for a plain indented line", () => {
    const split = splitPlainLine({ line: "  child", anchorCh: 7, headCh: 7 });

    expect(split?.insert).toBe("  - child\n  - ");
    expect(split?.cursorOffset).toBe("  - child".length + 1 + 4);
  });

  test.each([["- item"], ["  - item"], ["1. item"]])(
    "returns null for list line %s",
    (line) => {
      expect(splitPlainLine({ line, anchorCh: 0, headCh: 0 })).toBeNull();
    },
  );

  test.each([["```"], ["---"], ["| a | b |"], ["| a"]])(
    "returns null for protected line %s",
    (line) => {
      expect(splitPlainLine({ line, anchorCh: 0, headCh: 0 })).toBeNull();
    },
  );
});

describe("isEmptyTopLevelBullet", () => {
  test.each([["- "], ["* "], ["1. "], ["- [ ] "]])(
    "treats %s as an empty top-level bullet",
    (line) => {
      expect(isEmptyTopLevelBullet(line)).toBe(true);
    },
  );

  test.each([["  - "], ["- item"], ["plain"], ["```"]])(
    "does not treat %s as an empty top-level bullet",
    (line) => {
      expect(isEmptyTopLevelBullet(line)).toBe(false);
    },
  );
});

describe("isEmptyBullet", () => {
  test.each([["- "], ["  - "], ["- [ ] "], ["2. "]])(
    "treats %s as an empty bullet",
    (line) => {
      expect(isEmptyBullet(line)).toBe(true);
    },
  );

  test.each([["- item"], ["plain"], [""]])(
    "does not treat %s as an empty bullet",
    (line) => {
      expect(isEmptyBullet(line)).toBe(false);
    },
  );
});

describe("decideEmptyBulletBackspace", () => {
  test.each([["- "], ["  - "], ["- [ ] "], ["1. "]])(
    "keeps the bullet on the first line: %s",
    (lineText) => {
      expect(decideEmptyBulletBackspace({ lineText, lineNumber: 1 })).toBe(
        "keep",
      );
    },
  );

  test.each([["- "], ["  - "], ["- [ ] "], ["2. "]])(
    "merges up on later lines: %s",
    (lineText) => {
      expect(decideEmptyBulletBackspace({ lineText, lineNumber: 3 })).toBe(
        "mergeUp",
      );
    },
  );

  test.each([["- item"], ["plain"], ["```"], ["| a | b |"]])(
    "ignores other lines: %s",
    (lineText) => {
      expect(decideEmptyBulletBackspace({ lineText, lineNumber: 2 })).toBe(
        "ignore",
      );
    },
  );
});

describe("isListItem and isProtectedLine", () => {
  test("detects list items", () => {
    expect(isListItem("- item")).toBe(true);
    expect(isListItem("plain")).toBe(false);
  });

  test("detects protected lines", () => {
    expect(isProtectedLine("```js")).toBe(true);
    expect(isProtectedLine("| a | b |")).toBe(true);
    expect(isProtectedLine("| a")).toBe(true);
    expect(isProtectedLine("---")).toBe(true);
    expect(isProtectedLine("- item")).toBe(false);
    expect(isProtectedLine("a | b")).toBe(false);
  });

  test("detects table rows without outer pipes in context", () => {
    const lines = ["a | b", "--- | ---", "c | d"];

    expect(isProtectedLineInDoc(lines, 0)).toBe(true);
    expect(isProtectedLineInDoc(lines, 1)).toBe(true);
    expect(isProtectedLineInDoc(lines, 2)).toBe(true);
    expect(isProtectedLineInDoc(["- x", "- | foo"], 1)).toBe(false);
    expect(isProtectedLineInDoc(["plain"], 0)).toBe(false);
  });
});
