#!/usr/bin/env node
"use strict";

// Generates every SKC colour theme from one shared structure.
//
// The variants exist to answer different working situations, not to be four
// more palettes on the Marketplace: a daily dark driver, a daylight light one,
// a high-contrast build for demos and screen sharing, and a warm low-blue-light
// build for long evening sessions. What makes them useful is that they are
// structurally identical - the same diagnostic, diff, merge, bracket, inlay
// hint and test colours land in the same places - so switching variant never
// moves meaning, only brightness and temperature.
//
// Four hand-written theme files drift apart within a release or two, which is
// how a variant ends up missing merge-conflict colours. The palettes below are
// the only thing that differs; everything else is derived. Run `npm run
// build:themes` after editing and commit the generated themes/*.json.

const fs = require("fs");
const path = require("path");

const themesDir = path.resolve(__dirname, "..", "themes");

// AL work leans on specific editor surfaces, so each palette must supply the
// colours those surfaces need rather than letting VS Code fall back to defaults:
// analyzer diagnostics (CodeCop/UICop/AppSourceCop), delta and merge diffing,
// deep begin/end bracket nesting, and the inlay hints the presets switch on.
const palettes = [
    {
        id: "skc-dark",
        label: "SKC Dark",
        uiTheme: "vs-dark",
        type: "dark",

        editor: "#0f0f1a",
        chrome: "#0b0b14",
        elevated: "#16162a",
        input: "#1a1a2e",
        raised: "#1c1c34",
        lineHighlight: "#16162a",
        lineHighlightBorder: "#00000000",
        border: "#2a2a48",
        borderStrong: "#3a3a60",
        shadow: "#00000080",

        fg: "#e0e0f0",
        fgStrong: "#ffffff",
        fgMuted: "#9898b8",
        fgSubtle: "#7878a0",
        fgFaint: "#4a4a6a",

        accent: "#6c63ff",
        accentHover: "#8a83ff",
        accentFg: "#ffffff",
        accent2: "#00d4ff",

        error: "#F87171",
        warning: "#FBBF24",
        info: "#00d4ff",
        success: "#34D399",
        errorSurface: "#3a1520",
        warningSurface: "#33280d",
        infoSurface: "#0d2a33",

        sel: "#6c63ff44",
        selInactive: "#6c63ff22",
        selBorder: "#00000000",
        find: "#6c63ff88",
        findHi: "#6c63ff44",
        findBorder: "#00000000",
        wordHi: "#6c63ff33",
        wordHiStrong: "#6c63ff4d",
        hoverHi: "#6c63ff28",
        rangeHi: "#6c63ff22",
        listHover: "#6c63ff1a",
        listActive: "#6c63ff44",
        listInactive: "#6c63ff28",
        accentSoft: "#6c63ff18",
        accentGuide: "#6c63ff88",

        addedSoft: "#34D39922",
        addedFaint: "#34D39914",
        removedSoft: "#F8717122",
        removedFaint: "#F8717114",
        currentSoft: "#00d4ff22",
        currentHeader: "#00d4ff44",
        incomingSoft: "#6c63ff22",
        incomingHeader: "#6c63ff55",
        commonSoft: "#7878a022",
        commonHeader: "#7878a044",

        synComment: "#6e6e92",
        synKeyword: "#8a83ff",
        synString: "#ce9178",
        synNumber: "#b5cea8",
        synType: "#00d4ff",
        synFunction: "#E8D48A",
        synVariable: "#c5d0f0",
        synConstant: "#b4e0ff",
        synBuiltin: "#ff6cf0",
        synRegex: "#ff6cf0",
        synTag: "#8a83ff",
        synAttr: "#c5d0f0",
        synOperator: "#e0e0f0",
        synPunct: "#7878a0",
        synMember: "#9cdcfe",
        synEvent: "#ffa657",

        bracket1: "#6c63ff",
        bracket2: "#00d4ff",
        bracket3: "#ff6cf0",
        bracket4: "#34D399",
        bracket5: "#FBBF24",
        bracket6: "#8a83ff",

        italics: true,
        boldKeywords: false,
        statusOnAccent: false,
    },
    {
        id: "skc-light",
        label: "SKC Light",
        uiTheme: "vs",
        type: "light",

        editor: "#ffffff",
        chrome: "#f4f3f8",
        elevated: "#ffffff",
        input: "#ffffff",
        raised: "#eae9f2",
        lineHighlight: "#f7f7fa",
        lineHighlightBorder: "#00000000",
        border: "#e1dfea",
        borderStrong: "#c8c5d5",
        shadow: "#17152822",

        fg: "#171528",
        fgStrong: "#000000",
        fgMuted: "#5f5a70",
        fgSubtle: "#77738a",
        fgFaint: "#a09baf",

        accent: "#6c63ff",
        accentHover: "#574fe0",
        accentFg: "#ffffff",
        accent2: "#007a91",

        error: "#b42318",
        warning: "#b45309",
        info: "#007a91",
        success: "#047857",
        errorSurface: "#fdf2f1",
        warningSurface: "#fdf6ec",
        infoSurface: "#eef8fb",

        sel: "#6c63ff2e",
        selInactive: "#6c63ff18",
        selBorder: "#00000000",
        find: "#f6c45399",
        findHi: "#f6c45355",
        findBorder: "#b45309",
        wordHi: "#6c63ff1a",
        wordHiStrong: "#6c63ff2e",
        hoverHi: "#6c63ff14",
        rangeHi: "#6c63ff14",
        listHover: "#eae9f2",
        listActive: "#6c63ff24",
        listInactive: "#6c63ff14",
        accentSoft: "#6c63ff14",
        accentGuide: "#6c63ff66",

        addedSoft: "#04785722",
        addedFaint: "#04785712",
        removedSoft: "#b4231822",
        removedFaint: "#b4231812",
        currentSoft: "#007a9118",
        currentHeader: "#007a9133",
        incomingSoft: "#6c63ff18",
        incomingHeader: "#6c63ff33",
        commonSoft: "#77738a14",
        commonHeader: "#77738a2e",

        synComment: "#77738a",
        synKeyword: "#6c3fc4",
        synString: "#9a3412",
        synNumber: "#007a91",
        synType: "#a21caf",
        synFunction: "#2563eb",
        synVariable: "#171528",
        synConstant: "#007a91",
        synBuiltin: "#a21caf",
        synRegex: "#a21caf",
        synTag: "#6c3fc4",
        synAttr: "#2563eb",
        synOperator: "#403b55",
        synPunct: "#5f5a70",
        synMember: "#0b5fa5",
        synEvent: "#be185d",

        bracket1: "#6c63ff",
        bracket2: "#007a91",
        bracket3: "#a21caf",
        bracket4: "#047857",
        bracket5: "#b45309",
        bracket6: "#2563eb",

        italics: true,
        boldKeywords: false,
        statusOnAccent: true,
    },
    {
        id: "skc-presentation",
        label: "SKC Presentation",
        uiTheme: "vs",
        type: "light",

        // Built for a projector or a compressed screen share, where low-contrast
        // greys and italics disappear. Everything the audience must follow - the
        // cursor, the selection, the current find match - is deliberately loud,
        // and find/selection carry borders so they survive video compression.
        editor: "#ffffff",
        chrome: "#f2f2f5",
        elevated: "#ffffff",
        input: "#ffffff",
        raised: "#e6e6eb",
        lineHighlight: "#f0effa",
        lineHighlightBorder: "#d6d4e6",
        border: "#b9b7c4",
        borderStrong: "#6e6b7b",
        shadow: "#00000033",

        fg: "#101014",
        fgStrong: "#000000",
        fgMuted: "#3a3844",
        fgSubtle: "#55525f",
        fgFaint: "#7a7786",

        accent: "#4b3fd4",
        accentHover: "#3a2fb0",
        accentFg: "#ffffff",
        accent2: "#005f73",

        error: "#b3261e",
        warning: "#8a4b00",
        info: "#005f73",
        success: "#056839",
        errorSurface: "#fdeceb",
        warningSurface: "#fdf3e6",
        infoSurface: "#e8f4f7",

        sel: "#4b3fd44d",
        selInactive: "#4b3fd426",
        selBorder: "#4b3fd4",
        find: "#ffd54f",
        findHi: "#ffecb3",
        findBorder: "#8a4b00",
        wordHi: "#4b3fd426",
        wordHiStrong: "#4b3fd44d",
        hoverHi: "#4b3fd41f",
        rangeHi: "#4b3fd41f",
        listHover: "#e6e6eb",
        listActive: "#4b3fd43d",
        listInactive: "#4b3fd41f",
        accentSoft: "#4b3fd41f",
        accentGuide: "#4b3fd4aa",

        addedSoft: "#05683933",
        addedFaint: "#0568391f",
        removedSoft: "#b3261e33",
        removedFaint: "#b3261e1f",
        currentSoft: "#005f7326",
        currentHeader: "#005f734d",
        incomingSoft: "#4b3fd426",
        incomingHeader: "#4b3fd44d",
        commonSoft: "#55525f1f",
        commonHeader: "#55525f3d",

        synComment: "#55525f",
        synKeyword: "#6a1b9a",
        synString: "#a03000",
        synNumber: "#00565f",
        synType: "#8a0f7a",
        synFunction: "#123fb8",
        synVariable: "#101014",
        synConstant: "#00565f",
        synBuiltin: "#8a0f7a",
        synRegex: "#8a0f7a",
        synTag: "#6a1b9a",
        synAttr: "#123fb8",
        synOperator: "#101014",
        synPunct: "#3a3844",
        synMember: "#005a8a",
        synEvent: "#a81b60",

        bracket1: "#4b3fd4",
        bracket2: "#005f73",
        bracket3: "#8a0f7a",
        bracket4: "#056839",
        bracket5: "#8a4b00",
        bracket6: "#123fb8",

        italics: false,
        boldKeywords: true,
        statusOnAccent: true,
    },
    {
        id: "skc-beach",
        label: "SKC Beach",
        uiTheme: "vs",
        type: "light",

        // Warm, low blue light, for long sessions and late evenings.
        editor: "#fbf6ec",
        chrome: "#f1e6d0",
        elevated: "#fffdf8",
        input: "#fffdf8",
        raised: "#e8d7bc",
        lineHighlight: "#f5ecda",
        lineHighlightBorder: "#00000000",
        border: "#d8c6aa",
        borderStrong: "#cdb99b",
        shadow: "#6b513322",

        fg: "#3f3428",
        fgStrong: "#241d14",
        fgMuted: "#766451",
        fgSubtle: "#8c7a67",
        fgFaint: "#b09a7d",

        accent: "#0e7490",
        accentHover: "#155e75",
        accentFg: "#ffffff",
        accent2: "#0f766e",

        error: "#b42318",
        warning: "#b45309",
        info: "#0e7490",
        success: "#3f7d58",
        errorSurface: "#f9ece6",
        warningSurface: "#faf0dd",
        infoSurface: "#e9f2f4",

        sel: "#8cc8d455",
        selInactive: "#8cc8d433",
        selBorder: "#00000000",
        find: "#f6c45388",
        findHi: "#f6c45355",
        findBorder: "#b45309",
        wordHi: "#0e749022",
        wordHiStrong: "#0e749038",
        hoverHi: "#0e74901a",
        rangeHi: "#0e74901a",
        listHover: "#e8d7bc88",
        listActive: "#8cc8d455",
        listInactive: "#8cc8d433",
        accentSoft: "#0e74901a",
        accentGuide: "#0e749088",

        addedSoft: "#3f7d5826",
        addedFaint: "#3f7d5814",
        removedSoft: "#c2410c26",
        removedFaint: "#c2410c14",
        currentSoft: "#0e74901f",
        currentHeader: "#0e74903d",
        incomingSoft: "#0f766e1f",
        incomingHeader: "#0f766e3d",
        commonSoft: "#8c7a6714",
        commonHeader: "#8c7a6733",

        synComment: "#8c7a67",
        synKeyword: "#c2410c",
        synString: "#9a3412",
        synNumber: "#0f766e",
        synType: "#7c3f2c",
        synFunction: "#0e7490",
        synVariable: "#3f3428",
        synConstant: "#0f766e",
        synBuiltin: "#a13b6c",
        synRegex: "#a13b6c",
        synTag: "#c2410c",
        synAttr: "#0e7490",
        synOperator: "#5b4a39",
        synPunct: "#766451",
        synMember: "#8a5a00",
        synEvent: "#9d174d",

        bracket1: "#0e7490",
        bracket2: "#c2410c",
        bracket3: "#0f766e",
        bracket4: "#a13b6c",
        bracket5: "#b45309",
        bracket6: "#7c3f2c",

        italics: true,
        boldKeywords: false,
        statusOnAccent: true,
    },
];

