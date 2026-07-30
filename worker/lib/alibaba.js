export async function ingestFace(photo, env) {
  const entityId = buildEntityId(photo.id);
  const dbName = env.ALIBABA_DB_NAME || "default";
  const imageUrl = await prepareImageUrl(photo.r2_key, env);

  await deleteFaceEntity(entityId, env);
  await callRpc("AddFaceEntity", { DbName: dbName, EntityId: entityId }, env, {
    ignoreErrors: ["already", "exist"],
  });
  await callRpc("AddFace", {
    DbName: dbName,
    EntityId: entityId,
    ImageUrl: imageUrl,
    ExtraData: photo.original_name,
  }, env);
  return entityId;
}

export async function searchFaces(r2Key, env) {
  const config = validateSearchConfig(env);
  const dbName = env.ALIBABA_DB_NAME || "default";
  const imageUrl = await prepareImageUrl(r2Key, env);
  const response = await callRpc("SearchFace", {
    DbName: dbName,
    DbNames: dbName,
    ImageUrl: imageUrl,
    Limit: String(config.limit),
    MaxFaceNum: String(config.maxFaces),
    QualityScoreThreshold: String(config.quality),
  }, env);
  return extractMatches(response, config);
}

export async function deleteFaceEntity(entityId, env) {
  if (!entityId) return;
  await callRpc("DeleteFaceEntity", {
    DbName: env.ALIBABA_DB_NAME || "default",
    EntityId: entityId,
  }, env, {
    ignoreErrors: ["not exist", "not found", "deleted"],
  });
}

function buildEntityId(photoId) {
  return `p_${String(photoId).replace(/[^A-Za-z0-9_]/g, "_")}`.slice(0, 64);
}

async function prepareImageUrl(r2Key, env) {
  const object = await env.PHOTO_BUCKET.get(r2Key);
  if (!object) throw new Error(`R2 object ${r2Key} was not found`);
  const contentType = object.httpMetadata?.contentType || "application/octet-stream";
  const extension = extensionFor(contentType, r2Key);
  const sts = await getStsToken(env);
  const objectKey = `${env.ALIBABA_ACCESS_KEY_ID}/${crypto.randomUUID()}/image.${extension}`;

  await putTempObject({
    accessKeyId: sts.accessKeyId,
    accessKeySecret: sts.accessKeySecret,
    securityToken: sts.securityToken,
    body: object.body,
    contentType,
    objectKey,
  });
  return `http://viapi-customer-temp.oss-cn-shanghai.aliyuncs.com/${objectKey.split("/").map(encodeURIComponent).join("/")}`;
}

async function getStsToken(env) {
  const response = await callRpc("GetOssStsToken", {}, env, {
    endpoint: "https://viapiutils.cn-shanghai.aliyuncs.com",
    version: "2020-04-01",
  });
  const flat = flattenObject(response);
  const accessKeyId = flat.AccessKeyId || flat.accessKeyId;
  const accessKeySecret = flat.AccessKeySecret || flat.accessKeySecret;
  const securityToken = flat.SecurityToken || flat.securityToken;
  if (!accessKeyId || !accessKeySecret || !securityToken) {
    throw new Error("GetOssStsToken did not return complete credentials");
  }
  return { accessKeyId, accessKeySecret, securityToken };
}

async function putTempObject({ accessKeyId, accessKeySecret, securityToken, body, contentType, objectKey }) {
  const bucket = "viapi-customer-temp";
  const host = `${bucket}.oss-cn-shanghai.aliyuncs.com`;
  const date = new Date().toUTCString();
  const resource = `/${bucket}/${objectKey}`;
  const canonicalHeaders = `x-oss-security-token:${securityToken}\n`;
  const signature = await sign(`${["PUT", "", contentType, date, `${canonicalHeaders}${resource}`].join("\n")}`, accessKeySecret);
  const response = await fetch(`https://${host}/${objectKey.split("/").map(encodeURIComponent).join("/")}`, {
    method: "PUT",
    headers: {
      Authorization: `OSS ${accessKeyId}:${signature}`,
      Date: date,
      "Content-Type": contentType,
      "x-oss-security-token": securityToken,
    },
    body,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`VIAPI temporary upload failed: ${text || response.statusText}`);
  }
}

