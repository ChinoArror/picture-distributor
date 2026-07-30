import { newId, parseClassQuery, classNameRelevance } from "./lib/core.js";
import {
  randomToken,
  sha256,
  hashPassword,
  verifyPassword,
  encryptPassword,
  decryptPassword,
} from "./lib/passwords.js";
import { ingestFace, searchFaces, deleteFaceEntity } from "./lib/alibaba.js";
import { extractPhotoMetadata } from "./lib/image-metadata.js";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};
const ACCESS_MODES = new Set(["all_read", "all_write", "own_write", "own_read"]);
const PUBLIC_CACHE_KEY = "public-classes:v2";
const NORMAL_SESSION_SECONDS = 14 * 24 * 60 * 60;
const TEST_SESSION_SECONDS = 30 * 60;
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const MAX_QUEUE_ATTEMPTS = 4;
const STATIC_CSP = [
  "default-src 'self'",
  "script-src 'self' https://cdn.jsdelivr.net https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https://accounts.aryuki.com",
  "connect-src 'self' https://cloudflareinsights.com",
  "font-src 'self' data:",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

export default {
  async fetch(request, env, ctx) {
    try {
      if (request.method === "OPTIONS") return handleOptions(request);
      if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) requireSameOrigin(request);
      const response = await routeRequest(request, env, ctx);
      if (response.ok) {
        ctx.waitUntil(queueAuditRequest(request, response.clone(), env).catch((error) => {
          console.error("Audit queue send failed", error);
        }));
      }
      return response;
    } catch (error) {
      const expected = error instanceof HttpError;
      if (!expected) console.error("Request failed", error);
      return jsonResponse(
        { error: expected ? error.message : "Unexpected server error" },
        expected ? error.status : 500
      );
    }
  },

  async queue(batch, env) {
    await handleQueueBatch(batch, env);
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(Promise.all([enqueuePendingJobs(env), cleanupExpiredTempData(env)]));
  },
};

export async function enqueuePendingJobs(env) {
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE deletion_jobs SET status='pending',error_message='Recovered stale processing claim'," +
      "updated_at=CURRENT_TIMESTAMP WHERE status='processing' AND datetime(updated_at)<datetime('now','-15 minutes')"
    ),
    env.DB.prepare(
      "UPDATE photos SET status='uploaded',error_message='Recovered stale indexing claim'," +
      "updated_at=CURRENT_TIMESTAMP WHERE status='indexing' AND deleted_at IS NULL " +
      "AND datetime(updated_at)<datetime('now','-15 minutes')"
    ),
    env.DB.prepare(
      "UPDATE search_tasks SET status='pending',error_message='Recovered stale search claim'," +
      "updated_at=CURRENT_TIMESTAMP WHERE status='processing' " +
      "AND datetime(updated_at)<datetime('now','-15 minutes')"
    ),
  ]);
  const includeFailed = String(env.RETRY_FAILED_JOBS || "").toLowerCase() === "true";
  const [jobRows, photoRows, searchRows] = await env.DB.batch([
    env.DB.prepare(
      `SELECT id,kind FROM deletion_jobs WHERE status ${includeFailed ? "IN ('pending','failed')" : "='pending'"} ` +
      "ORDER BY created_at LIMIT 50"
    ),
    env.DB.prepare(
      "SELECT id FROM photos WHERE status='uploaded' AND deleted_at IS NULL ORDER BY created_at LIMIT 50"
    ),
    env.DB.prepare(
      "SELECT id FROM search_tasks WHERE status='pending' ORDER BY created_at LIMIT 50"
    ),
  ]);
  const jobs = jobRows.results || [];
  const photos = photoRows.results || [];
  const searches = searchRows.results || [];
  if (jobs.length || photos.length) {
    await env.INGEST_QUEUE.sendBatch([
      ...jobs.map((job) => ({
        body: { type: job.kind === "rekey_photo" ? "storage.rekey" : "storage.delete", jobId: job.id },
      })),
      ...photos.map((photo) => ({ body: { type: "photo.ingest", photoId: photo.id } })),
    ]);
  }
  if (searches.length) {
    await env.SEARCH_QUEUE.sendBatch(
      searches.map((task) => ({ body: { type: "search.run", taskId: task.id } }))
    );
  }
  return jobs.length + photos.length + searches.length;
}

export async function cleanupExpiredTempData(env) {
  const selfieRows = await env.DB.prepare(
    "SELECT id,selfie_key FROM search_tasks WHERE selfie_key!='' " +
    "AND ((status IN ('completed','failed') AND datetime(updated_at)<datetime('now','-24 hours')) " +
    "OR datetime(created_at)<datetime('now','-7 days')) " +
    "ORDER BY updated_at LIMIT 50"
  ).all();
  const selfies = selfieRows.results || [];
  const deletedSelfies = await Promise.allSettled(
    selfies.map((task) => env.PHOTO_BUCKET.delete(task.selfie_key))
  );
  const clearedIds = selfies
    .filter((_, index) => deletedSelfies[index]?.status === "fulfilled")
    .map((task) => task.id);
  if (clearedIds.length) {
    await env.DB.prepare(
      "UPDATE search_tasks SET selfie_key='',status=CASE WHEN status IN ('pending','processing') " +
      "THEN 'failed' ELSE status END,error_message=CASE WHEN status IN ('pending','processing') " +
      "THEN 'Selfie input expired before processing' ELSE error_message END,updated_at=CURRENT_TIMESTAMP " +
      "WHERE id IN (SELECT value FROM json_each(?1))"
    ).bind(JSON.stringify(clearedIds)).run();
  }
  await env.DB.prepare(
    "DELETE FROM search_tasks WHERE user_id IN (SELECT id FROM app_users WHERE kind='temp') " +
    "AND datetime(created_at)<datetime('now','-7 days')"
  ).run();
  await env.DB.prepare(
    "DELETE FROM class_search_history WHERE user_id IN (SELECT id FROM app_users WHERE kind='temp') " +
    "AND datetime(created_at)<datetime('now','-7 days')"
  ).run();
  await env.DB.prepare(
    "DELETE FROM class_search_history WHERE user_id IN (SELECT id FROM app_users WHERE kind!='temp') " +
    "AND datetime(created_at)<datetime('now','-90 days')"
  ).run();
  await env.DB.prepare(
    "DELETE FROM search_tasks WHERE user_id IN (SELECT id FROM app_users WHERE kind!='temp') " +
    "AND datetime(created_at)<datetime('now','-90 days')"
  ).run();
  await env.DB.prepare("DELETE FROM app_sessions WHERE datetime(expires_at)<=datetime('now')").run();
  await env.DB.prepare("DELETE FROM share_sessions WHERE datetime(expires_at)<=datetime('now')").run();
  const expiredBackgrounds = await env.DB.prepare(
    "SELECT user_id,pending_original_key,pending_cropped_key FROM user_backgrounds " +
    "WHERE restore_deadline IS NOT NULL AND datetime(restore_deadline)<=datetime('now') LIMIT 50"
  ).all();
  await Promise.allSettled((expiredBackgrounds.results || []).flatMap((item) =>
    [item.pending_original_key, item.pending_cropped_key].filter(Boolean)
      .map((key) => env.PHOTO_BUCKET.delete(key))
  ));
  if (expiredBackgrounds.results?.length) {
    await env.DB.prepare(
      "UPDATE user_backgrounds SET pending_original_key=NULL,pending_cropped_key=NULL," +
      "restore_token_hash=NULL,restore_deadline=NULL,updated_at=CURRENT_TIMESTAMP " +
      "WHERE user_id IN (SELECT value FROM json_each(?1))"
    ).bind(JSON.stringify(expiredBackgrounds.results.map((item) => item.user_id))).run();
  }
  await env.DB.prepare(
    "DELETE FROM rate_limit_buckets WHERE datetime(expires_at)<=datetime('now')"
  ).run();
  await env.DB.prepare(
    "DELETE FROM app_users WHERE kind='temp' AND datetime(last_seen_at)<datetime('now','-30 days') " +
    "AND NOT EXISTS(SELECT 1 FROM app_sessions s WHERE s.user_id=app_users.id) " +
    "AND NOT EXISTS(SELECT 1 FROM search_tasks t WHERE t.user_id=app_users.id) " +
    "AND NOT EXISTS(SELECT 1 FROM class_search_history h WHERE h.user_id=app_users.id) " +
    "AND NOT EXISTS(SELECT 1 FROM photo_classes c WHERE c.owner_user_id=app_users.id) " +
    "AND NOT EXISTS(SELECT 1 FROM photos p WHERE p.owner_user_id=app_users.id)"
  ).run();
  return clearedIds.length;
}

async function routeRequest(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const method = request.method;

  if (method === "GET" && (path === "/sso-callback" || path.startsWith("/sso-callback/"))) {
    return handleSsoCallback(request, env);
  }
  if (method === "GET" && path === "/api/me") return handleMe(request, env);
  if (method === "GET" && path === "/api/auth/login-url") return handleLoginUrl(request, env);
  if (method === "POST" && path === "/api/auth/temp") return handleTempLogin(request, env);
  if (method === "POST" && path === "/api/logout") return handleLogout(request, env);

  if (method === "GET" && path === "/api/classes") return handleListClasses(request, env);
  if (method === "POST" && path === "/api/classes") return handleCreateClass(request, env);
  if (method === "GET" && path === "/api/class-search") return handleClassSearch(request, env);
  if (path === "/api/class-search-history" && method === "GET") return handleRecentQueries(request, env);
  if (path === "/api/class-search-history" && method === "POST") return handleSaveQuery(request, env);

  let match = path.match(/^\/api\/classes\/([^/]+)\/photos$/);
  if (match && method === "GET") return handleClassPhotos(request, env, decodePart(match[1]));
  if (match && method === "POST") return handleUploadPhotos(request, env, decodePart(match[1]));
  match = path.match(/^\/api\/classes\/([^/]+)$/);
  if (match && method === "GET") return handleClassDetail(request, env, decodePart(match[1]));
  if (match && method === "PATCH") return handleUpdateClass(request, env, decodePart(match[1]));
  if (match && method === "DELETE") return handleDeleteClass(request, env, decodePart(match[1]));

  if (method === "POST" && path === "/api/admin/photos") return handleLegacyAdminUpload(request, env);
  if (method === "POST" && path === "/api/admin/retry-ingest") return handleRetryIngest(request, env);
  if (method === "POST" && path === "/api/search") return handleSearchUpload(request, env);
  match = path.match(/^\/api\/status\/([^/]+)$/);
  if (match && method === "GET") return handleTaskStatus(request, env, decodePart(match[1]));
  match = path.match(/^\/api\/selfies\/([^/]+)\/file$/);
  if (match && method === "GET") return handleSelfieFile(request, env, decodePart(match[1]));

  if (method === "GET" && (path === "/api/history" || path === "/api/query-history")) {
    return handleUnifiedHistory(request, env, path === "/api/query-history" ? "search" : "");
  }
  match = path.match(/^\/api\/history\/(selfie|search)\/([^/]+)$/);
  if (match && method === "DELETE") return handleDeleteHistory(request, env, match[1], decodePart(match[2]));
  match = path.match(/^\/api\/query-history\/([^/]+)$/);
  if (match && method === "DELETE") return handleDeleteHistory(request, env, "search", decodePart(match[1]));

  match = path.match(/^\/api\/photos\/([^/]+)\/file$/);
  if (match && method === "GET") return handlePhotoFile(request, env, decodePart(match[1]));
  match = path.match(/^\/api\/photos\/([^/]+)\/thumbnail$/);
  if (match && method === "GET") return handlePhotoThumbnail(request, env, decodePart(match[1]));
  match = path.match(/^\/api\/photos\/([^/]+)$/);
  if (match && method === "DELETE") return handleDeletePhoto(request, env, decodePart(match[1]));

  if (method === "GET" && path === "/api/storage") return handleStorage(request, env);
  if (method === "GET" && path === "/api/saved") return handleSaved(request, env);
  if (method === "GET" && path === "/api/background") return handleGetBackground(request, env);
  if (method === "GET" && path === "/api/background/bing") return handleBingBackground(request, env);
  if (method === "POST" && path === "/api/background") return handleSaveBackground(request, env);
  if (method === "POST" && path === "/api/background/mode") return handleBackgroundMode(request, env);
  if (method === "DELETE" && path === "/api/background") return handleDeleteBackground(request, env);
  if (method === "POST" && path === "/api/background/restore") return handleRestoreBackground(request, env);
  if (method === "GET" && path === "/api/background/file") return handleBackgroundFile(request, env);
  match = path.match(/^\/api\/saved\/(classes|photos)\/([^/]+)$/);
  if (match && method === "POST") return handleSavePointer(request, env, match[1], decodePart(match[2]));
  if (match && method === "DELETE") return handleRemovePointer(request, env, match[1], decodePart(match[2]));

  if (method === "GET" && path === "/api/share-links") return handleListShareLinks(request, env);
  if (method === "POST" && path === "/api/share-links") return handleCreateShareLink(request, env);
  match = path.match(/^\/api\/share-links\/([^/]+)$/);
  if (match && method === "GET") return handleGetShareLink(request, env, decodePart(match[1]));
  if (match && method === "PATCH") return handleUpdateShareLink(request, env, decodePart(match[1]));
  if (match && method === "DELETE") return handleDeleteShareLink(request, env, decodePart(match[1]));

  match = path.match(/^\/api\/public\/shares\/([^/]+)\/unlock$/);
  if (match && method === "POST") return handleUnlockShare(request, env, decodePart(match[1]));
  match = path.match(/^\/api\/public\/shares\/([^/]+)\/photos\/([^/]+)\/file$/);
  if (match && method === "GET") {
    return handlePublicSharePhoto(request, env, decodePart(match[1]), decodePart(match[2]));
  }
  match = path.match(/^\/api\/public\/shares\/([^/]+)$/);
  if (match && method === "GET") return handlePublicShare(request, env, decodePart(match[1]));

  if (method === "GET" && path === "/api/admin/overview") return handleAdminOverview(request, env);
  if (method === "GET" && path === "/api/admin/audit") return handleAdminAudit(request, env);
  if (method === "GET" && path === "/api/admin/classes") return handleAdminClasses(request, env);
  if (method === "GET" && path === "/api/admin/users") return handleAdminUsers(request, env);
  if (method === "GET" && path === "/api/admin/roles") return handleAdminRoles(request, env);
  if (method === "POST" && path === "/api/admin/roles") return handleCreateRole(request, env);
  match = path.match(/^\/api\/admin\/users\/([^/]+)$/);
  if (match && method === "PATCH") return handleUpdateUser(request, env, decodePart(match[1]));
  match = path.match(/^\/api\/admin\/roles\/([^/]+)$/);
  if (match && method === "PATCH") return handleUpdateRole(request, env, decodePart(match[1]));
  if (match && method === "DELETE") return handleDeleteRole(request, env, decodePart(match[1]));
  match = path.match(/^\/api\/admin\/(classes|photos)\/([^/]+)$/);
  if (match && method === "DELETE") {
    return handleAdminForceDelete(request, env, match[1], decodePart(match[2]));
  }
  if (method === "POST" && path === "/api/admin/storage/rekey") return handleStartRekey(request, env);
  if (method === "GET" && path === "/api/admin/storage/rekey/status") return handleRekeyStatus(request, env);

  if (path.startsWith("/api/")) return jsonResponse({ error: "Not found" }, 404);
  return serveStatic(request, env);
}

function handleOptions(request) {
  requireSameOrigin(request);
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": new URL(request.url).origin,
      "access-control-allow-methods": "GET,HEAD,POST,PATCH,DELETE,OPTIONS",
      "access-control-allow-headers": "content-type",
      "access-control-allow-credentials": "true",
      "access-control-max-age": "600",
      vary: "Origin",
    },
  });
}

function requireSameOrigin(request) {
  const expected = new URL(request.url).origin;
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if ((origin && origin !== expected) || fetchSite === "cross-site") {
    throw new HttpError("Cross-origin request blocked", 403);
  }
}

async function serveStatic(request, env) {
  if (!env.ASSETS) return jsonResponse({ error: "Static assets are not configured" }, 503);
  let response = await env.ASSETS.fetch(request);
  const acceptsHtml = (request.headers.get("accept") || "").includes("text/html");
  if (response.status === 404 && request.method === "GET" && acceptsHtml) {
    response = await env.ASSETS.fetch(new Request(new URL("/index.html", request.url), request));
  }
  const headers = new Headers(response.headers);
  headers.set("content-security-policy", STATIC_CSP);
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "same-origin");
  headers.set("permissions-policy", "camera=(self), microphone=(), geolocation=()");
  headers.set("x-frame-options", "DENY");
  if ((headers.get("content-type") || "").includes("text/html")) headers.set("cache-control", "no-cache");
  return new Response(response.body, { status: response.status, headers });
}

async function handleMe(request, env) {
  const user = await getSessionUser(request, env);
  return jsonResponse(user ? { authenticated: true, user: publicUser(user) } : { authenticated: false });
}

async function handleLoginUrl(request, env) {
  const url = new URL(request.url);
  const mode = ["admin", "bind", "user"].includes(url.searchParams.get("mode"))
    ? url.searchParams.get("mode")
    : "user";
  const state = randomToken(24);
  const callback = new URL(`/sso-callback/${mode}`, url.origin);
  callback.searchParams.set("state", state);
  const next = safeNextPath(url.searchParams.get("next"));
  if (next) callback.searchParams.set("next", next);
  const login = new URL("/", getAuthOrigin(env));
  login.searchParams.set("client_id", getAppId(env));
  login.searchParams.set("redirect", callback.toString());
  return jsonResponse({ url: login.toString() }, 200, {
    "set-cookie": `pd_sso_state=${state}; Path=/sso-callback; HttpOnly; Secure; SameSite=Lax; Max-Age=300`,
  });
}

async function handleTempLogin(request, env) {
  const current = await getSessionUser(request, env);
  if (current) return jsonResponse({ authenticated: true, user: publicUser(current), reused: true });
  const rateKey = await requestRateKey(request, "temp-login");
  await consumeRateLimit(env, rateKey, 10, 3600, "Too many temporary sessions; try again later");
  const userId = newId("u_");
  const name = randomName();
  const username = `${name.toLowerCase().replace(/[^a-z]+/g, ".").replace(/\.$/, "")}.${Math.floor(100 + Math.random() * 900)}`;
  const defaultRole = await getDefaultRole(env);
  await env.DB.prepare(
    "INSERT INTO app_users (id,kind,role,role_id,name,username,storage_used_bytes,updated_at,last_seen_at) " +
    "VALUES (?1,'temp','user',?2,?3,?4,0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"
  ).bind(userId, defaultRole?.id || null, name, username).run();
  const sessionId = await createSession(env, userId);
  const user = await getUserById(userId, env);
  return jsonResponse({ authenticated: true, user: publicUser(user) }, 200, {
    "set-cookie": sessionCookie(sessionId),
  });
}

async function handleLogout(request, env) {
  const sessionId = getCookie(request, "pd_session");
  if (sessionId) await env.DB.prepare("DELETE FROM app_sessions WHERE id=?1").bind(sessionId).run();
  return jsonResponse({ ok: true }, 200, { "set-cookie": clearSessionCookie() });
}

