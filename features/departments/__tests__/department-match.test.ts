import { describe, it, expect } from "vitest";
import { departmentKey, matchDepartment } from "../utils/department-match";

/** The institution's departments, as in production. */
const DEPARTMENTS = [
  { code: "CHEM", name: "Chemical Engineering" },
  { code: "COMP", name: "Computer Engineering" },
  { code: "EXTC", name: "Electronics and Telecommunication" },
  { code: "INSTRU", name: "Instrumentation Engineering" },
  { code: "IT", name: "Information Technology" },
  { code: "MECH", name: "Mechanical Engineering" },
];

const codeOf = (value: string) => matchDepartment(value, DEPARTMENTS)?.code ?? null;

describe("matchDepartment", () => {
  it("reads every common way of writing Computer as COMP", () => {
    for (const value of [
      "COMP",
      "comp",
      "comps",
      "Comps",
      "Computer",
      "computer engineering",
      "Computer Engineering",
      "COMPUTER SCIENCE ENGINEERING",
      "Computer Science & Engineering",
      "computer science and engg.",
      "CSE",
      "cs",
      "Dept. of Computer Engineering",
      "B.E. Computer",
      "  comp  ",
    ]) {
      expect(codeOf(value), value).toBe("COMP");
    }
  });

  it("forgives a small typo in a longer value", () => {
    expect(codeOf("cpmps")).toBe("COMP");
    expect(codeOf("computr")).toBe("COMP");
    expect(codeOf("mechanicl")).toBe("MECH");
    expect(codeOf("instrumentaion")).toBe("INSTRU");
  });

  it("reads the other departments by code, name and short form", () => {
    expect(codeOf("it")).toBe("IT");
    expect(codeOf("Information Technology")).toBe("IT");
    expect(codeOf("E&TC")).toBe("EXTC");
    expect(codeOf("ENTC")).toBe("EXTC");
    expect(codeOf("Electronics & Telecommunication Engg")).toBe("EXTC");
    expect(codeOf("Mechanical")).toBe("MECH");
    expect(codeOf("chemical engg")).toBe("CHEM");
    expect(codeOf("Instrumentation")).toBe("INSTRU");
  });

  it("never turns a short code into another one — those must be exact", () => {
    expect(codeOf("ot")).toBeNull();
    expect(codeOf("cx")).toBeNull();
    expect(codeOf("xyz")).toBeNull();
  });

  it("does not guess at something that is not a department", () => {
    expect(codeOf("Civil")).toBeNull();
    expect(codeOf("Biotechnology")).toBeNull();
    expect(codeOf("")).toBeNull();
    expect(codeOf("---")).toBeNull();
  });

  it("refuses a value equally close to two departments", () => {
    const twins = [
      { code: "AAAA", name: "Alpha" },
      { code: "AAAB", name: "Beta" },
    ];
    expect(matchDepartment("AAAC", twins)).toBeNull();
  });

  it("matches a department it has no short forms for by its code and name", () => {
    const civil = [...DEPARTMENTS, { code: "CIVIL", name: "Civil Engineering" }];
    expect(matchDepartment("civil engg", civil)?.code).toBe("CIVIL");
    expect(matchDepartment("CIVIL", civil)?.code).toBe("CIVIL");
  });
});

describe("departmentKey", () => {
  it("ignores case, punctuation, '&' and filler words", () => {
    expect(departmentKey("Computer Sci. & Engg.")).toBe("computersci");
    expect(departmentKey("DEPT OF MECHANICAL ENGINEERING")).toBe("mechanical");
  });
});
