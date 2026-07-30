export { parseClassQuery, classNameRelevance } from "./search-query.js";

import { classNameRelevance } from "./search-query.js";
import { shortId } from "./ids.js";

export function newId(prefix) {
  const value = String(prefix || "").replace(/_+$/, "");
  return shortId(`${value}_`);
}

export function classMatchesQuery(name, parsedOrQuery) {
  return classNameRelevance(name, parsedOrQuery) > 0;
}
