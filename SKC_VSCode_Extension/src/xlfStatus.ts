const TRANS_UNIT_REGEX = /<trans-unit\b[^>]*>([\s\S]*?)<\/trans-unit\s*>/gi;
const TARGET_REGEX = /<target\b([^>]*)\/\s*>|<target\b([^>]*)>([\s\S]*?)<\/target\s*>/gi;
const SOURCE_REGEX = /<source\b[^>]*\/\s*>|<source\b[^>]*>([\s\S]*?)<\/source\s*>/i;

const COMPLETED_TARGET_STATES = new Set(["translated", "signed-off", "final"]);
const NAB_PLACEHOLDER_REGEX = /\[\s*(?:NAB\s*:\s*)?(?:NOT\s+TRANSLATED|NEEDS\s+TRANSLATION|SUGGESTION|REVIEW)\s*\]/i;

export interface TranslationUnitStatus {
    targetText: string;
    state: string;
    targetStates: string[];
    hasTarget: boolean;
    hasPlaceholder: boolean;
    isTranslated: boolean;
}

function getAttribute(attributes: string, name: string): string {
    const match = attributes.match(new RegExp(`${name}\\s*=\\s*(['"])(.*?)\\1`, "i"));
    return match?.[2] ?? "";
}

function stripXmlMarkup(value: string): string {
    return value
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
        .replace(/<[^>]*>/g, "")
        .trim();
}

function hasSourceText(unitContent: string): boolean {
    const match = SOURCE_REGEX.exec(unitContent);
    return stripXmlMarkup(match?.[1] ?? "").length > 0;
}

function getTargetValues(unitContent: string): Array<{ text: string; state: string; raw: string }> {
    const targets: Array<{ text: string; state: string; raw: string }> = [];
    let match: RegExpExecArray | null;

    TARGET_REGEX.lastIndex = 0;
    while ((match = TARGET_REGEX.exec(unitContent)) !== null) {
        const attributes = match[1] ?? match[2] ?? "";
        const raw = match[3] ?? "";
        targets.push({
            text: stripXmlMarkup(raw),
            state: getAttribute(attributes, "state").trim().toLowerCase(),
            raw
        });
    }

    return targets;
}

export function getTranslationUnitStatus(unitContent: string): TranslationUnitStatus {
    const targets = getTargetValues(unitContent);
    const targetStates = targets.map((target) => target.state).filter(Boolean);
    const targetText = targets[0]?.text ?? "";
    const allTargetText = targets.map((target) => target.text).join(" | ").trim();
    const hasTarget = targets.some((target) => target.text.length > 0);
    const hasPlaceholder = targets.some((target) =>
        NAB_PLACEHOLDER_REGEX.test(target.raw) || NAB_PLACEHOLDER_REGEX.test(target.text)
    );
    const hasPendingState = targetStates.some((state) => !COMPLETED_TARGET_STATES.has(state));

    return {
        targetText: targetText || allTargetText,
        state: targetStates[0] ?? "",
        targetStates,
        hasTarget,
        hasPlaceholder,
        isTranslated: hasTarget && !hasPlaceholder && !hasPendingState
    };
}

export function isCompletedTranslation(targetText: string, state = ""): boolean {
    const normalizedText = stripXmlMarkup(targetText);
    const normalizedState = state.trim().toLowerCase();

    return normalizedText.length > 0 &&
        !NAB_PLACEHOLDER_REGEX.test(normalizedText) &&
        (!normalizedState || COMPLETED_TARGET_STATES.has(normalizedState));
}

export function getTranslationStatsFromContent(content: string): { total: number; translated: number } {
    let total = 0;
    let translated = 0;
    let match: RegExpExecArray | null;

    TRANS_UNIT_REGEX.lastIndex = 0;
    while ((match = TRANS_UNIT_REGEX.exec(content)) !== null) {
        if (!hasSourceText(match[1] ?? "")) {
            continue;
        }

        total++;
        if (getTranslationUnitStatus(match[1] ?? "").isTranslated) {
            translated++;
        }
    }

    return { total, translated };
}