export function describeApplyResult(result) {
  if (!result) return { message: "", tone: "ok" };
  if (result.paused) {
    return { message: "Overrides are off. Your rules stay saved.", tone: "ok" };
  }

  const skipped = result.skipped ?? [];
  const applied = result.applied ?? 0;
  if (skipped.length === 0) {
    if (applied === 0) return { message: "No rules to send yet.", tone: "ok" };
    const noun = applied === 1 ? "rule" : "rules";
    return { message: `Applied ${applied} ${noun}.`, tone: "ok" };
  }

  const first = skipped[0];
  const who = first.header ? first.header : "One rule";
  const extra = skipped.length > 1 ? ` ${skipped.length - 1} more also need attention.` : "";
  const sent = applied === 0 ? "Nothing sent yet." : `Applied ${applied}.`;
  return {
    message: `${sent} ${who} was left off: ${first.reason}${extra}`,
    tone: "warn",
  };
}