async function handleSsoCallback(request, env) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) throw new HttpError("Missing login token", 400);
  const verified = await verifyAuthToken(token, env);
  const payload = decodeJwtPayload(token);
  const testCallback = url.pathname.replace(/\/+$/, "") === "/sso-callback"
    && payload.test_session === true
    && payload.target_subapp === getAppId(env);
  const state = url.searchParams.get("state") || "";
  const expectedState = getCookie(request, "pd_sso_state");
  if (!testCallback && (!state || !expectedState || !constantTimeTextEqual(state, expectedState))) {
    throw new HttpError("Login state expired or invalid", 400);
  }
  const mode = testCallback
    ? (payload.role === "admin" ? "admin" : "user")
    : url.pathname.split("/").pop();
  const identity = normalizeVerifiedUser(verified, token);
  if (!identity.uuid) throw new HttpError("Auth Center response has no stable user id", 502);

  const current = await getSessionUser(request, env);
  const existing = await env.DB.prepare(
    "SELECT id,role_id,role,kind FROM app_users WHERE auth_uuid=?1 LIMIT 1"
  )
    .bind(identity.uuid).first();
  const bootstrapLegacyAdmin = mode === "admin" && isAdmin(current) && !existing;
  const admin = existing?.role === "admin" || existing?.kind === "admin" ||
    (testCallback && payload.role === "admin") ||
    isConfiguredAdmin(identity.uuid, env) || bootstrapLegacyAdmin;
  if (mode === "admin" && !admin) throw new HttpError("Admin login is not allowed for this account", 403);
  const upgradeCurrent = (mode === "bind" && current?.kind === "temp") || bootstrapLegacyAdmin;
  const userId = existing?.id || (upgradeCurrent ? current.id : newId("u_"));
  const defaultRole = existing?.role_id
    ? { id: existing.role_id }
    : admin
      ? (await env.DB.prepare("SELECT id FROM roles WHERE id='role_admin' LIMIT 1").first()) || await getDefaultRole(env)
      : await getDefaultRole(env);
  const statements = [env.DB.prepare(
    "INSERT INTO app_users " +
    "(id,kind,role,role_id,auth_uuid,auth_user_id,name,username,email,avatar_url,token,bound_temp_id,storage_used_bytes,updated_at,last_seen_at) " +
    "VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,NULL,?11,0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) " +
    "ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,role=excluded.role,auth_uuid=excluded.auth_uuid," +
    "auth_user_id=excluded.auth_user_id,name=excluded.name,username=excluded.username,email=excluded.email,avatar_url=excluded.avatar_url," +
    "token=NULL,updated_at=CURRENT_TIMESTAMP,last_seen_at=CURRENT_TIMESTAMP"
  ).bind(
    userId,
    admin ? "admin" : "auth",
    admin ? "admin" : "user",
    defaultRole?.id || null,
    identity.uuid,
    identity.userId,
    identity.name,
    identity.username,
    identity.email,
    identity.avatarUrl,
    current?.kind === "temp" ? current.id : null
  )];
  if (existing?.id && current?.kind === "temp" && current.id !== existing.id) {
    statements.push(
      env.DB.prepare("UPDATE search_tasks SET user_id=?2 WHERE user_id=?1").bind(current.id, existing.id),
      env.DB.prepare("UPDATE class_search_history SET user_id=?2 WHERE user_id=?1").bind(current.id, existing.id),
    );
  }
  if (current && (current.kind === "temp" || bootstrapLegacyAdmin)) {
    statements.push(
      env.DB.prepare("DELETE FROM app_sessions WHERE user_id=?1").bind(current.id)
    );
  }
  if (existing?.id && current?.kind === "temp" && current.id !== existing.id) {
    statements.push(env.DB.prepare("DELETE FROM app_users WHERE id=?1 AND kind='temp'").bind(current.id));
  }
  if (testCallback) {
    statements.push(env.DB.prepare("DELETE FROM app_sessions WHERE user_id=?1").bind(userId));
  }
  await env.DB.batch(statements);
  const sessionSeconds = testCallback ? TEST_SESSION_SECONDS : NORMAL_SESSION_SECONDS;
  const sessionId = await createSession(env, userId, sessionSeconds);
  const headers = new Headers({
    location: mode === "admin" ? "/admin" : safeNextPath(url.searchParams.get("next")) || "/home",
    "cache-control": "no-store",
    "referrer-policy": "no-referrer",
  });
  headers.append("set-cookie", sessionCookie(sessionId, sessionSeconds));
  headers.append("set-cookie", "pd_sso_state=; Path=/sso-callback; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
  return new Response(null, { status: 302, headers });
}

async function handleListClasses(request, env) {
  const url = new URL(request.url);
  const scope = ["public", "accessible", "owned"].includes(url.searchParams.get("scope"))
    ? url.searchParams.get("scope")
    : "accessible";
  const user = scope === "public" ? await getSessionUser(request, env) : await requireUser(request, env);
  const where = ["c.deleted_at IS NULL"];
  const binds = [];
  if (scope === "public") {
    where.push("COALESCE(c.visibility,CASE WHEN c.is_open=1 THEN 'public' ELSE 'private' END)='public'");
  } else if (scope === "owned") {
    where.push("c.owner_user_id=?1");
    binds.push(user.id);
  } else if (user.kind === "temp") {
    where.push("COALESCE(c.visibility,CASE WHEN c.is_open=1 THEN 'public' ELSE 'private' END)='public'");
  } else if (!isAdmin(user) && !["all_read", "all_write"].includes(user.access_mode)) {
    where.push(
      "(COALESCE(c.visibility,CASE WHEN c.is_open=1 THEN 'public' ELSE 'private' END)='public' " +
      "OR c.owner_user_id=?1 OR EXISTS(SELECT 1 FROM saved_classes sc WHERE sc.class_id=c.id AND sc.user_id=?1))"
    );
    binds.push(user.id);
  }
  const statement = env.DB.prepare(
    "SELECT c.id,c.name,c.description,c.is_open,c.visibility,c.owner_user_id,c.created_at,c.updated_at," +
    "COALESCE(NULLIF(u.username,''),u.name) owner_name,COUNT(CASE WHEN p.id IS NOT NULL AND p.deleted_at IS NULL AND p.class_removed_at IS NULL THEN 1 END) photo_count," +
    "COALESCE(SUM(CASE WHEN p.deleted_at IS NULL AND p.class_removed_at IS NULL THEN COALESCE(p.byte_size,p.size_bytes,0) ELSE 0 END),0) byte_size " +
    "FROM photo_classes c LEFT JOIN photos p ON p.class_id=c.id LEFT JOIN app_users u ON u.id=c.owner_user_id " +
    `WHERE ${where.join(" AND ")} GROUP BY c.id ORDER BY c.created_at DESC LIMIT 500`
  );
  const rows = await (binds.length ? statement.bind(...binds) : statement).all();
  return jsonResponse({ classes: (rows.results || []).map(classDto), scope });
}

async function handleClassDetail(request, env, classId) {
  const user = await requireUser(request, env);
  const photoClass = await getClass(classId, env);
  if (!photoClass || !(await canReadClass(user, photoClass, env))) throw new HttpError("Class not found", 404);
  return jsonResponse({ class: classDto(photoClass), canWrite: canWriteClass(user, photoClass) });
}

async function handleCreateClass(request, env) {
  const user = await requireBoundUser(request, env);
  if (!canCreateClass(user)) throw new HttpError("Your role cannot create classes", 403);
  const body = await safeJson(request);
  const name = requiredText(body.name, "name", 80);
  const description = String(body.description || "").trim().slice(0, 240);
  const visibility = parseVisibility(body.visibility ?? (body.isOpen ? "public" : "private"));
  const id = newId("c_");
  await env.DB.prepare(
    "INSERT INTO photo_classes (id,name,description,is_open,visibility,created_by,owner_user_id,updated_at) " +
    "VALUES (?1,?2,?3,?4,?5,?6,?6,CURRENT_TIMESTAMP)"
  ).bind(id, name, description, visibility === "public" ? 1 : 0, visibility, user.id).run();
  await invalidatePublicClassCache(env);
  return jsonResponse({ class: classDto({ id, name, description, visibility, is_open: visibility === "public" ? 1 : 0, owner_user_id: user.id, photo_count: 0, byte_size: 0 }) }, 201);
}

async function handleUpdateClass(request, env, classId) {
  const user = await requireUser(request, env);
  const current = await getClass(classId, env);
  if (!current || !canWriteClass(user, current)) throw new HttpError("Class not found", 404);
  const body = await safeJson(request);
  const name = body.name === undefined ? current.name : requiredText(body.name, "name", 80);
  const description = body.description === undefined
    ? current.description || ""
    : String(body.description || "").trim().slice(0, 240);
  const visibility = body.visibility === undefined && body.isOpen === undefined
    ? classVisibility(current)
    : parseVisibility(body.visibility ?? (body.isOpen ? "public" : "private"));
  await env.DB.prepare(
    "UPDATE photo_classes SET name=?2,description=?3,visibility=?4,is_open=?5,updated_at=CURRENT_TIMESTAMP WHERE id=?1 AND deleted_at IS NULL"
  ).bind(classId, name, description, visibility, visibility === "public" ? 1 : 0).run();
  await invalidatePublicClassCache(env);
  return jsonResponse({ class: classDto({ ...current, name, description, visibility, is_open: visibility === "public" ? 1 : 0 }) });
}

async function handleDeleteClass(request, env, classId) {
  const user = await requireUser(request, env);
  const photoClass = await getClass(classId, env, true);
  if (!photoClass) throw new HttpError("Class not found", 404);
  if (!canWriteClass(user, photoClass)) {
    const result = await env.DB.prepare("DELETE FROM saved_classes WHERE user_id=?1 AND class_id=?2")
      .bind(user.id, classId).run();
    if (Number(result.meta?.changes || 0) > 0) return jsonResponse({
      deleted: false,
      removedPointer: true,
      target: { kind: "class", id: classId, name: photoClass.name, count: 1 },
    });
    throw new HttpError("You cannot delete this class", 403);
  }
  const job = await scheduleDeletion("class", photoClass, user, false, env);
  await invalidatePublicClassCache(env);
  return jsonResponse({
    deleted: true,
    pending: true,
    jobId: job.id,
    target: { kind: "class", id: classId, name: photoClass.name, count: 1 },
  }, 202);
}

async function handleClassPhotos(request, env, classId) {
  const user = await requireUser(request, env);
  const photoClass = await getClass(classId, env);
  if (!photoClass || !(await canReadClass(user, photoClass, env))) throw new HttpError("Class not found", 404);
  const rows = await env.DB.prepare(
    "SELECT id,class_id,owner_user_id,original_name,content_type,COALESCE(byte_size,size_bytes,0) byte_size,metadata_json,status,created_at " +
    "FROM photos WHERE class_id=?1 AND deleted_at IS NULL AND class_removed_at IS NULL ORDER BY created_at DESC"
  ).bind(classId).all();
  return jsonResponse({
    class: classDto(photoClass),
    canWrite: canWriteClass(user, photoClass),
    photos: (rows.results || []).map(photoDto),
  });
}

async function handleClassSearch(request, env) {
  const url = new URL(request.url);
  const query = String(url.searchParams.get("q") || "").trim().slice(0, 160);
  const parsed = parseClassQuery(query);
  if (!query || (!parsed.groups.length && !parsed.excluded.length && !Object.keys(parsed.filters).length)) {
    return jsonResponse({ query, classes: [], syntax: searchSyntax() });
  }
  const user = await getSessionUser(request, env);
  await consumeRateLimit(
    env,
    await requestRateKey(request, "class-search"),
    60,
    60,
    "Too many searches from this network; try again shortly"
  );
  if (user) {
    await consumeRateLimit(
      env,
      `class-search-user:${user.id}`,
      60,
      60,
      "Too many searches; try again shortly"
    );
  }
  const candidates = await getPublicClassCandidates(env);
  const before = parsed.filters.before ? Date.parse(`${parsed.filters.before}T00:00:00.000Z`) : 0;
  const after = parsed.filters.after ? Date.parse(`${parsed.filters.after}T00:00:00.000Z`) : 0;
  const ranked = candidates
    .filter((item) => {
      const created = sqliteTimestampMs(item.created_at);
      return (!before || created < before) && (!after || created >= after);
    })
    .map((item) => ({ ...item, relevance: classNameRelevance(item.name, parsed) }))
    .filter((item) => item.relevance > 0)
    .sort((left, right) => right.relevance - left.relevance || left.name.localeCompare(right.name))
    .slice(0, 80);

  const rechecked = ranked.length ? await env.DB.batch(ranked.map((item) => env.DB.prepare(
    "SELECT id,name,created_at FROM photo_classes WHERE id=?1 AND deleted_at IS NULL " +
    "AND COALESCE(visibility,CASE WHEN is_open=1 THEN 'public' ELSE 'private' END)='public' LIMIT 1"
  ).bind(item.id))) : [];
  const active = ranked.filter((_, index) => rechecked[index]?.results?.length);
  const photoResults = active.length ? await env.DB.batch(active.map((item) => env.DB.prepare(
    "SELECT id,class_id,owner_user_id,original_name,content_type,COALESCE(byte_size,size_bytes,0) byte_size,metadata_json,status,created_at " +
    "FROM photos WHERE class_id=?1 AND deleted_at IS NULL AND class_removed_at IS NULL " +
    "ORDER BY created_at DESC LIMIT 200"
  ).bind(item.id))) : [];
  const classes = active.slice(0, 30).map((item, index) => ({
    id: item.id,
    name: item.name,
    relevance: item.relevance,
    photos: (photoResults[index]?.results || []).map(photoDto),
  }));
  if (user) await recordClassSearch(user.id, query, classes.flatMap((item) => item.photos.map((photo) => photo.id)), env);
  return jsonResponse({ query, parsed, classes, syntax: searchSyntax() });
}

async function getPublicClassCandidates(env) {
  if (env.SEARCH_CACHE) {
    try {
      const cached = await env.SEARCH_CACHE.get(PUBLIC_CACHE_KEY, "json");
      if (Array.isArray(cached)) return cached;
    } catch (error) {
      console.warn("Public class cache read failed", error);
    }
  }
  const rows = await env.DB.prepare(
    "SELECT id,name,created_at FROM photo_classes WHERE deleted_at IS NULL " +
    "AND COALESCE(visibility,CASE WHEN is_open=1 THEN 'public' ELSE 'private' END)='public' " +
    "ORDER BY created_at DESC LIMIT 5000"
  ).all();
  const candidates = rows.results || [];
  if (env.SEARCH_CACHE) {
    try {
      await env.SEARCH_CACHE.put(PUBLIC_CACHE_KEY, JSON.stringify(candidates), { expirationTtl: 300 });
    } catch (error) {
      console.warn("Public class cache write failed", error);
    }
  }
  return candidates;
}

async function invalidatePublicClassCache(env) {
  if (!env.SEARCH_CACHE) return;
  try {
    await env.SEARCH_CACHE.delete(PUBLIC_CACHE_KEY);
  } catch (error) {
    console.warn("Public class cache invalidation failed", error);
  }
}

function searchSyntax() {
  return {
    phrase: "\"graduation day\"",
    exclude: "-draft",
    or: "spring OR summer",
    fieldAliases: ["name:", "class:"],
    dates: ["before:YYYY-MM-DD", "after:YYYY-MM-DD"],
  };
}

async function handleUploadPhotos(request, env, classId) {
  const user = await requireUser(request, env);
  const photoClass = await getClass(classId, env);
  if (!photoClass || !canWriteClass(user, photoClass)) throw new HttpError("Class not found", 404);
  const form = await request.formData();
  const files = extractFiles(form, "photos");
  if (!files.length) throw new HttpError("No photos were uploaded", 400);
  if (files.length > 100) throw new HttpError("Upload at most 100 photos at once", 413);
  const validatedTypes = [];
  for (const file of files) validatedTypes.push(await validateImageFile(file, MAX_UPLOAD_BYTES));
  const metadata = await Promise.all(files.map(extractPhotoMetadata));
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  const owner = await getUserById(photoClass.owner_user_id, env);
  if (!owner) throw new HttpError("Class owner no longer exists", 409);
  await reserveStorage(owner, totalBytes, env);

  const rows = files.map((file, index) => {
    const id = newId("p_");
    const contentType = validatedTypes[index];
    const extension = trustedExtension(contentType);
    return {
      id,
      classId,
      ownerId: owner.id,
      key: `${classId}/${id}.${extension}`,
      name: String(file.name || `${id}.${extension}`).slice(0, 255),
      type: contentType,
      bytes: file.size,
      metadata: metadata[index],
      file,
    };
  });
  const storedKeys = [];
  try {
    for (const row of rows) {
      await env.PHOTO_BUCKET.put(row.key, row.file.stream(), {
        httpMetadata: { contentType: row.type },
        customMetadata: { originalName: row.name, classId, photoId: row.id },
      });
      storedKeys.push(row.key);
    }
    await env.DB.batch([
      ...rows.map((row) => env.DB.prepare(
        "INSERT INTO photos " +
        "(id,class_id,owner_user_id,r2_key,original_name,content_type,size_bytes,byte_size,metadata_json,status,updated_at) " +
        "VALUES (?1,?2,?3,?4,?5,?6,?7,?7,?8,'uploaded',CURRENT_TIMESTAMP)"
      ).bind(row.id, row.classId, row.ownerId, row.key, row.name, row.type, row.bytes, JSON.stringify(row.metadata))),
    ]);
  } catch (error) {
    await Promise.allSettled(storedKeys.map((key) => env.PHOTO_BUCKET.delete(key)));
    await releaseStorage(owner.id, totalBytes, env);
    throw error;
  }
  let queued = true;
  try {
    await env.INGEST_QUEUE.sendBatch(rows.map((row) => ({ body: { type: "photo.ingest", photoId: row.id } })));
  } catch (error) {
    queued = false;
    console.error("Ingest queue send failed; photos remain retryable", error);
  }
  return jsonResponse({ uploaded: rows.length, photos: rows.map((row) => photoDto({
    id: row.id,
    class_id: row.classId,
    owner_user_id: row.ownerId,
    original_name: row.name,
    content_type: row.type,
    byte_size: row.bytes,
    metadata_json: JSON.stringify(row.metadata),
    status: "uploaded",
  })), queued }, queued ? 202 : 201);
}

async function handleLegacyAdminUpload(request, env) {
  await requireAdmin(request, env);
  const form = await request.clone().formData();
  const classId = String(form.get("class_id") || "").trim();
  if (!classId) throw new HttpError("class_id is required", 400);
  return handleUploadPhotos(request, env, classId);
}

async function handleRetryIngest(request, env) {
  await requireAdmin(request, env);
  const limit = clampInteger(new URL(request.url).searchParams.get("limit"), 1, 200, 50);
  const rows = await env.DB.prepare(
    "SELECT id FROM photos WHERE deleted_at IS NULL AND status IN ('uploaded','failed') ORDER BY created_at DESC LIMIT ?1"
  ).bind(limit).all();
  await Promise.all((rows.results || []).map((photo) => env.INGEST_QUEUE.send({ type: "photo.ingest", photoId: photo.id })));
  return jsonResponse({ requeued: rows.results?.length || 0 });
}