function colors(p) {
    const statusBg = p.statusOnAccent ? p.fgStrong : p.chrome;
    const statusFg = p.statusOnAccent ? "#ffffff" : p.fg;

    return {
        foreground: p.fg,
        disabledForeground: p.fgSubtle,
        descriptionForeground: p.fgMuted,
        errorForeground: p.error,
        focusBorder: p.accent,
        "icon.foreground": p.fg,
        "sash.hoverBorder": p.accent,
        "widget.border": p.border,
        "widget.shadow": p.shadow,
        "selection.background": p.sel,

        "activityBar.background": p.chrome,
        "activityBar.foreground": p.fg,
        "activityBar.inactiveForeground": p.fgSubtle,
        "activityBar.border": p.border,
        "activityBar.activeBorder": p.accent,
        "activityBar.activeBackground": p.accentSoft,
        "activityBarBadge.background": p.accent,
        "activityBarBadge.foreground": p.accentFg,
        "activityBarTop.foreground": p.fg,
        "activityBarTop.activeBorder": p.accent,
        "activityBarTop.inactiveForeground": p.fgSubtle,

        "badge.background": p.accent,
        "badge.foreground": p.accentFg,

        "button.background": p.accent,
        "button.foreground": p.accentFg,
        "button.hoverBackground": p.accentHover,
        "button.border": p.border,
        "button.secondaryBackground": p.raised,
        "button.secondaryForeground": p.fg,
        "button.secondaryHoverBackground": p.borderStrong,

        "checkbox.background": p.input,
        "checkbox.border": p.borderStrong,
        "checkbox.foreground": p.fg,
        "checkbox.selectBackground": p.accent,

        "dropdown.background": p.input,
        "dropdown.border": p.borderStrong,
        "dropdown.foreground": p.fg,
        "dropdown.listBackground": p.elevated,

        "input.background": p.input,
        "input.border": p.borderStrong,
        "input.foreground": p.fg,
        "input.placeholderForeground": p.fgSubtle,
        "inputOption.activeBackground": p.wordHiStrong,
        "inputOption.activeBorder": p.accent,
        "inputOption.activeForeground": p.fg,
        "inputValidation.errorBackground": p.errorSurface,
        "inputValidation.errorBorder": p.error,
        "inputValidation.errorForeground": p.error,
        "inputValidation.infoBackground": p.infoSurface,
        "inputValidation.infoBorder": p.info,
        "inputValidation.warningBackground": p.warningSurface,
        "inputValidation.warningBorder": p.warning,

        "editor.background": p.editor,
        "editor.foreground": p.fg,
        "editorCursor.foreground": p.accent2,
        "editorMultiCursor.primary.foreground": p.accent2,
        "editorMultiCursor.secondary.foreground": p.accent,
        "editor.lineHighlightBackground": p.lineHighlight,
        "editor.lineHighlightBorder": p.lineHighlightBorder,
        "editor.selectionBackground": p.sel,
        "editor.selectionForeground": p.fgStrong,
        "editor.inactiveSelectionBackground": p.selInactive,
        "editor.selectionHighlightBackground": p.wordHi,
        "editor.selectionHighlightBorder": p.selBorder,
        "editor.wordHighlightBackground": p.wordHi,
        "editor.wordHighlightStrongBackground": p.wordHiStrong,
        "editor.findMatchBackground": p.find,
        "editor.findMatchBorder": p.findBorder,
        "editor.findMatchHighlightBackground": p.findHi,
        "editor.findMatchHighlightBorder": p.findBorder,
        "editor.findRangeHighlightBackground": p.rangeHi,
        "editor.hoverHighlightBackground": p.hoverHi,
        "editor.rangeHighlightBackground": p.rangeHi,
        "editor.foldBackground": p.rangeHi,
        "editorLink.activeForeground": p.accent2,
        "editorWhitespace.foreground": p.fgFaint,
        "editorIndentGuide.background1": p.border,
        "editorIndentGuide.activeBackground1": p.accentGuide,
        "editorLineNumber.foreground": p.fgFaint,
        "editorLineNumber.activeForeground": p.accent,
        "editorRuler.foreground": p.border,
        "editorCodeLens.foreground": p.fgSubtle,

        // AL nests begin/end deeply, so every pair level gets a distinct colour
        // rather than repeating after three.
        "editorBracketMatch.background": p.wordHi,
        "editorBracketMatch.border": p.accent,
        "editorBracketHighlight.foreground1": p.bracket1,
        "editorBracketHighlight.foreground2": p.bracket2,
        "editorBracketHighlight.foreground3": p.bracket3,
        "editorBracketHighlight.foreground4": p.bracket4,
        "editorBracketHighlight.foreground5": p.bracket5,
        "editorBracketHighlight.foreground6": p.bracket6,
        "editorBracketHighlight.unexpectedBracket.foreground": p.error,
        "editorBracketPairGuide.background1": p.border,
        "editorBracketPairGuide.activeBackground1": p.bracket1,
        "editorBracketPairGuide.activeBackground2": p.bracket2,
        "editorBracketPairGuide.activeBackground3": p.bracket3,

        // The presets enable AL parameter-name and return-type inlay hints, so
        // these must read as annotation rather than as code.
        "editorInlayHint.background": p.accentSoft,
        "editorInlayHint.foreground": p.fgMuted,
        "editorInlayHint.typeBackground": p.accentSoft,
        "editorInlayHint.typeForeground": p.synType,
        "editorInlayHint.parameterBackground": p.accentSoft,
        "editorInlayHint.parameterForeground": p.fgMuted,

        // Long codeunits scroll past their own object and procedure headers.
        "editorStickyScroll.background": p.elevated,
        "editorStickyScroll.border": p.border,
        "editorStickyScroll.shadow": p.shadow,
        "editorStickyScrollHover.background": p.listHover,

        // Analyzer output: CodeCop, UICop and AppSourceCop live here.
        "editorError.foreground": p.error,
        "editorWarning.foreground": p.warning,
        "editorInfo.foreground": p.info,
        "editorHint.foreground": p.accent,
        "editorGutter.background": p.editor,
        "editorGutter.addedBackground": p.success,
        "editorGutter.modifiedBackground": p.info,
        "editorGutter.deletedBackground": p.error,
        "editorGutter.commentRangeForeground": p.fgSubtle,
        "editorUnnecessaryCode.border": p.warning,
        "editorOverviewRuler.border": p.border,
        "editorOverviewRuler.background": p.editor,
        "editorOverviewRuler.findMatchForeground": p.find,
        "editorOverviewRuler.selectionHighlightForeground": p.wordHiStrong,
        "editorOverviewRuler.wordHighlightForeground": p.wordHi,
        "editorOverviewRuler.addedForeground": p.success,
        "editorOverviewRuler.modifiedForeground": p.info,
        "editorOverviewRuler.deletedForeground": p.error,
        "editorOverviewRuler.errorForeground": p.error,
        "editorOverviewRuler.warningForeground": p.warning,
        "editorOverviewRuler.infoForeground": p.info,
        "editorOverviewRuler.bracketMatchForeground": p.accent,
        "problemsErrorIcon.foreground": p.error,
        "problemsWarningIcon.foreground": p.warning,
        "problemsInfoIcon.foreground": p.info,

        // Error Lens ships in the extension pack and renders diagnostics inline.
        "errorLens.errorForeground": p.error,
        "errorLens.errorBackground": p.errorSurface,
        "errorLens.errorGutterIconColor": p.error,
        "errorLens.warningForeground": p.warning,
        "errorLens.warningBackground": p.warningSurface,
        "errorLens.warningGutterIconColor": p.warning,
        "errorLens.infoForeground": p.info,
        "errorLens.infoBackground": p.infoSurface,
        "errorLens.infoGutterIconColor": p.info,
        "errorLens.hintForeground": p.fgMuted,
        "errorLens.hintBackground": p.accentSoft,
        "errorLens.statusBarErrorForeground": p.error,
        "errorLens.statusBarWarningForeground": p.warning,
        "errorLens.statusBarInfoForeground": p.info,
        "errorLens.statusBarHintForeground": p.fgMuted,

        "editorWidget.background": p.elevated,
        "editorWidget.border": p.border,
        "editorWidget.foreground": p.fg,
        "editorSuggestWidget.background": p.elevated,
        "editorSuggestWidget.border": p.border,
        "editorSuggestWidget.foreground": p.fg,
        "editorSuggestWidget.selectedBackground": p.listActive,
        "editorSuggestWidget.selectedForeground": p.fgStrong,
        "editorSuggestWidget.highlightForeground": p.accent2,
        "editorSuggestWidget.focusHighlightForeground": p.accent2,
        "editorHoverWidget.background": p.elevated,
        "editorHoverWidget.border": p.border,
        "editorHoverWidget.foreground": p.fg,
        "editorHoverWidget.statusBarBackground": p.raised,
        "editorGhostText.foreground": p.fgSubtle,

        "minimap.background": p.editor,
        "minimap.selectionHighlight": p.sel,
        "minimap.findMatchHighlight": p.find,
        "minimap.errorHighlight": p.error,
        "minimap.warningHighlight": p.warning,
        "minimapGutter.addedBackground": p.success,
        "minimapGutter.modifiedBackground": p.info,
        "minimapGutter.deletedBackground": p.error,
        "minimapSlider.background": p.wordHi,
        "minimapSlider.hoverBackground": p.wordHiStrong,
        "minimapSlider.activeBackground": p.wordHiStrong,

        // Delta and upgrade work is diff-heavy, and a merge conflict must never
        // rely on VS Code's fallback colours to tell current from incoming.
        "diffEditor.insertedTextBackground": p.addedSoft,
        "diffEditor.removedTextBackground": p.removedSoft,
        "diffEditor.insertedLineBackground": p.addedFaint,
        "diffEditor.removedLineBackground": p.removedFaint,
        "diffEditor.diagonalFill": p.border,
        "diffEditor.border": p.border,
        "diffEditorOverview.insertedForeground": p.success,
        "diffEditorOverview.removedForeground": p.error,
        "merge.currentHeaderBackground": p.currentHeader,
        "merge.currentContentBackground": p.currentSoft,
        "merge.incomingHeaderBackground": p.incomingHeader,
        "merge.incomingContentBackground": p.incomingSoft,
        "merge.commonHeaderBackground": p.commonHeader,
        "merge.commonContentBackground": p.commonSoft,
        "merge.border": p.border,
        "mergeEditor.change.background": p.addedSoft,
        "mergeEditor.conflict.unhandledUnfocused.border": p.warning,
        "mergeEditor.conflict.unhandledFocused.border": p.error,
        "mergeEditor.conflict.handledUnfocused.border": p.border,
        "mergeEditor.conflict.handledFocused.border": p.success,
        "editorOverviewRuler.currentContentForeground": p.info,
        "editorOverviewRuler.incomingContentForeground": p.accent,
        "editorOverviewRuler.commonContentForeground": p.fgSubtle,

        "sideBar.background": p.chrome,
        "sideBar.foreground": p.fg,
        "sideBar.border": p.border,
        "sideBarTitle.foreground": p.fg,
        "sideBarSectionHeader.background": p.chrome,
        "sideBarSectionHeader.foreground": p.fgMuted,
        "sideBarSectionHeader.border": p.border,
        "sideBarStickyScroll.background": p.chrome,

        "list.activeSelectionBackground": p.listActive,
        "list.activeSelectionForeground": p.fgStrong,
        "list.activeSelectionIconForeground": p.fgStrong,
        "list.inactiveSelectionBackground": p.listInactive,
        "list.inactiveSelectionForeground": p.fg,
        "list.hoverBackground": p.listHover,
        "list.hoverForeground": p.fg,
        "list.focusBackground": p.listActive,
        "list.focusForeground": p.fg,
        "list.focusOutline": p.accent,
        "list.highlightForeground": p.accent2,
        "list.focusHighlightForeground": p.accent2,
        "list.dropBackground": p.listActive,
        "list.errorForeground": p.error,
        "list.warningForeground": p.warning,
        "list.filterMatchBackground": p.findHi,
        "list.filterMatchBorder": p.findBorder,
        "listFilterWidget.background": p.elevated,
        "listFilterWidget.outline": p.accent,
        "listFilterWidget.noMatchesOutline": p.error,
        "tree.indentGuidesStroke": p.border,
        "tree.inactiveIndentGuidesStroke": p.border,

        "menu.background": p.elevated,
        "menu.foreground": p.fg,
        "menu.selectionBackground": p.accent,
        "menu.selectionForeground": p.accentFg,
        "menu.separatorBackground": p.border,
        "menu.border": p.border,
        "menubar.selectionBackground": p.listActive,
        "menubar.selectionForeground": p.fg,

        "notificationCenterHeader.background": p.elevated,
        "notificationCenterHeader.foreground": p.fg,
        "notifications.background": p.elevated,
        "notifications.border": p.border,
        "notifications.foreground": p.fg,
        "notificationLink.foreground": p.accent2,
        "notificationsErrorIcon.foreground": p.error,
        "notificationsWarningIcon.foreground": p.warning,
        "notificationsInfoIcon.foreground": p.info,

        "panel.background": p.chrome,
        "panel.border": p.border,
        "panelTitle.activeBorder": p.accent,
        "panelTitle.activeForeground": p.fg,
        "panelTitle.inactiveForeground": p.fgSubtle,
        "panelInput.border": p.borderStrong,
        "panelSection.border": p.border,
        "panelSectionHeader.background": p.chrome,

        "peekView.border": p.accent,
        "peekViewEditor.background": p.elevated,
        "peekViewEditor.matchHighlightBackground": p.find,
        "peekViewEditor.matchHighlightBorder": p.findBorder,
        "peekViewEditorGutter.background": p.elevated,
        "peekViewResult.background": p.chrome,
        "peekViewResult.fileForeground": p.fg,
        "peekViewResult.lineForeground": p.fgMuted,
        "peekViewResult.matchHighlightBackground": p.findHi,
        "peekViewResult.selectionBackground": p.listActive,
        "peekViewResult.selectionForeground": p.fgStrong,
        "peekViewTitle.background": p.elevated,
        "peekViewTitleLabel.foreground": p.fg,
        "peekViewTitleDescription.foreground": p.fgMuted,

        "pickerGroup.border": p.border,
        "pickerGroup.foreground": p.accent2,
        "progressBar.background": p.accent,
        "quickInput.background": p.elevated,
        "quickInput.foreground": p.fg,
        "quickInputList.focusBackground": p.listActive,
        "quickInputList.focusForeground": p.fgStrong,
        "quickInputTitle.background": p.raised,

        "scrollbar.shadow": p.shadow,
        "scrollbarSlider.background": p.wordHi,
        "scrollbarSlider.hoverBackground": p.wordHiStrong,
        "scrollbarSlider.activeBackground": p.wordHiStrong,

        "settings.headerForeground": p.fgStrong,
        "settings.modifiedItemIndicator": p.accent,
        "settings.dropdownBackground": p.input,
        "settings.dropdownBorder": p.borderStrong,
        "settings.focusedRowBackground": p.accentSoft,
        "settings.headerBorder": p.border,
        "settings.sashBorder": p.border,

        "statusBar.background": statusBg,
        "statusBar.foreground": statusFg,
        "statusBar.border": p.border,
        "statusBar.noFolderBackground": statusBg,
        "statusBar.debuggingBackground": p.accent,
        "statusBar.debuggingForeground": p.accentFg,
        "statusBar.debuggingBorder": p.accent,
        "statusBar.focusBorder": p.accent,
        "statusBarItem.hoverBackground": p.wordHiStrong,
        "statusBarItem.hoverForeground": "#ffffff",
        "statusBarItem.activeBackground": p.wordHiStrong,
        "statusBarItem.remoteBackground": p.accent,
        "statusBarItem.remoteForeground": p.accentFg,
        "statusBarItem.prominentBackground": p.wordHiStrong,
        "statusBarItem.errorBackground": p.error,
        "statusBarItem.errorForeground": "#ffffff",
        "statusBarItem.warningBackground": p.warning,
        "statusBarItem.warningForeground": "#ffffff",

        "tab.activeBackground": p.editor,
        "tab.activeForeground": p.fgStrong,
        "tab.activeBorder": p.editor,
        "tab.activeBorderTop": p.accent,
        "tab.inactiveBackground": p.chrome,
        "tab.inactiveForeground": p.fgSubtle,
        "tab.border": p.border,
        "tab.hoverBackground": p.listHover,
        "tab.unfocusedActiveBorderTop": p.border,
        "tab.unfocusedHoverBackground": p.listHover,
        "tab.lastPinnedBorder": p.border,
        "tab.selectedBackground": p.editor,
        "tab.selectedForeground": p.fgStrong,
        "tab.selectedBorderTop": p.accent2,
        "editorGroup.border": p.border,
        "editorGroupHeader.tabsBackground": p.chrome,
        "editorGroupHeader.tabsBorder": p.border,
        "editorGroupHeader.noTabsBackground": p.chrome,
        "editorGroup.dropBackground": p.listActive,

        "terminal.background": p.editor,
        "terminal.foreground": p.fg,
        "terminal.ansiBlack": p.type === "dark" ? p.chrome : p.fg,
        "terminal.ansiRed": p.error,
        "terminal.ansiGreen": p.success,
        "terminal.ansiYellow": p.warning,
        "terminal.ansiBlue": p.accent,
        "terminal.ansiMagenta": p.synBuiltin,
        "terminal.ansiCyan": p.accent2,
        "terminal.ansiWhite": p.type === "dark" ? p.fg : p.fgMuted,
        "terminal.ansiBrightBlack": p.fgFaint,
        "terminal.ansiBrightRed": p.error,
        "terminal.ansiBrightGreen": p.success,
        "terminal.ansiBrightYellow": p.warning,
        "terminal.ansiBrightBlue": p.accentHover,
        "terminal.ansiBrightMagenta": p.synBuiltin,
        "terminal.ansiBrightCyan": p.accent2,
        "terminal.ansiBrightWhite": p.type === "dark" ? p.fgStrong : p.fg,
        "terminal.selectionBackground": p.sel,
        "terminal.inactiveSelectionBackground": p.selInactive,
        "terminal.border": p.border,
        "terminalCursor.foreground": p.accent2,
        "terminal.tab.activeBorder": p.accent,
        "terminalCommandDecoration.successBackground": p.success,
        "terminalCommandDecoration.errorBackground": p.error,

        "titleBar.activeBackground": p.chrome,
        "titleBar.activeForeground": p.fg,
        "titleBar.inactiveBackground": p.chrome,
        "titleBar.inactiveForeground": p.fgSubtle,
        "titleBar.border": p.border,

        "textBlockQuote.background": p.elevated,
        "textBlockQuote.border": p.accent,
        "textCodeBlock.background": p.raised,
        "textLink.activeForeground": p.accentHover,
        "textLink.foreground": p.accent2,
        "textPreformat.foreground": p.synString,
        "textPreformat.background": p.raised,
        "textSeparator.foreground": p.border,

        "gitDecoration.addedResourceForeground": p.success,
        "gitDecoration.modifiedResourceForeground": p.info,
        "gitDecoration.deletedResourceForeground": p.error,
        "gitDecoration.untrackedResourceForeground": p.accent,
        "gitDecoration.ignoredResourceForeground": p.fgFaint,
        "gitDecoration.conflictingResourceForeground": p.warning,
        "gitDecoration.stageModifiedResourceForeground": p.info,
        "gitDecoration.stageDeletedResourceForeground": p.error,
        "gitDecoration.renamedResourceForeground": p.success,
        "gitDecoration.submoduleResourceForeground": p.fgMuted,

        // BC test codeunits run through the Test Explorer.
        "testing.iconPassed": p.success,
        "testing.iconFailed": p.error,
        "testing.iconErrored": p.error,
        "testing.iconQueued": p.warning,
        "testing.iconSkipped": p.fgSubtle,
        "testing.iconUnset": p.fgSubtle,
        "testing.runAction": p.success,
        "testing.message.error.decorationForeground": p.error,
        "testing.message.error.lineBackground": p.removedSoft,
        "testing.message.info.decorationForeground": p.info,

        "debugToolBar.background": p.elevated,
        "debugToolBar.border": p.border,
        "debugExceptionWidget.background": p.elevated,
        "debugExceptionWidget.border": p.error,
        "debugIcon.breakpointForeground": p.error,
        "debugIcon.breakpointDisabledForeground": p.fgSubtle,
        "debugIcon.startForeground": p.success,
        "debugIcon.continueForeground": p.success,
        "debugIcon.stopForeground": p.error,
        "debugIcon.stepOverForeground": p.accent,
        "debugIcon.stepIntoForeground": p.accent,
        "debugIcon.stepOutForeground": p.accent,
        "debugTokenExpression.name": p.synVariable,
        "debugTokenExpression.value": p.fg,
        "debugTokenExpression.string": p.synString,
        "debugTokenExpression.boolean": p.synKeyword,
        "debugTokenExpression.number": p.synNumber,
        "debugTokenExpression.error": p.error,
        "editor.stackFrameHighlightBackground": p.warningSurface,
        "editor.focusedStackFrameHighlightBackground": p.addedSoft,

        "keybindingLabel.background": p.raised,
        "keybindingLabel.foreground": p.fg,
        "keybindingLabel.border": p.border,
        "keybindingLabel.bottomBorder": p.border,

        "breadcrumb.foreground": p.fgMuted,
        "breadcrumb.focusForeground": p.fg,
        "breadcrumb.activeSelectionForeground": p.accent2,
        "breadcrumb.background": p.editor,
        "breadcrumbPicker.background": p.elevated,

        "charts.red": p.error,
        "charts.blue": p.accent,
        "charts.yellow": p.warning,
        "charts.orange": p.warning,
        "charts.green": p.success,
        "charts.purple": p.synBuiltin,
        "charts.foreground": p.fg,
        "charts.lines": p.border,
        "ports.iconRunningProcessForeground": p.success,

        "chat.slashCommandBackground": p.listActive,
        "chat.slashCommandForeground": p.accent,
        "chat.editedFileForeground": p.warning,
        "chat.requestBorder": p.border,
        "inlineChat.background": p.elevated,
        "inlineChat.border": p.accent,

        "commandCenter.background": p.chrome,
        "commandCenter.foreground": p.fg,
        "commandCenter.border": p.border,
        "commandCenter.activeBackground": p.listActive,
        "commandCenter.activeBorder": p.accent,
        "commandCenter.inactiveBorder": p.border,

        "welcomePage.tileBackground": p.elevated,
        "welcomePage.tileBorder": p.border,
        "welcomePage.progress.foreground": p.accent,
        "walkThrough.embeddedEditorBackground": p.editor,
    };
}

