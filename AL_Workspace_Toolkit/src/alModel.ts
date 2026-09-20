import * as path from "path";

export type OrganizationMode = "Namespace" | "ObjectType" | "None";

export interface AlObjectInfo {
  objectType: string;
  objectId?: string;
  objectName: string;
  namespace?: string;
  baseObjectName?: string;
  baseObjectId?: string;
  subtype?: "Test" | "TestRunner";
  objectNameOffset: number;
}

export interface PathOptions {
  fileNamePattern: string;
  extensionFileNamePattern: string;
  pageCustomizationFileNamePattern: string;
  organizationMode: OrganizationMode;
  sourceRoot: string;
  testSourceRoot: string;
  namespacePrefixToIgnore: string;
  affixesToRemove: string[];
  objectNamePrefix: string;
  objectNameSuffix: string;
  rewriteObjectName: boolean;
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
  profileextension: "ProfileExt",
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
  profileextension: "ProfileExtensions",
  controladdin: "ControlAddIns",
  entitlement: "Entitlements"
};

const objectDeclaration = /^\s*(tableextension|pageextension|reportextension|enumextension|permissionsetextension|profileextension|pagecustomization|table|page|report|codeunit|query|xmlport|enum|interface|permissionset|profile|controladdin|entitlement)\s+(?:(\d+)\s+)?("(?:[^"]|"")*"|[A-Za-z_][A-Za-z0-9_]*)/im;
const namespaceDeclaration = /^\s*namespace\s+([A-Za-z_][A-Za-z0-9_.]*)\s*;/im;
const extensionObjectTypes = new Set([
  "tableextension",
  "pageextension",
  "reportextension",
  "enumextension",
  "permissionsetextension",
  "profileextension"
]);

export function parseAlObject(source: string): AlObjectInfo | undefined {
  const code = stripComments(source);
  const declaration = objectDeclaration.exec(code);
  if (!declaration) {
    return undefined;
  }

  const namespace = namespaceDeclaration.exec(code)?.[1];
  const objectNameToken = declaration[3];
  const objectNameOffset = declaration.index + declaration[0].lastIndexOf(objectNameToken);
  const declarationTail = code.slice(objectNameOffset + objectNameToken.length);
  const baseMatch = /^\s+(?:extends|customizes)\s+("(?:[^"]|"")*"|[A-Za-z_][A-Za-z0-9_]*)/i.exec(declarationTail);
  const baseObjectName = baseMatch ? unquoteIdentifier(baseMatch[1]) : undefined;
  const baseObjectId = baseMatch
    ? readBaseObjectId(source, objectNameOffset + objectNameToken.length + baseMatch[0].length)
    : undefined;
  const subtypeMatch = declaration[1].toLowerCase() === "codeunit"
    ? /\bSubtype\s*=\s*(Test|TestRunner)\s*;/i.exec(code)
    : undefined;
  return {
    objectType: declaration[1].toLowerCase(),
    objectId: declaration[2],
    objectName: unquoteIdentifier(objectNameToken),
    namespace,
    baseObjectName,
    baseObjectId,
    subtype: subtypeMatch?.[1] as "Test" | "TestRunner" | undefined,
    objectNameOffset
  };
}

export function renderFileName(info: AlObjectInfo, options: PathOptions): string {
  const effectiveObjectName = options.rewriteObjectName ? renderObjectName(info.objectName, options) : info.objectName;
  const objectName = sanitizeFileSegment(effectiveObjectName);
  const shortObjectName = sanitizeFileSegment(stripAffixes(effectiveObjectName, options.affixesToRemove))
    .replace(/[^A-Za-z0-9]/g, "");
  const shortType = objectTypeShortNames[info.objectType] ?? toPascalCase(info.objectType);
  const baseName = sanitizeFileSegment(stripAffixes(info.baseObjectName ?? "", options.affixesToRemove));
  const shortBaseName = baseName.replace(/[^A-Za-z0-9]/g, "");
  const replacements: Record<string, string> = {
    "<Prefix>": options.objectNamePrefix,
    "<Suffix>": options.objectNameSuffix,
    "<ObjectName>": objectName,
    "<ObjectNameShort>": shortObjectName || objectName,
    "<ObjectType>": info.objectType,
    "<ObjectTypeShort>": shortType.toLowerCase(),
    "<ObjectTypeShortPascalCase>": shortType,
    "<ObjectTypeShortUpper>": shortType.toUpperCase(),
    "<ObjectId>": info.objectId ?? "",
    "<Namespace>": info.namespace ?? "",
    "<BaseName>": baseName,
    "<BaseNameShort>": shortBaseName,
    "<BaseId>": info.baseObjectId ?? ""
  };

  let fileName = selectFileNamePattern(info.objectType, options);
  for (const [token, value] of Object.entries(replacements)) {
    fileName = fileName.split(token).join(value);
  }
  fileName = sanitizeFileSegment(fileName).replace(/\.{2,}/g, ".");
  if (!fileName || fileName.toLowerCase() === ".al") {
    throw new Error("The configured filename pattern produced an empty filename.");
  }
  if (!fileName.toLowerCase().endsWith(".al")) {
    fileName += ".al";
  }
  return fileName;
}

export function renderObjectName(objectName: string, options: PathOptions): string {
  let result = objectName.trim();
  const prefix = options.objectNamePrefix;
  const suffix = options.objectNameSuffix;
  if (prefix && !result.toLowerCase().startsWith(prefix.toLowerCase())) {
    result = `${prefix}${result}`;
  }
  if (suffix && !result.toLowerCase().endsWith(suffix.toLowerCase())) {
    result = `${result}${suffix}`;
  }
  return result;
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

  if (reorganize) {
    const isTestCodeunit = info.objectType === "codeunit" && Boolean(info.subtype);
    const configuredRoot = isTestCodeunit && options.testSourceRoot.trim()
      ? options.testSourceRoot
      : options.sourceRoot || "src";
    const sourceRoot = path.resolve(workspaceRoot, configuredRoot);
    const segments = options.organizationMode === "Namespace"
      ? namespaceSegments(info.namespace, options.namespacePrefixToIgnore)
      : options.organizationMode === "ObjectType"
        ? [objectTypeFolders[info.objectType] ?? toPascalCase(info.objectType)]
        : [];
    targetDirectory = path.join(sourceRoot, ...segments);
  }

  const destination = path.resolve(targetDirectory, fileName);
  if (!isPathInside(destination, workspaceRoot)) {
    throw new Error("The calculated destination is outside the workspace.");
  }
  return destination;
}

function selectFileNamePattern(objectType: string, options: PathOptions): string {
  if (objectType === "pagecustomization" && options.pageCustomizationFileNamePattern.trim()) {
    return options.pageCustomizationFileNamePattern;
  }
  if (extensionObjectTypes.has(objectType) && options.extensionFileNamePattern.trim()) {
    return options.extensionFileNamePattern;
  }
  return options.fileNamePattern;
}

function readBaseObjectId(source: string, targetEnd: number): string | undefined {
  const lineEnd = source.indexOf("\n", targetEnd);
  const lineTail = source.slice(targetEnd, lineEnd < 0 ? source.length : lineEnd);
  return /^\s*\/\/\s*(\d+)/.exec(lineTail)?.[1];
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