async function handleSearchUpload(request, env) {
  const user = await requireUser(request, env);
  await consumeRateLimit(env, `face-user:${user.id}`, 10, 3600, "Hourly face-search limit reached");
  const rateKey = await requestRateKey(request, "face-search");
  await consumeRateLimit(env, rateKey, 20, 3600, "Too many face searches from this network");
  const form = await request.formData();
  const selfie = form.get("selfie");
  if (!(selfie instanceof File)) throw new HttpError("A selfie file is required", 400);
  const selfieContentType = await validateImageFile(selfie, 10 * 1024 * 1024);
  const taskId = newId("task_");
  const extension = trustedExtension(selfieContentType);
  const key = `temp/selfies/${taskId}.${extension}`;
  await env.PHOTO_BUCKET.put(key, selfie.stream(), {
    httpMetadata: { contentType: selfieContentType },
    customMetadata: { purpose: "face-search", taskId },
  });
  try {
    await env.DB.prepare(
      "INSERT INTO search_tasks " +
      "(id,user_id,selfie_key,selfie_name,selfie_content_type,selfie_size_bytes,status,updated_at) " +
      "VALUES (?1,?2,?3,?4,?5,?6,'pending',CURRENT_TIMESTAMP)"
    ).bind(taskId, user.id, key, String(selfie.name || "selfie").slice(0, 255), selfieContentType, selfie.size).run();
  } catch (error) {
    await env.PHOTO_BUCKET.delete(key);
    throw error;
  }
  try {
    await env.SEARCH_QUEUE.send({ type: "search.run", taskId });
  } catch (error) {
    await env.DB.prepare("DELETE FROM search_tasks WHERE id=?1").bind(taskId).run();
    await env.PHOTO_BUCKET.delete(key);
    throw new HttpError("Face search is temporarily unavailable; please retry", 503);
  }
  return jsonResponse({ taskId, status: "pending" }, 202);
}

async function handleTaskStatus(request, env, taskId) {
  const user = await requireUser(request, env);
  const task = await env.DB.prepare(
    "SELECT id,user_id,status,match_count,matched_photo_ids,matched_scores,error_message,created_at,updated_at,completed_at " +
    "FROM search_tasks WHERE id=?1 LIMIT 1"
  ).bind(taskId).first();
  if (!task || (!isAdmin(user) && task.user_id !== user.id)) throw new HttpError("Task not found", 404);
  const ids = parseJsonArray(task.matched_photo_ids);
  const scores = parseJsonArray(task.matched_scores);
  const photosById = await visiblePhotoMap(ids, user, env);
  const photos = ids.map((id, index) => {
    const photo = photosById.get(id);
    return photo ? { ...photo, ...(scores[index] || {}) } : null;
  }).filter(Boolean);
  return jsonResponse({
    taskId: task.id,
    status: task.status,
    matchCount: photos.length,
    results: photos.map(photoDto),
    error: task.error_message,
    createdAt: task.created_at,
    updatedAt: task.updated_at,
    completedAt: task.completed_at,
  });
}

async function handleSelfieFile(request, env, taskId) {
  const user = await requireUser(request, env);
  const task = await env.DB.prepare(
    "SELECT id,user_id,selfie_key,selfie_name,selfie_content_type FROM search_tasks WHERE id=?1 LIMIT 1"
  ).bind(taskId).first();
  if (!task || (!isAdmin(user) && task.user_id !== user.id)) throw new HttpError("Selfie not found", 404);
  if (!task.selfie_key) throw new HttpError("Selfie preview has expired", 404);
  return streamR2Object(request, env, task.selfie_key, {
    contentType: task.selfie_content_type,
    filename: task.selfie_name,
    publicCache: false,
  });
}

async function handleUnifiedHistory(request, env, onlyType = "") {
  const user = await requireUser(request, env);
  const limit = clampInteger(new URL(request.url).searchParams.get("limit"), 1, 100, 50);
  const [selfieRows, searchRows] = await Promise.all([
    onlyType === "search" ? { results: [] } : env.DB.prepare(
      "SELECT id,status,match_count,matched_photo_ids,matched_scores,error_message,selfie_name,created_at,updated_at,completed_at " +
      "FROM search_tasks WHERE user_id=?1 ORDER BY created_at DESC LIMIT ?2"
    ).bind(user.id, limit).all(),
    env.DB.prepare(
      "SELECT id,query,result_count,matched_photo_ids,created_at FROM class_search_history " +
      "WHERE user_id=?1 ORDER BY created_at DESC LIMIT ?2"
    ).bind(user.id, limit).all(),
  ]);
  const selfieSource = selfieRows.results || [];
  const searchSource = searchRows.results || [];
  const allPhotoIds = [...new Set(
    [...selfieSource, ...searchSource].flatMap((row) => parseJsonArray(row.matched_photo_ids))
  )];
  const visibleById = await visiblePhotoMap(allPhotoIds, user, env);
  const selfieRecords = selfieSource.map((row) => {
    const scores = parseJsonArray(row.matched_scores);
    const photos = parseJsonArray(row.matched_photo_ids).map((id, index) => {
      const photo = visibleById.get(id);
      return photo ? { ...photo, ...(scores[index] || {}) } : null;
    }).filter(Boolean);
    return {
      id: row.id,
      type: "selfie",
      title: row.selfie_name || "Selfie recognition",
      status: row.status,
      resultCount: photos.length,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
      error: row.error_message,
      photos: photos.map(photoDto),
    };
  });
  const searchRecords = searchSource.map((row) => {
    const ids = parseJsonArray(row.matched_photo_ids);
    return {
      id: row.id,
      type: "search",
      title: row.query,
      query: row.query,
      status: "completed",
      resultCount: Number(row.result_count || ids.length),
      createdAt: row.created_at,
      photos: ids.map((id) => visibleById.has(id)
        ? photoDto(visibleById.get(id))
        : { id, name: "Image unavailable", available: false, url: null }),
    };
  });
  const records = [...selfieRecords, ...searchRecords]
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
    .slice(0, limit);
  return jsonResponse({
    synced: Boolean(user.auth_uuid || isAdmin(user)),
    records,
    tasks: selfieRecords,
  });
}

async function handleDeleteHistory(request, env, type, id) {
  const user = await requireUser(request, env);
  if (type === "search") {
    const result = await env.DB.prepare("DELETE FROM class_search_history WHERE id=?1 AND user_id=?2")
      .bind(id, user.id).run();
    if (!result.meta?.changes) throw new HttpError("History record not found", 404);
  } else {
    const task = await env.DB.prepare("SELECT selfie_key FROM search_tasks WHERE id=?1 AND user_id=?2 LIMIT 1")
      .bind(id, user.id).first();
    if (!task) throw new HttpError("History record not found", 404);
    await env.PHOTO_BUCKET.delete(task.selfie_key);
    await env.DB.prepare("DELETE FROM search_tasks WHERE id=?1 AND user_id=?2").bind(id, user.id).run();
  }
  return jsonResponse({ deleted: true, type, id });
}

async function handleRecentQueries(request, env) {
  const user = await requireUser(request, env);
  const rows = await env.DB.prepare(
    "SELECT query,MAX(created_at) last_used FROM class_search_history WHERE user_id=?1 " +
    "GROUP BY query ORDER BY last_used DESC LIMIT 8"
  ).bind(user.id).all();
  return jsonResponse({ synced: Boolean(user.auth_uuid || isAdmin(user)), queries: (rows.results || []).map((row) => row.query) });
}

async function handleSaveQuery(request, env) {
  const user = await requireUser(request, env);
  await consumeRateLimit(
    env,
    `search-history-user:${user.id}`,
    60,
    60,
    "Too many history updates; try again shortly"
  );
  const body = await safeJson(request);
  const query = String(body.query || "").trim().slice(0, 160);
  if (!query) return jsonResponse({ saved: false });
  await recordClassSearch(user.id, query, [], env);
  return jsonResponse({ saved: true, synced: Boolean(user.auth_uuid || isAdmin(user)) });
}

async function recordClassSearch(userId, query, photoIds, env) {
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO class_search_history (id,user_id,query,result_count,matched_photo_ids) VALUES (?1,?2,?3,?4,?5)"
    ).bind(newId("hist_"), userId, query, photoIds.length, JSON.stringify(photoIds)),
    env.DB.prepare(
      "DELETE FROM class_search_history WHERE user_id=?1 AND id NOT IN (" +
      "SELECT id FROM class_search_history WHERE user_id=?1 ORDER BY created_at DESC,id DESC LIMIT 500)"
    ).bind(userId),
  ]);
}

async function handlePhotoFile(request, env, photoId) {
  const photo = await getPhoto(photoId, env);
  if (!photo) throw new HttpError("Photo not found", 404);
  const visibility = classVisibility(photo);
  const publiclyVisible = !photo.class_removed_at && !photo.class_deleted_at && visibility === "public";
  let allowed = publiclyVisible;
  if (!allowed) {
    const user = await getSessionUser(request, env);
    allowed = Boolean(user && await canReadPhoto(user, photo, env));
  }
  if (!allowed) throw new HttpError("Photo not found", 404);
  return streamR2Object(request, env, photo.r2_key, {
    contentType: photo.content_type,
    filename: photo.original_name,
    publicCache: publiclyVisible,
  });
}

async function handlePhotoThumbnail(request, env, photoId) {
  const photo = await getPhoto(photoId, env);
  if (!photo) throw new HttpError("Photo not found", 404);
  const visibility = classVisibility(photo);
  const publiclyVisible = !photo.class_removed_at && !photo.class_deleted_at && visibility === "public";
  let allowed = publiclyVisible;
  if (!allowed) {
    const user = await getSessionUser(request, env);
    allowed = Boolean(user && await canReadPhoto(user, photo, env));
  }
  if (!allowed) throw new HttpError("Photo not found", 404);
  if (!env.IMAGES) {
    return streamR2Object(request, env, photo.r2_key, {
      contentType: photo.content_type,
      filename: photo.original_name,
      publicCache: publiclyVisible,
    });
  }
  const object = await env.PHOTO_BUCKET.get(photo.r2_key);
  if (!object) throw new HttpError("File not found", 404);
  try {
    const transformed = await env.IMAGES
      .input(object.body)
      .transform({ width: 520 })
      .output({ format: "image/webp", quality: 74 })
      .response();
    const headers = new Headers(transformed.headers);
    headers.set("content-type", "image/webp");
    headers.set("cache-control", publiclyVisible
      ? "public, max-age=3600, stale-while-revalidate=86400"
      : "private, max-age=300");
    headers.set("content-disposition", "inline");
    headers.set("x-content-type-options", "nosniff");
    return new Response(request.method === "HEAD" ? null : transformed.body, {
      status: transformed.status,
      headers,
    });
  } catch {
    return streamR2Object(request, env, photo.r2_key, {
      contentType: photo.content_type,
      filename: photo.original_name,
      publicCache: publiclyVisible,
    });
  }
}

async function handleDeletePhoto(request, env, photoId) {
  const user = await requireUser(request, env);
  const photo = await getPhoto(photoId, env, true);
  if (!photo) throw new HttpError("Photo not found", 404);
  if (photo.class_delete_job_id) {
    const classJob = await env.DB.prepare(
      "SELECT status FROM deletion_jobs WHERE id=?1 LIMIT 1"
    ).bind(photo.class_delete_job_id).first();
    if (["pending", "processing"].includes(classJob?.status)) {
      throw new HttpError("This photo's class is already being deleted", 409);
    }
  }
  const canDeleteOriginal = isAdmin(user) || user.access_mode === "all_write" ||
    (user.access_mode === "own_write" && photo.owner_user_id === user.id);
  if (!canDeleteOriginal) {
    const result = await env.DB.prepare("DELETE FROM saved_photos WHERE user_id=?1 AND photo_id=?2")
      .bind(user.id, photoId).run();
    if (Number(result.meta?.changes || 0) > 0) return jsonResponse({
      deleted: false,
      removedPointer: true,
      target: { kind: "photos", id: photoId, name: photo.class_name, count: 1 },
    });
    throw new HttpError("You cannot delete this photo", 403);
  }
  const job = await scheduleDeletion("photo", photo, user, false, env);
  return jsonResponse({
    deleted: true,
    pending: true,
    jobId: job.id,
    target: { kind: "photos", id: photoId, name: photo.class_name, count: 1 },
  }, 202);
}

async function handleStorage(request, env) {
  const user = await requireUser(request, env);
  if (!isAdmin(user) && user.access_mode === "own_read") {
    return jsonResponse({ storage: null, hidden: true, role: roleDto(user) });
  }
  const [classes, photos] = await env.DB.batch([
    env.DB.prepare(
      "SELECT COUNT(*) count FROM photo_classes WHERE owner_user_id=?1 AND deleted_at IS NULL"
    ).bind(user.id),
    env.DB.prepare(
      "SELECT COUNT(*) count,COALESCE(SUM(COALESCE(byte_size,size_bytes,0)),0) bytes FROM photos " +
      "WHERE owner_user_id=?1 AND deleted_at IS NULL"
    ).bind(user.id),
  ]);
  const quota = Number(user.quota_bytes || 0);
  const used = Number(user.storage_used_bytes || 0);
  return jsonResponse({
    storage: {
      usedBytes: used,
      quotaBytes: quota,
      unlimited: quota === 0,
      ratio: quota > 0 ? Math.min(1, used / quota) : 0,
      classCount: Number(classes.results?.[0]?.count || 0),
      photoCount: Number(photos.results?.[0]?.count || 0),
      measuredOwnedBytes: Number(photos.results?.[0]?.bytes || 0),
    },
    role: roleDto(user),
  });
}

async function handleSaved(request, env) {
  const user = await requireUser(request, env);
  const { classRows, photoRows } = await querySavedContent(user, env);
  return jsonResponse({
    classes: (classRows.results || []).map(classDto),
    photos: (photoRows.results || []).map(photoDto),
  });
}

async function querySavedContent(user, env) {
  const [classRows, photoRows] = await env.DB.batch([
    env.DB.prepare(
      "SELECT c.id,c.name,c.description,c.visibility,c.is_open,c.owner_user_id,c.created_at,sc.created_at saved_at," +
      "COUNT(CASE WHEN p.id IS NOT NULL AND p.deleted_at IS NULL AND p.class_removed_at IS NULL THEN 1 END) photo_count " +
      "FROM saved_classes sc JOIN photo_classes c ON c.id=sc.class_id " +
      "LEFT JOIN photos p ON p.class_id=c.id WHERE sc.user_id=?1 AND c.deleted_at IS NULL " +
      "GROUP BY c.id ORDER BY sc.created_at DESC"
    ).bind(user.id),
    env.DB.prepare(
      "SELECT p.id,p.class_id,p.owner_user_id,p.original_name,p.content_type,p.metadata_json,p.class_removed_at," +
      "(p.owner_user_id=?1) owned," +
      "COALESCE(p.byte_size,p.size_bytes,0) byte_size,p.status,p.created_at," +
      "COALESCE(sp.created_at,sc.created_at,p.updated_at) saved_at,c.created_at class_created_at," +
      "CASE WHEN sp.user_id IS NOT NULL THEN 'photo' WHEN sc.user_id IS NOT NULL THEN 'class' ELSE 'transfer' END saved_kind," +
      "c.name class_name,c.description class_description,c.deleted_at class_deleted_at " +
      "FROM photos p JOIN photo_classes c ON c.id=p.class_id " +
      "LEFT JOIN saved_photos sp ON sp.photo_id=p.id AND sp.user_id=?1 " +
      "LEFT JOIN saved_classes sc ON sc.class_id=p.class_id AND sc.user_id=?1 " +
      "WHERE p.deleted_at IS NULL AND (sp.user_id IS NOT NULL OR " +
      "(sc.user_id IS NOT NULL AND c.deleted_at IS NULL AND p.class_removed_at IS NULL) OR " +
      "(p.owner_user_id=?1 AND (p.class_removed_at IS NOT NULL OR c.deleted_at IS NOT NULL))) " +
      "ORDER BY COALESCE(sp.created_at,sc.created_at,p.updated_at) DESC"
    ).bind(user.id),
  ]);
  return { classRows, photoRows };
}

async function handleGetBackground(request, env) {
  const user = await requireBoundUser(request, env);
  const row = await env.DB.prepare(
    "SELECT mode,original_key,cropped_key,restore_deadline FROM user_backgrounds WHERE user_id=?1 LIMIT 1"
  ).bind(user.id).first();
  const storedMode = row?.mode || (row?.cropped_key ? "custom" : "none");
  const mode = storedMode === "custom" && !row?.cropped_key ? "none" : storedMode;
  return jsonResponse({
    mode,
    background: mode === "bing" ? {
      url: "/api/background/bing",
      source: "bing",
      hasOriginal: Boolean(row?.original_key),
    } : mode === "custom" && row?.cropped_key ? {
      url: "/api/background/file?kind=cropped",
      source: "custom",
      hasOriginal: Boolean(row.original_key),
    } : null,
    customAvailable: Boolean(row?.cropped_key),
    restoreUntil: row?.restore_deadline || null,
  });
}

async function handleBackgroundMode(request, env) {
  const user = await requireBoundUser(request, env);
  const body = await safeJson(request);
  const mode = String(body.mode || "");
  if (!["none", "custom", "bing"].includes(mode)) throw new HttpError("Invalid background mode", 400);
  if (mode === "custom") {
    const row = await env.DB.prepare(
      "SELECT cropped_key FROM user_backgrounds WHERE user_id=?1 LIMIT 1"
    ).bind(user.id).first();
    if (!row?.cropped_key) throw new HttpError("Upload a custom background first", 409);
  }
  await env.DB.prepare(
    "INSERT INTO user_backgrounds (user_id,mode,updated_at) VALUES (?1,?2,CURRENT_TIMESTAMP) " +
    "ON CONFLICT(user_id) DO UPDATE SET mode=excluded.mode,updated_at=CURRENT_TIMESTAMP"
  ).bind(user.id, mode).run();
  return handleGetBackground(request, env);
}

async function handleBingBackground(request, env) {
  await requireBoundUser(request, env);
  const market = new URL(request.url).searchParams.get("mkt") === "en-US" ? "en-US" : "zh-CN";
  const archive = await fetch(
    `https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=${market}`,
    { headers: { accept: "application/json" } }
  );
  if (!archive.ok) throw new HttpError("Daily background is temporarily unavailable", 502);
  const data = await archive.json();
  const imagePath = String(data?.images?.[0]?.url || "");
  if (!imagePath.startsWith("/th?id=")) throw new HttpError("Daily background is temporarily unavailable", 502);
  const image = await fetch(`https://www.bing.com${imagePath}`);
  if (!image.ok || !image.body) throw new HttpError("Daily background is temporarily unavailable", 502);
  return new Response(request.method === "HEAD" ? null : image.body, {
    status: 200,
    headers: {
      "content-type": image.headers.get("content-type") || "image/jpeg",
      "cache-control": "private, max-age=21600",
      "x-content-type-options": "nosniff",
    },
  });
}