async function callRpc(action, extraParams, env, options = {}) {
  if (!env.ALIBABA_ACCESS_KEY_ID || !env.ALIBABA_ACCESS_KEY_SECRET) {
    throw new Error("Alibaba Cloud secrets are missing");
  }
  const endpoint = new URL(options.endpoint || env.ALIBABA_ENDPOINT || "https://facebody.cn-shanghai.aliyuncs.com");
  const params = {
    AccessKeyId: env.ALIBABA_ACCESS_KEY_ID,
    Action: action,
    Format: "JSON",
    RegionId: env.ALIBABA_REGION_ID || "cn-shanghai",
    SignatureMethod: "HMAC-SHA1",
    SignatureNonce: crypto.randomUUID(),
    SignatureVersion: "1.0",
    Timestamp: new Date().toISOString(),
    Version: options.version || env.ALIBABA_API_VERSION || "2019-12-30",
    ...extraParams,
  };
  const canonicalQuery = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${strictEncode(key)}=${strictEncode(String(value))}`)
    .join("&");
  const stringToSign = `POST&${strictEncode("/")}&${strictEncode(canonicalQuery)}`;
  const signature = await sign(stringToSign, `${env.ALIBABA_ACCESS_KEY_SECRET}&`);
  endpoint.search = `${canonicalQuery}&Signature=${strictEncode(signature)}`;

  const response = await fetch(endpoint, { method: "POST" });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!response.ok || data.Code || data.code) {
    const message = data.Message || data.message || text || response.statusText;
    const ignored = (options.ignoreErrors || []).some((part) => String(message).toLowerCase().includes(part));
    if (!ignored) throw new Error(message);
  }
  return data;
}

function extractMatches(payload, config) {
  const minimumScore = config.score;
  const minimumConfidence = config.confidence;
  const results = new Map();

  walk(payload, (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    const rawId = read(value, "EntityId");
    const rawScore = read(value, "Score");
    const rawConfidence = read(value, "Confidence");
    const entityId = typeof rawId === "string" && /^[\w.-]{1,128}$/.test(rawId) ? rawId : "";
    const score = optionalFinite(rawScore);
    const confidence = optionalFinite(rawConfidence);
    if ((rawScore !== undefined && rawScore !== null && rawScore !== "" && score === null) ||
      (rawConfidence !== undefined && rawConfidence !== null && rawConfidence !== "" && confidence === null)) return;
    if (!entityId || (score === null && confidence === null)) return;
    if (score !== null && score < minimumScore) return;
    if (confidence !== null && confidence < minimumConfidence) return;

    const candidate = { entityId, score: score ?? -1, confidence: confidence ?? -1 };
    const current = results.get(entityId);
    if (!current || candidate.confidence > current.confidence ||
      (candidate.confidence === current.confidence && candidate.score > current.score)) {
      results.set(entityId, candidate);
    }
  });

  return [...results.values()].sort((left, right) =>
    right.confidence - left.confidence || right.score - left.score
  );
}

function optionalFinite(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function validateSearchConfig(env) {
  return {
    score: bounded(env.ALIBABA_SCORE_THRESHOLD, 0.6, 0, 1, false, "ALIBABA_SCORE_THRESHOLD"),
    confidence: bounded(env.ALIBABA_CONFIDENCE_THRESHOLD, 72.62, 0, 100, false, "ALIBABA_CONFIDENCE_THRESHOLD"),
    limit: bounded(env.ALIBABA_SEARCH_LIMIT, 12, 1, 100, true, "ALIBABA_SEARCH_LIMIT"),
    maxFaces: bounded(env.ALIBABA_MAX_FACES, 1, 1, 10, true, "ALIBABA_MAX_FACES"),
    quality: bounded(env.ALIBABA_QUALITY_SCORE_THRESHOLD, 50, 0, 100, true, "ALIBABA_QUALITY_SCORE_THRESHOLD"),
  };
}

function bounded(raw, fallback, minimum, maximum, integer, name) {
  const number = raw === undefined || raw === null || raw === "" ? fallback : Number(raw);
  if (!Number.isFinite(number) || number < minimum || number > maximum || (integer && !Number.isInteger(number))) {
    throw new Error(`${name} must be ${integer ? "an integer " : ""}between ${minimum} and ${maximum}`);
  }
  return number;
}

function read(value, key) {
  const wanted = key.toLowerCase();
  for (const [entryKey, entryValue] of Object.entries(value)) {
    if (entryKey.toLowerCase() === wanted) return entryValue;
  }
  return undefined;
}

function walk(value, visitor) {
  visitor(value);
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visitor);
  } else if (value && typeof value === "object") {
    for (const child of Object.values(value)) walk(child, visitor);
  }
}

function flattenObject(value, out = {}) {
  if (!value || typeof value !== "object") return out;
  for (const [key, child] of Object.entries(value)) {
    if (child && typeof child === "object" && !Array.isArray(child)) flattenObject(child, out);
    else out[key] = child;
  }
  return out;
}

function extensionFor(contentType, key) {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  return String(key.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
}

function strictEncode(value) {
  return encodeURIComponent(value)
    .replace(/\+/g, "%20")
    .replace(/\*/g, "%2A")
    .replace(/%7E/g, "~");
}

async function sign(value, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
  return btoa(String.fromCharCode(...bytes));
}