function semanticTokenColors(p) {
    return {
        class: p.synType,
        interface: p.synType,
        enum: p.synType,
        enumMember: p.synConstant,
        type: p.synType,
        typeParameter: p.synType,
        struct: p.synType,
        namespace: p.synType,
        function: p.synFunction,
        method: p.synFunction,
        macro: p.synKeyword,
        parameter: p.synVariable,
        property: p.synVariable,
        variable: p.synVariable,
        "variable.readonly": p.synConstant,
        keyword: p.synKeyword,
        comment: p.synComment,
        string: p.synString,
        number: p.synNumber,
        operator: p.synOperator,
        newOperator: p.synBuiltin,
        stringLiteral: p.synString,
        customLiteral: p.synFunction,
        numberLiteral: p.synNumber,

        // The AL server emits its own token types rather than the standard set,
        // so none of the entries above apply to AL. Names below are verbatim from
        // ms-dynamics-smb.al, including the misspelled "langaugeconstant".
        builtintypes: p.synType,
        builtinfunctions: p.synBuiltin,
        otherkeyword: p.synKeyword,
        langaugeconstant: p.synConstant,
        preprocessorkeyword: p.synKeyword,
        datetime: p.synNumber,
        namespace: p.synType,
        globalVariable: p.synVariable,
        localVariable: p.synVariable,
        returnparameter: p.synVariable,
        triggername: p.synFunction,

        // Attributes are how events are declared in AL, so the attribute and the
        // publisher/subscriber it produces share a colour and the whole event
        // wiring reads as one thing.
        attribute: p.synEvent,
        aleventcreation: p.synEvent,
        aleventsubscription: p.synEvent,

        // Object members: the identifiers AL code is mostly made of.
        tablefield: p.synMember,
        tablekey: p.synMember,
        tablefieldgroup: p.synMember,
        pagecontrol: p.synMember,
        pageaction: p.synMember,
        pageview: p.synMember,
        reportlabel: p.synMember,
        reportlayout: p.synMember,
        querydataitem: p.synMember,
        querycolumn: p.synMember,
        queryfilter: p.synMember,
        xmlporttableelement: p.synMember,
        xmlporttextelement: p.synMember,
        xmlportfieldelement: p.synMember,
        xmlportfieldattribute: p.synMember,

        // Code switched off by a preprocessor directive should recede.
        excludedCode: p.fgFaint,
    };
}

