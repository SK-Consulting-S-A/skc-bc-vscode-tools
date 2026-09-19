import * as path from "path";
import { describe, expect, it } from "vitest";
import { calculateDestinationPath, isPathInside, parseAlObject, PathOptions, renderFileName } from "../src/alModel";

const options: PathOptions = {
  fileNamePattern: "<ObjectNameShort>.<ObjectTypeShortPascalCase>.al",
  organizationMode: "Namespace",
  sourceRoot: "src",
  namespacePrefixToIgnore: "Contoso",
  affixesToRemove: ["CTO"]
};

describe("parseAlObject", () => {
  it("parses a namespaced extension object", () => {
    const result = parseAlObject(`
      namespace Contoso.Sales.Documents;
      pageextension 50100 "CTO Customer Card" extends "Customer Card"
      {
      }
    `);

    expect(result).toEqual({
      objectType: "pageextension",
      objectId: "50100",
      objectName: "CTO Customer Card",
      namespace: "Contoso.Sales.Documents"
    });
  });

  it("ignores declarations inside comments", () => {
    const result = parseAlObject(`
      // page 1 Wrong { }
      /* table 2 AlsoWrong { } */
      codeunit 50101 "Real Object"
      {
      }
    `);

    expect(result?.objectType).toBe("codeunit");
    expect(result?.objectName).toBe("Real Object");
  });

  it("supports quoted identifiers containing escaped quotes", () => {
    const result = parseAlObject('table 50102 "Customer ""Signal""" { }');
    expect(result?.objectName).toBe('Customer "Signal"');
  });
});

describe("renderFileName", () => {
  it("renders the configured tokens and removes configured affixes", () => {
    const name = renderFileName({
      objectType: "pageextension",
      objectId: "50100",
      objectName: "CTO Customer Card",
      namespace: "Contoso.Sales.Documents"
    }, options);

    expect(name).toBe("CustomerCard.PageExt.al");
  });
});

describe("calculateDestinationPath", () => {
  it("organizes by namespace relative to the configured source root", () => {
    const workspaceRoot = path.resolve("workspace");
    const destination = calculateDestinationPath(
      path.join(workspaceRoot, "old", "Customer.al"),
      workspaceRoot,
      {
        objectType: "pageextension",
        objectId: "50100",
        objectName: "CTO Customer Card",
        namespace: "Contoso.Sales.Documents"
      },
      options,
      true
    );

    expect(destination).toBe(path.join(workspaceRoot, "src", "Sales", "Documents", "CustomerCard.PageExt.al"));
  });

  it("keeps the directory for rename-only operations", () => {
    const workspaceRoot = path.resolve("workspace");
    const current = path.join(workspaceRoot, "custom", "Old.al");
    const destination = calculateDestinationPath(
      current,
      workspaceRoot,
      { objectType: "codeunit", objectId: "50100", objectName: "CTO Processor" },
      options,
      false
    );

    expect(destination).toBe(path.join(workspaceRoot, "custom", "Processor.Codeunit.al"));
  });

  it("rejects destinations outside the workspace", () => {
    const workspaceRoot = path.resolve("workspace");
    expect(() => calculateDestinationPath(
      path.join(workspaceRoot, "Old.al"),
      workspaceRoot,
      { objectType: "codeunit", objectName: "Processor" },
      { ...options, sourceRoot: ".." },
      true
    )).toThrow("outside the workspace");
  });
});

describe("isPathInside", () => {
  it("distinguishes workspace paths from sibling paths", () => {
    const workspaceRoot = path.resolve("workspace");
    expect(isPathInside(path.join(workspaceRoot, "src", "File.al"), workspaceRoot)).toBe(true);
    expect(isPathInside(path.resolve(workspaceRoot, "..", "outside", "File.al"), workspaceRoot)).toBe(false);
  });
});
