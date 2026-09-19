import * as path from "path";

export type OrganizationMode = "Namespace" | "ObjectType" | "None";

export interface AlObjectInfo {
  objectType: string;
  objectId?: string;
  objectName: string;
  namespace?: string;
}

export interface PathOptions {
  fileNamePattern: string;
  organizationMode: OrganizationMode;
  sourceRoot: string;
  namespacePrefixToIgnore: string;
  affixesToRemove: string[];
}

const objectTypeShortNames: Record<string, string> = {
  table: "Table",
  tableextension: "TableExt",
  page: "Page",
  pageextension: "PageExt",
  pagecustomization: "PageCust",
  report: "Report",
  reportextension: "ReportExt",
  codeunit: "Codeunit",
  query: "Query",
  xmlport: "XmlPort",
  enum: "Enum",
  enumextension: "EnumExt",
  interface: "Interface",
  permissionset: "PermissionSet",
  permissionsetextension: "PermissionSetExt",
  profile: "Profile",
  controladdin: "ControlAddIn",
  entitlement: "Entitlement"
};

const objectTypeFolders: Record<string, string> = {
  table: "Tables",
  tableextension: "TableExtensions",
  page: "Pages",
  pageextension: "PageExtensions",
  pagecustomization: "PageCustomizations",
  report: "Reports",
  reportextension: "ReportExtensions",
  codeunit: "Codeunits",
  query: "Queries",
  xmlport: "XmlPorts",
  enum: "Enums",
  enumextension: "EnumExtensions",
  interface: "Interfaces",
  permissionset: "PermissionSets",
  permissionsetextension: "PermissionSetExtensions",
  profile: "Profiles",
  controladdin: "ControlAddIns",
  entitlement: "Entitlements"
};

const objectDeclaration = /^\s*(tableextension|pageextension|reportextension|enumextension|permissionsetextension|pagecustomization|table|page|report|codeunit|query|xmlport|enum|interface|permissionset|profile|controladdin|entitlement)\s+(?:(\d+)\s+)?("(?:[^"]|"")*"|[A-Za-z_][A-Za-z0-9_]*)/im;
const namespaceDeclaration = /^\s*namespace\s+([A-Za-z_][A-Za-z0-9_.]*)\s*;/im;

export function parseAlObject(source: string): AlObjectInfo | undefined {
  const code = stripComments(source);
  const declaration = objectDeclaration.exec(code);
  if (!declaration) {
    return undefined;
  }

  const namespace = namespaceDeclaration.exec(code)?.[1];
  return {
    objectType: declaration[1].toLowerCase(),
    objectId: declaration[2],
    objectName: unquoteIdentifier(declaration[3]),
    namespace
  };
}

export function renderFileName(info: AlObjectInfo, options: PathOptions): string {
  const objectName = sanitizeFileSegment(info.objectName);
  const shortObjectName = sanitizeFileSegment(stripAffixes(info.objectName, options.affixesToRemove))
    .replace(/[^A-Za-z0-9]/g, "");
  const shortType = objectTypeShortNames[info.objectType] ?? toPascalCase(info.objectType);
  const replacements: Record<string, string> = {
    "<ObjectName>": objectName,
    "<ObjectNameShort>": shortObjectName || objectName,
    "<ObjectType>": info.objectType,
    "<ObjectTypeShort>": shortType.toLowerCase(),
    "<ObjectTypeShortPascalCase>": shortType,
    "<ObjectId>": info.objectId ?? "",
    "<Namespace>": info.namespace ?? ""
  };

  let fileName = options.fileNamePattern;
  for (const [token, value] of Object.entries(replacements)) {
    fileName = fileName.split(token).join(value);
  }
  fileName = sanitizeFileSegment(fileName).replace(/\.{2,}/g, ".");
  if (!fileName.toLowerCase().endsWith(".al")) {
    fileName += ".al";
  }
  return fileName;
}

export function calculateDestinationPath(
  currentPath: string,
  workspaceRoot: string,
  info: AlObjectInfo,
  options: PathOptions,
  reorganize: boolean
): string {
  const fileName = renderFileName(info, options);
  let targetDirectory = path.dirname(currentPath);

  if (reorganize && options.organizationMode !== "None") {
    const sourceRoot = path.resolve(workspaceRoot, options.sourceRoot || "src");
    const segments = options.organizationMode === "Namespace"
      ? namespaceSegments(info.namespace, options.namespacePrefixToIgnore)
      : [objectTypeFolders[info.objectType] ?? toPascalCase(info.objectType)];
    targetDirectory = path.join(sourceRoot, ...segments);
  }

  const destination = path.resolve(targetDirectory, fileName);
  if (!isPathInside(destination, workspaceRoot)) {
    throw new Error("The calculated destination is outside the workspace.");
  }
  return destination;
}

export function isPathInside(candidatePath: string, workspaceRoot: string): boolean {
  const relative = path.relative(path.resolve(workspaceRoot), path.resolve(candidatePath));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function namespaceSegments(namespaceValue: string | undefined, prefixToIgnore: string): string[] {
  if (!namespaceValue) {
    return ["Unnamespaced"];
  }

  let value = namespaceValue;
  const prefix = prefixToIgnore.trim().replace(/\.$/, "");
  if (prefix && (value.toLowerCase() === prefix.toLowerCase() || value.toLowerCase().startsWith(`${prefix.toLowerCase()}.`))) {
    value = value.slice(prefix.length).replace(/^\./, "");
  }

  const segments = value.split(".").map(sanitizeFileSegment).filter(Boolean);
  return segments.length > 0 ? segments : ["Unnamespaced"];
}

function stripAffixes(value: string, affixes: string[]): string {
  let result = value.trim();
  for (const rawAffix of affixes) {
    const affix = rawAffix.trim();
    if (!affix) {
      continue;
    }
    if (result.toLowerCase().startsWith(affix.toLowerCase())) {
      result = result.slice(affix.length).trim();
    }
    if (result.toLowerCase().endsWith(affix.toLowerCase())) {
      result = result.slice(0, -affix.length).trim();
    }
  }
  return result;
}

function sanitizeFileSegment(value: string): string {
  return value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "").trim().replace(/[. ]+$/, "");
}

function toPascalCase(value: string): string {
  return value.split(/[^A-Za-z0-9]+/).filter(Boolean).map((part) => part[0].toUpperCase() + part.slice(1)).join("");
}

function unquoteIdentifier(value: string): string {
  return value.startsWith('"') && value.endsWith('"')
    ? value.slice(1, -1).replace(/""/g, '"')
    : value;
}

function stripComments(source: string): string {
  let output = "";
  let inBlockComment = false;
  let inString = false;

  for (let index = 0; index < source.length; index += 1) {
    const current = source[index];
    const next = source[index + 1];

    if (inBlockComment) {
      if (current === "*" && next === "/") {
        inBlockComment = false;
        output += "  ";
        index += 1;
      } else {
        output += current === "\n" ? "\n" : " ";
      }
      continue;
    }

    if (!inString && current === "/" && next === "*") {
      inBlockComment = true;
      output += "  ";
      index += 1;
      continue;
    }

    if (!inString && current === "/" && next === "/") {
      while (index < source.length && source[index] !== "\n") {
        output += " ";
        index += 1;
      }
      output += "\n";
      continue;
    }

    if (current === '"') {
      if (inString && next === '"') {
        output += '""';
        index += 1;
        continue;
      }
      inString = !inString;
    }
    output += current;
  }

  return output;
}
