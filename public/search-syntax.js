const FILTERS = new Set(["class", "name", "before", "after"]);

export function parseSearchQuery(input = "") {
  const raw = String(input).trim();
  const tokens = raw.match(/-?"(?:\\.|[^"])*"|\S+/g) || [];
  const parsed = { raw, include: [], exact: [], exclude: [], filters: {}, groups: [[]] };
  let nextGroup = false;

  for (const original of tokens) {
    if (original === "OR") {
      nextGroup = true;
      continue;
    }
    let token = original;
    const excluded = token.startsWith("-") && token.length > 1;
    if (excluded) token = token.slice(1);

    const filterMatch = token.match(/^([a-z]+):(.*)$/i);
    if (filterMatch && FILTERS.has(filterMatch[1].toLowerCase())) {
      const key = filterMatch[1].toLowerCase();
      const value = unquote(filterMatch[2]);
      if (value) (parsed.filters[key] ||= []).push(value);
      continue;
    }

    const quoted = token.length > 1 && token.startsWith('"') && token.endsWith('"');
    const value = unquote(token);
    if (!value) continue;
    if (excluded) parsed.exclude.push(value);
    else if (quoted) parsed.exact.push(value);
    else parsed.include.push(value);

    if (!excluded) {
      if (nextGroup && parsed.groups.at(-1)?.length) parsed.groups.push([]);
      parsed.groups.at(-1).push(value);
      nextGroup = false;
    }
  }

  parsed.normalized = [
    ...parsed.include,
    ...parsed.exact.map((value) => `"${value}"`),
    ...parsed.exclude.map((value) => `-${value}`),
  ].join(" ");
  return parsed;
}

export function syntaxChips(parsed) {
  return [
    ...parsed.exact.map((value) => ({ type: "精确短语", value })),
    ...parsed.exclude.map((value) => ({ type: "排除", value })),
    ...Object.entries(parsed.filters).flatMap(([type, values]) =>
      values.map((value) => ({ type: `${type}:`, value }))),
    ...(parsed.groups.length > 1 ? [{ type: "OR", value: `${parsed.groups.length} 组条件` }] : []),
  ];
}

export const SEARCH_HELP = [
  ['"毕业典礼"', "精确匹配完整短语"],
  ["-夜景", "排除包含该词的类"],
  ["高一 OR 高二", "匹配任一条件"],
  ["class:摄影", "只在类名中搜索"],
  ["before:2026-07-01", "搜索该日期前创建的类"],
  ["after:2026-01-01", "搜索该日期后创建的类"],
];

function unquote(value) {
  return String(value || "")
    .replace(/^"|"$/g, "")
    .replace(/\\"/g, '"')
    .trim();
}
