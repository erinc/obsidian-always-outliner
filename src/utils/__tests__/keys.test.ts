import {
  isEmptyBullet,
  isEmptyTopLevelBullet,
  isListItem,
  isProtectedLine,
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

  test.each([["```"], ["---"], ["| a | b |"]])(
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

describe("isListItem and isProtectedLine", () => {
  test("detects list items", () => {
    expect(isListItem("- item")).toBe(true);
    expect(isListItem("plain")).toBe(false);
  });

  test("detects protected lines", () => {
    expect(isProtectedLine("```js")).toBe(true);
    expect(isProtectedLine("| a | b |")).toBe(true);
    expect(isProtectedLine("---")).toBe(true);
    expect(isProtectedLine("- item")).toBe(false);
  });
});