function tokenColors(p) {
    const commentStyle = p.italics ? "italic" : "";
    const keywordStyle = p.boldKeywords ? "bold" : "";
    const rule = (name, scope, settings) => ({ name, scope, settings });

    return [
        rule("Base", ["meta.embedded", "source.groovy.embedded"], { foreground: p.fg }),
        rule("Emphasis", "emphasis", { fontStyle: "italic" }),
        rule("Strong", "strong", { fontStyle: "bold" }),
        rule("Comment", ["comment", "punctuation.definition.comment"], {
            foreground: p.synComment,
            fontStyle: commentStyle,
        }),

        // AL: procedure, trigger, var, begin/end, if/then, local/internal.
        rule("Keyword", [
            "keyword",
            "keyword.control",
            "keyword.other",
            "storage",
            "storage.type",
            "storage.modifier",
        ], { foreground: p.synKeyword, fontStyle: keywordStyle }),
        rule("Operator", ["keyword.operator", "punctuation.separator", "punctuation.terminator"], {
            foreground: p.synOperator,
        }),
        rule("Punctuation", ["punctuation", "meta.brace"], { foreground: p.synPunct }),

        rule("String", ["string", "string.quoted", "meta.preprocessor.string"], {
            foreground: p.synString,
        }),
        rule("String escape", ["constant.character.escape", "constant.other.placeholder"], {
            foreground: p.synBuiltin,
        }),
        rule("Regex", ["constant.regexp", "string.regexp"], { foreground: p.synRegex }),

        rule("Number", [
            "constant.numeric",
            "meta.preprocessor.numeric",
            "keyword.operator.plus.exponent",
            "keyword.operator.minus.exponent",
        ], { foreground: p.synNumber }),
        rule("Constant", ["constant.language", "variable.other.enummember", "constant.other"], {
            foreground: p.synConstant,
        }),

        // AL: Rec, xRec, CurrPage, CurrReport - system variables that behave
        // differently from anything the developer declared.
        rule("Language variable", ["variable.language", "support.variable"], {
            foreground: p.synBuiltin,
            fontStyle: keywordStyle,
        }),

        // AL: Codeunit, Record, Page, Enum and the object being declared.
        rule("Type", [
            "entity.name.type",
            "entity.name.class",
            "entity.name.namespace",
            "support.type",
            "support.class",
            "meta.object-literal.key.type",
        ], { foreground: p.synType }),

        rule("Function", [
            "entity.name.function",
            "support.function",
            "meta.function-call",
            "variable.function",
        ], { foreground: p.synFunction }),

        rule("Variable", [
            "variable",
            "variable.other",
            "meta.definition.variable",
            "meta.structure.dictionary.key.python",
        ], { foreground: p.synVariable }),
        rule("Parameter", ["variable.parameter", "meta.parameter"], { foreground: p.synVariable }),

        rule("Invalid", ["invalid", "invalid.illegal"], { foreground: p.error }),
        rule("Deprecated", "invalid.deprecated", { foreground: p.warning, fontStyle: "strikethrough" }),

        // XLF translation files and any XML the reports pull in.
        rule("Tag", ["entity.name.tag", "meta.tag"], { foreground: p.synTag }),
        rule("Tag punctuation", "punctuation.definition.tag", { foreground: p.synPunct }),
        rule("Attribute", ["entity.other.attribute-name", "meta.attribute"], {
            foreground: p.synAttr,
        }),

        // app.json, launch.json, settings and the preset files.
        rule("JSON key", [
            "support.type.property-name.json",
            "meta.object-literal.key",
            "support.type.property-name",
        ], { foreground: p.synAttr }),

        rule("CSS selector", [
            "entity.name.tag.css",
            "entity.other.attribute-name.class.css",
            "entity.other.attribute-name.id.css",
            "entity.other.attribute-name.pseudo-class",
            "entity.other.attribute-name.pseudo-element.css",
        ], { foreground: p.synFunction }),

        rule("Preprocessor", ["meta.preprocessor", "entity.name.function.preprocessor"], {
            foreground: p.synKeyword,
        }),

        // Skill, agent and instruction authoring happens in Markdown.
        rule("Markdown heading", "markup.heading", { foreground: p.synType, fontStyle: "bold" }),
        rule("Markdown bold", "markup.bold", { foreground: p.synKeyword, fontStyle: "bold" }),
        rule("Markdown italic", "markup.italic", { foreground: p.synBuiltin, fontStyle: "italic" }),
        rule("Markdown underline", "markup.underline", { fontStyle: "underline" }),
        rule("Markdown strikethrough", "markup.strikethrough", { fontStyle: "strikethrough" }),
        rule("Markdown code", ["markup.inline.raw", "markup.fenced_code.block"], {
            foreground: p.synString,
        }),
        rule("Markdown link", ["markup.underline.link", "string.other.link"], {
            foreground: p.accent2,
        }),
        rule("Markdown list", "punctuation.definition.list.begin.markdown", {
            foreground: p.accent,
        }),
        rule("Markdown quote", "punctuation.definition.quote.begin.markdown", {
            foreground: p.synComment,
        }),
        rule("Markdown inserted", "markup.inserted", { foreground: p.success }),
        rule("Markdown deleted", "markup.deleted", { foreground: p.error }),
        rule("Markdown changed", "markup.changed", { foreground: p.info }),

        // AL scopes, taken from the grammar the AL extension ships. These come
        // last so they win over the generic rules above.

        // The AL grammar says "operators", not "operator", so the generic
        // keyword.operator rule never matches and AL operators would otherwise
        // be painted as keywords.
        rule("AL operator", "keyword.operators", { foreground: p.synOperator }),

        // Record, Integer, Text and friends are keywords in the grammar but read
        // as types to anyone writing AL.
        rule("AL built-in type", "keyword.other.builtintypes.al", { foreground: p.synType }),

        // Object names: Codeunit "Sales Post", table Customer. Unscoped by every
        // generic entity.name rule, so without this they fall back to plain text.
        rule("AL object name", "entity.name.applicationobject.al", { foreground: p.synType }),

        // Quoted identifiers such as "No. Series" - identifiers, not strings.
        rule("AL quoted identifier", "identifier.quoted.double.al", { foreground: p.synVariable }),

        // Caption, ApplicationArea, DataClassification.
        rule("AL property", "keyword.other.property.al", { foreground: p.synAttr }),

        rule("AL attribute", [
            "keyword.other.metadata.al",
            "entity.other.attribute.al",
        ], { foreground: p.synEvent }),
        rule("AL event", "entity.name.function.alevent", { foreground: p.synEvent }),

        rule("AL object member", [
            "entity.name.class.tablefield.al",
            "entity.name.class.tablekey.al",
            "entity.name.class.tablefieldgroup.al",
            "entity.name.class.pagecontrol.al",
            "entity.name.class.pageaction.al",
            "entity.name.class.pageview.al",
            "entity.name.class.reportlabel.al",
            "entity.name.class.reportlayout.al",
            "entity.name.class.querydataitem.al",
            "entity.name.class.querycolumn.al",
            "entity.name.class.queryfilter.al",
            "entity.name.class.xmlporttableelement.al",
            "entity.name.class.xmlporttextelement.al",
            "entity.name.class.xmlportfieldelement.al",
            "entity.name.class.xmlportfieldattribute.al",
        ], { foreground: p.synMember }),

        rule("AL excluded code", "support.other.excluded.al", { foreground: p.fgFaint }),
        rule("AL doc comment", "comment.documentation", {
            foreground: p.synComment,
            fontStyle: commentStyle,
        }),
    ];
}