async function handleSaveBackground(request, env) {
  const user = await requireBoundUser(request, env);
  const form = await request.formData();
  const cropped = form.get("cropped");
  const original = form.get("original");
  if (!(cropped instanceof File)) throw new HttpError("A cropped background is required", 400);
  const croppedType = await validateImageFile(cropped, 10 * 1024 * 1024);
  const originalType = original instanceof File
    ? await validateImageFile(original, 18 * 1024 * 1024)
    : "";
  const current = await env.DB.prepare(
    "SELECT * FROM user_backgrounds WHERE user_id=?1 LIMIT 1"
  ).bind(user.id).first();
  const version = newId("bg_");
  const croppedKey = `backgrounds/${user.id}/${version}-cropped.${trustedExtension(croppedType)}`;
  const originalKey = original instanceof File
    ? `backgrounds/${user.id}/${version}-original.${trustedExtension(originalType, original.name)}`
    : current?.original_key || "";
  const uploaded = [];
  try {
    if (original instanceof File) {
      await env.PHOTO_BUCKET.put(originalKey, original.stream(), {
        httpMetadata: { contentType: originalType },
        customMetadata: { purpose: "home-background-original", userId: user.id },
      });
      uploaded.push(originalKey);
    }
    await env.PHOTO_BUCKET.put(croppedKey, cropped.stream(), {
      httpMetadata: { contentType: croppedType },
      customMetadata: { purpose: "home-background-cropped", userId: user.id },
    });
    uploaded.push(croppedKey);
    await env.DB.prepare(
      "INSERT INTO user_backgrounds " +
      "(user_id,mode,original_key,cropped_key,original_content_type,cropped_content_type,updated_at) " +
      "VALUES (?1,'custom',?2,?3,?4,?5,CURRENT_TIMESTAMP) " +
      "ON CONFLICT(user_id) DO UPDATE SET original_key=excluded.original_key,cropped_key=excluded.cropped_key," +
      "original_content_type=excluded.original_content_type,cropped_content_type=excluded.cropped_content_type," +
      "mode='custom'," +
      "pending_original_key=NULL,pending_cropped_key=NULL,restore_token_hash=NULL,restore_deadline=NULL," +
      "updated_at=CURRENT_TIMESTAMP"
    ).bind(user.id, originalKey, croppedKey, originalType || current?.original_content_type || "", croppedType).run();
  } catch (error) {
    await Promise.allSettled(uploaded.map((key) => env.PHOTO_BUCKET.delete(key)));
    throw error;
  }
  const obsolete = [
    current?.cropped_key,
    original instanceof File ? current?.original_key : "",
    current?.pending_original_key,
    current?.pending_cropped_key,
  ].filter((key) => key && key !== originalKey && key !== croppedKey);
  await Promise.allSettled(obsolete.map((key) => env.PHOTO_BUCKET.delete(key)));
  return jsonResponse({
    background: { url: "/api/background/file?kind=cropped", hasOriginal: Boolean(originalKey) },
  });
}

async function handleDeleteBackground(request, env) {
  const user = await requireBoundUser(request, env);
  const row = await env.DB.prepare(
    "SELECT * FROM user_backgrounds WHERE user_id=?1 LIMIT 1"
  ).bind(user.id).first();
  if (!row?.cropped_key) throw new HttpError("Background not found", 404);
  const restoreToken = randomToken(32);
  const restoreTokenHash = await sha256(restoreToken);
  const restoreDeadline = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  await env.DB.prepare(
    "UPDATE user_backgrounds SET pending_original_key=original_key,pending_cropped_key=cropped_key," +
    "original_key=NULL,cropped_key=NULL,mode=CASE WHEN mode='custom' THEN 'none' ELSE mode END," +
    "restore_token_hash=?2,restore_deadline=?3,updated_at=CURRENT_TIMESTAMP " +
    "WHERE user_id=?1"
  ).bind(user.id, restoreTokenHash, restoreDeadline).run();
  return jsonResponse({ deleted: true, restoreToken, restoreUntil: restoreDeadline });
}

async function handleRestoreBackground(request, env) {
  const user = await requireBoundUser(request, env);
  const body = await safeJson(request);
  const tokenHash = await sha256(String(body.restoreToken || ""));
  const row = await env.DB.prepare(
    "SELECT * FROM user_backgrounds WHERE user_id=?1 AND restore_token_hash=?2 " +
    "AND datetime(restore_deadline)>datetime('now') LIMIT 1"
  ).bind(user.id, tokenHash).first();
  if (!row?.pending_cropped_key) throw new HttpError("Restore window has expired", 409);
  await env.DB.prepare(
    "UPDATE user_backgrounds SET original_key=pending_original_key,cropped_key=pending_cropped_key," +
    "mode='custom'," +
    "pending_original_key=NULL,pending_cropped_key=NULL,restore_token_hash=NULL,restore_deadline=NULL," +
    "updated_at=CURRENT_TIMESTAMP WHERE user_id=?1"
  ).bind(user.id).run();
  return jsonResponse({
    restored: true,
    background: { url: "/api/background/file?kind=cropped", hasOriginal: Boolean(row.pending_original_key) },
  });
}

async function handleBackgroundFile(request, env) {
  const user = await requireBoundUser(request, env);
  const kind = new URL(request.url).searchParams.get("kind") === "original" ? "original" : "cropped";
  const row = await env.DB.prepare(
    "SELECT original_key,cropped_key,original_content_type,cropped_content_type " +
    "FROM user_backgrounds WHERE user_id=?1 LIMIT 1"
  ).bind(user.id).first();
  const key = kind === "original" ? row?.original_key : row?.cropped_key;
  if (!key) throw new HttpError("Background not found", 404);
  return streamR2Object(request, env, key, {
    contentType: kind === "original" ? row.original_content_type : row.cropped_content_type,
    filename: `home-background-${kind}`,
    publicCache: false,
  });
}

async function handleSavePointer(request, env, kind, targetId) {
  const user = await requireBoundUser(request, env);
  if (kind === "classes") {
    const photoClass = await getClass(targetId, env);
    if (!photoClass || !(await canReadClass(user, photoClass, env))) throw new HttpError("Class not found", 404);
    if (photoClass.owner_user_id === user.id) return jsonResponse({ saved: true, alreadyOwner: true });
  } else {
    const photo = await getPhoto(targetId, env);
    if (!photo || !(await canReadPhoto(user, photo, env))) throw new HttpError("Photo not found", 404);
    if (photo.owner_user_id === user.id) return jsonResponse({ saved: true, alreadyOwner: true });
  }
  const eventId = newId("save_");
  await env.INGEST_QUEUE.send({
    type: "pointer.save",
    eventId,
    userId: user.id,
    kind,
    targetId,
  });
  return jsonResponse({ queued: true, eventId, kind, id: targetId }, 202);
}

async function handleRemovePointer(request, env, kind, targetId) {
  const user = await requireUser(request, env);
  const table = kind === "classes" ? "saved_classes" : "saved_photos";
  const column = kind === "classes" ? "class_id" : "photo_id";
  const result = await env.DB.prepare(`DELETE FROM ${table} WHERE user_id=?1 AND ${column}=?2`)
    .bind(user.id, targetId).run();
  return jsonResponse({ removed: Number(result.meta?.changes || 0) > 0 });
}

async function handleListShareLinks(request, env) {
  const user = await requireBoundUser(request, env);
  const includeContent = new URL(request.url).searchParams.get("include") === "content";
  const rows = await env.DB.prepare(
    "SELECT l.*," +
    "(SELECT COUNT(*) FROM share_link_classes x WHERE x.share_link_id=l.id) class_count," +
    "(SELECT COUNT(*) FROM share_link_photos x WHERE x.share_link_id=l.id) photo_count " +
    "FROM share_links l WHERE l.owner_user_id=?1 ORDER BY l.created_at DESC"
  ).bind(user.id).all();
  if (!includeContent) return jsonResponse({ links: (rows.results || []).map(shareDto) });
  const [ownedRows, saved] = await Promise.all([
    env.DB.prepare(
      "SELECT c.id,c.name,c.description,c.is_open,c.visibility,c.owner_user_id,c.created_at,c.updated_at," +
      "COUNT(CASE WHEN p.id IS NOT NULL AND p.deleted_at IS NULL AND p.class_removed_at IS NULL THEN 1 END) photo_count," +
      "COALESCE(SUM(CASE WHEN p.deleted_at IS NULL AND p.class_removed_at IS NULL THEN COALESCE(p.byte_size,p.size_bytes,0) ELSE 0 END),0) byte_size " +
      "FROM photo_classes c LEFT JOIN photos p ON p.class_id=c.id " +
      "WHERE c.owner_user_id=?1 AND c.deleted_at IS NULL GROUP BY c.id ORDER BY c.created_at DESC"
    ).bind(user.id).all(),
    querySavedContent(user, env),
  ]);
  const classMap = new Map();
  for (const item of [...(ownedRows.results || []), ...(saved.classRows.results || [])]) {
    classMap.set(item.id, classDto(item));
  }
  return jsonResponse({
    links: (rows.results || []).map(shareDto),
    classes: [...classMap.values()],
    photos: (saved.photoRows.results || []).map(photoDto),
  });
}

async function handleCreateShareLink(request, env) {
  const user = await requireBoundUser(request, env);
  const body = await safeJson(request);
  const id = newId("link_");
  const slug = parseSlug(body.slug || randomToken(8));
  const window = parseShareWindow(body);
  const passwordText = String(body.password || "");
  if (body.passwordEnabled && passwordText.length < 6) throw new HttpError("Share passwords must be at least 6 characters", 400);
  if (passwordText && passwordText.length < 6) throw new HttpError("Share passwords must be at least 6 characters", 400);
  const password = body.passwordEnabled === false || !passwordText
    ? { salt: null, hash: null, ciphertext: null }
    : await createSharePassword(passwordText, env);
  const status = parseShareStatus(body.status);
  await validateShareItems(user, body.classIds || [], body.photoIds || [], env);
  const classIds = uniqueIds(body.classIds || [], 500);
  const photoIds = uniqueIds(body.photoIds || [], 1000);
  try {
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO share_links " +
        "(id,owner_user_id,slug,starts_at,ends_at,password_salt,password_hash,password_ciphertext,status,updated_at) " +
        "VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,CURRENT_TIMESTAMP)"
      ).bind(
        id,
        user.id,
        slug,
        window.startsAt,
        window.endsAt,
        password.salt,
        password.hash,
        password.ciphertext,
        status
      ),
      env.DB.prepare(
        "INSERT INTO share_link_classes (share_link_id,class_id) SELECT ?1,value FROM json_each(?2)"
      ).bind(id, JSON.stringify(classIds)),
      env.DB.prepare(
        "INSERT INTO share_link_photos (share_link_id,photo_id) SELECT ?1,value FROM json_each(?2)"
      ).bind(id, JSON.stringify(photoIds)),
    ]);
  } catch (error) {
    if (String(error).toLowerCase().includes("unique")) throw new HttpError("This share suffix is already in use", 409);
    throw error;
  }
  return jsonResponse({ link: shareDto({
    id,
    owner_user_id: user.id,
    slug,
    starts_at: window.startsAt,
    ends_at: window.endsAt,
    password_hash: password.hash,
    status,
    class_count: classIds.length,
    photo_count: photoIds.length,
  }) }, 201);
}

async function handleGetShareLink(request, env, linkId) {
  const user = await requireBoundUser(request, env);
  const link = await getOwnedShareLink(linkId, user, env);
  const [classes, photos] = await env.DB.batch([
    env.DB.prepare("SELECT class_id FROM share_link_classes WHERE share_link_id=?1 ORDER BY class_id").bind(linkId),
    env.DB.prepare("SELECT photo_id FROM share_link_photos WHERE share_link_id=?1 ORDER BY photo_id").bind(linkId),
  ]);
  let password = "";
  if (link.password_ciphertext && env.SHARE_PASSWORD_KEY) {
    try {
      password = await decryptPassword(link.password_ciphertext, env.SHARE_PASSWORD_KEY);
    } catch {
      password = "";
    }
  }
  return jsonResponse({
    link: {
      ...shareDto(link),
      password,
      classIds: (classes.results || []).map((row) => row.class_id),
      photoIds: (photos.results || []).map((row) => row.photo_id),
    },
  });
}

async function handleUpdateShareLink(request, env, linkId) {
  const user = await requireBoundUser(request, env);
  const current = await getOwnedShareLink(linkId, user, env);
  const body = await safeJson(request);
  const slug = body.slug === undefined ? current.slug : parseSlug(body.slug);
  const window = parseShareWindow({
    startsAt: body.startsAt === undefined ? current.starts_at : body.startsAt,
    endsAt: body.endsAt === undefined ? current.ends_at : body.endsAt,
  });
  const status = body.status === undefined ? current.status : parseShareStatus(body.status);
  let password = {
    salt: current.password_salt,
    hash: current.password_hash,
    ciphertext: current.password_ciphertext,
  };
  const passwordText = body.password === undefined || body.password === null ? "" : String(body.password);
  if (body.passwordEnabled === false || body.password === null) {
    password = { salt: null, hash: null, ciphertext: null };
  } else if (passwordText) {
    if (passwordText.length < 6) throw new HttpError("Share passwords must be at least 6 characters", 400);
    password = await createSharePassword(passwordText, env);
  } else if (body.passwordEnabled === true && !current.password_hash) {
    throw new HttpError("A password of at least 6 characters is required", 400);
  }
  const classIds = body.classIds;
  const photoIds = body.photoIds;
  let selection = null;
  if (classIds !== undefined || photoIds !== undefined) {
    const selected = await currentShareItems(linkId, env);
    const nextClasses = classIds === undefined ? selected.classIds : classIds;
    const nextPhotos = photoIds === undefined ? selected.photoIds : photoIds;
    await validateShareItems(user, nextClasses, nextPhotos, env);
    selection = {
      classIds: uniqueIds(nextClasses, 500),
      photoIds: uniqueIds(nextPhotos, 1000),
    };
  }
  try {
    const statements = [env.DB.prepare(
      "UPDATE share_links SET slug=?2,starts_at=?3,ends_at=?4,password_salt=?5,password_hash=?6,password_ciphertext=?7,status=?8," +
      "updated_at=CURRENT_TIMESTAMP WHERE id=?1"
    ).bind(
      linkId,
      slug,
      window.startsAt,
      window.endsAt,
      password.salt,
      password.hash,
      password.ciphertext,
      status
    )];
    if (selection) statements.push(
      env.DB.prepare("DELETE FROM share_link_classes WHERE share_link_id=?1").bind(linkId),
      env.DB.prepare("DELETE FROM share_link_photos WHERE share_link_id=?1").bind(linkId),
      env.DB.prepare(
        "INSERT INTO share_link_classes (share_link_id,class_id) SELECT ?1,value FROM json_each(?2)"
      ).bind(linkId, JSON.stringify(selection.classIds)),
      env.DB.prepare(
        "INSERT INTO share_link_photos (share_link_id,photo_id) SELECT ?1,value FROM json_each(?2)"
      ).bind(linkId, JSON.stringify(selection.photoIds))
    );
    if (password.salt !== current.password_salt || password.hash !== current.password_hash) {
      statements.push(env.DB.prepare("DELETE FROM share_sessions WHERE share_link_id=?1").bind(linkId));
    }
    await env.DB.batch(statements);
  } catch (error) {
    if (String(error).toLowerCase().includes("unique")) throw new HttpError("This share suffix is already in use", 409);
    throw error;
  }
  return handleGetShareLink(request, env, linkId);
}

async function handleDeleteShareLink(request, env, linkId) {
  const user = await requireBoundUser(request, env);
  const link = await getOwnedShareLink(linkId, user, env);
  await env.DB.prepare("DELETE FROM share_links WHERE id=?1").bind(linkId).run();
  return jsonResponse({ deleted: true, id: linkId, slug: link.slug });
}

async function handlePublicShare(request, env, slug) {
  const link = await getActiveShare(slug, env);
  const locked = Boolean(link.password_hash) && !(await hasShareSession(request, link.id, env));
  if (locked) {
    return jsonResponse({
      error: "Share password required",
      requiresPassword: true,
      passwordRequired: true,
      share: publicShareDto(link),
      locked: true,
      photos: [],
    }, 401);
  }
  const photos = await getSharePhotos(link.id, env);
  return jsonResponse({
    share: publicShareDto(link),
    locked: false,
    photos: photos.map((photo) => ({
      ...photoDto(photo),
      url: publicSharePhotoUrl(link.slug, photo.id),
      thumbnailUrl: publicSharePhotoUrl(link.slug, photo.id),
    })),
  });
}

async function handleUnlockShare(request, env, slug) {
  const link = await getActiveShare(slug, env);
  if (!link.password_hash) return jsonResponse({ unlocked: true });
  const rateKey = await shareUnlockRateKey(request, link.slug);
  await consumeRateLimit(env, rateKey, 5, 600, "Too many password attempts; try again later");
  const body = await safeJson(request);
  if (!(await verifyPassword(
    String(body.password || ""),
    link.password_salt,
    link.password_hash,
    env.SHARE_PASSWORD_KEY || ""
  ))) {
    throw new HttpError("Incorrect share password", 401);
  }
  await clearRateLimit(env, rateKey);
  const token = randomToken(32);
  const tokenHash = await sha256(token);
  const twelveHours = Date.now() + 12 * 60 * 60 * 1000;
  const shareEnd = link.ends_at ? new Date(link.ends_at).valueOf() : Number.POSITIVE_INFINITY;
  const expiresAt = new Date(Math.min(twelveHours, shareEnd)).toISOString();
  await env.DB.prepare(
    "INSERT INTO share_sessions (token_hash,share_link_id,expires_at) VALUES (?1,?2,?3)"
  ).bind(tokenHash, link.id, expiresAt).run();
  return jsonResponse({ unlocked: true }, 200, {
    "set-cookie": `${shareCookieName(link.id)}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=43200`,
  });
}

async function createSharePassword(password, env) {
  if (!env.SHARE_PASSWORD_KEY) throw new HttpError("Share passwords are temporarily unavailable", 503);
  const [hashed, ciphertext] = await Promise.all([
    hashPassword(password, undefined, env.SHARE_PASSWORD_KEY),
    encryptPassword(password, env.SHARE_PASSWORD_KEY),
  ]);
  return { ...hashed, ciphertext };
}

async function shareUnlockRateKey(request, slug) {
  return requestRateKey(request, `share-unlock:${slug}`);
}

async function requestRateKey(request, scope) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = request.headers.get("cf-connecting-ip") || forwarded || "unknown";
  return `rate:${await sha256(`${scope}:${ip}`)}`;
}

async function consumeRateLimit(env, key, limit, ttlSeconds, message) {
  const modifier = `+${clampInteger(ttlSeconds, 1, 86400, 600)} seconds`;
  const row = await env.DB.prepare(
    "INSERT INTO rate_limit_buckets (bucket_key,request_count,expires_at,updated_at) " +
    "VALUES (?1,1,datetime('now',?2),CURRENT_TIMESTAMP) " +
    "ON CONFLICT(bucket_key) DO UPDATE SET " +
    "request_count=CASE WHEN datetime(expires_at)<=datetime('now') THEN 1 ELSE request_count+1 END," +
    "expires_at=CASE WHEN datetime(expires_at)<=datetime('now') THEN datetime('now',?2) ELSE expires_at END," +
    "updated_at=CURRENT_TIMESTAMP RETURNING request_count"
  ).bind(key, modifier).first();
  if (Number(row?.request_count || 0) > limit) throw new HttpError(message, 429);
}

async function clearRateLimit(env, key) {
  await env.DB.prepare("DELETE FROM rate_limit_buckets WHERE bucket_key=?1").bind(key).run();
}

async function handlePublicSharePhoto(request, env, slug, photoId) {
  const link = await getActiveShare(slug, env);
  if (link.password_hash && !(await hasShareSession(request, link.id, env))) {
    throw new HttpError("Share password required", 401);
  }
  const photo = await env.DB.prepare(
    "SELECT p.*,c.name class_name,c.visibility,c.is_open,c.deleted_at class_deleted_at " +
    "FROM photos p JOIN photo_classes c ON c.id=p.class_id JOIN share_links l ON l.id=?2 " +
    "WHERE p.id=?1 AND p.deleted_at IS NULL AND (" +
    "(EXISTS(SELECT 1 FROM share_link_photos x WHERE x.share_link_id=?2 AND x.photo_id=p.id) " +
    "AND (p.owner_user_id=l.owner_user_id " +
    "OR EXISTS(SELECT 1 FROM saved_photos sp WHERE sp.user_id=l.owner_user_id AND sp.photo_id=p.id) " +
    "OR EXISTS(SELECT 1 FROM saved_classes sc WHERE sc.user_id=l.owner_user_id AND sc.class_id=p.class_id))) OR " +
    "(p.class_removed_at IS NULL AND c.deleted_at IS NULL " +
    "AND (c.owner_user_id=l.owner_user_id OR EXISTS(SELECT 1 FROM saved_classes sc WHERE sc.user_id=l.owner_user_id AND sc.class_id=c.id)) " +
    "AND EXISTS(SELECT 1 FROM share_link_classes x " +
    "WHERE x.share_link_id=?2 AND x.class_id=p.class_id))) LIMIT 1"
  ).bind(photoId, link.id).first();
  if (!photo) throw new HttpError("Photo not found", 404);
  return streamR2Object(request, env, photo.r2_key, {
    contentType: photo.content_type,
    filename: photo.original_name,
    publicCache: false,
  });
}

