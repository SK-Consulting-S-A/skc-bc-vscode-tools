# AL Patterns Reference

Read `app.json` first for **suffix**, **namespace**, and **idRanges**. Replace `<Suffix>`, `<Name>`, and IDs accordingly.

## 1. Buffer table (temporary)

One row per data line. Add a field for **every** JSON property you will emit — even if not all are populated yet.

```al
namespace <RootNamespace>.Reporting;

table <ID> "<Name>DashLine<Suffix>"
{
    Caption = '<Name> Dashboard Line';
    TableType = Temporary;
    DataClassification = SystemMetadata;

    fields
    {
        field(1; "Entry No."; Integer) { Caption = 'Entry No.'; }
        field(10; "Posting Date"; Date) { Caption = 'Posting Date'; }
        field(11; "Document No."; Code[20]) { Caption = 'Document No.'; }
        field(12; "Document Kind"; Text[20]) { Caption = 'Document Kind'; }  // 'Sale' / 'Purchase'
        field(20; "VAT Bus. Posting Group"; Code[20]) { Caption = 'VAT Bus. Posting Group'; }
        field(21; "VAT Prod. Posting Group"; Code[20]) { Caption = 'VAT Prod. Posting Group'; }
        field(22; "VAT Identifier"; Code[20]) { Caption = 'VAT Identifier'; }
        field(23; "VAT Percent"; Decimal) { Caption = 'VAT %'; }
        field(24; "VAT Posting Description"; Text[100]) { Caption = 'VAT Posting Description'; }
        field(30; "Partner No."; Code[20]) { Caption = 'Partner No.'; }
        field(31; "Partner Name"; Text[100]) { Caption = 'Partner Name'; }
        field(40; "Currency Code"; Code[10]) { Caption = 'Currency Code'; }
        field(41; "Currency Factor"; Decimal) { Caption = 'Currency Factor'; }
        field(50; "VAT Base Amount"; Decimal) { Caption = 'VAT Base Amount'; }
        field(51; "VAT Amount"; Decimal) { Caption = 'VAT Amount'; }
        field(52; "VAT Base Amount EUR"; Decimal) { Caption = 'VAT Base Amount EUR'; }
        field(53; "VAT Amount EUR"; Decimal) { Caption = 'VAT Amount EUR'; }
        // ... add USD, ROE diff, etc. as the report needs
    }

    keys { key(PK; "Entry No.") { Clustered = true; } }
}
```

## 2. Data codeunit

```al
namespace <RootNamespace>.Reporting;

codeunit <ID> "<Name>Data<Suffix>"
{
    procedure GenerateDashboardJson(StartDate: Date; EndDate: Date; FilterValue: Text): Text
    begin
        PopulateBuffer(StartDate, EndDate, FilterValue);
        exit(BuildJson(StartDate, EndDate, FilterValue));
    end;

    local procedure PopulateBuffer(StartDate: Date; EndDate: Date; FilterValue: Text)
    var
        VATEntry: Record "VAT Entry";
        VATPostingSetup: Record "VAT Posting Setup";
        EntryNo: Integer;
    begin
        Buffer.Reset();
        Buffer.DeleteAll();
        VATEntry.SetLoadFields("Posting Date", "Document No.", "Type",
            "VAT Bus. Posting Group", "VAT Prod. Posting Group", Base, Amount);
        VATEntry.SetRange("Posting Date", StartDate, EndDate);
        if VATEntry.FindSet() then
            repeat
                EntryNo += 1;
                Buffer.Init();
                Buffer."Entry No." := EntryNo;
                Buffer."Posting Date" := VATEntry."Posting Date";
                Buffer."Document No." := VATEntry."Document No.";
                Buffer."Document Kind" := Format(VATEntry.Type);
                Buffer."VAT Bus. Posting Group" := VATEntry."VAT Bus. Posting Group";
                Buffer."VAT Prod. Posting Group" := VATEntry."VAT Prod. Posting Group";
                // Join lookups
                if VATPostingSetup.Get(VATEntry."VAT Bus. Posting Group", VATEntry."VAT Prod. Posting Group") then begin
                    Buffer."VAT Identifier" := VATPostingSetup."VAT Identifier";
                    Buffer."VAT Percent" := VATPostingSetup."VAT %";
                    Buffer."VAT Posting Description" :=
                        CopyStr(VATPostingSetup.Description, 1, MaxStrLen(Buffer."VAT Posting Description"));
                end;
                Buffer."VAT Base Amount" := VATEntry.Base;
                Buffer."VAT Amount" := VATEntry.Amount;
                Buffer."VAT Base Amount EUR" := VATEntry.Base;   // LCY = EUR here
                Buffer."VAT Amount EUR" := VATEntry.Amount;
                // ... currency conversions via local procs
                Buffer.Insert();
            until VATEntry.Next() = 0;
    end;

    local procedure BuildJson(StartDate: Date; EndDate: Date; FilterValue: Text): Text
    var
        JsonHelper: Codeunit DashboardJsonHelperAFK001;  // existing project helper
        Root: JsonObject;
        Lines: JsonArray;
        Line: JsonObject;
    begin
        Buffer.Reset();
        if Buffer.FindSet() then
            repeat
                Clear(Line);
                Line.Add('entryNo', Buffer."Entry No.");
                Line.Add('postingDate', Format(Buffer."Posting Date", 0, '<Year4>-<Month,2>-<Day,2>'));
                Line.Add('documentNo', Buffer."Document No.");
                Line.Add('documentKind', Buffer."Document Kind");
                Line.Add('vatBusPostingGroup', Buffer."VAT Bus. Posting Group");
                Line.Add('vatProdPostingGroup', Buffer."VAT Prod. Posting Group");
                Line.Add('vatIdentifier', Buffer."VAT Identifier");
                Line.Add('vatPercent', Buffer."VAT Percent");
                Line.Add('vatPostingDescription', Buffer."VAT Posting Description");
                Line.Add('partnerName', Buffer."Partner Name");
                Line.Add('currencyCode', Buffer."Currency Code");
                Line.Add('currencyFactor', Buffer."Currency Factor");
                Line.Add('vatBaseAmount', Buffer."VAT Base Amount");
                Line.Add('vatAmount', Buffer."VAT Amount");
                Line.Add('vatBaseAmountEUR', Buffer."VAT Base Amount EUR");
                Line.Add('vatAmountEUR', Buffer."VAT Amount EUR");
                Lines.Add(Line);
            until Buffer.Next() = 0;

        Root.Add('title', 'VAT Report – Germany');
        Root.Add('startDate', Format(StartDate, 0, '<Year4>-<Month,2>-<Day,2>'));
        Root.Add('endDate', Format(EndDate, 0, '<Year4>-<Month,2>-<Day,2>'));
        Root.Add('lines', Lines);
        exit(JsonHelper.ToText(Root));
    end;

    var
        Buffer: Record "<Name>DashLine<Suffix>" temporary;
}
```

