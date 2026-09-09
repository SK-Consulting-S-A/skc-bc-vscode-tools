# Obsolete APIs & Replacements — BC14 to BC25 Migration

## DotNet Consolidation Strategy

txt2al generates a separate `dotnet.al` file in each conversion output folder (one per run).
These per-folder files must be **consolidated into a single root `dotnet.al`** file.

### Consolidation Steps

1. After all txt2al runs complete, collect every `dotnet.al` from the conversion output folders, for example:
   - `<RepoRoot>/src/CustomAL/Codeunit/dotnet.al`
   - `<RepoRoot>/src/CustomAL/Table/dotnet.al`
   - `<RepoRoot>/src/CustomAL/Page/dotnet.al`
   - `<RepoRoot>/src/CustomAL/Report/dotnet.al`
   - `<RepoRoot>/src/DeltaAL/Codeunits/dotnet.al`
   - `<RepoRoot>/src/DeltaAL/Table/dotnet.al`
   - `<RepoRoot>/src/DeltaAL/ReportExt/dotnet.al`

2. Merge all unique `type()` declarations into a single `dotnet.al` at the project root
   (e.g., `<ProjectFolder>/dotnet.al`), grouped by assembly.

3. Delete all per-folder `dotnet.al` files.

4. Remove duplicate type declarations (txt2al often re-declares the same type in each folder).

### Custom-Prefix Aliasing Pattern

When a DotNet type alias conflicts with a standard BC type name, prefix with a project-specific tag (e.g., `Custom`, `My`, or your project suffix):

```al
dotnet
{
    assembly("System")
    {
        Culture = 'neutral';
        PublicKeyToken = 'b77a5c561934e089';
        Version = '4.0.0.0';

        type("System.Net.HttpStatusCode"; "CustomHttpStatusCode") { }
        type("System.Net.WebClient"; "CustomWebClient") { }
        type("System.Uri"; "CustomUri") { }
        type("System.Xml.XmlDocument"; "CustomXmlDocument") { }
    }
}
```

Non-conflicting types can use simple aliases: `type("System.Text.RegularExpressions.Regex"; "Regex") { }`.

### DotNet Types Intentionally Kept (OnPrem Only)

Some DotNet types have NO AL-native replacement and are kept for OnPrem targets:

| Assembly | Purpose | Why kept |
|---|---|---|
| `<Company>.HRImport` | Custom HR import integration | Project-specific .NET assembly, no AL alternative |
| `<Company>.Integration.ThirdParty` | Third-party system integration | Project-specific .NET assembly, no AL alternative |
| `Microsoft.Dynamics.Nav.OpenXml` | Excel cell formatting (`CellDecorator`) | No AL-native equivalent for advanced cell styling |
| `DocumentFormat.OpenXml` | Excel Font/Fill/Border objects | Used with CellDecorator for report formatting |
| `System.IdentityModel.Tokens.Jwt` | JWT token parsing | Consider migrating to AL `Codeunit "Cryptography Management"` in future |

These types are only valid when `"target": "OnPrem"` in `app.json`. If the app ever moves
to SaaS, these must be replaced with AL-native or Azure Function wrappers.

### Format Cleanup