async function validateShareItems(user, classIdsInput, photoIdsInput, env) {
  const classIds = uniqueIds(classIdsInput, 500);
  const photoIds = uniqueIds(photoIdsInput, 1000);
  const [classes, photos] = await env.DB.batch([
    env.DB.prepare(
      "SELECT COUNT(*) count FROM photo_classes c WHERE c.deleted_at IS NULL " +
      "AND (c.owner_user_id=?1 OR EXISTS(SELECT 1 FROM saved_classes sc WHERE sc.user_id=?1 AND sc.class_id=c.id)) " +
      "AND c.id IN (SELECT value FROM json_each(?2))"
    ).bind(user.id, JSON.stringify(classIds)),
    env.DB.prepare(
      "SELECT COUNT(*) count FROM photos p WHERE p.deleted_at IS NULL " +
      "AND (p.owner_user_id=?1 OR EXISTS(SELECT 1 FROM saved_photos sp WHERE sp.user_id=?1 AND sp.photo_id=p.id) " +
      "OR EXISTS(SELECT 1 FROM saved_classes sc WHERE sc.user_id=?1 AND sc.class_id=p.class_id)) " +
      "AND p.id IN (SELECT value FROM json_each(?2))"
    ).bind(user.id, JSON.stringify(photoIds)),
  ]);
  if (Number(classes.results?.[0]?.count || 0) !== classIds.length) {
    throw new HttpError("One or more classes are not owned or available", 400);
  }
  if (Number(photos.results?.[0]?.count || 0) !== photoIds.length) {
    throw new HttpError("One or more photos are not owned or available", 400);
  }
}

async function currentShareItems(linkId, env) {
  const [classes, photos] = await env.DB.batch([
    env.DB.prepare("SELECT class_id FROM share_link_classes WHERE share_link_id=?1").bind(linkId),
    env.DB.prepare("SELECT photo_id FROM share_link_photos WHERE share_link_id=?1").bind(linkId),
  ]);
  return {
    classIds: (classes.results || []).map((row) => row.class_id),
    photoIds: (photos.results || []).map((row) => row.photo_id),
  };
}

async function getOwnedShareLink(linkId, user, env) {
  const link = await env.DB.prepare(
    "SELECT l.*," +
    "(SELECT COUNT(*) FROM share_link_classes x WHERE x.share_link_id=l.id) class_count," +
    "(SELECT COUNT(*) FROM share_link_photos x WHERE x.share_link_id=l.id) photo_count " +
    "FROM share_links l WHERE l.id=?1 LIMIT 1"
  ).bind(linkId).first();
  if (!link || (!isAdmin(user) && link.owner_user_id !== user.id)) throw new HttpError("Share link not found", 404);
  return link;
}

async function getActiveShare(slug, env) {
  const link = await env.DB.prepare(
    "SELECT * FROM share_links WHERE slug=?1 COLLATE NOCASE AND status='active' " +
    "AND (starts_at IS NULL OR datetime(starts_at)<=datetime('now')) " +
    "AND (ends_at IS NULL OR datetime(ends_at)>datetime('now')) LIMIT 1"
  ).bind(parseSlug(slug)).first();
  if (!link) throw new HttpError("Share link not found or expired", 404);
  return link;
}

async function hasShareSession(request, linkId, env) {
  const token = getCookie(request, shareCookieName(linkId));
  if (!token) return false;
  const tokenHash = await sha256(token);
  return Boolean(await env.DB.prepare(
    "SELECT token_hash FROM share_sessions WHERE token_hash=?1 AND share_link_id=?2 " +
    "AND datetime(expires_at)>datetime('now') LIMIT 1"
  ).bind(tokenHash, linkId).first());
}

function shareCookieName(linkId) {
  return `pd_share_${String(linkId || "").replace(/[^A-Za-z0-9_-]/g, "_")}`;
}

async function getSharePhotos(linkId, env) {
  const rows = await env.DB.prepare(
    "SELECT DISTINCT p.id,p.class_id,p.owner_user_id,p.original_name,p.content_type,p.metadata_json," +
    "COALESCE(p.byte_size,p.size_bytes,0) byte_size,p.status,p.created_at,c.name class_name " +
    "FROM photos p JOIN photo_classes c ON c.id=p.class_id JOIN share_links l ON l.id=?1 " +
    "WHERE p.deleted_at IS NULL AND (" +
    "(EXISTS(SELECT 1 FROM share_link_photos x WHERE x.share_link_id=?1 AND x.photo_id=p.id) " +
    "AND (p.owner_user_id=l.owner_user_id " +
    "OR EXISTS(SELECT 1 FROM saved_photos sp WHERE sp.user_id=l.owner_user_id AND sp.photo_id=p.id) " +
    "OR EXISTS(SELECT 1 FROM saved_classes sc WHERE sc.user_id=l.owner_user_id AND sc.class_id=p.class_id))) OR " +
    "(p.class_removed_at IS NULL AND c.deleted_at IS NULL " +
    "AND (c.owner_user_id=l.owner_user_id OR EXISTS(SELECT 1 FROM saved_classes sc WHERE sc.user_id=l.owner_user_id AND sc.class_id=c.id)) " +
    "AND EXISTS(SELECT 1 FROM share_link_classes x " +
    "WHERE x.share_link_id=?1 AND x.class_id=p.class_id))) " +
    "ORDER BY p.created_at DESC LIMIT 2000"
  ).bind(linkId).all();
  return rows.results || [];
}

async function handleAdminOverview(request, env) {
  await requireAdmin(request, env);
  const [classes, photos, users, shares, jobs] = await env.DB.batch([
    env.DB.prepare(
      "SELECT COUNT(*) count,SUM(CASE WHEN deleted_at IS NULL THEN 1 ELSE 0 END) active_count " +
      "FROM photo_classes"
    ),
    env.DB.prepare(
      "SELECT COUNT(*) count,COALESCE(SUM(COALESCE(byte_size,size_bytes,0)),0) bytes FROM photos WHERE deleted_at IS NULL"
    ),
    env.DB.prepare("SELECT COUNT(*) count,COALESCE(SUM(storage_used_bytes),0) bytes FROM app_users"),
    env.DB.prepare("SELECT COUNT(*) count FROM share_links WHERE status='active'"),
    env.DB.prepare("SELECT COUNT(*) count FROM deletion_jobs WHERE status IN ('pending','processing')"),
  ]);
  return jsonResponse({
    classCount: Number(classes.results?.[0]?.count || 0),
    activeClassCount: Number(classes.results?.[0]?.active_count || 0),
    photoCount: Number(photos.results?.[0]?.count || 0),
    storageBytes: Number(photos.results?.[0]?.bytes || 0),
    userCount: Number(users.results?.[0]?.count || 0),
    accountedStorageBytes: Number(users.results?.[0]?.bytes || 0),
    activeShareCount: Number(shares.results?.[0]?.count || 0),
    pendingJobCount: Number(jobs.results?.[0]?.count || 0),
  });
}

async function handleAdminAudit(request, env) {
  await requireAdmin(request, env);
  const rows = await env.DB.prepare(
    "SELECT a.id,a.user_id,a.auth_uuid,a.action,a.ip_address,a.country_code,a.sensitive," +
    "a.target_kind,a.target_id,a.target_name,a.target_count,a.created_at," +
    "COALESCE(NULLIF(u.username,''),NULLIF(u.name,''),'Unknown user') user_name " +
    "FROM audit_logs a LEFT JOIN app_users u ON u.id=a.user_id " +
    "ORDER BY datetime(a.created_at) DESC LIMIT 1000"
  ).all();
  return jsonResponse({
    logs: (rows.results || []).map((row) => ({
      id: row.id,
      userId: row.user_id || "",
      authUuid: row.auth_uuid || "",
      userName: row.user_name,
      action: row.action,
      ipAddress: row.ip_address || "",
      countryCode: row.country_code || "",
      sensitive: Boolean(row.sensitive),
      targetKind: row.target_kind || "",
      targetId: row.target_id || "",
      targetName: row.target_name || "",
      targetCount: Number(row.target_count || 0),
      createdAt: row.created_at,
    })),
  });
}

async function handleAdminClasses(request, env) {
  await requireAdmin(request, env);
  const rows = await env.DB.prepare(
    "SELECT c.id,c.name,c.description,c.is_open,c.visibility,c.owner_user_id,c.deleted_at,c.delete_job_id,c.created_at," +
    "COALESCE(NULLIF(u.username,''),u.name) owner_name,COUNT(p.id) photo_count,COALESCE(SUM(COALESCE(p.byte_size,p.size_bytes,0)),0) byte_size " +
    "FROM photo_classes c LEFT JOIN photos p ON p.class_id=c.id AND p.deleted_at IS NULL " +
    "LEFT JOIN app_users u ON u.id=c.owner_user_id " +
    "GROUP BY c.id ORDER BY c.created_at DESC LIMIT 1000"
  ).all();
  return jsonResponse({ classes: (rows.results || []).map(classDto) });
}

async function handleAdminUsers(request, env) {
  await requireAdmin(request, env);
  const rows = await env.DB.prepare(
    "SELECT u.id,u.kind,u.role,u.role_id,u.auth_uuid,u.name,u.username,u.email,u.avatar_url,u.storage_used_bytes," +
    "u.created_at,u.last_seen_at,r.name role_name,r.description role_description,r.access_mode,r.quota_bytes " +
    "FROM app_users u LEFT JOIN roles r ON r.id=u.role_id ORDER BY u.created_at DESC LIMIT 2000"
  ).all();
  return jsonResponse({ users: (rows.results || []).map((user) => ({ ...publicUser(user), createdAt: user.created_at, lastSeenAt: user.last_seen_at })) });
}

async function handleAdminRoles(request, env) {
  await requireAdmin(request, env);
  const rows = await env.DB.prepare(
    "SELECT r.*,(SELECT COUNT(*) FROM app_users u WHERE u.role_id=r.id) user_count FROM roles r ORDER BY r.sort_order,r.name"
  ).all();
  return jsonResponse({ roles: (rows.results || []).map(roleDto) });
}

async function handleUpdateUser(request, env, userId) {
  await requireAdmin(request, env);
  const body = await safeJson(request);
  const roleId = requiredText(body.roleId, "roleId", 80);
  const role = await env.DB.prepare("SELECT id FROM roles WHERE id=?1 LIMIT 1").bind(roleId).first();
  if (!role) throw new HttpError("Role not found", 404);
  const result = await env.DB.prepare("UPDATE app_users SET role_id=?2,updated_at=CURRENT_TIMESTAMP WHERE id=?1")
    .bind(userId, roleId).run();
  if (!result.meta?.changes) throw new HttpError("User not found", 404);
  return jsonResponse({ updated: true, userId, roleId });
}

async function handleCreateRole(request, env) {
  await requireAdmin(request, env);
  const body = await safeJson(request);
  const role = parseRoleInput(body);
  const id = newId("role_");
  const statements = [];
  if (role.isDefault) statements.push(env.DB.prepare("UPDATE roles SET is_default=0 WHERE is_default=1"));
  statements.push(env.DB.prepare(
    "INSERT INTO roles (id,name,description,access_mode,quota_bytes,is_default,is_system,sort_order,updated_at) " +
    "VALUES (?1,?2,?3,?4,?5,?6,0,?7,CURRENT_TIMESTAMP)"
  ).bind(id, role.name, role.description, role.accessMode, role.quotaBytes, role.isDefault ? 1 : 0, role.sortOrder));
  try {
    await writeRoleWithLegacyCheck(env, role.accessMode, () => env.DB.batch(statements));
  } catch (error) {
    if (String(error).toLowerCase().includes("unique")) throw new HttpError("Role name already exists", 409);
    throw error;
  }
  return jsonResponse({ role: roleDto({ id, ...roleToRow(role), is_system: 0, user_count: 0 }) }, 201);
}

async function handleUpdateRole(request, env, roleId) {
  await requireAdmin(request, env);
  const current = await env.DB.prepare("SELECT * FROM roles WHERE id=?1 LIMIT 1").bind(roleId).first();
  if (!current) throw new HttpError("Role not found", 404);
  const body = await safeJson(request);
  const role = parseRoleInput({
    name: body.name ?? current.name,
    description: body.description ?? current.description,
    accessMode: body.accessMode ?? current.access_mode,
    quotaBytes: body.quotaBytes ?? current.quota_bytes,
    quotaGb: body.quotaGb,
    isDefault: body.isDefault ?? Boolean(current.is_default),
    sortOrder: body.sortOrder ?? current.sort_order,
  });
  if (current.is_system && body.name !== undefined && body.name !== current.name) {
    throw new HttpError("System role names cannot be changed", 400);
  }
  const statements = [];
  if (role.isDefault && !current.is_default) statements.push(env.DB.prepare("UPDATE roles SET is_default=0 WHERE is_default=1"));
  if (!role.isDefault && current.is_default) throw new HttpError("Choose another default role before clearing this one", 400);
  statements.push(env.DB.prepare(
    "UPDATE roles SET name=?2,description=?3,access_mode=?4,quota_bytes=?5,is_default=?6,sort_order=?7," +
    "updated_at=CURRENT_TIMESTAMP WHERE id=?1"
  ).bind(roleId, role.name, role.description, role.accessMode, role.quotaBytes, role.isDefault ? 1 : 0, role.sortOrder));
  await writeRoleWithLegacyCheck(env, role.accessMode, () => env.DB.batch(statements));
  return jsonResponse({ role: roleDto({ ...current, ...roleToRow(role) }) });
}

async function handleDeleteRole(request, env, roleId) {
  await requireAdmin(request, env);
  const role = await env.DB.prepare(
    "SELECT r.*,(SELECT COUNT(*) FROM app_users u WHERE u.role_id=r.id) user_count FROM roles r WHERE r.id=?1 LIMIT 1"
  ).bind(roleId).first();
  if (!role) throw new HttpError("Role not found", 404);
  if (role.is_system || role.is_default || Number(role.user_count)) throw new HttpError("System, default, or assigned roles cannot be deleted", 409);
  await env.DB.prepare("DELETE FROM roles WHERE id=?1").bind(roleId).run();
  return jsonResponse({ deleted: true, id: roleId, name: role.name });
}

async function handleAdminForceDelete(request, env, kind, targetId) {
  const admin = await requireAdmin(request, env);
  if (new URL(request.url).searchParams.get("force") !== "1") throw new HttpError("force=1 is required", 400);
  const resource = kind === "classes"
    ? await getClass(targetId, env, true)
    : await getPhoto(targetId, env, true);
  if (!resource) throw new HttpError(kind === "classes" ? "Class not found" : "Photo not found", 404);
  const job = await scheduleDeletion(kind === "classes" ? "class" : "photo", resource, admin, true, env);
  if (kind === "classes") await invalidatePublicClassCache(env);
  return jsonResponse({
    deleted: true,
    forced: true,
    pending: true,
    jobId: job.id,
    target: {
      kind: kind === "classes" ? "class" : "photos",
      id: targetId,
      name: kind === "classes" ? resource.name : resource.class_name,
      count: 1,
    },
  }, 202);
}

function parseRoleInput(body) {
  const name = requiredText(body.name, "name", 80);
  const description = String(body.description || "").trim().slice(0, 240);
  const accessMode = String(body.accessMode || "");
  if (!ACCESS_MODES.has(accessMode)) throw new HttpError("Invalid access mode", 400);
  let quotaBytes = body.quotaGb !== undefined
    ? Math.round(Number(body.quotaGb) * 1_000_000_000)
    : Number(body.quotaBytes ?? 0);
  if (!Number.isSafeInteger(quotaBytes) || quotaBytes < 0) throw new HttpError("Quota must be a non-negative GB or byte value", 400);
  const sortOrder = Number(body.sortOrder || 0);
  if (!Number.isSafeInteger(sortOrder)) throw new HttpError("sortOrder must be an integer", 400);
  return { name, description, accessMode, quotaBytes, isDefault: Boolean(body.isDefault), sortOrder };
}

function roleToRow(role) {
  return {
    name: role.name,
    description: role.description,
    access_mode: role.accessMode,
    quota_bytes: role.quotaBytes,
    is_default: role.isDefault ? 1 : 0,
    sort_order: role.sortOrder,
  };
}

async function writeRoleWithLegacyCheck(env, accessMode, write) {
  if (accessMode !== "own_read") return write();
  await env.DB.exec("PRAGMA ignore_check_constraints=ON");
  try {
    return await write();
  } finally {
    await env.DB.exec("PRAGMA ignore_check_constraints=OFF");
  }
}

