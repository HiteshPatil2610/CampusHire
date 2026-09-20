import { describe, it, expect } from "vitest";
import {
  EXPORT_DATASETS,
  applicationInDataset,
  exportColumns,
  exportFilename,
  isExportDataset,
  projectRow,
} from "../domain/export-datasets";
import { csvCell, rowsToCsv } from "@/lib/csv-format";

/**
 * What can be exported, and what an export may contain — pure rules, checked
 * without a database.
 */

describe("dataset names", () => {
  it("accepts exactly the datasets that exist", () => {
    for (const dataset of EXPORT_DATASETS) expect(isExportDataset(dataset)).toBe(true);
    expect(isExportDataset("students")).toBe(false);
    expect(isExportDataset("../../etc/passwd")).toBe(false);
    expect(isExportDataset(undefined)).toBe(false);
    expect(isExportDataset({ toString: () => "applicants" })).toBe(false);
  });
});

describe("which application is in which dataset", () => {
  const at = (status: "IN_PROGRESS" | "SELECTED" | "REJECTED" | "WITHDRAWN", stageType: never) => ({
    status,
    stageType,
  });

  it("applicants is everyone, withdrawn included", () => {
    expect(applicationInDataset("applicants", at("WITHDRAWN", "APPLICATION" as never))).toBe(true);
  });

  it("shortlisted is in progress and past screening", () => {
    expect(applicationInDataset("shortlisted", at("IN_PROGRESS", "CODING" as never))).toBe(true);
    expect(applicationInDataset("shortlisted", at("IN_PROGRESS", "APPLICATION" as never))).toBe(false);
    expect(applicationInDataset("shortlisted", at("REJECTED", "CODING" as never))).toBe(false);
    expect(applicationInDataset("shortlisted", { status: "IN_PROGRESS", stageType: null })).toBe(false);
  });

  it("test and interview are told apart by the stage they are at", () => {
    expect(applicationInDataset("test", at("IN_PROGRESS", "APTITUDE" as never))).toBe(true);
    expect(applicationInDataset("test", at("IN_PROGRESS", "HR_INTERVIEW" as never))).toBe(false);
    expect(applicationInDataset("interview", at("IN_PROGRESS", "HR_INTERVIEW" as never))).toBe(true);
    expect(applicationInDataset("interview", at("IN_PROGRESS", "GROUP_DISCUSSION" as never))).toBe(true);
    expect(applicationInDataset("interview", at("IN_PROGRESS", "CODING" as never))).toBe(false);
  });

  it("a finished application is no longer 'in a round'", () => {
    expect(applicationInDataset("test", at("REJECTED", "CODING" as never))).toBe(false);
    expect(applicationInDataset("interview", at("SELECTED", "HR_INTERVIEW" as never))).toBe(false);
  });

  it("selected and rejected are the outcome", () => {
    expect(applicationInDataset("selected", at("SELECTED", "OFFER" as never))).toBe(true);
    expect(applicationInDataset("selected", at("IN_PROGRESS", "OFFER" as never))).toBe(false);
    expect(applicationInDataset("rejected", at("REJECTED", "CODING" as never))).toBe(true);
  });
});

describe("columns are an allowlist per role", () => {
  it("never includes an internal id, a credential or a marksheet link", () => {
    for (const dataset of EXPORT_DATASETS) {
      for (const role of ["DEPT_ADMIN", "SUPER_ADMIN"] as const) {
        const columns = exportColumns(dataset, role).join("|").toLowerCase();
        expect(columns).not.toMatch(/\bid\b|clerk|password|token|marksheet|url|phone/);
      }
    }
  });

  it("gives only the Super Admin a department column, since only theirs spans departments", () => {
    expect(exportColumns("applicants", "DEPT_ADMIN")).not.toContain("Department");
    expect(exportColumns("applicants", "SUPER_ADMIN")[0]).toBe("Department");
  });

  it("writes only the allowed columns, in order, whatever the row holds", () => {
    const row = {
      Name: "Asha",
      Email: "asha@college.edu",
      "Clerk id": "user_123",
      "Marksheet url": "https://blob/x.pdf",
      Extra: "leak",
    };

    const projected = projectRow(row, ["Name", "Email", "CGPA"]);

    expect(Object.keys(projected)).toEqual(["Name", "Email", "CGPA"]);
    expect(projected.CGPA).toBeNull();
    expect(JSON.stringify(projected)).not.toContain("user_123");
    expect(JSON.stringify(projected)).not.toContain("blob");
  });
});

describe("the file", () => {
  it("has a name nothing can object to", () => {
    expect(exportFilename("Tata Consultancy Services (TCS)!", "selected", new Date("2026-09-20T10:00:00Z"))).toBe(
      "tata-consultancy-services-tcs-selected-2026-09-20"
    );
    expect(exportFilename("../../etc", "test", new Date("2026-09-20T00:00:00Z"))).not.toContain("/");
    expect(exportFilename("!!!", "placed", new Date("2026-09-20T00:00:00Z"))).toContain("drive-placed");
  });

  it("defuses a value a spreadsheet would run as a formula", () => {
    expect(csvCell('=HYPERLINK("http://evil","x")')).toBe(`"'=HYPERLINK(""http://evil"",""x"")"`);
    expect(csvCell("+91 98765")).toBe("'+91 98765");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    // Numbers are numbers, including negative ones.
    expect(csvCell(-1)).toBe("-1");
    expect(csvCell(8.5)).toBe("8.5");
  });

  it("quotes commas, quotes and newlines and leaves nothing null as text", () => {
    expect(csvCell("Doe, John")).toBe('"Doe, John"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("a\nb")).toBe('"a\nb"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  it("builds its header from the allowlist even when there are no rows", () => {
    expect(rowsToCsv([], ["Name", "Email"])).toBe("Name,Email");
  });

  it("writes the columns it was told to, not the ones the row happens to have", () => {
    const csv = rowsToCsv([{ Name: "Asha", Secret: "x" }], ["Name"]);

    expect(csv).toBe("Name\nAsha");
  });
});
