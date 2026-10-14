import {
  decideEmptyBulletBackspace,
  isCursorBeforeContent,
  isEmptyBullet,
  isEmptyTopLevelBullet,
  isListItem,
  isProtectedLine,
  isProtectedLineInDoc,
  outdentEmptyLine,
  splitPlainLine,
} from "../../keys";

describe("splitPlainLine", () => {
  test("Enter splits a plain line into two items with content", () => {
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

    expect(split?.insert).toBe("  - child\n  ");
    expect(split?.cursorOffset).toBe("  - child".length + 1 + 2);
  });

  test("Enter at the start keeps the first line empty", () => {
    expect(splitPlainLine({ line: "plain", anchorCh: 0, headCh: 0 })).toEqual({
      insert: "\n- plain",
      cursorOffset: 3,
    });
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

  test("merges a marker-free blank line up", () => {
    expect(decideEmptyBulletBackspace({ lineText: "  ", lineNumber: 2 })).toBe(
      "mergeUp",
    );
  });
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

describe("outdentEmptyLine", () => {
  test("has nothing to outdent at the top level", () => {
    expect(outdentEmptyLine("", "\t")).toBeNull();
  });

  test("removes one tab", () => {
    expect(outdentEmptyLine("\t\t", "\t")).toBe("\t");
    expect(outdentEmptyLine("\t", "\t")).toBe("");
  });

  test("removes one space indent unit", () => {
    expect(outdentEmptyLine("        ", "    ")).toBe("    ");
    expect(outdentEmptyLine("  ", "  ")).toBe("");
  });
});

describe("isCursorBeforeContent", () => {
  test("is true at the start of a bullet's content", () => {
    expect(isCursorBeforeContent("- foo", 0)).toBe(true);
    expect(isCursorBeforeContent("- foo", 2)).toBe(true);
    expect(isCursorBeforeContent("\t- foo", 3)).toBe(true);
    expect(isCursorBeforeContent("- [ ] foo", 6)).toBe(true);
    expect(isCursorBeforeContent("  plain", 2)).toBe(true);
  });

  test("is false once the cursor is inside or after the content", () => {
    expect(isCursorBeforeContent("- foo", 3)).toBe(false);
    expect(isCursorBeforeContent("- [ ] foo", 7)).toBe(false);
    expect(isCursorBeforeContent("- foo", 5)).toBe(false);
  });

  test("is false for empty lines", () => {
    expect(isCursorBeforeContent("", 0)).toBe(false);
    expect(isCursorBeforeContent("\t", 1)).toBe(false);
  });
});