async function scheduleDeletion(kind, resource, requester, force, env) {
  const existing = await env.DB.prepare(
    "SELECT * FROM deletion_jobs WHERE kind=?1 AND target_id=?2 AND status IN ('pending','processing') LIMIT 1"
  ).bind(kind, resource.id).first();
  if (existing) {
    if (force && !existing.force) {
      const upgraded = await env.DB.prepare(
        "UPDATE deletion_jobs SET force=1,requested_by_user_id=?2," +
        "error_message=NULL,updated_at=CURRENT_TIMESTAMP " +
        "WHERE id=?1 AND status='pending' AND force=0"
      ).bind(existing.id, requester.id).run();
      if (!upgraded.meta?.changes) {
        throw new HttpError("Deletion is already processing; refresh and force-delete the remaining item", 409);
      }
      existing.force = 1;
    }
    await env.INGEST_QUEUE.send({ type: "storage.delete", jobId: existing.id });
    return existing;
  }
  const id = newId("job_");
  const update = kind === "class"
    ? env.DB.prepare(
      "UPDATE photo_classes SET deleted_at=CURRENT_TIMESTAMP,delete_job_id=?2,updated_at=CURRENT_TIMESTAMP WHERE id=?1"
    ).bind(resource.id, id)
    : env.DB.prepare(
      "UPDATE photos SET deleted_at=CURRENT_TIMESTAMP,delete_job_id=?2,updated_at=CURRENT_TIMESTAMP " +
      "WHERE id=?1 AND (delete_job_id IS NULL OR NOT EXISTS(" +
      "SELECT 1 FROM deletion_jobs j WHERE j.id=photos.delete_job_id " +
      "AND j.status IN ('pending','processing')))"
    ).bind(resource.id, id);
  const insert = kind === "photo"
    ? env.DB.prepare(
      "INSERT INTO deletion_jobs " +
      "(id,kind,target_id,force,status,requested_by_user_id,expected_owner_user_id,updated_at) " +
      "SELECT ?1,?2,?3,?4,'pending',?5,?6,CURRENT_TIMESTAMP WHERE EXISTS(" +
      "SELECT 1 FROM photos p WHERE p.id=?3 AND (p.delete_job_id IS NULL OR NOT EXISTS(" +
      "SELECT 1 FROM deletion_jobs j WHERE j.id=p.delete_job_id " +
      "AND j.status IN ('pending','processing'))))"
    ).bind(id, kind, resource.id, force ? 1 : 0, requester.id, resource.owner_user_id || null)
    : env.DB.prepare(
      "INSERT INTO deletion_jobs " +
      "(id,kind,target_id,force,status,requested_by_user_id,expected_owner_user_id,updated_at) " +
      "VALUES (?1,?2,?3,?4,'pending',?5,?6,CURRENT_TIMESTAMP)"
    ).bind(id, kind, resource.id, force ? 1 : 0, requester.id, resource.owner_user_id || null);
  try {
    const results = await env.DB.batch([insert, update]);
    if (kind === "photo" && !results[0]?.meta?.changes) {
      throw new HttpError("This photo is already being changed by another job", 409);
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (!String(error).toLowerCase().includes("unique")) throw error;
    const winner = await env.DB.prepare(
      "SELECT * FROM deletion_jobs WHERE kind=?1 AND target_id=?2 " +
      "AND status IN ('pending','processing') LIMIT 1"
    ).bind(kind, resource.id).first();
    if (!winner) throw error;
    if (force && !winner.force) {
      throw new HttpError("Another deletion request won the race; refresh before force-deleting", 409);
    }
    return winner;
  }
  try {
    await env.INGEST_QUEUE.send({ type: "storage.delete", jobId: id });
  } catch (error) {
    await env.DB.prepare("UPDATE deletion_jobs SET error_message=?2,updated_at=CURRENT_TIMESTAMP WHERE id=?1")
      .bind(id, `Queue send failed: ${error instanceof Error ? error.message : String(error)}`).run();
  }
  return { id, kind, target_id: resource.id, status: "pending" };
}

async function handleStartRekey(request, env) {
  const admin = await requireAdmin(request, env);
  const limit = clampInteger(new URL(request.url).searchParams.get("limit"), 1, 500, 100);
  const rows = await env.DB.prepare(
    "SELECT id,owner_user_id FROM photos WHERE deleted_at IS NULL AND r2_key NOT LIKE class_id||'/%' " +
    "ORDER BY created_at LIMIT ?1"
  ).bind(limit).all();
  const jobs = (rows.results || []).map((photo) => ({
    id: newId("job_"),
    targetId: photo.id,
    ownerId: photo.owner_user_id,
  }));
  const results = jobs.length ? await env.DB.batch(jobs.map((job) => env.DB.prepare(
    "INSERT OR IGNORE INTO deletion_jobs " +
    "(id,kind,target_id,force,status,requested_by_user_id,expected_owner_user_id,updated_at) " +
    "VALUES (?1,'rekey_photo',?2,0,'pending',?3,?4,CURRENT_TIMESTAMP)"
  ).bind(job.id, job.targetId, admin.id, job.ownerId))) : [];
  const queued = jobs.filter((_, index) => Number(results[index]?.meta?.changes || 0) > 0);
  if (queued.length) {
    await env.INGEST_QUEUE.sendBatch(queued.map((job) => ({ body: { type: "storage.rekey", jobId: job.id } })));
  }
  return jsonResponse({ discovered: jobs.length, queued: queued.length, jobIds: queued.map((job) => job.id) }, 202);
}

async function handleRekeyStatus(request, env) {
  await requireAdmin(request, env);
  const rows = await env.DB.prepare(
    "SELECT status,COUNT(*) count FROM deletion_jobs WHERE kind='rekey_photo' GROUP BY status"
  ).all();
  const remaining = await env.DB.prepare(
    "SELECT COUNT(*) count FROM photos WHERE deleted_at IS NULL AND r2_key NOT LIKE class_id||'/%'"
  ).first();
  return jsonResponse({
    jobs: Object.fromEntries((rows.results || []).map((row) => [row.status, Number(row.count || 0)])),
    remaining: Number(remaining?.count || 0),
  });
}

async function handleQueueBatch(batch, env) {
  for (const message of batch.messages) {
    let payload;
    try {
      payload = typeof message.body === "string" ? JSON.parse(message.body) : message.body;
      if (payload?.type === "photo.ingest") await processIngest(payload.photoId, env);
      else if (payload?.type === "search.run") await processFaceSearch(payload.taskId, env);
      else if (payload?.type === "face.delete") await deleteFaceEntity(payload.entityId, env);
      else if (payload?.type === "storage.delete") await processDeletionJob(payload.jobId, env);
      else if (payload?.type === "storage.rekey") await processRekeyJob(payload.jobId, env);
      else if (payload?.type === "pointer.save") await processSavePointer(payload, env);
      else if (payload?.type === "audit.write") await processAuditWrite(payload, env);
      else throw new Error(`Unsupported queue message type: ${payload?.type}`);
      message.ack();
    } catch (error) {
      console.error("Queue message failed", error);
      const jobId = payload?.jobId;
      const attempts = Number(message.attempts || 1);
      if (jobId) {
        await env.DB.prepare(
          "UPDATE deletion_jobs SET status=?2,error_message=?3,updated_at=CURRENT_TIMESTAMP WHERE id=?1 AND status!='completed'"
        ).bind(jobId, attempts >= MAX_QUEUE_ATTEMPTS ? "failed" : "pending", error instanceof Error ? error.message : String(error)).run();
      }
      message.retry({ delaySeconds: Math.min(300, 2 ** attempts) });
    }
  }
}

async function processSavePointer(payload, env) {
  const table = payload.kind === "classes" ? "saved_classes" : "saved_photos";
  const targetTable = payload.kind === "classes" ? "photo_classes" : "photos";
  const column = payload.kind === "classes" ? "class_id" : "photo_id";
  if (!payload.userId || !payload.targetId || !["classes", "photos"].includes(payload.kind)) {
    throw new Error("Invalid pointer.save message");
  }
  await env.DB.prepare(
    `INSERT OR IGNORE INTO ${table} (user_id,${column}) ` +
    `SELECT ?1,?2 WHERE EXISTS(SELECT 1 FROM app_users WHERE id=?1 AND kind!='temp') ` +
    `AND EXISTS(SELECT 1 FROM ${targetTable} WHERE id=?2 AND deleted_at IS NULL)`
  ).bind(payload.userId, payload.targetId).run();
}

async function processAuditWrite(payload, env) {
  if (!payload.id || !payload.action) throw new Error("Invalid audit.write message");
  await env.DB.prepare(
    "INSERT OR IGNORE INTO audit_logs " +
    "(id,user_id,auth_uuid,action,ip_address,country_code,sensitive,target_kind,target_id,target_name,target_count,created_at) " +
    "VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)"
  ).bind(
    payload.id,
    payload.userId || null,
    String(payload.authUuid || ""),
    String(payload.action),
    String(payload.ipAddress || ""),
    String(payload.countryCode || "").slice(0, 2).toUpperCase(),
    payload.sensitive ? 1 : 0,
    String(payload.targetKind || ""),
    String(payload.targetId || ""),
    String(payload.targetName || "").slice(0, 240),
    Math.max(0, Math.trunc(Number(payload.targetCount || 0))),
    payload.createdAt || new Date().toISOString()
  ).run();
}

async function queueAuditRequest(request, response, env) {
  if (!env.INGEST_QUEUE) return;
  const action = auditAction(request);
  if (!action) return;
  const user = await getSessionUser(request, env);
  if (!user || user.kind === "temp") return;
  const ipAddress = request.headers.get("cf-connecting-ip")
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "";
  const countryCode = String(
    request.cf?.country || request.headers.get("cf-ipcountry") || ""
  ).slice(0, 2).toUpperCase();
  const target = await auditTarget(action.name, request, response, env);
  await env.INGEST_QUEUE.send({
    type: "audit.write",
    id: newId("audit_"),
    userId: user.id,
    authUuid: user.auth_uuid || "",
    action: action.name,
    ipAddress,
    countryCode,
    sensitive: action.sensitive,
    ...target,
    createdAt: new Date().toISOString(),
  });
}

async function auditTarget(action, request, response, env) {
  const path = new URL(request.url).pathname.replace(/\/+$/, "");
  let result = {};
  try {
    if ((response.headers.get("content-type") || "").includes("json")) result = await response.json();
  } catch {}
  if (result.target?.name) {
    return {
      targetKind: String(result.target.kind || ""),
      targetId: String(result.target.id || ""),
      targetName: String(result.target.name || ""),
      targetCount: Math.max(1, Number(result.target.count || 1)),
    };
  }
  const decoded = (match) => match ? decodePart(match[1]) : "";
  const classId = decoded(path.match(/^\/api\/classes\/([^/]+)/)) || result.class?.id || "";
  const photoId = decoded(path.match(/^\/api\/(?:admin\/)?photos\/([^/]+)/));
  const saved = path.match(/^\/api\/saved\/(classes|photos)\/([^/]+)$/);
  const adminTarget = path.match(/^\/api\/admin\/(classes|photos)\/([^/]+)$/);

  if (action.startsWith("class.")) {
    const row = classId ? await getClass(classId, env, true) : null;
    return { targetKind: "class", targetId: classId, targetName: result.class?.name || row?.name || "", targetCount: 1 };
  }
  if (action === "photo.upload") {
    const row = classId ? await getClass(classId, env, true) : null;
    return { targetKind: "photos", targetId: classId, targetName: row?.name || "", targetCount: Number(result.uploaded || 0) };
  }
  if (action === "photo.delete" || (action === "admin.force_delete" && adminTarget?.[1] === "photos")) {
    const id = photoId || (adminTarget ? decodePart(adminTarget[2]) : "");
    const row = id ? await getPhoto(id, env, true) : null;
    return { targetKind: "photos", targetId: id, targetName: row?.class_name || "", targetCount: 1 };
  }
  if (action === "admin.force_delete" && adminTarget?.[1] === "classes") {
    const id = decodePart(adminTarget[2]);
    const row = await getClass(id, env, true);
    return { targetKind: "class", targetId: id, targetName: row?.name || "", targetCount: 1 };
  }
  if (action.startsWith("saved.") && saved) {
    const id = decodePart(saved[2]);
    if (saved[1] === "classes") {
      const row = await getClass(id, env, true);
      return { targetKind: "class", targetId: id, targetName: row?.name || "", targetCount: 1 };
    }
    const row = await getPhoto(id, env, true);
    return { targetKind: "photos", targetId: id, targetName: row?.class_name || "", targetCount: 1 };
  }
  if (action.startsWith("share.")) {
    const id = decoded(path.match(/^\/api\/share-links\/([^/]+)$/)) || result.link?.id || result.id || "";
    const row = id ? await env.DB.prepare("SELECT slug FROM share_links WHERE id=?1 LIMIT 1").bind(id).first() : null;
    return { targetKind: "share", targetId: id, targetName: result.link?.slug || result.slug || row?.slug || "", targetCount: 1 };
  }
  if (action.startsWith("admin.role.")) {
    const id = decoded(path.match(/^\/api\/admin\/roles\/([^/]+)$/)) || result.role?.id || result.id || "";
    const row = id ? await env.DB.prepare("SELECT name FROM roles WHERE id=?1 LIMIT 1").bind(id).first() : null;
    return { targetKind: "role", targetId: id, targetName: result.role?.name || result.name || row?.name || "", targetCount: 1 };
  }
  if (action === "admin.user.update") {
    const id = decoded(path.match(/^\/api\/admin\/users\/([^/]+)$/));
    const row = id ? await env.DB.prepare("SELECT COALESCE(NULLIF(username,''),name) name FROM app_users WHERE id=?1 LIMIT 1").bind(id).first() : null;
    return { targetKind: "user", targetId: id, targetName: row?.name || "", targetCount: 1 };
  }
  return {};
}

function auditAction(request) {
  const method = request.method;
  const path = new URL(request.url).pathname.replace(/\/+$/, "");
  if (method === "POST" && path === "/api/classes") return { name: "class.create", sensitive: false };
  if (method === "PATCH" && /^\/api\/classes\/[^/]+$/.test(path)) return { name: "class.update", sensitive: false };
  if (method === "DELETE" && /^\/api\/classes\/[^/]+$/.test(path)) return { name: "class.delete", sensitive: true };
  if (method === "POST" && /^\/api\/classes\/[^/]+\/photos$/.test(path)) return { name: "photo.upload", sensitive: false };
  if (method === "DELETE" && /^\/api\/photos\/[^/]+$/.test(path)) return { name: "photo.delete", sensitive: true };
  if (method === "POST" && path === "/api/search") return { name: "selfie.search", sensitive: false };
  if (method === "POST" && /^\/api\/saved\/(classes|photos)\/[^/]+$/.test(path)) return { name: "saved.add", sensitive: false };
  if (method === "DELETE" && /^\/api\/saved\/(classes|photos)\/[^/]+$/.test(path)) return { name: "saved.remove", sensitive: false };
  if (method === "POST" && path === "/api/share-links") return { name: "share.create", sensitive: false };
  if (method === "PATCH" && /^\/api\/share-links\/[^/]+$/.test(path)) return { name: "share.update", sensitive: false };
  if (method === "DELETE" && /^\/api\/share-links\/[^/]+$/.test(path)) return { name: "share.delete", sensitive: true };
  if (method === "POST" && path === "/api/background") return { name: "background.upload", sensitive: false };
  if (method === "POST" && path === "/api/background/mode") return { name: "background.mode", sensitive: false };
  if (method === "DELETE" && path === "/api/background") return { name: "background.delete", sensitive: true };
  if (method === "POST" && path === "/api/background/restore") return { name: "background.restore", sensitive: false };
  if (method === "PATCH" && /^\/api\/admin\/users\/[^/]+$/.test(path)) return { name: "admin.user.update", sensitive: true };
  if (method === "POST" && path === "/api/admin/roles") return { name: "admin.role.create", sensitive: true };
  if (method === "PATCH" && /^\/api\/admin\/roles\/[^/]+$/.test(path)) return { name: "admin.role.update", sensitive: true };
  if (method === "DELETE" && /^\/api\/admin\/roles\/[^/]+$/.test(path)) return { name: "admin.role.delete", sensitive: true };
  if (method === "DELETE" && /^\/api\/admin\/(classes|photos)\/[^/]+$/.test(path)) return { name: "admin.force_delete", sensitive: true };
  return null;
}

async function processIngest(photoId, env) {
  const claim = await env.DB.prepare(
    "UPDATE photos SET status='indexing',error_message=NULL,updated_at=CURRENT_TIMESTAMP " +
    "WHERE id=?1 AND deleted_at IS NULL AND status IN ('uploaded','failed')"
  ).bind(photoId).run();
  if (!claim.meta?.changes) return;
  const photo = await env.DB.prepare(
    "SELECT id,r2_key,original_name,status,vector_id,deleted_at FROM photos WHERE id=?1 LIMIT 1"
  ).bind(photoId).first();
  if (!photo || photo.deleted_at) return;
  try {
    const entityId = await ingestFace(photo, env);
    const update = await env.DB.prepare(
      "UPDATE photos SET status='indexed',vector_id=?2,indexed_at=CURRENT_TIMESTAMP,error_message=NULL," +
      "updated_at=CURRENT_TIMESTAMP WHERE id=?1 AND deleted_at IS NULL AND status='indexing'"
    ).bind(photo.id, entityId).run();
    if (!update.meta?.changes) await deleteFaceEntity(entityId, env);
  } catch (error) {
    const failed = await env.DB.prepare(
      "UPDATE photos SET status='failed',error_message=?2,updated_at=CURRENT_TIMESTAMP " +
      "WHERE id=?1 AND deleted_at IS NULL AND status='indexing'"
    ).bind(photo.id, error instanceof Error ? error.message : String(error)).run();
    if (failed.meta?.changes) throw error;
  }
}

async function processFaceSearch(taskId, env) {
  const claim = await env.DB.prepare(
    "UPDATE search_tasks SET status='processing',error_message=NULL,updated_at=CURRENT_TIMESTAMP " +
    "WHERE id=?1 AND status IN ('pending','failed')"
  ).bind(taskId).run();
  if (!claim.meta?.changes) return;
  const task = await env.DB.prepare(
    "SELECT id,user_id,selfie_key,status FROM search_tasks WHERE id=?1 LIMIT 1"
  ).bind(taskId).first();
  if (!task) return;
  try {
    const matches = await searchFaces(task.selfie_key, env);
    const user = await getUserById(task.user_id, env);
    const rows = matches.length ? await env.DB.batch(matches.map((match) => env.DB.prepare(
      "SELECT p.*,c.name class_name,c.visibility,c.is_open,c.owner_user_id class_owner_user_id," +
      "c.deleted_at class_deleted_at FROM photos p JOIN photo_classes c ON c.id=p.class_id " +
      "WHERE p.vector_id=?1 AND p.deleted_at IS NULL LIMIT 1"
    ).bind(match.entityId))) : [];
    const ordered = [];
    for (let index = 0; index < rows.length; index += 1) {
      const result = rows[index];
      const photo = result.results?.[0];
      if (photo && user && await canReadPhoto(user, photo, env)) {
        const score = matches[index].score;
        const confidence = matches[index].confidence;
        const match = confidence >= 0 ? confidence : score >= 0 && score <= 1 ? score * 100 : Math.max(0, score);
        ordered.push({ ...photo, score, confidence, match });
      }
    }
    await env.DB.prepare(
      "UPDATE search_tasks SET status='completed',match_count=?2,matched_photo_ids=?3,matched_urls=?4,matched_scores=?5," +
      "completed_at=CURRENT_TIMESTAMP,error_message=NULL,updated_at=CURRENT_TIMESTAMP " +
      "WHERE id=?1 AND status='processing'"
    ).bind(
      task.id,
      ordered.length,
      JSON.stringify(ordered.map((photo) => photo.id)),
      JSON.stringify(ordered.map((photo) => photoFileUrl(photo.id))),
      JSON.stringify(ordered.map(({ score, confidence, match }) => ({ score, confidence, match })))
    ).run();
  } catch (error) {
    const failed = await env.DB.prepare(
      "UPDATE search_tasks SET status='failed',error_message=?2,updated_at=CURRENT_TIMESTAMP " +
      "WHERE id=?1 AND status='processing'"
    ).bind(task.id, error instanceof Error ? error.message : String(error)).run();
    if (failed.meta?.changes) throw error;
  }
}

async function processDeletionJob(jobId, env) {
  const claim = await env.DB.prepare(
    "UPDATE deletion_jobs SET status='processing',started_at=COALESCE(started_at,CURRENT_TIMESTAMP)," +
    "error_message=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?1 AND status IN ('pending','failed')"
  ).bind(jobId).run();
  if (!claim.meta?.changes) return;
  const job = await env.DB.prepare("SELECT * FROM deletion_jobs WHERE id=?1 LIMIT 1").bind(jobId).first();
  if (!job) return;
  if (job.kind === "photo") await processPhotoDeletion(job, env);
  else if (job.kind === "class") await processClassDeletion(job, env);
  else throw new Error(`Deletion job ${job.id} has invalid kind ${job.kind}`);
}

async function processPhotoDeletion(job, env) {
  const photo = await env.DB.prepare("SELECT * FROM photos WHERE id=?1 LIMIT 1").bind(job.target_id).first();
  if (!photo) return completeJob(job.id, env);
  if (photo.delete_job_id !== job.id) return completeJob(job.id, env);
  if (!job.force && photo.owner_user_id !== job.expected_owner_user_id) return completeJob(job.id, env);
  await transferPhotoOrDelete(photo, Boolean(job.force), env);
  await completeJob(job.id, env);
}

async function processClassDeletion(job, env) {
  const photoClass = await env.DB.prepare("SELECT * FROM photo_classes WHERE id=?1 LIMIT 1")
    .bind(job.target_id).first();
  if (!photoClass) return completeJob(job.id, env);
  if (!job.force && photoClass.owner_user_id !== job.expected_owner_user_id) {
    await env.DB.batch([
      env.DB.prepare(
        "DELETE FROM saved_classes WHERE user_id=?1 AND class_id=?2"
      ).bind(photoClass.owner_user_id, photoClass.id),
      env.DB.prepare(
        "DELETE FROM saved_photos WHERE user_id=?1 AND photo_id IN (" +
        "SELECT id FROM photos WHERE class_id=?2 AND owner_user_id=?1 AND class_removed_at IS NULL)"
      ).bind(photoClass.owner_user_id, photoClass.id),
      env.DB.prepare("DELETE FROM share_link_classes WHERE class_id=?1").bind(photoClass.id),
      env.DB.prepare(
        "UPDATE photo_classes SET delete_job_id=NULL,visibility='private',is_open=0,updated_at=CURRENT_TIMESTAMP " +
        "WHERE id=?1 AND owner_user_id=?2 AND delete_job_id=?3"
      ).bind(photoClass.id, photoClass.owner_user_id, job.id),
      completedJobStatement(job.id, env),
    ]);
    await invalidatePublicClassCache(env);
    return;
  }
  if (photoClass.delete_job_id !== job.id) return completeJob(job.id, env);

  if (!job.force && !job.cursor) {
    const bytesRow = await env.DB.prepare(
      "SELECT COALESCE(SUM(COALESCE(byte_size,size_bytes,0)),0) bytes FROM photos " +
      "WHERE class_id=?1 AND owner_user_id=?2 AND deleted_at IS NULL AND class_removed_at IS NULL"
    ).bind(photoClass.id, photoClass.owner_user_id).first();
    const bytes = Number(bytesRow?.bytes || 0);
    const nextOwner = await earliestClassPointer(photoClass.id, photoClass.owner_user_id, env);
    if (nextOwner) {
      const results = await env.DB.batch([
        env.DB.prepare(
          "UPDATE app_users SET storage_used_bytes=MAX(0,COALESCE(storage_used_bytes,0)-?2)," +
          "updated_at=CURRENT_TIMESTAMP WHERE id=?1 AND EXISTS(" +
          "SELECT 1 FROM photo_classes c JOIN saved_classes s ON s.class_id=c.id AND s.user_id=?4 " +
          "WHERE c.id=?3 AND c.owner_user_id=?1 AND c.delete_job_id=?5)"
        ).bind(photoClass.owner_user_id, bytes, photoClass.id, nextOwner.id, job.id),
        env.DB.prepare(
          "UPDATE app_users SET storage_used_bytes=COALESCE(storage_used_bytes,0)+?2," +
          "updated_at=CURRENT_TIMESTAMP WHERE id=?1 AND EXISTS(" +
          "SELECT 1 FROM photo_classes c JOIN saved_classes s ON s.class_id=c.id AND s.user_id=?1 " +
          "WHERE c.id=?3 AND c.owner_user_id=?4 AND c.delete_job_id=?5)"
        ).bind(nextOwner.id, bytes, photoClass.id, photoClass.owner_user_id, job.id),
        env.DB.prepare(
          "UPDATE photos SET owner_user_id=?2,updated_at=CURRENT_TIMESTAMP " +
          "WHERE class_id=?1 AND owner_user_id=?3 AND deleted_at IS NULL AND class_removed_at IS NULL " +
          "AND EXISTS(SELECT 1 FROM photo_classes c JOIN saved_classes s " +
          "ON s.class_id=c.id AND s.user_id=?2 WHERE c.id=?1 AND c.owner_user_id=?3 AND c.delete_job_id=?4)"
        ).bind(photoClass.id, nextOwner.id, photoClass.owner_user_id, job.id),
        env.DB.prepare(
          "UPDATE photo_classes SET owner_user_id=?2,visibility='private',is_open=0,deleted_at=NULL," +
          "delete_job_id=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?1 AND owner_user_id=?3 " +
          "AND delete_job_id=?4 AND EXISTS(" +
          "SELECT 1 FROM saved_classes s WHERE s.class_id=?1 AND s.user_id=?2)"
        ).bind(photoClass.id, nextOwner.id, photoClass.owner_user_id, job.id),
      ]);
      if (results[3]?.meta?.changes) {
        await env.DB.batch([
          env.DB.prepare("DELETE FROM saved_classes WHERE user_id=?1 AND class_id=?2")
            .bind(nextOwner.id, photoClass.id),
          env.DB.prepare(
            "DELETE FROM saved_photos WHERE user_id=?1 AND photo_id IN (" +
            "SELECT id FROM photos WHERE class_id=?2 AND owner_user_id=?1 AND class_removed_at IS NULL)"
          ).bind(nextOwner.id, photoClass.id),
          env.DB.prepare("DELETE FROM share_link_classes WHERE class_id=?1").bind(photoClass.id),
          completedJobStatement(job.id, env),
        ]);
        await invalidatePublicClassCache(env);
        return;
      }
    }
  }

  const photoQuery = job.force
    ? "SELECT * FROM photos WHERE class_id=?1 AND id>?2 ORDER BY id LIMIT 12"
    : "SELECT * FROM photos WHERE class_id=?1 AND (deleted_at IS NULL OR delete_job_id=?3) " +
      "AND class_removed_at IS NULL AND id>?2 ORDER BY id LIMIT 12";
  const photos = job.force
    ? await env.DB.prepare(photoQuery).bind(photoClass.id, job.cursor || "").all()
    : await env.DB.prepare(photoQuery).bind(photoClass.id, job.cursor || "", job.id).all();
  if (photos.results?.length) {
    let cursor = job.cursor || "";
    for (const photo of photos.results) {
      const claimed = await claimPhotoForClassJob(photo.id, job.id, env);
      if (!claimed) {
        await env.DB.prepare(
          "UPDATE deletion_jobs SET status='pending',cursor=?2,updated_at=CURRENT_TIMESTAMP WHERE id=?1"
        ).bind(job.id, cursor).run();
        try {
          await env.INGEST_QUEUE.send(
            { type: "storage.delete", jobId: job.id },
            { delaySeconds: 5 }
          );
        } catch {
          // The Cron recovery path will re-enqueue this pending job.
        }
        return;
      }
      const currentPhoto = await env.DB.prepare(
        "SELECT * FROM photos WHERE id=?1 LIMIT 1"
      ).bind(photo.id).first();
      if (currentPhoto) await transferPhotoOrDelete(currentPhoto, Boolean(job.force), env);
      cursor = photo.id;
    }
    await env.DB.prepare(
      "UPDATE deletion_jobs SET status='pending',cursor=?2,updated_at=CURRENT_TIMESTAMP WHERE id=?1"
    ).bind(job.id, cursor).run();
    await env.INGEST_QUEUE.send({ type: "storage.delete", jobId: job.id });
    return;
  }
  const remaining = await env.DB.prepare("SELECT COUNT(*) count FROM photos WHERE class_id=?1")
    .bind(photoClass.id).first();
  const cleanup = [
    env.DB.prepare("DELETE FROM share_link_classes WHERE class_id=?1").bind(photoClass.id),
    env.DB.prepare("DELETE FROM saved_classes WHERE class_id=?1").bind(photoClass.id),
  ];
  if (Number(remaining?.count || 0) > 0) {
    cleanup.push(env.DB.prepare(
      "UPDATE photo_classes SET delete_job_id=NULL,visibility='private',is_open=0,updated_at=CURRENT_TIMESTAMP WHERE id=?1"
    ).bind(photoClass.id));
  } else {
    cleanup.push(env.DB.prepare("DELETE FROM photo_classes WHERE id=?1").bind(photoClass.id));
  }
  cleanup.push(completedJobStatement(job.id, env));
  await env.DB.batch(cleanup);
  await invalidatePublicClassCache(env);
}

async function claimPhotoForClassJob(photoId, jobId, env) {
  const claim = await env.DB.prepare(
    "UPDATE photos SET deleted_at=COALESCE(deleted_at,CURRENT_TIMESTAMP),delete_job_id=?2," +
    "updated_at=CURRENT_TIMESTAMP WHERE id=?1 AND (" +
    "delete_job_id IS NULL OR delete_job_id=?2 OR NOT EXISTS(" +
    "SELECT 1 FROM deletion_jobs j WHERE j.id=photos.delete_job_id " +
    "AND j.status IN ('pending','processing')))"
  ).bind(photoId, jobId).run();
  return Number(claim.meta?.changes || 0) > 0;
}

async function transferPhotoOrDelete(photo, force, env) {
  if (!force) {
    await env.DB.prepare(
      "INSERT OR IGNORE INTO saved_photos (user_id,photo_id,created_at) " +
      "SELECT user_id,?2,created_at FROM saved_classes WHERE class_id=?1"
    ).bind(photo.class_id, photo.id).run();
  }
  const nextOwner = force ? null : await earliestPhotoPointer(photo.id, photo.owner_user_id, env);
  if (!nextOwner) {
    await physicallyDeletePhoto(photo, env);
    return false;
  }
  const bytes = Number(photo.byte_size ?? photo.size_bytes ?? 0);
  const lockId = String(photo.delete_job_id || "");
  const results = await env.DB.batch([
    env.DB.prepare(
      "UPDATE app_users SET storage_used_bytes=MAX(0,COALESCE(storage_used_bytes,0)-?2)," +
      "updated_at=CURRENT_TIMESTAMP WHERE id=?1 AND EXISTS(" +
      "SELECT 1 FROM photos p JOIN saved_photos s ON s.photo_id=p.id AND s.user_id=?4 " +
      "WHERE p.id=?3 AND p.owner_user_id=?1 AND p.delete_job_id=?5)"
    ).bind(photo.owner_user_id, bytes, photo.id, nextOwner.id, lockId),
    env.DB.prepare(
      "UPDATE app_users SET storage_used_bytes=COALESCE(storage_used_bytes,0)+?2," +
      "updated_at=CURRENT_TIMESTAMP WHERE id=?1 AND EXISTS(" +
      "SELECT 1 FROM photos p JOIN saved_photos s ON s.photo_id=p.id AND s.user_id=?1 " +
      "WHERE p.id=?3 AND p.owner_user_id=?4 AND p.delete_job_id=?5)"
    ).bind(nextOwner.id, bytes, photo.id, photo.owner_user_id, lockId),
    env.DB.prepare(
      "UPDATE photos SET owner_user_id=?2,deleted_at=NULL,delete_job_id=NULL,class_removed_at=CURRENT_TIMESTAMP," +
      "updated_at=CURRENT_TIMESTAMP WHERE id=?1 AND owner_user_id=?3 AND delete_job_id=?4 " +
      "AND EXISTS(SELECT 1 FROM saved_photos s WHERE s.photo_id=?1 AND s.user_id=?2)"
    ).bind(photo.id, nextOwner.id, photo.owner_user_id, lockId),
    env.DB.prepare(
      "DELETE FROM saved_photos WHERE user_id=?1 AND photo_id=?2 AND EXISTS(" +
      "SELECT 1 FROM photos p WHERE p.id=?2 AND p.owner_user_id=?1)"
    ).bind(nextOwner.id, photo.id),
    env.DB.prepare(
      "DELETE FROM share_link_photos WHERE photo_id=?1 AND EXISTS(" +
      "SELECT 1 FROM photos p WHERE p.id=?1 AND p.owner_user_id=?2 AND p.class_removed_at IS NOT NULL)"
    ).bind(photo.id, nextOwner.id),
  ]);
  if (!results[2]?.meta?.changes) {
    const current = await env.DB.prepare("SELECT * FROM photos WHERE id=?1 LIMIT 1").bind(photo.id).first();
    if (!current || current.owner_user_id !== photo.owner_user_id) return Boolean(current);
    return transferPhotoOrDelete(current, force, env);
  }
  return true;
}

async function earliestPhotoPointer(photoId, ownerId, env) {
  const rows = await env.DB.prepare(
    "SELECT s.user_id id,s.created_at FROM saved_photos s JOIN app_users u ON u.id=s.user_id " +
    "WHERE s.photo_id=?1 AND s.user_id!=?2 AND u.kind!='temp' ORDER BY s.created_at,s.user_id LIMIT 100"
  ).bind(photoId, ownerId).all();
  return rows.results?.[0] || null;
}

async function earliestClassPointer(classId, ownerId, env) {
  const rows = await env.DB.prepare(
    "SELECT s.user_id id,s.created_at FROM saved_classes s JOIN app_users u ON u.id=s.user_id " +
    "WHERE s.class_id=?1 AND s.user_id!=?2 AND u.kind!='temp' ORDER BY s.created_at,s.user_id LIMIT 100"
  ).bind(classId, ownerId).all();
  return rows.results?.[0] || null;
}

async function physicallyDeletePhoto(photo, env) {
  if (photo.r2_key) await env.PHOTO_BUCKET.delete(photo.r2_key);
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE app_users SET storage_used_bytes=MAX(0,COALESCE(storage_used_bytes,0)-" +
      "COALESCE((SELECT COALESCE(p.byte_size,p.size_bytes,0) FROM photos p WHERE p.id=?1),0))," +
      "updated_at=CURRENT_TIMESTAMP WHERE id=(SELECT owner_user_id FROM photos WHERE id=?1)"
    ).bind(photo.id),
    env.DB.prepare("DELETE FROM share_link_photos WHERE photo_id=?1").bind(photo.id),
    env.DB.prepare("DELETE FROM saved_photos WHERE photo_id=?1").bind(photo.id),
    env.DB.prepare("DELETE FROM photos WHERE id=?1").bind(photo.id),
  ]);
  if (photo.vector_id) {
    try {
      await env.INGEST_QUEUE.send({ type: "face.delete", entityId: photo.vector_id });
    } catch (error) {
      try {
        await deleteFaceEntity(photo.vector_id, env);
      } catch (cleanupError) {
        console.error("Face entity cleanup could not be queued", error, cleanupError);
      }
    }
  }
}