Use single-line format for type declarations (cleaner than txt2al's multi-line output):
```al
type("System.Net.HttpStatusCode"; "CustomHttpStatusCode") { }
```
Not:
```al
type("System.Net.HttpStatusCode"; "CustomHttpStatusCode")
{
}
```

---

## DotNet Types → AL Native Replacements

BC14 C/AL code heavily uses DotNet interop. BC25 AL provides native alternatives for most scenarios.

> **Deployment target matters.** If targeting **on-premises**, DotNet interop still works — you may choose to keep DotNet references during the structural migration and replace them in a later cloud-readiness wave. If targeting **SaaS/Cloud**, all DotNet references must be replaced before deployment. See `SKILL.md` → DotNet Strategy — Deployment Target for the full decision matrix.

The tables below list the AL-native replacements for when you do replace DotNet — whether now or later.

### HTTP & Web Services

| C/AL DotNet type | BC25 AL replacement | Notes |
|---|---|---|
| `System.Net.HttpWebRequest` | `HttpClient`, `HttpRequestMessage` | Full AL HTTP stack available since runtime 1.0 |
| `System.Net.HttpWebResponse` | `HttpResponseMessage` | |
| `System.Net.WebClient` | `HttpClient` | |
| `System.IO.Stream` (for HTTP) | `HttpContent`, `InStream`, `OutStream` | |
| `System.Xml.XmlDocument` (for SOAP) | `HttpClient` + `XmlDocument` (AL native) | AL has native XML types since runtime 1.0 |
| `System.Net.ServicePointManager` | Not needed — TLS managed by platform | |
| `System.Net.NetworkCredential` | `HttpClient.DefaultRequestHeaders.Add('Authorization', ...)` | Use SecretText for credentials |

**Example migration — HTTP request:**
```al
// C/AL (DotNet)
HttpWebRequest := HttpWebRequest.Create(Url);
HttpWebRequest.Method := 'POST';
HttpWebRequest.ContentType := 'application/json';
// ... complex stream handling ...

// BC25 AL (native)
var
    Client: HttpClient;
    Content: HttpContent;
    Response: HttpResponseMessage;
    ResponseText: Text;
begin
    Content.WriteFrom(RequestBody);
    Content.GetHeaders(ContentHeaders);
    ContentHeaders.Remove('Content-Type');
    ContentHeaders.Add('Content-Type', 'application/json');
    Client.Post(Url, Content, Response);
    Response.Content.ReadAs(ResponseText);
end;
```

### Email (SMTP)

| C/AL approach | BC25 replacement | Notes |
|---|---|---|
| Codeunit 400 "SMTP Mail" | `Codeunit "Email Message"` + `Codeunit "Email"` | SMTP Mail is removed in BC25 |
| `Mail.CreateMessage(...)` | `EmailMessage.Create(Recipients, Subject, Body)` | |
| `Mail.AddAttachment(...)` | `EmailMessage.AddAttachment(Name, MediaType, InStream)` | |
| `Mail.Send()` | `Email.Send(EmailMessage, Enum::"Email Scenario"::Default)` | |
| DotNet `System.Net.Mail.SmtpClient` | Email module handles SMTP internally | |
| DotNet `System.Net.Mail.MailMessage` | `Email Message` record | |

**Note:** The Email module (System Application) uses Email Accounts and Email Scenarios.
Custom SMTP code must be completely rewritten to use the module pattern.

### File System

| C/AL DotNet type | BC25 AL replacement | Notes |
|---|---|---|
| `System.IO.File` | `File` data type (AL built-in) for on-prem; `TempBlob` + `Download/Upload` for SaaS | |
| `System.IO.StreamReader` / `StreamWriter` | `InStream` / `OutStream` | |
| `System.IO.Path` | String manipulation or `FileManagement` codeunit | |
| `System.IO.Directory` | Not available in SaaS; on-prem only via `FileManagement` | |
| Codeunit 419 "File Management" | `Codeunit "File Management"` (still exists but reduced) | Many methods marked Obsolete |
| `DOWNLOAD` / `UPLOAD` procedures | Still available but behavior differs in SaaS (browser-based) | |
| `TEMPORARYPATH` | `Codeunit "Temp Blob"` | Avoid file system in SaaS |

### Client-Side File Operations → Server-Side AL

BC14 C/AL used client-side `File Management` methods that are removed or obsolete in BC25 (SaaS has no client file system). Replace with server-side AL equivalents:

| C/AL / BC14 pattern | BC25 AL replacement | Notes |
|---|---|---|
| `FileMgt.ClientFileExists(Path)` | `Exists(Path)` | Server-side file existence check |
| `FileMgt.DeleteClientFile(Path)` | `Erase(Path)` | Server-side file deletion |
| `FileMgt.UploadFileSilent(Path)` + `FileMgt.BLOBImport(TempBlob, Path)` | `UploadIntoStream(DialogTitle, '', FileFilter, UploadFileName, InStr)` | Browser-based upload to stream |
| `FileMgt.BLOBExport(TempBlob, Path, Show)` | Direct stream copy: `BlobField.CreateInStream(InStr); File.CreateOutStream(OutStr); CopyStream(OutStr, InStr);` | Export BLOB to file via streams |
| `[RunOnClient]` attribute | **Remove entirely** | Not supported in SaaS; all code runs server-side |

**Example — File upload replacing TempBlob + BLOBImport:**
```al
// BC14 (C/AL style)
var
    TempBlob: Record TempBlob;
    FileMgt: Codeunit "File Management";
begin
    FileMgt.UploadFileSilent(FileName);
    FileMgt.BLOBImport(TempBlob, FileName);
    "Template Blob" := TempBlob.Blob;
    Modify();

// BC25 (AL native)
var
    InStr: InStream;
    OutStr: OutStream;
    UploadFileName: Text;
begin
    if UploadIntoStream('', '', '*.html', UploadFileName, InStr) then begin
        Clear("Template Blob");
        "Template Blob".CreateOutStream(OutStr);
        CopyStream(OutStr, InStr);
        Modify(false);
    end;
```

**Example — File existence and deletion:**
```al
// BC14
if FileMgt.ClientFileExists(FileName) then
    if not FileMgt.DeleteClientFile(FileName) then
        Error(FileDeleteErr);

// BC25
if Exists(FileName) then
    Erase(FileName);
```

### TempBlob → Native BLOB Stream Operations

The `Record TempBlob` pattern (using `.ReadAsText()` / `.WriteAsText()` / `.Blob` assignment) is obsolete in BC25. BLOB fields now support direct stream operations without a TempBlob intermediary.

| BC14 pattern (TempBlob) | BC25 replacement (native streams) |
|---|---|
| `TempBlob.Blob := BlobField; TempBlob.ReadAsText(CR, Encoding)` | `BlobField.CreateInStream(InStr, Encoding); InStr.ReadText(TextVar)` |
| `TempBlob.WriteAsText(NewText, Encoding); BlobField := TempBlob.Blob` | `BlobField.CreateOutStream(OutStr, Encoding); OutStr.WriteText(NewText)` |
| `TempBlob.Blob := BlobField` (to copy) | `BlobField.CreateInStream(InStr)` (direct access) |
| `BlobField := TempBlob.Blob` (to assign) | `BlobField.CreateOutStream(OutStr); CopyStream(OutStr, InStr)` |

**Example — Reading text from a BLOB field:**
```al
// BC14 (TempBlob)
var
    TempBlob: Record TempBlob temporary;
    CR: Text[1];
begin
    CalcFields("Notification Text");
    if not "Notification Text".HasValue then
        exit('');
    CR[1] := 10;
    TempBlob.Blob := "Notification Text";
    exit(TempBlob.ReadAsText(CR, TEXTENCODING::Windows));
end;

// BC25 (native streams)
var
    NotificationInStream: InStream;
    NotificationText: Text;
begin
    CalcFields("Notification Text");
    if not "Notification Text".HasValue then
        exit('');
    "Notification Text".CreateInStream(NotificationInStream, TEXTENCODING::Windows);
    NotificationInStream.ReadText(NotificationText);
    exit(NotificationText);
end;
```

**Example — Writing text to a BLOB field:**
```al
// BC14 (TempBlob)
var
    TempBlob: Record TempBlob temporary;
begin
    Clear("Request Filters");
    if NewText = '' then exit;
    TempBlob.Blob := "Request Filters";
    TempBlob.WriteAsText(NewText, TEXTENCODING::Windows);
    "Request Filters" := TempBlob.Blob;
    Modify();
end;

// BC25 (native streams)
var
    OutStr: OutStream;
begin
    Clear("Request Filters");
    if NewText = '' then exit;
    "Request Filters".CreateOutStream(OutStr, TEXTENCODING::Windows);
    OutStr.WriteText(NewText);
    Modify(false);
end;
```

**Cascade effect:** Removing TempBlob usage also removes many related variables:
- `Record TempBlob` → delete
- `CR: Text[1]` (used as line break for ReadAsText) → delete
- DotNet `StreamReader`/`StreamWriter`/`Encoding` → delete
- Unused `CellValueText`, `Path`, `isTemplateStream` → delete

Use `Modify(false)` instead of `Modify()` when only updating BLOB data programmatically — triggers are not needed for internal data updates.

### XML Processing

| C/AL DotNet type | BC25 AL replacement | Notes |
|---|---|---|
| `System.Xml.XmlDocument` | `XmlDocument` (AL native) | |
| `System.Xml.XmlNode` | `XmlNode` / `XmlElement` / `XmlAttribute` | |
| `System.Xml.XmlNodeList` | `XmlNodeList` | |
| `System.Xml.XmlNamespaceManager` | `XmlNamespaceManager` | |
| `System.Xml.XPath.XPathNavigator` | `XmlDocument.SelectNodes(XPath)` | |
| `System.Xml.XmlTextWriter` | `XmlDocument` + `XmlElement.Add(...)` | |
| XMLport with DotNet processing | XMLport (still AL native) or `XmlDocument` | |

### JSON Processing

| C/AL DotNet type | BC25 AL replacement | Notes |
|---|---|---|
| `Newtonsoft.Json.JsonConvert` | `JsonObject`, `JsonArray`, `JsonToken`, `JsonValue` | AL native since runtime 1.0 |
| `System.Json.*` | Same AL native types | |
| DotNet JSON serialization | `JsonObject.WriteTo(Text)` / `JsonObject.ReadFrom(Text)` | |

### String & Text Processing

| C/AL DotNet type | BC25 AL replacement | Notes |
|---|---|---|
| `System.Text.RegularExpressions.Regex` | `Codeunit "Regex"` (System Application) | Available since BC 2021 Wave 1 |
| `System.Text.StringBuilder` | `TextBuilder` (AL native since runtime 6.0) | |
| `System.String` methods | AL `Text` functions: `StrSubstNo`, `CopyStr`, `StrLen`, etc. | |
| `System.Convert.ToBase64String` | `Base64Convert` codeunit (System Application) | |
| `System.Text.Encoding` | `TextEncoding` enum with `InStream`/`OutStream` | |

### Cryptography & Security

| C/AL DotNet type | BC25 AL replacement | Notes |
|---|---|---|
| `System.Security.Cryptography.*` | `Codeunit "Cryptography Management"` | System Application module |
| `System.Convert.ToBase64String` | `Codeunit "Base64 Convert"` | |
| Passwords in Text variables | `SecretText` data type (runtime 12.0+) | |
| `ISOLATEDSTORAGE` | `IsolatedStorage` module (AL) | Same concept, cleaner API |

### UI & Client

| C/AL DotNet type | BC25 AL replacement | Notes |
|---|---|---|
| `Microsoft.Dynamics.Nav.Client.BusinessChart` | `Business Chart` buffer table (still available) | Control add-in definition may need update |
| Custom control add-ins (DotNet) | `controladdin` objects in AL | Must rewrite as AL control add-in |
| Client-side .NET assemblies | JavaScript control add-ins | Complete rewrite required |
| `HYPERLINK` | `HYPERLINK` (still valid) | |
| `DIALOG.OPEN` / `DIALOG.UPDATE` | Same (still valid) | Guard with `GuiAllowed` check |

---

## Removed / Restructured Standard Objects

### Tables Removed Since BC14

| Table ID | Table Name | Replacement | Migration |
|---|---|---|---|
| 5723 | Product Group | Item Category (5722) with hierarchy | Migrate records to Item Category with `Parent Category` |
| 470 | Change Log Setup (Table) | Remains but restructured | Check field compatibility |
| Various NAVApp* tables | NAV App management tables | Extension Management module | Platform-managed, never extend |
| 2000000004 | User | `User` in System Application | Different structure, don't extend directly |

### Codeunits Removed or Replaced

| Old CU | Old Name | BC25 Replacement | Notes |
|---|---|---|---|
| 397 | Mail | Email module (codeunit "Email") | Complete rewrite required |
| 400 | SMTP Mail | Email module | Complete rewrite required |
| 1290 | SOAP Web Service Request Mgt. | `HttpClient` AL native | SOAP support via XML + HTTP |
| 1297 | Http Web Request Mgt. | `HttpClient` AL native | Direct replacement |
| 396 | NoSeriesManagement | `Codeunit "No. Series"` (new module) | API changed significantly in BC24+ |
| 419 | File Management | Reduced version exists; many methods obsolete | Use `TempBlob` + `Download`/`Upload` |
| 5063 | ArchiveManagement | Still exists but events/signatures may differ | Verify event signatures |

### Pages Removed Since BC14

| Page ID | Page Name | Notes |
|---|---|---|
| Various Debugger pages | Client debugger | Completely removed — delete any extensions |
| Session List (old) | Session management | Replaced by modern admin pages |

### Reports With Changed Datasets

Reports converted from C/AL may reference dataset columns that no longer exist or have
different names in BC25. Always compile against BC25 symbols and verify RDLC column bindings.

---

## Language / Syntax Changes BC14 → BC25

### WITH Statement (Removed)

The `WITH` statement was deprecated and removed. All `WITH` blocks must be unwound:

```al
// C/AL (with WITH)
WITH SalesHeader DO BEGIN
    VALIDATE("Sell-to Customer No.", CustNo);
    VALIDATE("Posting Date", TODAY);
    INSERT(TRUE);
END;

// BC25 AL (explicit record reference)
SalesHeader.Validate("Sell-to Customer No.", CustNo);
SalesHeader.Validate("Posting Date", Today());
SalesHeader.Insert(true);
```

**Impact on converted code:** txt2al output may still contain `WITH` blocks. The AL compiler
will reject them. This affects virtually every copied standard codeunit.

### TextConst → Label

C/AL `TextConst` variables become `Label` variables in AL:

```al
// C/AL
TextConst Text001 = 'ENU=Do you want to post?;FRB=Voulez-vous valider ?';

// BC25 AL
PostConfirmQst: Label 'Do you want to post?';
// French translation goes in XLIFF file, not in code
```

### CALCDATE String Changes

`CALCDATE` still works the same way, but be aware of locale-sensitive date formulas
that may have been hardcoded in C/AL with French abbreviations.

### RunFormOnRec / RunFormLink → RunModal / SetTableView

Old C/AL page invocation patterns need updating:

```al
// C/AL
FORM.RUNMODAL(FORM::"Customer Card", Customer);

// BC25 AL
PAGE.RunModal(PAGE::"Customer Card", Customer);
```

### COUNT Without Parentheses

```al
// C/AL
IF RecRef.COUNT > 0 THEN

// BC25 AL
if RecRef.Count() > 0 then
```

### TRUE/FALSE → true/false

AL uses lowercase boolean literals.

### RECORDID → RecordId

Casing matters in AL for system types.

---

## No. Series Module Migration (BC24+)

Starting with BC24, the No. Series module was moved to BCApps/Business Foundation and completely rewritten.
Codeunit 396 `NoSeriesManagement` is marked `ObsoleteState = Pending` with tag `'24.0'`.

**BC25/v26 status**: Still `Pending` — compiles with warnings, still works. NOT yet `Removed`.
**Future**: Will move to `Removed` (compilation error) in a future release. Physically deleted at the v30 stepping stone.
**Recommendation**: Migrate proactively during BC14→BC25 conversion. The old API works but the boolean parameter trap (see below) makes it risky to keep.

### CRITICAL WARNING: GetNextNo Boolean Parameter Trap

`GetNextNo(Code[20]; Date; Boolean)` exists in BOTH the old and new codeunits with the **same signature but logically different behavior**:
- **Old (CU 396)**: Boolean = ModifySeries (TRUE = save to DB immediately, FALSE = delayed save)
- **New (CU "No. Series")**: Boolean = HideErrorsAndWarnings (TRUE = suppress errors, FALSE = show errors)

This means a simple find-and-replace from `NoSeriesMgt` to `NoSeries` will **silently change behavior**.

### Migration Patterns (from Microsoft's official refactoring guide)

#### 1. Simple GetNextNo
```al
// OLD (Codeunit 396)
NewNo := NoSeriesMgt.GetNextNo(NoSeriesCode, PostingDate, true);

// NEW (Codeunit "No. Series")
NewNo := NoSeries.GetNextNo(NoSeriesCode, PostingDate);
```

#### 2. TryGetNextNo → PeekNextNo (read without modifying)
```al
// OLD
DocNo := NoSeriesMgt.TryGetNextNo(GenJnlBatch."No. Series", EndDateReq);

// NEW
DocNo := NoSeries.PeekNextNo(GenJnlBatch."No. Series", EndDateReq);
```

#### 3. GetNextNo with delayed modify
```al
// OLD
if DocNo = NoSeriesMgt.GetNextNo(GenJnlBatch."No. Series", EndDateReq, false) then
    NoSeriesMgt.SaveNoSeries();

// NEW — Option A: Peek then get
if DocNo = NoSeries.PeekNextNo(GenJnlBatch."No. Series", EndDateReq) then
    NoSeries.GetNextNo(GenJnlBatch."No. Series", EndDateReq);

// NEW — Option B: Use Batch (recommended for posting)
if DocNo = NoSeriesBatch.GetNextNo(GenJnlBatch."No. Series", EndDateReq) then
    NoSeriesBatch.SaveState();
```

#### 4. InitSeries (most common in custom table OnInsert triggers)
```al
// OLD
if "No." = '' then begin
    GLSetup.Get();
    GLSetup.TestField("Bank Account Nos.");
    NoSeriesMgt.InitSeries(GLSetup."Bank Account Nos.", xRec."No. Series", 0D, "No.", "No. Series");
end;

// NEW
if "No." = '' then begin
    GLSetup.Get();
    GLSetup.TestField("Bank Account Nos.");
    "No. Series" := GLSetup."Bank Account Nos.";
    if NoSeries.AreRelated(GLSetup."Bank Account Nos.", xRec."No. Series") then
        "No. Series" := xRec."No. Series";
    "No." := NoSeries.GetNextNo("No. Series");
end;
```

#### 5. Document posting with multiple No. Series (batch)
```al
// OLD — Array of codeunits (confusing)
var
    NoSeriesMgt2: array[100] of Codeunit NoSeriesManagement;
// ... complex array management per No. Series ...

// NEW — Single batch codeunit
var
    NoSeriesBatch: Codeunit "No. Series - Batch";
begin
    GenJnlLine2."Document No." := NoSeriesBatch.GetNextNo(GenJnlLine2."Posting No. Series", GenJnlLine2."Posting Date");
    // ... at the end of posting:
    NoSeriesBatch.SaveState();
end;
```

#### 6. Backward compatibility (for keeping old event subscribers working)
If other extensions subscribe to the old NoSeriesManagement events, add compatibility calls:
```al
NoSeriesManagement.RaiseObsoleteOnBeforeInitSeries(SetupNoSeries, xRec."No. Series", 0D, "No.", "No. Series", IsHandled);
if not IsHandled then begin
    // ... new No. Series code ...
    NoSeriesManagement.RaiseObsoleteOnAfterInitSeries("No. Series", SetupNoSeries, 0D, "No.");
end;
```

### New codeunits to use
| Old | New | Purpose |
|---|---|---|
| `Codeunit 396 NoSeriesManagement` | `Codeunit "No. Series"` | Single No. Series operations |
| `Codeunit 396` (array of) | `Codeunit "No. Series - Batch"` | Multiple No. Series during posting |
| `NoSeriesMgt.TryGetNextNo()` | `NoSeries.PeekNextNo()` | Read next number without modifying |
| `NoSeriesMgt.InitSeries()` | `NoSeries.GetNextNo()` + `NoSeries.AreRelated()` | Initialize No. on new records |
| `NoSeriesMgt.TestManual()` | `NoSeries.TestManual()` | Check if manual numbering allowed |
| `NoSeriesMgt.SetNoSeriesLineFilter()` | `NoSeriesBatch.SimulateGetNextNo()` | Increment simulation |

### Search patterns for affected code
Grep your project for these patterns to find all instances needing migration:
```
NoSeriesManagement|NoSeriesMgt|"No. Series Mgt"|InitSeries|GetNextNo|TryGetNextNo|SaveNoSeries|TestManual
```

---

## Obsolete Field Types & Properties

### OptionString → Enum

BC25 best practice converts Option fields to Enums. However:
- **Do not convert during initial migration** if the field is on a table extension that already has data
- Convert Option → Enum only for NEW custom tables or during a major version bump
- Option fields continue to work in BC25 — this is an improvement, not a requirement

### CaptionML → Caption + XLIFF

C/AL `CaptionML` properties with inline translations become single `Caption` properties
with translations in XLIFF files:

```al
// C/AL
CaptionML = ENU='Customer No.',FRB='N° client',NLB='Klantnr.';

// BC25 AL
Caption = 'Customer No.';
// FRB and NLB translations in the .xlf file
```

### DateFormula Handling

`DateFormula` fields work the same in BC25 but text representations may differ by locale.
Verify that any hardcoded date formula strings still parse correctly.

---

## Upgrade Codeunit Patterns

When data must be moved between old and new structures during the migration:

### Standard Upgrade Codeunit Template

```al
codeunit 50XXX "Upgrade<Suffix>"
{
    Subtype = Upgrade;
    Access = Internal;

    trigger OnUpgradePerCompany()
    var
        Module: ModuleInfo;
    begin
        NavApp.GetCurrentModuleInfo(Module);
        if Module.DataVersion().Major() < 25 then
            UpgradeFromBC14();
    end;

    local procedure UpgradeFromBC14()
    begin
        MigrateProductGroupData();
        MigrateCustomLocalizationFields();
        // Add other migration procedures
    end;

    local procedure MigrateProductGroupData()
    var
        ItemCategory: Record "Item Category";
    begin
        // Only run if data hasn't been pre-mirrored
        // See safety-rules.md for verification steps
    end;
}
```

### Install Codeunit (for first-time installation)

```al
codeunit 50XXX "Install<Suffix>"
{
    Subtype = Install;
    Access = Internal;

    trigger OnInstallAppPerCompany()
    begin
        if IsFirstInstall() then
            InitializeSetupData();
    end;

    local procedure IsFirstInstall(): Boolean
    var
        Module: ModuleInfo;
    begin
        NavApp.GetCurrentModuleInfo(Module);
        exit(Module.DataVersion() = Version.Create(0, 0, 0, 0));
    end;
}
```

---

## Record File for Directory Listing (Obsolete Pattern)

C/AL code commonly uses `Record File` or `Record File temporary` to enumerate files in a server directory:

```al
// C/AL / BC14 pattern — Record File for directory listing
var
    FileTmp: Record File temporary;
    FileRec: Record File;
begin
    FileRec.SetRange(Path, ServerDirectory);
    FileRec.SetRange("Is a file", true);
    FileRec.SetFilter(Name, '*.xml');
    if FileRec.Find('-') then
        repeat
            // Process each file
            ProcessFile(FileRec.Path + FileRec.Name);
        until FileRec.Next() = 0;
end;
```

`Record File` (table 2000000022) is a **virtual system table** that represents the server file system. It still exists in BC25 OnPrem but has limitations:
- Not available in SaaS (no server file system access)
- Returns server-side files only — no client-side access
- Performance is poor for large directories

### BC25 Replacement — OnPrem

For OnPrem targets where server file access is still needed, use `File Management` codeunit methods or direct `File` data type operations:

```al
// BC25 OnPrem — using File Management
var
    FileMgt: Codeunit "File Management";
    TempNameValueBuffer: Record "Name/Value Buffer" temporary;
    ServerFolder: Text;
begin
    ServerFolder := FileMgt.GetDirectoryName(BasePath);
    FileMgt.GetServerDirectoryFilesList(TempNameValueBuffer, ServerFolder);
    TempNameValueBuffer.SetFilter(Name, '*.xml');
    if TempNameValueBuffer.FindSet() then
        repeat
            ProcessFile(TempNameValueBuffer.Value);
        until TempNameValueBuffer.Next() = 0;
end;
```

### BC25 Replacement — SaaS / Hybrid

For SaaS or hybrid targets, server file listing is not available. Files must come from:
- `UploadIntoStream()` — user uploads from browser
- Azure Blob Storage via `HttpClient` — for automated file ingestion
- Job Queue processing of files deposited via API

### Temporary Record File Variant

Some codeunits use `Record File temporary` to build an in-memory file list. Replace with `Record "Name/Value Buffer" temporary` or a `List of [Text]`:

```al
// BC14
var
    FileTmp: Record File temporary;
begin
    FileTmp.Init();
    FileTmp.Path := Directory;
    FileTmp.Name := FileName;
    FileTmp."Is a file" := true;
    FileTmp.Insert();

// BC25
var
    FileList: List of [Text];
begin
    FileList.Add(Directory + FileName);
```

---

## ZipFile DotNet → DataCompression Codeunit

C/AL code using `System.IO.Compression.ZipFile` for zip operations should use the `DataCompression` codeunit from the System Application:

| C/AL DotNet pattern | BC25 AL replacement | Notes |
|---|---|---|
| `DotNet ZipFile` / `ZipArchive` | `Codeunit "Data Compression"` | System Application module |
| `ZipFile.ExtractToDirectory(path, dest)` | `DataCompression.OpenZipArchive(InStr); DataCompression.GetEntryList(EntryList)` | Extract entries one by one |
| `ZipFile.CreateFromDirectory(src, dest)` | `DataCompression.CreateZipArchive(); DataCompression.AddEntry(...)` | Build zip in memory |

```al
// BC14 (DotNet)
var
    ZipFile: DotNet CustomZipFileAlias;
begin
    ZipFile.ExtractToDirectory(ZipFilePath, DestinationFolder);

// BC25 (AL native)
var
    DataCompression: Codeunit "Data Compression";
    ZipInStr: InStream;
    EntryInStr: InStream;
    EntryList: List of [Text];
    EntryName: Text;
    EntryLength: Integer;
begin
    // Open zip from a file or BLOB
    ZipBlob.CreateInStream(ZipInStr);
    DataCompression.OpenZipArchive(ZipInStr, false);
    DataCompression.GetEntryList(EntryList);
    foreach EntryName in EntryList do begin
        DataCompression.ExtractEntry(EntryName, EntryInStr, EntryLength);
        ProcessEntry(EntryName, EntryInStr);
    end;
    DataCompression.CloseZipArchive();
end;
```

---

## Commit Statement Guidance

C/AL code frequently uses `Commit` to force database writes mid-transaction. During migration, each `Commit` call needs evaluation:

### When Commit Is Acceptable

| Context | Keep? | Reason |
|---|---|---|
| Before `Page.RunModal` / `Report.RunModal` | **Yes** | BC requires commit before opening modal UI |
| In Job Queue processing between independent batches | **Yes** | Prevents rolling back already-processed items |
| Before external HTTP calls | **Yes** | Ensures local state is saved before calling out |
| After posting documents in a batch loop | **Evaluate** | May be needed for large batches; consider `Codeunit.Run` with `if not` pattern instead |

### When Commit Should Be Removed

| Context | Remove? | Reason |
|---|---|---|
| Debug `Commit` to inspect intermediate state | **Yes** | Debug artifact |
| `Commit` followed immediately by `Error` or `exit` | **Yes** | Pointless — the Commit persists partial state before an intentional stop |
| `Commit` in a `TryFunction` | **Evaluate** | May cause partial writes if the try fails after the commit |
| `Commit` before simple record operations | **Yes** | Unnecessary — let the transaction complete naturally |

### SaaS Considerations

In SaaS, `Commit` calls are not forbidden but are **strongly discouraged** outside of specific patterns (pre-modal, external calls). Excessive commits:
- Break transaction atomicity
- Cause partial data writes on errors
- Trigger unnecessary `OnAfterModify` event chains
- Can violate the "no more than 10 commits per operation" platform guideline

**Rule:** For each `Commit` in migrated code, add a comment explaining why it's needed. If you can't explain it, remove it.
