# Event Mapping Reference — C/AL Modifications → BC25 Events

This file maps common C/AL modification points in standard codeunits and tables
to their BC25 integration/business event equivalents.

Use this when extracting custom code from the 60+ copied standard codeunits into
event subscriber codeunits.

## How to Use This Reference

1. Identify the custom code block in the copied codeunit (marked with legacy tags like `//DEV1`, `//TICKET-01`, `//FEAT-A`)
2. Determine WHERE in the standard procedure the code was inserted (before/after/replacing)
3. Look up the standard codeunit + location in the tables below
4. Find the BC25 event to subscribe to
5. If no event exists, see [Fallback Strategies](#fallback-strategies)

## Finding Events in BC25 Symbols

When an event isn't listed below, search for events using these methods:

1. **Verified Base App source** — inspect the unpacked Base Application source for the target BC version and search for `[IntegrationEvent]` or `[BusinessEvent]`
2. **Microsoft Learn documentation** — search `site:learn.microsoft.com "Purch.-Post" events` for published event lists
3. **BCApps GitHub** — search `github.com/microsoft/BCApps` for the codeunit source to see published events
4. **Event Recorder** (page 9804) in a BC sandbox — run the business process and see which events fire

**⚠️ Important:** The `.alpackages` folder contains **compiled binary `.app` files**, not searchable `.al` source. You cannot grep or read these files as text. Use the methods above instead.

**⚠️ Procedure relocation:** In BC25, Microsoft refactored several large codeunits. Posting logic may have moved to companion codeunits (e.g., CU 90 `PostBalancingEntry` → CU 816 "Purch. Post Invoice"). If you can't find an event on the expected codeunit, search across ALL codeunits for the procedure name. See the [Purch. Post Invoice Events](#purch-post-invoice-events-codeunit-816) section below and [delta-methodology.md](delta-methodology.md) → Pitfall: Assuming BC25 events live on the same codeunit as BC14.

## Legend

| Symbol | Meaning |
|---|---|
| ✅ | Direct event available in BC25 — straightforward migration |
| ⚠️ | Event exists but signature changed or indirect approach needed |
| ❌ | No event available — requires alternative strategy |
| 🔍 | Event likely exists but must be verified against BC25 symbols |

---

## Posting Codeunits

### Gen. Jnl.-Post Line (Codeunit 12)

The largest and most complex codeunit. Custom code typically adds fields to ledger entries during posting.

| C/AL modification location | BC25 event | Status |
|---|---|---|
| Before `InsertGLEntry` | `OnBeforeInsertGlEntry` | ✅ |
| After `InsertGLEntry` | `OnAfterInsertGlobalGLEntry` | ✅ |
| Before `InsertCustLedgEntry` | `OnBeforeCustLedgEntryInsert` | ✅ |
| After `InsertCustLedgEntry` | `OnAfterCustLedgEntryInsert` | ✅ |
| Before `InsertVendLedgEntry` | `OnBeforeVendLedgEntryInsert` | ✅ |
| After `InsertVendLedgEntry` | `OnAfterVendLedgEntryInsert` | ✅ |
| Before `InsertVATEntry` | `OnBeforeInsertVATEntry` | ✅ |
| After `InsertVATEntry` | `OnAfterInsertVATEntry` | ✅ |
| Before `InsertBankAccLedgEntry` | `OnBeforeBankAccLedgEntryInsert` | ✅ |
| In `PostGLAcc` | `OnPostGLAccOnBeforeInsertGLEntry` | ✅ |
| In `PostCust` (before posting) | `OnBeforePostCust` | ✅ |
| In `PostVend` (before posting) | `OnBeforePostVend` | ✅ |
| In `InitVAT` | `OnAfterInitVAT` | ✅ |
| In `CalcPmtDiscIfAdjVAT` | `OnBeforeCalcPmtDiscIfAdjVAT` | 🔍 |
| In `InitOldDtldCVLedgEntryBuf` | `OnAfterInitOldDtldCVLedgEntryBuf` | ✅ |
| In `InitNewDtldCVLedgEntryBuf` | `OnAfterInitNewDtldCVLedgEntryBuf` | ✅ |
| In `PostDtldCVLedgEntry` | `OnBeforePostDtldCVLedgEntry` | ✅ |
| Custom field on `GenJnlLine` → `VATEntry` | Subscribe to `OnBeforeInsertVATEntry` and copy fields | ✅ |
| Custom field on `GenJnlLine` → `CustLedgerEntry` | Subscribe to `OnBeforeCustLedgEntryInsert` | ✅ |
| Custom field on `GenJnlLine` → `GLEntry` | Subscribe to `OnBeforeInsertGlEntry` | ✅ |

### Gen. Jnl.-Post Batch (Codeunit 13)

| C/AL modification location | BC25 event | Status |
|---|---|---|
| Before `Code` procedure runs | `OnBeforeCode` | ✅ |
| After processing each line | `OnAfterProcessLines` | ✅ |
| Before posting journal batch | `OnBeforePostJournalBatch` | ✅ |
| After `GenJnlLine.SETRANGE("Journal Template Name")` | `OnCodeOnAfterFilterGenJnlLine` | 🔍 |

### Sales-Post (Codeunit 80)

| C/AL modification location | BC25 event | Status |
|---|---|---|
| Before posting starts | `OnBeforePostSalesDoc` | ✅ |
| After posting completes | `OnAfterPostSalesDoc` | ✅ |
| Before `SalesInvHeader.INSERT` | `OnBeforeSalesInvHeaderInsert` | ✅ |
| After `SalesInvHeader.INSERT` | `OnAfterSalesInvHeaderInsert` | ✅ |
| Before `SalesInvLine.INSERT` | `OnBeforeSalesInvLineInsert` | ✅ |
| After `SalesShptHeader.INSERT` | `OnAfterSalesShptHeaderInsert` | ✅ |
| Before `SalesCrMemoHeader.INSERT` | `OnBeforeSalesCrMemoHeaderInsert` | ✅ |
| Copy custom fields Header → Posted Header | Use the appropriate `OnBefore*Insert` event | ✅ |
| Copy custom fields Line → Posted Line | Use the appropriate `OnBefore*LineInsert` event | ✅ |
| Before item tracking | `OnBeforePostItemTrackingLine` | 🔍 |
| In `FillInvoicePostingBuffer` | `OnAfterFillInvoicePostingBuffer` | ✅ |

### Purch.-Post (Codeunit 90)

**⚠️ BC25 Architecture Change:** In BC25, invoice-specific posting logic (`PostBalancingEntry`, `PostInvoice`, etc.) was **refactored out of CU 90** into `Codeunit 816 "Purch. Post Invoice"` and its event publisher `Codeunit "Purch. Post Invoice Events"`. If you are looking for events related to invoice posting (especially `PostBalancingEntry`), see the [Purch. Post Invoice Events](#purch-post-invoice-events-codeunit-816) section below.

| C/AL modification location | BC25 event | Status |
|---|---|---|
| Before posting starts | `OnBeforePostPurchaseDoc` | ✅ |
| After posting completes | `OnAfterPostPurchaseDoc` | ✅ |
| In `CheckAndUpdate` (SrcCode override) | `OnCheckAndUpdateOnAfterSetSourceCode` (passes `var SrcCode`) | ✅ |
| Before posting lines (pre-processing) | `OnBeforePostLines` (passes `var TempPurchLineGlobal`) | ✅ |
| After `ModifyTempLine` | `OnAfterModifyTempLine` | ✅ |
| Before `PurchInvHeader.INSERT` | `OnBeforePurchInvHeaderInsert` | ✅ |
| After `PurchInvHeader.INSERT` | `OnAfterPurchInvHeaderInsert` | ✅ |
| Before `PurchInvLine.INSERT` | `OnBeforePurchInvLineInsert` | ✅ |
| Before `PurchRcptHeader.INSERT` | `OnBeforePurchRcptHeaderInsert` | ✅ |
| After `PurchRcptLine.INSERT` | `OnAfterPurchRcptLineInsert` (extended param list incl. `xPurchLine`, `PurchRcptHeader`, `TempPurchLineGlobal`) | ✅ |
| Before `PurchCrMemoHdr.INSERT` | `OnBeforePurchCrMemoHdrInsert` | ✅ |
| After `PurchCrMemoHdr.INSERT` | `OnAfterPurchCrMemoHeaderInsert` | ✅ |
| Copy custom fields Header → Receipt Header | Use `OnBeforePurchRcptHeaderInsert` | ✅ |
| In `PostVendorEntry` | `OnAfterPostVendorEntry` | ✅ |
| Before `DeleteAfterPosting` | `OnBeforeDeleteAfterPosting` | ✅ |
| After `FinalizePosting` before commit | `OnAfterFinalizePostingOnBeforeCommit` | ✅ |

**Timing note — `OnBeforePostLines`:** This event fires **after** `FillTempLines` populates `TempPurchLineGlobal`. If BC14 code ran before `FillTempLines` (e.g., `PreProcessPurchaseLines` on `OnRun`), the subscriber must update **both** the real DB purchase lines AND the `TempPurchLineGlobal` temp table to keep them in sync. See [patterns.md](patterns.md) → TempPurchLineGlobal Dual-Update Pattern.

### Purch. Post Invoice Events (Codeunit 816)

In BC25, invoice posting logic was refactored from CU 90 into `Codeunit 816 "Purch. Post Invoice"`. The events are published via a companion codeunit `"Purch. Post Invoice Events"`.

| C/AL modification location (was in CU 90) | BC25 event (on `Codeunit "Purch. Post Invoice Events"`) | Status |
|---|---|---|
| In `PostBalancingEntry` (before GenJnlLine posted) | `OnPostBalancingEntryOnBeforeGenJnlPostLine` (passes `var GenJnlLine`) | ✅ |

**⚠️ Critical:** If your BC14 DELTA modifies `PostBalancingEntry` in CU 90, the BC25 event is **NOT on CU 90** — it is on `Codeunit "Purch. Post Invoice Events"`. Searching CU 90's event list will not find it.

### Purch.-Get Receipt (Codeunit 74)

| C/AL modification location | BC25 event | Status |
|---|---|---|
| After receipt line filters are set | `OnAfterPurchRcptLineSetFilters` | ✅ |
| After invoice line created from receipt | `OnAfterInsertInvoiceLineFromReceiptLine` | ✅ |

### Sales Post Invoice Events (Codeunit 815)

Same refactoring as CU 90 → CU 816. In BC25, invoice posting logic was moved from CU 80 "Sales-Post" into `Codeunit 815 "Sales Post Invoice"`. Events are on the companion `"Sales Post Invoice Events"` codeunit.

| C/AL modification location (was in CU 80) | BC25 event (on `Codeunit "Sales Post Invoice Events"`) | Status |
|---|---|---|
| In `PostBalancingEntry` (before GenJnlLine posted) | `OnPostBalancingEntryOnBeforeGenJnlPostLine` (passes `var GenJnlLine`) | 🔍 |

### Sales-Get Shipment (Codeunit 64)

| C/AL modification location | BC25 event | Status |
|---|---|---|
| After shipment line filters are set | `OnAfterSalesShptLineSetFilters` | 🔍 |
| After invoice line created from shipment | `OnAfterInsertInvoiceLineFromShipmentLine` | 🔍 |

**Note:** CU 64 follows the same pattern as CU 74. Verify event names against BC25 symbols.

### Service-Post (Codeunit 5980)

| C/AL modification location | BC25 event | Status |
|---|---|---|
| Before posting | `OnBeforePostWithLines` | 🔍 |
| After posting | `OnAfterPostServiceDoc` | 🔍 |
| Before service invoice header insert | `OnBeforeServInvHeaderInsert` | 🔍 |
| Copy fields to service invoice line | `OnBeforeServInvLineInsert` | 🔍 |
| Before service Cr. Memo header insert | `OnBeforeServCrMemoHeaderInsert` | 🔍 |

**Note:** Service posting events are fewer than Sales/Purchase. Verify each one against BC25 symbols.

---

## Warehouse Codeunits

### TransferOrder-Post Shipment (Codeunit 5704)

| C/AL modification location | BC25 event | Status |
|---|---|---|
| Before posting | `OnBeforeTransferOrderPostShipment` | ✅ |
| After `TransShptHeader.INSERT` | `OnAfterInsertTransShptHeader` | ✅ |
| Before `TransShptLine.INSERT` | `OnBeforeInsertTransShptLine` | ✅ |
| After `TransShptLine.INSERT` | `OnAfterInsertTransShptLine` | ✅ |
| Copy custom fields Transfer Header → Shipment Header | `OnAfterInsertTransShptHeader` | ✅ |
| Copy custom fields Transfer Line → Shipment Line | `OnBeforeInsertTransShptLine` | ✅ |

### Whse.-Create Source Document (Codeunit 5750)

| C/AL modification location | BC25 event | Status |
|---|---|---|
| In `CreateWhseDocument` (warehouse receipt from transfer) | `OnAfterCreateWhseRcptHeaderFromWhseRequest` | 🔍 |
| Creating warehouse receipt line | `OnAfterCreateWhseReceiptLineFromTransLine` | 🔍 |
| Creating warehouse shipment line | `OnAfterCreateShptLineFromTransLine` | 🔍 |

### Whse.-Post Receipt (Codeunit 5760)

| C/AL modification location | BC25 event | Status |
|---|---|---|
| Before posting | `OnBeforeCode` | 🔍 |
| After `PostedWhseRcptHeader.INSERT` | `OnAfterPostedWhseRcptHeaderInsert` | 🔍 |
| After `PostedWhseRcptLine.INSERT` | `OnAfterPostedWhseRcptLineInsert` | 🔍 |
| After creating warehouse journal line | `OnAfterCreateWhseJnlLine` | 🔍 |

### Whse.-Post Shipment (Codeunit 5763)

| C/AL modification location | BC25 event | Status |
|---|---|---|
| Before posting | `OnBeforeCode` | 🔍 |
| After `PostedWhseShptHeader.INSERT` | `OnAfterPostedWhseShptHeaderInsert` | 🔍 |
| After `PostedWhseShptLine.INSERT` | `OnAfterPostedWhseShptLineInsert` | 🔍 |

### Create Pick (Codeunit 7312)

| C/AL modification location | BC25 event | Status |
|---|---|---|
| In `CreateWhseDocument` | `OnAfterCreateWhseDocumentOnBeforeShowMsg` | 🔍 |
| In `CreateNewWhseActivity` | `OnAfterCreateNewWhseActivity` | 🔍 |
| Filtering warehouse entries | `OnCreatePickOrMoveLineFromHandlingSpec` | 🔍 |

**Warning:** Create Pick is one of the most complex codeunits. Many internal filtering procedures have NO events. If custom code modified `FindFirstAllowedRec` / `FindNextAllowedRec`, see [Fallback Strategies](#fallback-strategies).

---

## Document Management Codeunits

### Copy Document Mgt. (Codeunit 6620)

| C/AL modification location | BC25 event | Status |
|---|---|---|
| When copying sales header | `OnAfterCopySalesHeader` | ✅ |
| When copying sales line | `OnAfterCopySalesLine` | ✅ |
| When copying purchase header | `OnAfterCopyPurchaseHeader` | ✅ |
| When copying purchase line | `OnAfterCopyPurchLine` | ✅ |
| Before recalculating lines | `OnBeforeRecalculateLines` | 🔍 |

### Format Address (Codeunit 365)

| C/AL modification location | BC25 event | Status |
|---|---|---|
| Custom address formatting | `OnAfterFormatAddr` | ✅ |
| Company address | `OnAfterCompany` | 🔍 |
| Vendor address | `OnAfterVendor` | 🔍 |
| Sales invoice address | `OnAfterSalesInvBillTo` / `OnAfterSalesInvShipTo` | 🔍 |
| Purchase order address | `OnAfterPurchHeaderBuyFrom` / `OnAfterPurchHeaderShipTo` | 🔍 |

### Format Document (Codeunit 368)

| C/AL modification location | BC25 event | Status |
|---|---|---|
| Setting total text | `OnAfterSetTotalLabels` | 🔍 |
| Setting payment text | After specific `SetPaymentX` procedures | 🔍 |

---

## Workflow & Approval Codeunits

### Approvals Mgmt. (Codeunit 1535)

| C/AL modification location | BC25 event | Status |
|---|---|---|
| Before sending approval request | `OnBeforeSendApprovalRequest` | 🔍 |
| After approval created | `OnAfterCreateApprovalRequests` | 🔍 |
| Custom approval check | `OnBeforeCheckPurchaseApprovalPossible` | 🔍 |
| After approval entry modified | `OnAfterApprovalEntryModify` | 🔍 |

### Workflow Event Handling (Codeunit 1520)

| C/AL modification location | BC25 event | Status |
|---|---|---|
| Adding custom workflow events | `OnAddWorkflowEventsToLibrary` | ✅ |
| Adding custom event conditions | `OnAddWorkflowEventPredecessorsToLibrary` | ✅ |

### Workflow Response Handling (Codeunit 1521)

| C/AL modification location | BC25 event | Status |
|---|---|---|
| Adding custom responses | `OnAddWorkflowResponsePredecessorsToLibrary` | ✅ |
| Custom response execution | `OnExecuteWorkflowResponse` | 🔍 |

### Workflow Setup (Codeunit 1502)

| C/AL modification location | BC25 event | Status |
|---|---|---|
| Adding custom workflow templates | `OnAfterInitWorkflowTemplates` | 🔍 |
| Inserting custom events/responses | `OnAddWorkflowCategoriesToLibrary` | 🔍 |

---

## Financial Codeunits

### Reminder-Make (Codeunit 392)

| C/AL modification location | BC25 event | Status |
|---|---|---|
| Before creating reminder | `OnBeforeMakeReminder` | 🔍 |
| After setting reminder entry filters | `OnAfterFilterCustLedgEntry` | 🔍 |
| Adding custom reminder line logic | `OnBeforeInsertReminderLine` | 🔍 |

### Reminder-Issue (Codeunit 393)

| C/AL modification location | BC25 event | Status |
|---|---|---|
| Before issuing | `OnBeforeIssueReminder` | ✅ |
| After issuing | `OnAfterIssueReminder` | ✅ |
| Before `IssuedReminderHeader.INSERT` | `OnBeforeIssuedReminderHeaderInsert` | 🔍 |

### Payment Tolerance Management (Codeunit 426)

| C/AL modification location | BC25 event | Status |
|---|---|---|
| During tolerance calculation | Various `OnBefore/AfterCalcTolerance` events | 🔍 |
| Mostly internal — few events available | See [Fallback Strategies](#fallback-strategies) | ⚠️ |

### FA Insert Ledger Entry (Codeunit 5600)

| C/AL modification location | BC25 event | Status |
|---|---|---|
| Before `FALedgerEntry.INSERT` | `OnBeforeInsertFA` | 🔍 |
| After `FALedgerEntry.INSERT` | `OnAfterInsertFA` | 🔍 |
| Copy custom FA posting group fields | Subscribe to insert events | 🔍 |

### Update Analysis View (Codeunit 410)

| C/AL modification location | BC25 event | Status |
|---|---|---|
| Before updating analysis view | `OnBeforeUpdateOne` | 🔍 |
| After updating entry | `OnAfterUpdateAnalysisViewEntry` | 🔍 |

---

## Table Trigger Events

These events fire when records are inserted/modified/deleted. Use them to replace
C/AL code that was inserted into standard table triggers.

### Generic Table Events (available on ALL tables)

| C/AL trigger | BC25 event | Notes |
|---|---|---|
| OnInsert (before standard code) | `OnBeforeInsertEvent` | Global event, fires before trigger |
| OnInsert (after standard code) | `OnAfterInsertEvent` | Global event, fires after trigger |
| OnModify (before standard code) | `OnBeforeModifyEvent` | Global event |
| OnModify (after standard code) | `OnAfterModifyEvent` | Global event |
| OnDelete (before standard code) | `OnBeforeDeleteEvent` | Global event |
| OnDelete (after standard code) | `OnAfterDeleteEvent` | Global event |
| OnRename (before standard code) | `OnBeforeRenameEvent` | Global event |
| OnRename (after standard code) | `OnAfterRenameEvent` | Global event |

### Specific Table Events (examples from common tables)

#### Transfer Header (Table 5740)

| C/AL modification | BC25 event | Status |
|---|---|---|
| OnInsert custom field init | `OnAfterInsertEvent` | ✅ |
| OnValidate of standard field | `OnAfterValidateEvent` (filter by FieldNo) | ✅ |
| `CopyFromTransferHeader` (on Transfer Receipt Header) | `OnAfterCopyFromTransferHeader` | ✅ |

#### Sales Header (Table 36)

| C/AL modification | BC25 event | Status |
|---|---|---|
| OnInsert | `OnAfterInsertEvent` or `OnAfterInitRecord` | ✅ |
| Field OnValidate ("Sell-to Customer No.") | `OnAfterValidateEvent` or specific `OnValidateSellToCustomerNo` | ✅ |
| `InitFromSalesHeader` (copy from archived/blanket) | `OnAfterInitFromSalesHeader` | 🔍 |

#### Purchase Header (Table 38)

| C/AL modification | BC25 event | Status |
|---|---|---|
| OnInsert | `OnAfterInsertEvent` or `OnAfterInitRecord` | ✅ |
| Field OnValidate ("Buy-from Vendor No.") | `OnAfterValidateEvent` or specific event | ✅ |
| Release document changes | Subscribe to Release Purchase Document events | ✅ |

---

## CopyFrom* Patterns

A very common C/AL pattern: copying custom fields when creating posted documents from source documents.

### General Approach

```al
[EventSubscriber(ObjectType::Table, Database::"<Posted Table>", '<OnAfterCopyFrom*>', '', false, false)]
local procedure CopyCustomFieldsOnPost(var <PostedRec>: Record "<Posted Table>"; <SourceRec>: Record "<Source Table>")
begin
    <PostedRec>."CustomField" := <SourceRec>."CustomField";
end;
```

### Common CopyFrom Events

| Source → Target | Event name | Table |
|---|---|---|
| Transfer Header → Transfer Receipt Header | `OnAfterCopyFromTransferHeader` | Transfer Receipt Header |
| Transfer Header → Transfer Shipment Header | `OnAfterCopyTransferHeader` | Transfer Shipment Header |
| Sales Header → Sales Invoice Header | Copy in `OnBeforeSalesInvHeaderInsert` | Sales-Post (CU 80) |
| Sales Header → Sales Shipment Header | Copy in `OnBeforeSalesShptHeaderInsert` | Sales-Post (CU 80) |
| Sales Header → Sales Cr.Memo Header | Copy in `OnBeforeSalesCrMemoHeaderInsert` | Sales-Post (CU 80) |
| Purchase Header → Purch. Inv. Header | Copy in `OnBeforePurchInvHeaderInsert` | Purch.-Post (CU 90) |
| Purchase Header → Purch. Rcpt. Header | Copy in `OnBeforePurchRcptHeaderInsert` | Purch.-Post (CU 90) |
| Service Header → Service Invoice Header | Copy in `OnBeforeServInvHeaderInsert` | Service-Post (CU 5980) |

---

## Fallback Strategies

When no BC25 event exists for a C/AL modification point:

### Strategy 1: Page-Level Override

If the custom code was in a table trigger but actually controls UI behavior:
```al
pageextension 50XXX MyPageExt extends "Standard Page"
{
    trigger OnInsertRecord(BelowxRec: Boolean): Boolean
    begin
        // Custom logic here
    end;
}
```

**Limitation:** Only works for page-initiated operations, not background/batch processes.

### Strategy 2: Table Extension Trigger

If your extension adds a field, you get full control of that field's triggers:
```al
field(50000; "MyField"; Code[20])
{
    trigger OnValidate()
    begin
        // Full custom validation here
    end;
}
```

### Strategy 3: Codeunit Wrapper

Create a new codeunit that wraps the standard operation with pre/post hooks:
```al
codeunit 50XXX "Custom Operation"
{
    procedure DoOperationWithCustomLogic(...)
    begin
        // Pre-processing (custom)
        StandardCodeunit.StandardProcedure(...);
        // Post-processing (custom)
    end;
}
```

**Limitation:** Callers must be updated to use the wrapper instead of calling the standard directly.

### Strategy 4: Record-Level Security / Security Filters

If the C/AL modification was filtering records based on permissions:
- Use `SecurityFiltering` property on the page
- Use permission sets with table data filters
- Use `SetSecurityFilter` in code

### Strategy 5: Accept Behavior Gap and Document

When no clean migration path exists:
1. Document exactly what the C/AL code did
2. Document why no BC25 equivalent exists
3. Assess business impact — is this feature still needed?
4. If critical, file a request with Microsoft for a new event
5. Meanwhile, consider a temporary workaround or manual process

### Strategy 6: Request Event via GitHub

Microsoft accepts event requests via the BCApps GitHub repository. If the custom code is
critical and no event exists, file an issue requesting a new integration event. This is a
long-term solution (weeks/months), not suitable for immediate migration needs.

---

## Event Subscriber Templates

### Template: Codeunit Integration Event

For subscribing to named integration events on standard codeunits (posting, document management, etc.):

```al
codeunit 50XXX "<StandardCUName>Events"
{
    Access = Internal;

    [EventSubscriber(ObjectType::Codeunit, Codeunit::"<Standard CU Name>", '<EventName>', '', false, false)]
    local procedure <DescriptiveName>(var <Params>)
    begin
        // Extracted from C/AL copy of <Standard CU Name>
        // Original tag: //<TAG>
        // Purpose: <brief description of what this code does>
    end;
}
```

### Template: Table Record Event (with RunTrigger guard)

For subscribing to generic table events (`OnBefore/AfterInsertEvent`, etc.):

```al
codeunit 50XXX "<TableName>Events"
{
    Access = Internal;

    [EventSubscriber(ObjectType::Table, Database::"<Table Name>", 'OnBeforeInsertEvent', '', false, false)]
    local procedure <TableName>_OnBeforeInsert(var Rec: Record "<Table Name>"; RunTrigger: Boolean)
    begin
        if not RunTrigger then
            exit;
        // Custom logic — only runs when triggers are intentionally fired
    end;
}
```

### Template: Table Field Validation Event

For subscribing to field-level validation events:

```al
[EventSubscriber(ObjectType::Table, Database::"<Table Name>", 'OnAfterValidateEvent', '<Field Name>', false, false)]
local procedure <TableName>_OnAfterValidate<FieldName>(var Rec: Record "<Table Name>"; var xRec: Record "<Table Name>"; CurrFieldNo: Integer)
begin
    // Replaces C/AL OnValidate modification on "<Field Name>"
end;
```

### Template: Utility Codeunit (shared logic)

When subscriber logic is complex or shared across multiple subscribers:

```al
codeunit 50XXX "<DescriptiveName>Mgt"
{
    Access = Internal;

    procedure CheckEmail(Employee: Record Employee)
    begin
        // Shared validation logic called from subscriber(s)
    end;
}
```

### Subscriber Codeunit Organization

- **Default:** one subscriber codeunit per standard table or codeunit that was modified
- **Consolidate related small changes** when they belong to the same functional chain and stay easy to review
- **Split by feature area** when a large standard codeunit has many unrelated customizations
- Name format: `<StandardObjectName>Events`
- File format: `<StandardObjectName>Events.Codeunit.al`
- Always declare `Access = Internal`
- Always use `false, false` for IncludeSender / GlobalVarAccess unless specifically needed
- Group all event subscribers for the same standard object together
- Keep subscriber procedures in the same order as they appear in the standard object
- Add `RunTrigger` guard for all generic record events (Insert, Modify, Delete)