async function completeJob(jobId, env) {
  await completedJobStatement(jobId, env).run();
}

function completedJobStatement(jobId, env) {
  return env.DB.prepare(
    "UPDATE deletion_jobs SET status='completed',error_message=NULL,completed_at=CURRENT_TIMESTAMP," +
    "updated_at=CURRENT_TIMESTAMP WHERE id=?1"
  ).bind(jobId);
}

async function processRekeyJob(jobId, env) {
  const claim = await env.DB.prepare(
    "UPDATE deletion_jobs SET status='processing',started_at=COALESCE(started_at,CURRENT_TIMESTAMP)," +
    "error_message=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?1 AND status IN ('pending','failed')"
  ).bind(jobId).run();
  if (!claim.meta?.changes) return;
  const job = await env.DB.prepare("SELECT * FROM deletion_jobs WHERE id=?1 LIMIT 1").bind(jobId).first();
  if (!job) return;
  const photo = await env.DB.prepare(
    "SELECT id,class_id,r2_key,content_type,original_name,deleted_at " +
    "FROM photos WHERE id=?1 LIMIT 1"
  ).bind(job.target_id).first();
  if (!photo) return completeJob(job.id, env);
  if (photo.deleted_at) return completeJob(job.id, env);
  const newKey = `${photo.class_id}/${photo.id}.${trustedExtension(photo.content_type, photo.original_name)}`;
  if (photo.r2_key === newKey) {
    if (job.cursor && job.cursor !== newKey) await env.PHOTO_BUCKET.delete(job.cursor);
    return completeJob(job.id, env);
  }
  await env.DB.prepare("UPDATE deletion_jobs SET cursor=?2,updated_at=CURRENT_TIMESTAMP WHERE id=?1")
    .bind(job.id, photo.r2_key).run();
  const oldObject = await env.PHOTO_BUCKET.get(photo.r2_key);
  if (!oldObject) throw new Error(`Legacy R2 object ${photo.r2_key} was not found`);
  await env.PHOTO_BUCKET.put(newKey, oldObject.body, {
    httpMetadata: oldObject.httpMetadata,
    customMetadata: { ...(oldObject.customMetadata || {}), classId: photo.class_id, photoId: photo.id },
  });
  const update = await env.DB.prepare(
    "UPDATE photos SET r2_key=?3,updated_at=CURRENT_TIMESTAMP " +
    "WHERE id=?1 AND r2_key=?2 AND deleted_at IS NULL AND delete_job_id IS NULL"
  ).bind(photo.id, photo.r2_key, newKey).run();
  if (Number(update.meta?.changes || 0) > 0) {
    await env.PHOTO_BUCKET.delete(photo.r2_key);
  } else {
    const current = await env.DB.prepare("SELECT r2_key FROM photos WHERE id=?1").bind(photo.id).first();
    if (current?.r2_key === newKey) await env.PHOTO_BUCKET.delete(photo.r2_key);
    else await env.PHOTO_BUCKET.delete(newKey);
  }
  await completeJob(job.id, env);
}

async function getClass(classId, env, includeDeleted = false) {
  return env.DB.prepare(
    "SELECT c.*,COALESCE(NULLIF(u.username,''),u.name) owner_name," +
    "(SELECT COUNT(*) FROM photos p WHERE p.class_id=c.id AND p.deleted_at IS NULL AND p.class_removed_at IS NULL) photo_count," +
    "(SELECT COALESCE(SUM(COALESCE(p.byte_size,p.size_bytes,0)),0) FROM photos p " +
    "WHERE p.class_id=c.id AND p.deleted_at IS NULL AND p.class_removed_at IS NULL) byte_size " +
    "FROM photo_classes c LEFT JOIN app_users u ON u.id=c.owner_user_id WHERE c.id=?1 " +
    (includeDeleted ? "" : "AND c.deleted_at IS NULL ") +
    "LIMIT 1"
  ).bind(classId).first();
}

async function getPhoto(photoId, env, includeDeleted = false) {
  return env.DB.prepare(
    "SELECT p.*,COALESCE(p.byte_size,p.size_bytes,0) resolved_byte_size,c.name class_name," +
    "c.visibility,c.is_open,c.owner_user_id class_owner_user_id,c.deleted_at class_deleted_at," +
    "c.delete_job_id class_delete_job_id " +
    "FROM photos p JOIN photo_classes c ON c.id=p.class_id WHERE p.id=?1 " +
    (includeDeleted ? "" : "AND p.deleted_at IS NULL ") +
    "LIMIT 1"
  ).bind(photoId).first();
}

async function canReadClass(user, photoClass, env) {
  if (!user || !photoClass || photoClass.deleted_at) return false;
  if (classVisibility(photoClass) === "public" || isAdmin(user) || photoClass.owner_user_id === user.id) return true;
  if (user.kind === "temp") return false;
  if (user.kind !== "temp" && ["all_read", "all_write"].includes(user.access_mode)) return true;
  return Boolean(await env.DB.prepare(
    "SELECT 1 ok FROM saved_classes WHERE user_id=?1 AND class_id=?2 LIMIT 1"
  ).bind(user.id, photoClass.id).first());
}

