export function shortId(prefix) {
  if (!/^[a-z][a-z0-9]*_$/.test(prefix)) {
    throw new TypeError("ID prefix must be lowercase alphanumeric and end with _");
  }
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const body = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${prefix}${body}`;
}
