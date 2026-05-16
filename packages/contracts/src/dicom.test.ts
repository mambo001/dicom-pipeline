import { describe, expect, it } from "vitest";
import { createDeidentificationReport } from "./dicom";

describe("createDeidentificationReport", () => {
  it("wraps findings with contract metadata", () => {
    expect(
      createDeidentificationReport({
        rulesetId: "prototype-basic-phi-v1",
        findings: [{ tag: "0010,0010", name: "Patient Name", action: "replaced" }]
      })
    ).toEqual({
      version: 1,
      kind: "deidentification_report",
      rulesetId: "prototype-basic-phi-v1",
      findings: [{ tag: "0010,0010", name: "Patient Name", action: "replaced" }]
    });
  });
});