async function canReadPhoto(user, photo, env) {
  if (!user || !photo || photo.deleted_at) return false;
  if (isAdmin(user) || photo.owner_user_id === user.id) return true;
  if (user.kind === "temp") {
    if (photo.class_removed_at || photo.class_deleted_at) return false;
    return canReadClass(user, {
      id: photo.class_id,
      owner_user_id: photo.class_owner_user_id,
      visibility: photo.visibility,
      is_open: photo.is_open,
      deleted_at: photo.class_deleted_at,
    }, env);
  }
  const saved = await env.DB.prepare(
    "SELECT 1 ok FROM saved_photos WHERE user_id=?1 AND photo_id=?2 LIMIT 1"
  ).bind(user.id, photo.id).first();
  if (saved) return true;
  if (photo.class_removed_at || photo.class_deleted_at) return false;
  return canReadClass(user, {
    id: photo.class_id,
    owner_user_id: photo.class_owner_user_id,
    visibility: photo.visibility,
    is_open: photo.is_open,
    deleted_at: photo.class_deleted_at,
  }, env);
}

function canWriteClass(user, photoClass) {
  return Boolean(user && photoClass && (
    isAdmin(user) ||
    user.access_mode === "all_write" ||
    (user.access_mode === "own_write" && photoClass.owner_user_id === user.id)
  ));
}

function canCreateClass(user) {
  return Boolean(user && (isAdmin(user) || ["all_write", "own_write"].includes(user.access_mode)));
}

async function resolveVisiblePhotos(ids, user, env) {
  const map = await visiblePhotoMap(ids, user, env);
  return ids.map((id) => map.get(id)).filter(Boolean);
}

async function visiblePhotoMap(idsInput, user, env) {
  const ids = uniqueIds(idsInput, 5000);
  const map = new Map();
  for (let offset = 0; offset < ids.length; offset += 80) {
    const chunk = ids.slice(offset, offset + 80);
    const placeholders = chunk.map((_, index) => `?${index + 1}`).join(",");
    let access = "";
    const binds = [...chunk];
    if (!isAdmin(user)) {
      const userPosition = binds.length + 1;
      if (user.kind === "temp") {
        access = " AND p.class_removed_at IS NULL AND c.deleted_at IS NULL " +
          "AND COALESCE(c.visibility,CASE WHEN c.is_open=1 THEN 'public' ELSE 'private' END)='public'";
      } else {
        const classAccess = ["all_read", "all_write"].includes(user.access_mode)
          ? "1=1"
          : `COALESCE(c.visibility,CASE WHEN c.is_open=1 THEN 'public' ELSE 'private' END)='public' ` +
            `OR c.owner_user_id=?${userPosition} ` +
            `OR EXISTS(SELECT 1 FROM saved_classes sc WHERE sc.class_id=c.id AND sc.user_id=?${userPosition})`;
        access = ` AND (p.owner_user_id=?${userPosition} ` +
          `OR EXISTS(SELECT 1 FROM saved_photos sp WHERE sp.photo_id=p.id AND sp.user_id=?${userPosition}) ` +
          `OR (p.class_removed_at IS NULL AND c.deleted_at IS NULL AND (${classAccess})))`;
        binds.push(user.id);
      }
    }
    const rows = await env.DB.prepare(
      "SELECT p.id,p.class_id,p.owner_user_id,p.original_name,p.content_type,p.metadata_json,p.class_removed_at," +
      "COALESCE(p.byte_size,p.size_bytes,0) byte_size,p.status,p.created_at,c.name class_name " +
      `FROM photos p JOIN photo_classes c ON c.id=p.class_id WHERE p.id IN (${placeholders}) ` +
      `AND p.deleted_at IS NULL${access}`
    ).bind(...binds).all();
    for (const photo of rows.results || []) map.set(photo.id, photo);
  }
  return map;
}

async function streamR2Object(request, env, key, options) {
  const range = request.headers.get("range");
  const object = await env.PHOTO_BUCKET.get(key, range ? { range: request.headers } : undefined);
  if (!object) throw new HttpError("File not found", 404);
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  const safeType = safeRasterContentType(options.contentType);
  headers.set("content-type", safeType || "application/octet-stream");
  headers.set("content-disposition", contentDisposition(
    options.filename || "photo",
    safeType ? "inline" : "attachment"
  ));
  headers.set("etag", object.httpEtag);
  headers.set("accept-ranges", "bytes");
  headers.set("x-content-type-options", "nosniff");
  headers.set("content-security-policy", "default-src 'none'; sandbox");
  headers.set("cross-origin-resource-policy", "same-origin");
  headers.set("cache-control", options.publicCache ? "public, max-age=60, must-revalidate" : "private, no-store");
  let status = 200;
  if (object.range && "offset" in object.range && "length" in object.range) {
    status = 206;
    headers.set("content-range", `bytes ${object.range.offset}-${object.range.offset + object.range.length - 1}/${object.size}`);
    headers.set("content-length", String(object.range.length));
  }
  return new Response(request.method === "HEAD" ? null : object.body, { status, headers });
}

async function reserveStorage(user, addedBytes, env) {
  const result = await env.DB.prepare(
    "UPDATE app_users SET storage_used_bytes=COALESCE(storage_used_bytes,0)+?2,updated_at=CURRENT_TIMESTAMP " +
    "WHERE id=?1 AND EXISTS(SELECT 1 FROM roles r WHERE r.id=app_users.role_id " +
    "AND (r.quota_bytes=0 OR COALESCE(app_users.storage_used_bytes,0)+?2<=r.quota_bytes))"
  ).bind(user.id, addedBytes).run();
  if (!result.meta?.changes) throw new HttpError("Storage quota exceeded", 413);
}

async function releaseStorage(userId, bytes, env) {
  await env.DB.prepare(
    "UPDATE app_users SET storage_used_bytes=MAX(0,COALESCE(storage_used_bytes,0)-?2)," +
    "updated_at=CURRENT_TIMESTAMP WHERE id=?1"
  ).bind(userId, bytes).run();
}

function classDto(row) {
  const visibility = classVisibility(row);
  return {
    id: row.id,
    name: row.name,
    description: row.description || "",
    visibility,
    isPublic: visibility === "public",
    is_open: visibility === "public" ? 1 : 0,
    ownerUserId: row.owner_user_id,
    ownerName: row.owner_name || "",
    photoCount: Number(row.photo_count || 0),
    byteSize: Number(row.byte_size || 0),
    deletedAt: row.deleted_at || null,
    deleteJobId: row.delete_job_id || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function photoDto(row) {
  const dto = {
    id: row.id,
    classId: row.class_id,
    className: row.class_name || "",
    ownerUserId: row.owner_user_id,
    name: row.original_name || row.id,
    contentType: row.content_type || "application/octet-stream",
    sizeBytes: Number(row.byte_size ?? row.resolved_byte_size ?? row.size_bytes ?? 0),
    metadata: parseJsonObject(row.metadata_json),
    status: row.status || "indexed",
    available: true,
    owned: Boolean(row.owned),
    classRemoved: Boolean(row.class_removed_at),
    class_removed: Boolean(row.class_removed_at),
    url: photoFileUrl(row.id),
    thumbnailUrl: photoThumbnailUrl(row.id),
    createdAt: row.created_at,
    savedAt: row.saved_at || null,
    classCreatedAt: row.class_created_at || null,
    savedKind: row.saved_kind || "",
  };
  if (Number.isFinite(Number(row.score))) dto.score = Number(row.score);
  if (Number.isFinite(Number(row.confidence))) dto.confidence = Number(row.confidence);
  if (Number.isFinite(Number(row.match))) dto.match = Number(row.match);
  if (row.class_removed_at) dto.detachedFromClass = true;
  return dto;
}

function roleDto(row) {
  return {
    id: row.role_id || row.id,
    name: row.role_name || row.name || "",
    description: row.role_description || row.description || "",
    accessMode: row.access_mode || "all_read",
    quotaBytes: Number(row.quota_bytes || 0),
    quotaGb: Number(row.quota_bytes || 0) / 1_000_000_000,
    isDefault: Boolean(row.is_default),
    isSystem: Boolean(row.is_system),
    sortOrder: Number(row.sort_order || 0),
    userCount: Number(row.user_count || 0),
  };
}

function shareDto(row) {
  return {
    id: row.id,
    slug: row.slug,
    url: `/s/${encodeURIComponent(row.slug)}`,
    ownerUserId: row.owner_user_id,
    startsAt: row.starts_at || null,
    endsAt: row.ends_at || null,
    starts_at: row.starts_at || null,
    ends_at: row.ends_at || null,
    status: row.status,
    passwordEnabled: Boolean(row.password_hash),
    classCount: Number(row.class_count || 0),
    photoCount: Number(row.photo_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function publicShareDto(row) {
  return {
    slug: row.slug,
    startsAt: row.starts_at || null,
    endsAt: row.ends_at || null,
    requiresPassword: Boolean(row.password_hash),
  };
}

function publicSharePhotoUrl(slug, photoId) {
  return `/api/public/shares/${encodeURIComponent(slug)}/photos/${encodeURIComponent(photoId)}/file`;
}

function photoFileUrl(photoId) {
  return `/api/photos/${encodeURIComponent(photoId)}/file`;
}

function photoThumbnailUrl(photoId) {
  return `/api/photos/${encodeURIComponent(photoId)}/thumbnail`;
}

function classVisibility(row) {
  return row.visibility || (Number(row.is_open) === 1 ? "public" : "private");
}

async function getSessionUser(request, env) {
  const sessionId = getCookie(request, "pd_session");
  if (!sessionId) return null;
  const user = await env.DB.prepare(
    "SELECT u.*,r.name role_name,r.description role_description,r.access_mode,r.quota_bytes,r.is_default,r.is_system,r.sort_order " +
    "FROM app_sessions s JOIN app_users u ON u.id=s.user_id LEFT JOIN roles r ON r.id=u.role_id " +
    "WHERE s.id=?1 AND datetime(s.expires_at)>datetime('now') LIMIT 1"
  ).bind(sessionId).first();
  if (user) {
    await env.DB.prepare(
      "UPDATE app_users SET last_seen_at=CURRENT_TIMESTAMP WHERE id=?1 AND last_seen_at<datetime('now','-5 minutes')"
    ).bind(user.id).run();
  }
  return user || null;
}

async function getUserById(userId, env) {
  if (!userId) return null;
  return env.DB.prepare(
    "SELECT u.*,r.name role_name,r.description role_description,r.access_mode,r.quota_bytes,r.is_default,r.is_system,r.sort_order " +
    "FROM app_users u LEFT JOIN roles r ON r.id=u.role_id WHERE u.id=?1 LIMIT 1"
  ).bind(userId).first();
}

async function getDefaultRole(env) {
  return env.DB.prepare("SELECT * FROM roles WHERE is_default=1 ORDER BY sort_order,id LIMIT 1").first();
}

async function requireUser(request, env) {
  const user = await getSessionUser(request, env);
  if (!user) throw new HttpError("Authentication required", 401);
  return user;
}

async function requireBoundUser(request, env) {
  const user = await requireUser(request, env);
  if (!user.auth_uuid && !isAdmin(user)) throw new HttpError("Aryuki Auth Center binding required", 403);
  return user;
}

async function requireAdmin(request, env) {
  const user = await requireUser(request, env);
  if (!isAdmin(user)) throw new HttpError("Admin only", 403);
  return user;
}

function isAdmin(user) {
  return user?.role === "admin" || user?.kind === "admin";
}

function publicUser(user) {
  return {
    id: user.id,
    kind: user.kind,
    role: user.role,
    roleId: user.role_id,
    roleName: user.role_name || "",
    accessMode: isAdmin(user) ? "all_write" : user.access_mode || "all_read",
    quotaBytes: Number(user.quota_bytes || 0),
    storageUsedBytes: Number(user.storage_used_bytes || 0),
    authUuid: user.auth_uuid,
    name: user.name,
    username: user.username || "",
    email: user.email || "",
    avatarUrl: user.avatar_url || "",
    authCenterUrl: user.auth_uuid ? `${getStaticAuthOrigin()}/${encodeURIComponent(user.auth_uuid)}` : "",
  };
}

async function createSession(env, userId, maxAgeSeconds = NORMAL_SESSION_SECONDS) {
  const id = newId("ses_");
  const expiresAt = new Date(Date.now() + maxAgeSeconds * 1000).toISOString();
  await env.DB.prepare("INSERT INTO app_sessions (id,user_id,expires_at) VALUES (?1,?2,?3)")
    .bind(id, userId, expiresAt).run();
  return id;
}

function sessionCookie(id, maxAgeSeconds = NORMAL_SESSION_SECONDS) {
  return `pd_session=${id}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

function clearSessionCookie() {
  return "pd_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
}

function getCookie(request, name) {
  const prefix = `${name}=`;
  const part = (request.headers.get("cookie") || "").split(";").map((item) => item.trim())
    .find((item) => item.startsWith(prefix));
  if (!part) return "";
  try {
    return decodeURIComponent(part.slice(prefix.length));
  } catch {
    return "";
  }
}

async function verifyAuthToken(token, env) {
  const response = await fetch(`${getAuthOrigin(env)}/api/verify?app_id=${encodeURIComponent(getAppId(env))}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }
  if (!response.ok) throw new HttpError(data.error || data.message || "SSO verification failed", response.status);
  return data;
}

function normalizeVerifiedUser(verified, token) {
  const payload = decodeJwtPayload(token);
  const user = verified.user || verified || {};
  return {
    uuid: user.uuid || user.sub || payload.uuid || payload.sub || "",
    userId: user.user_id ?? payload.user_id ?? null,
    name: user.name || payload.name || user.username || payload.username || "Aryuki User",
    username: user.username || payload.username || "",
    email: user.email || payload.email || "",
    avatarUrl: user.avatar_url || payload.avatar_url || "",
  };
}

function decodeJwtPayload(token) {
  try {
    const part = token.split(".")[1] || "";
    const normalized = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
    return JSON.parse(atob(normalized));
  } catch {
    return {};
  }
}

function isConfiguredAdmin(uuid, env) {
  const allowed = String(env.ADMIN_AUTH_UUIDS || "").split(",")
    .map((value) => value.trim()).filter(Boolean);
  return allowed.includes(String(uuid || "").trim());
}

function getAppId(env) {
  return env.APP_ID || "picture-distributor";
}

function getAuthOrigin(env) {
  return (env.AUTH_CENTER_ORIGIN || getStaticAuthOrigin()).replace(/\/$/, "");
}

function getStaticAuthOrigin() {
  return "https://accounts.aryuki.com";
}

function parseShareWindow(body) {
  const startsAt = parseOptionalTimestamp(body.startsAt ?? body.starts_at, "startsAt");
  const endsAt = parseOptionalTimestamp(body.endsAt ?? body.ends_at, "endsAt");
  if (startsAt && endsAt && endsAt <= startsAt) throw new HttpError("Share end time must be after start time", 400);
  return { startsAt, endsAt };
}

function parseOptionalTimestamp(value, name) {
  if (value === undefined || value === null || value === "") return null;
  const date = new Date(value);
  if (!Number.isFinite(date.valueOf())) throw new HttpError(`${name} must be a valid date`, 400);
  return date.toISOString();
}

function parseSlug(value) {
  const slug = String(value || "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{1,62}[a-z0-9]$/.test(slug)) {
    throw new HttpError("Share suffix must be 3-64 lowercase letters, numbers, hyphens, or underscores", 400);
  }
  return slug;
}

function parseShareStatus(value) {
  const status = value === undefined ? "active" : String(value);
  if (!["active", "disabled"].includes(status)) throw new HttpError("Invalid share status", 400);
  return status;
}

function parseVisibility(value) {
  const visibility = String(value || "").toLowerCase();
  if (!["public", "private"].includes(visibility)) throw new HttpError("visibility must be public or private", 400);
  return visibility;
}

function requiredText(value, name, maximum) {
  const text = String(value || "").trim();
  if (!text) throw new HttpError(`${name} is required`, 400);
  return text.slice(0, maximum);
}

export async function validateImageFile(file, maximumBytes) {
  if (!(file instanceof File)) {
    throw new HttpError("Only image files are accepted", 415);
  }
  if (!file.size) throw new HttpError("Image files cannot be empty", 400);
  if (file.size > maximumBytes) throw new HttpError(`Each image must be ${Math.floor(maximumBytes / 1024 / 1024)} MB or smaller`, 413);
  const detected = detectRasterContentType(new Uint8Array(await file.slice(0, 32).arrayBuffer()));
  const claimed = safeRasterContentType(file.type);
  if (!detected || (claimed && claimed !== detected)) {
    throw new HttpError("Only valid JPEG, PNG, WebP, GIF, AVIF, HEIC, or HEIF images are accepted", 415);
  }
  return detected;
}

function extractFiles(form, fieldName) {
  const preferred = form.getAll(fieldName).filter((value) => value instanceof File);
  return preferred.length ? preferred : [...form.values()].filter((value) => value instanceof File);
}

export function trustedExtension(contentType) {
  const type = safeRasterContentType(contentType);
  const known = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/avif": "avif",
    "image/heic": "heic",
    "image/heif": "heif",
  };
  return known[type] || "bin";
}

export function safeRasterContentType(value) {
  const type = String(value || "").toLowerCase().split(";")[0].trim();
  if (type === "image/jpg" || type === "image/pjpeg") return "image/jpeg";
  return new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/avif",
    "image/heic",
    "image/heif",
  ]).has(type) ? type : "";
}

export function detectRasterContentType(bytes) {
  const ascii = (start, length) => String.fromCharCode(...bytes.slice(start, start + length));
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value)
  ) {
    return "image/png";
  }
  if (bytes.length >= 6 && ["GIF87a", "GIF89a"].includes(ascii(0, 6))) return "image/gif";
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return "image/webp";
  if (bytes.length >= 12 && ascii(4, 4) === "ftyp") {
    const brand = ascii(8, 4).toLowerCase();
    if (["avif", "avis"].includes(brand)) return "image/avif";
    if (["heic", "heix", "hevc", "hevx", "heim", "heis"].includes(brand)) return "image/heic";
    if (["mif1", "msf1", "heif"].includes(brand)) return "image/heif";
  }
  return "";
}

export function contentDisposition(value, disposition = "inline") {
  const cleaned = String(value || "photo").toWellFormed().replace(/[\u0000-\u001f\u007f]/g, "_");
  const filename = Array.from(cleaned).slice(0, 180).join("");
  const ascii = filename.replace(/[^\x20-\x7e]|["\\;]/g, "_").trim() || "photo";
  const encoded = encodeURIComponent(filename).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

function uniqueIds(value, maximum) {
  if (!Array.isArray(value)) throw new HttpError("Expected an array of ids", 400);
  const ids = [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))];
  if (ids.length > maximum) throw new HttpError(`At most ${maximum} items are allowed`, 413);
  return ids;
}

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseJsonObject(value) {
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function clampInteger(value, minimum, maximum, fallback) {
  if (value === null || value === undefined || String(value).trim() === "") return fallback;
  const number = Number(value);
  return Number.isInteger(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
}

function sqliteTimestampMs(value) {
  const text = String(value || "");
  const normalized = text.includes("T") ? text : `${text.replace(" ", "T")}Z`;
  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function decodePart(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new HttpError("Malformed URL", 400);
  }
}

function safeNextPath(value) {
  const path = String(value || "");
  return path.startsWith("/") && !path.startsWith("//") && !path.includes("\\") ? path : "";
}

function constantTimeTextEqual(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function safeJson(request) {
  try {
    return await request.json();
  } catch {
    throw new HttpError("Request body must be valid JSON", 400);
  }
}

function randomName() {
  const first = ["James", "Olivia", "Liam", "Emma", "Noah", "Ava", "Ethan", "Mia"];
  const last = ["Miller", "Johnson", "Parker", "Bennett", "Carter", "Reed", "Morgan", "Hayes"];
  return `${first[Math.floor(Math.random() * first.length)]} ${last[Math.floor(Math.random() * last.length)]}`;
}

function jsonResponse(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}

class HttpError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
