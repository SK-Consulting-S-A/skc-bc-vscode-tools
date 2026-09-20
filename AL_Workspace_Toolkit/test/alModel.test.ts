import * as path from "path";
import { describe, expect, it } from "vitest";
import { calculateDestinationPath, isPathInside, parseAlObject, PathOptions, renderFileName, renderObjectName } from "../src/alModel";

const options: PathOptions = {
  fileNamePattern: "<ObjectNameShort>.<ObjectTypeShortPascalCase>.al",
  extensionFileNamePattern: "",
  pageCustomizationFileNamePattern: "",
  organizationMode: "Namespace",
  sourceRoot: "src",
  testSourceRoot: "",
  namespacePrefixToIgnore: "Contoso",
  affixesToRemove: ["CTO"],
  objectNamePrefix: "",
  objectNameSuffix: "",
  rewriteObjectName: false
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
      namespace: "Contoso.Sales.Documents",
      baseObjectName: "Customer Card",
      baseObjectId: undefined,
      subtype: undefined,
      objectNameOffset: expect.any(Number)
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

  it("parses extension targets, base IDs, and test subtypes", () => {
    const extension = parseAlObject('tableextension 50100 "CTO Customer Ext" extends Customer //18\n{ }');
    const test = parseAlObject('codeunit 50101 "Customer Tests" { Subtype = Test; }');

    expect(extension?.baseObjectName).toBe("Customer");
    expect(extension?.baseObjectId).toBe("18");
    expect(test?.subtype).toBe("Test");
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

  it("uses specialized patterns and renders base and uppercase tokens", () => {
    const name = renderFileName({
      objectType: "tableextension",
      objectId: "50100",
      objectName: "CTO Customer Ext",
      baseObjectName: "Customer",
      baseObjectId: "18",
      objectNameOffset: 0
    }, {
      ...options,
      extensionFileNamePattern: "<BaseNameShort>.<ObjectTypeShortUpper>.<BaseId>.al"
    });

    expect(name).toBe("Customer.TABLEEXT.18.al");
  });

  it("uses the page customization pattern independently", () => {
    const customization = parseAlObject('pagecustomization "Customer Customization" customizes "Customer Card" { }');
    const name = renderFileName(customization!, {
      ...options,
      extensionFileNamePattern: "Wrong.al",
      pageCustomizationFileNamePattern: "<BaseNameShort>.<ObjectTypeShortUpper>.al"
    });

    expect(name).toBe("CustomerCard.PAGECUST.al");
  });

  it("treats profile extensions as extension objects", () => {
    const profileExtension = parseAlObject('profileextension "Sales Profile Ext" extends "Business Manager" { }');
    const name = renderFileName(profileExtension!, {
      ...options,
      extensionFileNamePattern: "<BaseNameShort>.<ObjectTypeShortPascalCase>.al"
    });

    expect(name).toBe("BusinessManager.ProfileExt.al");
  });

  it("adds object-name affixes idempotently", () => {
    const namingOptions = { ...options, objectNamePrefix: "CTO ", objectNameSuffix: " SKC" };
    const first = renderObjectName("Customer", namingOptions);
    const second = renderObjectName(first, namingOptions);

    expect(first).toBe("CTO Customer SKC");
    expect(second).toBe(first);
  });

  it("rejects filename patterns that collapse to an empty AL filename", () => {
    expect(() => renderFileName({
      objectType: "interface",
      objectName: "Processor",
      objectNameOffset: 0
    }, { ...options, fileNamePattern: "<ObjectId>" })).toThrow("empty filename");
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

  it("routes test codeunits through the configured test source root", () => {
    const workspaceRoot = path.resolve("workspace");
    const destination = calculateDestinationPath(
      path.join(workspaceRoot, "src", "Tests.Codeunit.al"),
      workspaceRoot,
      {
        objectType: "codeunit",
        objectId: "50100",
        objectName: "Customer Tests",
        namespace: "Contoso.Tests",
        subtype: "Test",
        objectNameOffset: 0
      },
      { ...options, testSourceRoot: "test" },
      true
    );

    expect(destination).toBe(path.join(workspaceRoot, "test", "Tests", "CustomerTests.Codeunit.al"));
  });

  it("routes test runner codeunits through the configured test source root", () => {
    const workspaceRoot = path.resolve("workspace");
    const runner = parseAlObject('codeunit 50100 "Suite Runner" { Subtype = TestRunner; }');
    const destination = calculateDestinationPath(
      path.join(workspaceRoot, "src", "SuiteRunner.Codeunit.al"),
      workspaceRoot,
      runner!,
      { ...options, organizationMode: "None", testSourceRoot: "test" },
      true
    );

    expect(destination).toBe(path.join(workspaceRoot, "test", "SuiteRunner.Codeunit.al"));
  });
});

describe("isPathInside", () => {
  it("distinguishes workspace paths from sibling paths", () => {
    const workspaceRoot = path.resolve("workspace");
    expect(isPathInside(path.join(workspaceRoot, "src", "File.al"), workspaceRoot)).toBe(true);
    expect(isPathInside(path.resolve(workspaceRoot, "..", "outside", "File.al"), workspaceRoot)).toBe(false);
  });
});