function build(p) {
    return {
        $schema: "vscode://schemas/color-theme",
        name: p.label,
        type: p.type,
        semanticHighlighting: true,
        colors: colors(p),
        semanticTokenColors: semanticTokenColors(p),
        tokenColors: tokenColors(p),
    };
}

function main() {
    fs.mkdirSync(themesDir, { recursive: true });

    for (const palette of palettes) {
        const target = path.join(themesDir, `${palette.id}.json`);
        fs.writeFileSync(target, `${JSON.stringify(build(palette), null, 2)}\n`, "utf8");
        console.log(`[SKC] Wrote ${palette.label} -> themes/${palette.id}.json`);
    }

    // The manifest is the contract with VS Code; a generated theme that is not
    // contributed never reaches the picker.
    const pkgPath = path.resolve(__dirname, "..", "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    const contributed = new Set((pkg.contributes.themes || []).map((t) => t.path));
    const missing = palettes
        .filter((p) => !contributed.has(`./themes/${p.id}.json`))
        .map((p) => p.label);

    if (missing.length) {
        console.error(
            `[SKC] These themes are generated but not contributed in package.json: ${missing.join(", ")}`
        );
        process.exit(1);
    }

    console.log(`[SKC] ${palettes.length} themes generated and contributed.`);
}

main();
