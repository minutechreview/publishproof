export interface RobotsDecision {
  blocked: boolean;
  evidence: string;
}
export function evaluateRobots(body: string, path: string): RobotsDecision {
  const normalize = (value: string) =>
    value
      .replace(/[^\x00-\x7f]/gu, (x) => encodeURIComponent(x))
      .replace(/%([0-9a-f]{2})/gi, (_whole, hex: string) => {
        const char = String.fromCharCode(parseInt(hex, 16));
        return /[A-Za-z0-9._~-]/.test(char) ? char : "%" + hex.toUpperCase();
      });
  path = normalize(path);
  const groups: {
    agents: string[];
    rules: { allow: boolean; path: string }[];
  }[] = [];
  let group: (typeof groups)[number] | undefined;
  let rulesStarted = false;
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.split("#")[0].trim();
    const match = line.match(/^([^:]+):\s*(.*)$/);
    if (!match) continue;
    const key = match[1].trim().toLowerCase();
    const value = match[2].trim();
    if (key === "user-agent") {
      if (!group || rulesStarted) {
        group = { agents: [], rules: [] };
        groups.push(group);
        rulesStarted = false;
      }
      group.agents.push(value.toLowerCase());
    } else if (group && ["allow", "disallow"].includes(key)) {
      rulesStarted = true;
      if (value)
        group.rules.push({ allow: key === "allow", path: normalize(value) });
    }
  }
  const specific = groups.filter((x) => x.agents.includes("googlebot"));
  const selected = specific.length
    ? specific
    : groups.filter((x) => x.agents.includes("*"));
  // Split-and-search wildcard matching avoids regex backtracking on untrusted policies.
  const matchesRule = (pattern: string) => {
    const anchoredEnd = pattern.endsWith("$");
    const chunks = (anchoredEnd ? pattern.slice(0, -1) : pattern).split("*");
    if (!path.startsWith(chunks[0])) return false;
    let position = chunks[0].length;
    for (let i = 1; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (anchoredEnd && i === chunks.length - 1) {
        return path.endsWith(chunk) && path.length - chunk.length >= position;
      }
      const found = path.indexOf(chunk, position);
      if (found < 0) return false;
      position = found + chunk.length;
    }
    return !anchoredEnd || position === path.length;
  };
  const matches = selected
    .flatMap((x) => x.rules)
    .filter((rule) => matchesRule(rule.path))
    .sort(
      (a, b) =>
        b.path.replace(/[*$]/g, "").length -
          a.path.replace(/[*$]/g, "").length ||
        Number(b.allow) - Number(a.allow),
    );
  const winner = matches[0];
  return {
    blocked: !!winner && !winner.allow,
    evidence: winner
      ? `${specific.length ? "Googlebot" : "*"}: ${winner.allow ? "Allow" : "Disallow"}: ${winner.path}`
      : "No matching Googlebot/* restriction in sampled robots.txt.",
  };
}
