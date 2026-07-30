const TOKEN_PATTERN = /(-?)(?:(name|class|before|after):)?(?:"([^"]+)"|(\S+))/giu;

function normalize(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function parseClassQuery(input) {
  const source = String(input || "").trim().slice(0, 160);
  const groups = [[]];
  const excluded = [];
  const filters = {};
  let match;

  TOKEN_PATTERN.lastIndex = 0;
  while ((match = TOKEN_PATTERN.exec(source))) {
    const negative = match[1] === "-";
    const operator = String(match[2] || "").toLowerCase();
    const quoted = match[3] !== undefined;
    const raw = match[3] ?? match[4] ?? "";
    if (!negative && (operator === "before" || operator === "after") && validIsoDate(raw)) {
      filters[operator] = raw;
      continue;
    }
    if (!negative && !quoted && raw.toUpperCase() === "OR") {
      if (groups.at(-1).length) groups.push([]);
      continue;
    }
    const value = normalize(raw);
    if (!value) continue;
    (negative ? excluded : groups.at(-1)).push({ value, quoted });
  }

  return {
    source,
    groups: groups.filter((group) => group.length),
    excluded,
    filters,
  };
}

function validIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().startsWith(value);
}

function termScore(target, words, term) {
  if (target === term.value) return term.quoted ? 1200 : 1000;
  if (target.startsWith(term.value)) return (term.quoted ? 950 : 850) - Math.min(100, target.length - term.value.length);
  const offset = target.indexOf(term.value);
  if (offset >= 0) return (term.quoted ? 800 : 700) - Math.min(100, offset);
  if (words.includes(term.value)) return 120;
  if (!term.quoted && words.some((word) => word.startsWith(term.value))) return 80;
  return 0;
}

export function classNameRelevance(name, parsedOrQuery) {
  const parsed = typeof parsedOrQuery === "string" ? parseClassQuery(parsedOrQuery) : parsedOrQuery;
  const target = normalize(name);
  if (!target || !parsed) return 0;
  if (parsed.excluded.some((term) => target.includes(term.value))) return 0;
  if (!parsed.groups.length) return 1;
  const words = target.split(/\s+/);
  let best = 0;

  for (const group of parsed.groups) {
    let score = 0;
    let valid = true;
    for (const term of group) {
      const next = termScore(target, words, term);
      if (!next) {
        valid = false;
        break;
      }
      score += next;
    }
    if (valid) best = Math.max(best, score + group.length * 25);
  }
  return best;
}