> **Audit rule:** every `COL_DEFS` key in dashboard.js must have a matching `Line.Add(...)` here, and that buffer field must be assigned in `PopulateBuffer()`. A field that is declared but never `:=` set is the #1 cause of blank columns.

## 3. Control addin

```al
namespace <RootNamespace>.Reporting;

controladdin "<Name>Dash<Suffix>"
{
    RequestedHeight = 800;
    MinimumHeight = 400;
    MinimumWidth = 300;
    VerticalStretch = true;
    HorizontalStretch = true;          // NO RequestedWidth / MaximumWidth — they block full-width

    Scripts =
        'ControlAddins/<Name>Dash/dashboard.js';
    StyleSheets =
        'ControlAddins/<Name>Dash/dashboard.css';

    StartupScript = 'ControlAddins/<Name>Dash/dashboard.js';

    event OnReady();
    event OnDateFilterChanged(StartDate: Text; EndDate: Text);
    procedure LoadData(DataJson: Text);
    procedure PrintDashboard();
}
```

## 4. Host page

```al
namespace <RootNamespace>.Reporting;

page <ID> "<Name>Dash<Suffix>"
{
    PageType = Card;
    ApplicationArea = All;
    UsageCategory = ReportsAndAnalysis;
    Caption = 'VAT Report - Germany';

    layout
    {
        area(Content)
        {
            usercontrol(Control; "<Name>Dash<Suffix>")
            {
                ApplicationArea = All;

                trigger OnReady()
                begin
                    DashboardReady := true;
                    LoadDashboard();
                end;

                trigger OnDateFilterChanged(StartDateText: Text; EndDateText: Text)
                begin
                    StartDate := ParseISODate(StartDateText);
                    EndDate := ParseISODate(EndDateText);
                    LoadDashboard();
                end;
            }
        }
    }

    actions
    {
        area(Processing)
        {
            action(Generate)
            {
                Caption = 'Generate';
                Image = Refresh;
                ApplicationArea = All;
                trigger OnAction() begin LoadDashboard(); end;
            }
            action(Print)
            {
                Caption = 'Print / PDF';
                Image = Print;
                ApplicationArea = All;
                trigger OnAction() begin CurrPage.Control.PrintDashboard(); end;
            }
        }
    }

    trigger OnOpenPage()
    var
        CurrentYear: Integer;
    begin
        CurrentYear := Date2DMY(WorkDate(), 3);
        StartDate := DMY2Date(1, 1, CurrentYear);
        EndDate := DMY2Date(31, 12, CurrentYear);
    end;

    local procedure LoadDashboard()
    var
        JsonTxt: Text;
    begin
        if not DashboardReady then exit;
        JsonTxt := DataCU.GenerateDashboardJson(StartDate, EndDate, '');
        CurrPage.Control.LoadData(JsonTxt);
    end;

    local procedure ParseISODate(DateText: Text): Date
    var
        Y: Integer; M: Integer; D: Integer;
    begin
        if StrLen(DateText) >= 10 then
            if Evaluate(Y, CopyStr(DateText, 1, 4)) and
               Evaluate(M, CopyStr(DateText, 6, 2)) and
               Evaluate(D, CopyStr(DateText, 9, 2)) then
                if (Y > 0) and (M in [1 .. 12]) and (D in [1 .. 31]) then
                    exit(DMY2Date(D, M, Y));
        exit(0D);
    end;

    var
        DataCU: Codeunit "<Name>Data<Suffix>";
        StartDate: Date;
        EndDate: Date;
        DashboardReady: Boolean;
}
```
