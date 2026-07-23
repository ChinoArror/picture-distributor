import { renderHomePage } from "./homepage3.js";
import { renderClassSearchPage } from "./searchpage.js";
import { renderQueryHistoryPage } from "./historypage.js";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type",
};

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
};

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);

    try {
      if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/login")) {
        return htmlResponse(renderHomePage());
      }

      if (request.method === "GET" && url.pathname === "/search") {
        return htmlResponse(renderClassSearchPage());
      }

      if (request.method === "GET" && url.pathname === "/history") {
        return htmlResponse(renderQueryHistoryPage());
      }

      if (request.method === "GET" && url.pathname.startsWith("/sso-callback")) {
        return handleSsoCallback(request, env);
      }

      if (request.method === "GET" && url.pathname === "/api/me") {
        return withCors(await handleMe(request, env));
      }

      if (request.method === "GET" && url.pathname === "/api/auth/login-url") {
        return withCors(await handleLoginUrl(request, env));
      }

      if (request.method === "POST" && url.pathname === "/api/auth/temp") {
        return withCors(await handleTempLogin(env));
      }

      if (request.method === "POST" && url.pathname === "/api/logout") {
        return withCors(await handleLogout(request, env));
      }

      if (request.method === "GET" && url.pathname === "/api/classes") {
        return withCors(await handleListClasses(request, env));
      }

      if (request.method === "GET" && url.pathname === "/api/class-search") {
        return withCors(await handleClassNameSearch(request, env));
      }

      if (url.pathname === "/api/class-search-history" && request.method === "GET") {
        return withCors(await handleClassSearchHistory(request, env));
      }

      if (url.pathname === "/api/class-search-history" && request.method === "POST") {
        return withCors(await handleSaveClassSearch(request, env));
      }

      if (url.pathname === "/api/query-history" && request.method === "GET") {
        return withCors(await handleQueryHistory(request, env));
      }

      if (url.pathname.startsWith("/api/query-history/") && request.method === "DELETE") {
        return withCors(await handleDeleteQueryHistory(request, env, url.pathname.slice("/api/query-history/".length)));
      }

      if (request.method === "POST" && url.pathname === "/api/classes") {
        return withCors(await handleCreateClass(request, env));
      }

      if (request.method === "PATCH" && url.pathname.startsWith("/api/classes/")) {
        return withCors(await handleUpdateClass(request, env, url.pathname.slice("/api/classes/".length)));
      }

      if (request.method === "DELETE" && url.pathname.startsWith("/api/classes/") && !url.pathname.endsWith("/photos")) {
        return withCors(await handleDeleteClass(request, env, url.pathname.slice("/api/classes/".length)));
      }

      if (request.method === "GET" && url.pathname.startsWith("/api/classes/") && url.pathname.endsWith("/photos")) {
        const classId = url.pathname.slice("/api/classes/".length, -"/photos".length).replace(/\/$/, "");
        return withCors(await handleClassPhotos(request, env, classId));
      }

      if (request.method === "POST" && url.pathname === "/api/admin/photos") {
        return withCors(await handleAdminUpload(request, env));
      }

      if (request.method === "POST" && url.pathname === "/api/search") {
        return withCors(await handleSearchUpload(request, env));
      }

      if (request.method === "POST" && url.pathname === "/api/admin/retry-ingest") {
        return withCors(await handleRetryIngest(request, env));
      }

      if (request.method === "GET" && url.pathname === "/api/history") {
        return withCors(await handleSearchHistory(request, env));
      }

      if (request.method === "GET" && url.pathname.startsWith("/api/status/")) {
        return withCors(await handleTaskStatus(request, url.pathname.slice("/api/status/".length), env));
      }

      if (request.method === "GET" && url.pathname.startsWith("/api/photos/") && url.pathname.endsWith("/file")) {
        const photoId = url.pathname.slice("/api/photos/".length, -"/file".length).replace(/\/$/, "");
        return withCors(await handlePhotoStream(photoId, env));
      }

      if (request.method === "DELETE" && url.pathname.startsWith("/api/photos/") && !url.pathname.endsWith("/file")) {
        const photoId = url.pathname.slice("/api/photos/".length).replace(/\/$/, "");
        return withCors(await handleDeletePhoto(request, env, photoId));
      }

      if (request.method === "GET" && url.pathname.startsWith("/api/assets/")) {
        const key = decodeR2Key(url.pathname.slice("/api/assets/".length));
        return withCors(await streamAssetByKey(key, env));
      }

      return withCors(jsonResponse({ error: "Not Found" }, 404));
    } catch (error) {
      console.error("Request failed", error);
      return withCors(
        jsonResponse(
          { error: error instanceof Error ? error.message : "Unexpected error" },
          error instanceof HttpError ? error.status : 500
        )
      );
    }
  },

  async queue(batch, env, ctx) {
    return handleQueueBatch(batch, env, ctx);
  },
};

async function handleAdminUpload(request, env) {
  await requireAdmin(request, env);
  const formData = await request.formData();
  const files = extractFiles(formData, "photos");
  const classId = String(formData.get("class_id") || "").trim();
  const origin = new URL(request.url).origin;

  if (!files.length) {
    return jsonResponse({ error: "No photos were uploaded" }, 400);
  }
  if (!classId) {
    return jsonResponse({ error: "class_id is required" }, 400);
  }
  const photoClass = await env.DB.prepare("SELECT id FROM photo_classes WHERE id = ?1 LIMIT 1").bind(classId).first();
  if (!photoClass) {
    return jsonResponse({ error: "Class not found" }, 404);
  }

  const rows = [];

  for (const file of files) {
    const photoId = crypto.randomUUID();
    const objectKey = buildObjectKey("photos", file.name, photoId);

    await env.PHOTO_BUCKET.put(objectKey, file.stream(), {
      httpMetadata: {
        contentType: file.type || "application/octet-stream",
      },
      customMetadata: {
        originalName: file.name,
        uploadedFor: "photo-indexing",
      },
    });

    rows.push({
      id: photoId,
      r2Key: objectKey,
      contentType: file.type || "application/octet-stream",
      originalName: file.name,
      sizeBytes: file.size,
    });
  }

  const inserts = rows.map((row) =>
    env.DB.prepare(
      "INSERT INTO photos (id, class_id, r2_key, original_name, content_type, size_bytes, status, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'uploaded', CURRENT_TIMESTAMP)"
    ).bind(row.id, classId, row.r2Key, row.originalName, row.contentType, row.sizeBytes)
  );

  await env.DB.batch(inserts);

  await Promise.all(
    rows.map((row) =>
      env.INGEST_QUEUE.send({
        type: "photo.ingest",
        photoId: row.id,
        r2Key: row.r2Key,
        assetUrl: buildAssetProxyUrl(row.r2Key, origin),
      })
    )
  );

  return jsonResponse({
    uploaded: rows.length,
    photos: rows.map((row) => ({
      id: row.id,
      name: row.originalName,
      status: "uploaded",
      url: buildPhotoFileUrl(row.id),
    })),
  });
}

async function handleSearchUpload(request, env) {
  const user = await requireUser(request, env);
  const formData = await request.formData();
  const selfie = formData.get("selfie");
  const origin = new URL(request.url).origin;

  if (!(selfie instanceof File)) {
    return jsonResponse({ error: "A selfie file is required" }, 400);
  }
  if (!String(selfie.type || "").toLowerCase().startsWith("image/")) {
    return jsonResponse({ error: "The selfie must be an image file" }, 415);
  }
  if (!selfie.size) {
    return jsonResponse({ error: "The selfie image is empty" }, 400);
  }
  if (selfie.size > 10 * 1024 * 1024) {
    return jsonResponse({ error: "The selfie must be 10 MB or smaller" }, 413);
  }

  const taskId = crypto.randomUUID();
  const objectKey = buildObjectKey("selfies", selfie.name, taskId);

  await env.PHOTO_BUCKET.put(objectKey, selfie.stream(), {
    httpMetadata: {
      contentType: selfie.type || "application/octet-stream",
    },
    customMetadata: {
      uploadedFor: "face-search",
    },
  });

  await env.DB.prepare(
    "INSERT INTO search_tasks (id, user_id, selfie_key, selfie_name, selfie_content_type, selfie_size_bytes, status, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'pending', CURRENT_TIMESTAMP)"
  )
    .bind(taskId, user.id, objectKey, selfie.name || "selfie", selfie.type || "application/octet-stream", selfie.size || 0)
    .run();

  await env.SEARCH_QUEUE.send({
    type: "search.run",
    taskId,
    selfieKey: objectKey,
    assetUrl: buildAssetProxyUrl(objectKey, origin),
  });

  return jsonResponse({
    taskId,
    status: "pending",
  });
}

async function handleMe(request, env) {
  const user = await getSessionUser(request, env);
  if (!user) {
    return jsonResponse({ authenticated: false });
  }

  return jsonResponse({
    authenticated: true,
    user: publicUser(user),
  });
}

async function handleLoginUrl(request, env) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") === "bind" ? "bind" : "admin";
  const callback = `${url.origin}/sso-callback/${mode}`;
  const loginUrl = `${getAuthOrigin(env)}/?client_id=${encodeURIComponent(getAppId(env))}&redirect=${encodeURIComponent(callback)}`;

  return jsonResponse({ url: loginUrl });
}

async function handleTempLogin(env) {
  const userId = crypto.randomUUID();
  const name = randomAmericanName();
  const username = name.toLowerCase().replace(/[^a-z]+/g, ".").replace(/\.$/, "");

  await env.DB.prepare(
    "INSERT INTO app_users (id, kind, role, name, username, updated_at, last_seen_at) VALUES (?1, 'temp', 'user', ?2, ?3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
  )
    .bind(userId, name, `${username}.${Math.floor(100 + Math.random() * 900)}`)
    .run();

  const sid = await createSession(env, userId);
  return new Response(JSON.stringify({ authenticated: true, user: { id: userId, kind: "temp", role: "user", name, username } }), {
    headers: {
      ...jsonHeaders,
      "set-cookie": sessionCookie(sid),
    },
  });
}

async function handleLogout(request, env) {
  const sid = getCookie(request, "pd_session");
  if (sid) {
    await env.DB.prepare("DELETE FROM app_sessions WHERE id = ?1").bind(sid).run();
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      ...jsonHeaders,
      "set-cookie": clearSessionCookie(),
    },
  });
}

async function handleSsoCallback(request, env) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const mode = url.pathname.endsWith("/bind") || url.searchParams.get("mode") === "bind" ? "bind" : "admin";

  if (!token) {
    return htmlResponse("<h1>Missing token</h1>", 400);
  }

  const verified = await verifyAuthToken(token, env);
  const authUser = normalizeVerifiedUser(verified, token);
  const isAdmin = isAdminUser(authUser, env);

  if (mode === "admin" && !isAdmin) {
    return htmlResponse("<h1>Only admin users can login as admin.</h1><a href='/login'>Back</a>", 403);
  }

  const current = await getSessionUser(request, env);
  const userId = crypto.randomUUID();
  const existing = authUser.uuid
    ? await env.DB.prepare("SELECT id FROM app_users WHERE auth_uuid = ?1 LIMIT 1").bind(authUser.uuid).first()
    : null;
  const finalUserId = existing?.id || (mode === "bind" && current?.kind === "temp" ? current.id : userId);
  const role = isAdmin ? "admin" : "user";

  await env.DB.prepare(
    "INSERT INTO app_users (id, kind, role, auth_uuid, auth_user_id, name, username, avatar_url, token, bound_temp_id, updated_at, last_seen_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) " +
      "ON CONFLICT(id) DO UPDATE SET kind = excluded.kind, role = excluded.role, auth_uuid = excluded.auth_uuid, auth_user_id = excluded.auth_user_id, name = excluded.name, username = excluded.username, avatar_url = excluded.avatar_url, token = excluded.token, updated_at = CURRENT_TIMESTAMP, last_seen_at = CURRENT_TIMESTAMP"
  )
    .bind(
      finalUserId,
      isAdmin ? "admin" : "auth",
      role,
      authUser.uuid,
      authUser.user_id,
      authUser.name,
      authUser.username,
      authUser.avatar_url,
      token,
      current?.kind === "temp" ? current.id : null
    )
    .run();

  const sid = await createSession(env, finalUserId);
  return new Response(null, {
    status: 302,
    headers: {
      location: "/",
      "set-cookie": sessionCookie(sid),
    },
  });
}

async function handleListClasses(request, env) {
  const user = await requireUser(request, env);
  const admin = user.role === "admin";
  const rows = await env.DB.prepare(
    "SELECT c.id, c.name, c.is_open, COUNT(p.id) AS photo_count FROM photo_classes c LEFT JOIN photos p ON p.class_id = c.id " +
      (admin ? "" : "WHERE c.is_open = 1 ") +
      "GROUP BY c.id, c.name, c.is_open ORDER BY c.created_at DESC"
  ).all();

  return jsonResponse({ classes: rows.results || [] });
}

async function handleClassNameSearch(request, env) {
  const user = await requireUser(request, env);
  const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 80) || "";
  if (!query) {
    return jsonResponse({ classes: [] });
  }

  const classRows = await env.DB.prepare(
    "SELECT id, name FROM photo_classes WHERE is_open = 1 ORDER BY name COLLATE NOCASE ASC"
  ).all();
  const ranked = (classRows.results || [])
    .map((item) => ({ ...item, relevance: classNameRelevance(item.name, query) }))
    .filter((item) => item.relevance > 0)
    .sort((left, right) => right.relevance - left.relevance || left.name.localeCompare(right.name))
    .slice(0, 30);

  if (!ranked.length) {
    await recordClassSearchResult(user, query, [], env);
    return jsonResponse({ query, classes: [] });
  }

  const photoResults = await env.DB.batch(
    ranked.map((item) => env.DB.prepare(
      "SELECT id, original_name, content_type, size_bytes FROM photos WHERE class_id = ?1 AND status = 'indexed' ORDER BY created_at DESC"
    ).bind(item.id))
  );
  const classes = ranked.map((item, index) => ({
    id: item.id,
    name: item.name,
    photos: (photoResults[index]?.results || []).map((photo) => ({
      id: photo.id,
      name: photo.original_name || photo.id,
      contentType: photo.content_type,
      sizeBytes: photo.size_bytes,
      url: buildPhotoFileUrl(photo.id),
    })),
  }));
  if (user.auth_uuid || user.role === "admin") {
    const photoIds = classes.flatMap((item) => item.photos.map((photo) => photo.id));
    await recordClassSearchResult(user, query, photoIds, env);
  }
  return jsonResponse({ query, classes });
}

async function recordClassSearchResult(user, query, photoIds, env) {
  if (!user.auth_uuid && user.role !== "admin") return;
  await env.DB.prepare(
    "INSERT INTO class_search_history (id, user_id, query, result_count, matched_photo_ids) VALUES (?1, ?2, ?3, ?4, ?5)"
  ).bind(crypto.randomUUID(), user.id, query, photoIds.length, JSON.stringify(photoIds)).run();
}

async function handleClassSearchHistory(request, env) {
  const user = await requireUser(request, env);
  if (!user.auth_uuid && user.role !== "admin") return jsonResponse({ synced: false, queries: [] });
  const rows = await env.DB.prepare(
    "SELECT query, MAX(created_at) AS last_used FROM class_search_history WHERE user_id = ?1 GROUP BY query ORDER BY last_used DESC LIMIT 8"
  ).bind(user.id).all();
  return jsonResponse({ synced: true, queries: (rows.results || []).map((row) => row.query) });
}

async function handleSaveClassSearch(request, env) {
  const user = await requireUser(request, env);
  const body = await safeJson(request);
  const query = String(body.query || "").trim().slice(0, 80);
  if (!query) return jsonResponse({ saved: false });
  if (!user.auth_uuid && user.role !== "admin") return jsonResponse({ saved: false, synced: false });
  await env.DB.prepare("DELETE FROM class_search_history WHERE user_id = ?1 AND query = ?2").bind(user.id, query).run();
  await env.DB.prepare("INSERT INTO class_search_history (id, user_id, query) VALUES (?1, ?2, ?3)").bind(crypto.randomUUID(), user.id, query).run();
  return jsonResponse({ saved: true, synced: true });
}

async function handleQueryHistory(request, env) {
  const user = await requireUser(request, env);
  if (!user.auth_uuid && user.role !== "admin") return jsonResponse({ synced: false, records: [] });
  const rows = await env.DB.prepare(
    "SELECT id, query, result_count, matched_photo_ids, created_at FROM class_search_history WHERE user_id = ?1 ORDER BY created_at DESC LIMIT 50"
  ).bind(user.id).all();
  const records = [];
  for (const row of rows.results || []) {
    const ids = parseJsonArray(row.matched_photo_ids).slice(0, 80);
    const states = ids.length ? await env.DB.batch(ids.map((id) => env.DB.prepare(
      "SELECT p.id, p.original_name, p.status, c.is_open FROM photos p LEFT JOIN photo_classes c ON c.id = p.class_id WHERE p.id = ?1 LIMIT 1"
    ).bind(id))) : [];
    records.push({
      id: row.id,
      query: row.query,
      resultCount: Number(row.result_count || ids.length),
      createdAt: row.created_at,
      photos: ids.map((id, index) => {
        const photo = states[index]?.results?.[0];
        const available = !!photo && photo.status === "indexed" && photo.is_open === 1;
        return { id, name: photo?.original_name || "Image unavailable", available, url: available ? buildPhotoFileUrl(id) : null };
      }),
    });
  }
  return jsonResponse({ synced: true, records });
}

async function handleDeleteQueryHistory(request, env, historyId) {
  const user = await requireUser(request, env);
  if (!user.auth_uuid && user.role !== "admin") return jsonResponse({ error: "Online history is not enabled" }, 403);
  const row = await env.DB.prepare("SELECT id FROM class_search_history WHERE id = ?1 AND user_id = ?2 LIMIT 1").bind(historyId, user.id).first();
  if (!row) return jsonResponse({ error: "History record not found" }, 404);
  await env.DB.prepare("DELETE FROM class_search_history WHERE id = ?1 AND user_id = ?2").bind(historyId, user.id).run();
  return jsonResponse({ deleted: true });
}

function classNameRelevance(name, query) {
  const normalize = (value) => String(value || "").normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const target = normalize(name);
  const phrase = normalize(query);
  if (!target || !phrase) return 0;
  if (target === phrase) return 1000;
  if (target.startsWith(phrase)) return 850 - Math.min(100, target.length - phrase.length);
  if (target.includes(phrase)) return 700 - Math.min(100, target.indexOf(phrase));
  const targetWords = target.split(/\s+/);
  const terms = [...new Set(phrase.split(/\s+/).filter(Boolean))];
  let score = 0;
  let matched = 0;
  for (const term of terms) {
    if (targetWords.includes(term)) { score += 120; matched += 1; continue; }
    if (targetWords.some((word) => word.startsWith(term))) { score += 80; matched += 1; continue; }
    if (target.includes(term)) { score += 45; matched += 1; }
  }
  if (!matched) return 0;
  if (matched === terms.length) score += 250;
  return score + Math.round((matched / terms.length) * 100);
}

async function handleCreateClass(request, env) {
  const user = await requireAdmin(request, env);
  const body = await safeJson(request);
  const id = shortId();
  const name = String(body.name || `Class ${id}`).slice(0, 80);

  await env.DB.prepare(
    "INSERT INTO photo_classes (id, name, is_open, created_by, updated_at) VALUES (?1, ?2, ?3, ?4, CURRENT_TIMESTAMP)"
  )
    .bind(id, name, body.isOpen ? 1 : 0, user.id)
    .run();

  return jsonResponse({ class: { id, name, is_open: body.isOpen ? 1 : 0, photo_count: 0 } });
}

async function handleUpdateClass(request, env, classId) {
  await requireAdmin(request, env);
  const body = await safeJson(request);
  const current = await env.DB.prepare("SELECT id, name, is_open FROM photo_classes WHERE id = ?1 LIMIT 1").bind(classId).first();
  if (!current) {
    return jsonResponse({ error: "Class not found" }, 404);
  }

  const name = body.name === undefined ? current.name : String(body.name || current.name).slice(0, 80);
  const isOpen = body.isOpen === undefined ? current.is_open : body.isOpen ? 1 : 0;
  await env.DB.prepare("UPDATE photo_classes SET name = ?2, is_open = ?3, updated_at = CURRENT_TIMESTAMP WHERE id = ?1")
    .bind(classId, name, isOpen)
    .run();

  return jsonResponse({ class: { id: classId, name, is_open: isOpen } });
}

async function handleDeleteClass(request, env, classId) {
  await requireAdmin(request, env);
  const photoClass = await env.DB.prepare("SELECT id, name FROM photo_classes WHERE id = ?1 LIMIT 1").bind(classId).first();
  if (!photoClass) {
    return jsonResponse({ error: "Class not found" }, 404);
  }

  const photos = await env.DB.prepare("SELECT id, r2_key, vector_id FROM photos WHERE class_id = ?1").bind(classId).all();
  for (const photo of photos.results || []) {
    await deletePhotoAssets(photo, env);
    await env.DB.prepare("DELETE FROM photos WHERE id = ?1").bind(photo.id).run();
  }

  await env.DB.prepare("DELETE FROM photo_classes WHERE id = ?1").bind(classId).run();
  return jsonResponse({ deleted: true, class: photoClass, removedPhotos: (photos.results || []).length });
}

async function handleClassPhotos(request, env, classId) {
  const user = await requireUser(request, env);
  const row = await env.DB.prepare("SELECT id, name, is_open FROM photo_classes WHERE id = ?1 LIMIT 1").bind(classId).first();
  if (!row || (user.role !== "admin" && row.is_open !== 1)) {
    return jsonResponse({ error: "Class not found" }, 404);
  }
  const photos = await env.DB.prepare(
    "SELECT id, original_name, content_type, size_bytes, status FROM photos WHERE class_id = ?1 ORDER BY created_at DESC"
  )
    .bind(classId)
    .all();

  return jsonResponse({
    class: row,
    photos: (photos.results || []).map((photo) => ({
      ...photo,
      url: buildPhotoFileUrl(photo.id),
    })),
  });
}

async function handleDeletePhoto(request, env, photoId) {
  await requireAdmin(request, env);
  const photo = await env.DB.prepare("SELECT id, class_id, r2_key, vector_id, original_name FROM photos WHERE id = ?1 LIMIT 1").bind(photoId).first();
  if (!photo) {
    return jsonResponse({ error: "Photo not found" }, 404);
  }

  await deletePhotoAssets(photo, env);
  await env.DB.prepare("DELETE FROM photos WHERE id = ?1").bind(photo.id).run();
  return jsonResponse({ deleted: true, photoId: photo.id, classId: photo.class_id, name: photo.original_name });
}

async function handleRetryIngest(request, env) {
  await requireAdmin(request, env);
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") || 50), 200);
  const rows = await env.DB.prepare(
    "SELECT id, r2_key FROM photos WHERE status IN ('uploaded', 'failed') ORDER BY created_at DESC LIMIT ?1"
  )
    .bind(limit)
    .all();
  const photos = rows.results || [];
  const origin = url.origin;

  await Promise.all(
    photos.map((photo) =>
      env.INGEST_QUEUE.send({
        type: "photo.ingest",
        photoId: photo.id,
        r2Key: photo.r2_key,
        assetUrl: buildAssetProxyUrl(photo.r2_key, origin),
      })
    )
  );

  await env.DB.batch(
    photos.map((photo) =>
      env.DB.prepare(
        "UPDATE photos SET status = 'uploaded', error_message = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?1"
      ).bind(photo.id)
    )
  );

  return jsonResponse({
    requeued: photos.length,
  });
}

async function handleSearchHistory(request, env) {
  const user = await requireBoundUser(request, env);
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 12), 1), 50);
  const rows = await env.DB.prepare(
    "SELECT id, selfie_key, selfie_name, selfie_content_type, selfie_size_bytes, status, match_count, matched_photo_ids, matched_urls, error_message, created_at, updated_at, completed_at FROM search_tasks WHERE user_id = ?1 ORDER BY created_at DESC LIMIT ?2"
  )
    .bind(user.id, limit)
    .all();

  const tasks = [];
  for (const row of rows.results || []) {
    const matchedPhotoIds = parseJsonArray(row.matched_photo_ids);
    const matchedUrls = parseJsonArray(row.matched_urls);
    const photos = matchedPhotoIds.length ? await fetchPhotosByIds(matchedPhotoIds, env) : [];
    const photoById = new Map(photos.map((photo) => [photo.id, photo]));
    const results = matchedPhotoIds
      .map((photoId, index) => {
        const photo = photoById.get(photoId);
        if (!photo) {
          return null;
        }

        return {
          id: photo.id,
          name: photo.original_name,
          url: matchedUrls[index] || buildPhotoFileUrl(photo.id),
          classId: photo.class_id,
          className: photo.class_name,
          contentType: photo.content_type,
          sizeBytes: photo.size_bytes,
        };
      })
      .filter(Boolean);

    tasks.push({
      taskId: row.id,
      status: row.status,
      matchCount: row.match_count,
      error: row.error_message,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
      selfie: {
        name: row.selfie_name || "selfie",
        url: buildAssetProxyUrl(row.selfie_key, configuredOrigin(env) || new URL(request.url).origin),
        contentType: row.selfie_content_type || "application/octet-stream",
        sizeBytes: row.selfie_size_bytes || 0,
      },
      results,
    });
  }

  return jsonResponse({ tasks });
}

async function handleTaskStatus(request, taskId, env) {
  const viewer = await requireUser(request, env);
  const task = await env.DB.prepare(
    "SELECT id, user_id, status, match_count, matched_photo_ids, matched_urls, error_message, created_at, updated_at, completed_at FROM search_tasks WHERE id = ?1 LIMIT 1"
  )
    .bind(taskId)
    .first();

  if (!task) {
    return jsonResponse({ error: "Task not found" }, 404);
  }

  if (viewer.role !== "admin" && task.user_id && task.user_id !== viewer.id) {
    return jsonResponse({ error: "Task not found" }, 404);
  }

  const matchedPhotoIds = parseJsonArray(task.matched_photo_ids);
  const matchedUrls = parseJsonArray(task.matched_urls);
  const photos = matchedPhotoIds.length ? await fetchPhotosByIds(matchedPhotoIds, env) : [];
  const photoById = new Map(photos.map((photo) => [photo.id, photo]));

  const results = matchedPhotoIds
    .map((photoId, index) => {
      const photo = photoById.get(photoId);
      if (!photo) {
        return null;
      }

      return {
        id: photo.id,
        name: photo.original_name,
        url: matchedUrls[index] || buildPhotoFileUrl(photo.id),
        classId: photo.class_id,
        className: photo.class_name,
        contentType: photo.content_type,
        sizeBytes: photo.size_bytes,
      };
    })
    .filter(Boolean);

  return jsonResponse({
    taskId: task.id,
    status: task.status,
    matchCount: task.match_count,
    matchedPhotoIds,
    matchedUrls,
    results,
    error: task.error_message,
    createdAt: task.created_at,
    updatedAt: task.updated_at,
    completedAt: task.completed_at,
  });
}

async function handlePhotoStream(photoId, env) {
  const photo = await env.DB.prepare(
    "SELECT id, r2_key, content_type, original_name FROM photos WHERE id = ?1 LIMIT 1"
  )
    .bind(photoId)
    .first();

  if (!photo) {
    return jsonResponse({ error: "Photo not found" }, 404);
  }

  return streamAssetByKey(photo.r2_key, env, {
    "content-type": photo.content_type,
    "content-disposition": `inline; filename="${sanitizeFilename(photo.original_name)}"`,
  });
}

async function handleQueueBatch(batch, env) {
  for (const message of batch.messages) {
    try {
      const payload = parseMessageBody(message.body);

      if (payload.type === "photo.ingest") {
        await handleIngestTask(payload, env);
      } else if (payload.type === "search.run") {
        await handleSearchTask(payload, env);
      } else {
        throw new Error(`Unsupported queue message type: ${payload.type}`);
      }

      message.ack();
    } catch (error) {
      console.error("Queue message failed", error);
      message.retry();
    }
  }
}

async function handleIngestTask(payload, env) {
  const photo = await env.DB.prepare(
    "SELECT id, r2_key, original_name FROM photos WHERE id = ?1 LIMIT 1"
  )
    .bind(payload.photoId)
    .first();

  if (!photo) {
    throw new Error(`Photo ${payload.photoId} not found`);
  }

  await env.DB.prepare(
    "UPDATE photos SET status = 'indexing', error_message = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?1"
  )
    .bind(photo.id)
    .run();

  try {
    const dbName = getAlibabaDbName(env);
    const entityId = buildAlibabaEntityId(photo.id);
    const imageUrl = await prepareAlibabaImageUrl(photo.r2_key, env);

    await callAlibabaRpc(
      "AddFaceEntity",
      {
        DbName: dbName,
        EntityId: entityId,
      },
      env,
      {
        ignoreErrors: ["already", "exist"],
      }
    );

    await callAlibabaRpc(
      "AddFace",
      {
        DbName: dbName,
        EntityId: entityId,
        ImageUrl: imageUrl,
        ExtraData: photo.original_name,
      },
      env
    );

    await env.DB.prepare(
      "UPDATE photos SET status = 'indexed', vector_id = ?2, indexed_at = CURRENT_TIMESTAMP, error_message = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?1"
    )
      .bind(photo.id, entityId)
      .run();
  } catch (error) {
    await env.DB.prepare(
      "UPDATE photos SET status = 'failed', error_message = ?2, updated_at = CURRENT_TIMESTAMP WHERE id = ?1"
    )
      .bind(photo.id, error instanceof Error ? error.message : String(error))
      .run();
    throw error;
  }
}

async function handleSearchTask(payload, env) {
  const task = await env.DB.prepare(
    "SELECT id, selfie_key FROM search_tasks WHERE id = ?1 LIMIT 1"
  )
    .bind(payload.taskId)
    .first();

  if (!task) {
    throw new Error(`Search task ${payload.taskId} not found`);
  }

  await env.DB.prepare(
    "UPDATE search_tasks SET status = 'processing', error_message = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?1"
  )
    .bind(task.id)
    .run();

  try {
    const imageUrl = await prepareAlibabaImageUrl(task.selfie_key, env);
    const response = await callAlibabaRpc(
      "SearchFace",
      {
        DbName: getAlibabaDbName(env),
        DbNames: getAlibabaDbName(env),
        ImageUrl: imageUrl,
        Limit: env.ALIBABA_SEARCH_LIMIT || "12",
        MaxFaceNum: env.ALIBABA_MAX_FACES || "1",
        QualityScoreThreshold: env.ALIBABA_QUALITY_SCORE_THRESHOLD || "50",
      },
      env
    );
    const matchedEntityIds = extractAlibabaMatches(response, env).map((match) => match.entityId);

    const photos = matchedEntityIds.length ? await fetchPhotosByEntityIds(matchedEntityIds, env) : [];
    const photoByEntityId = new Map(photos.map((photo) => [photo.vector_id, photo]));
    const orderedPhotos = matchedEntityIds.map((entityId) => photoByEntityId.get(entityId)).filter(Boolean);
    const matchedUrls = orderedPhotos.map((photo) => buildPhotoFileUrl(photo.id));

    await env.DB.prepare(
      "UPDATE search_tasks SET status = 'completed', match_count = ?2, matched_photo_ids = ?3, matched_urls = ?4, completed_at = CURRENT_TIMESTAMP, error_message = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?1"
    )
      .bind(
        task.id,
        orderedPhotos.length,
        JSON.stringify(orderedPhotos.map((photo) => photo.id)),
        JSON.stringify(matchedUrls)
      )
      .run();
  } catch (error) {
    await env.DB.prepare(
      "UPDATE search_tasks SET status = 'failed', error_message = ?2, updated_at = CURRENT_TIMESTAMP WHERE id = ?1"
    )
      .bind(task.id, error instanceof Error ? error.message : String(error))
      .run();
    throw error;
  }
}

async function prepareAlibabaImageUrl(r2Key, env) {
  const object = await env.PHOTO_BUCKET.get(r2Key);
  if (!object) {
    throw new Error(`R2 object ${r2Key} was not found`);
  }

  const contentType = object.httpMetadata?.contentType || "application/octet-stream";
  const extension = extensionFromContentTypeOrKey(contentType, r2Key);
  const body = await object.arrayBuffer();
  const sts = await getViapiOssStsToken(env);
  const objectKey = `${env.ALIBABA_ACCESS_KEY_ID}/${crypto.randomUUID()}/image.${extension}`;

  await putViapiTempObject({
    accessKeyId: sts.accessKeyId,
    accessKeySecret: sts.accessKeySecret,
    securityToken: sts.securityToken,
    body,
    contentType,
    objectKey,
  });

  return `http://viapi-customer-temp.oss-cn-shanghai.aliyuncs.com/${objectKey
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

async function deletePhotoAssets(photo, env) {
  if (photo.vector_id) {
    await callAlibabaRpc(
      "DeleteFaceEntity",
      {
        DbName: getAlibabaDbName(env),
        EntityId: photo.vector_id,
      },
      env,
      {
        ignoreErrors: ["not exist", "not found", "deleted"],
      }
    );
  }

  if (photo.r2_key) {
    await env.PHOTO_BUCKET.delete(photo.r2_key);
  }
}

async function getViapiOssStsToken(env) {
  const response = await callAlibabaRpc(
    "GetOssStsToken",
    {},
    env,
    {
      endpoint: "https://viapiutils.cn-shanghai.aliyuncs.com",
      version: "2020-04-01",
    }
  );
  const flat = flattenObject(response);
  const accessKeyId = flat.AccessKeyId || flat.accessKeyId;
  const accessKeySecret = flat.AccessKeySecret || flat.accessKeySecret;
  const securityToken = flat.SecurityToken || flat.securityToken;

  if (!accessKeyId || !accessKeySecret || !securityToken) {
    throw new Error("GetOssStsToken did not return a complete OSS STS credential");
  }

  return {
    accessKeyId,
    accessKeySecret,
    securityToken,
  };
}

async function putViapiTempObject({ accessKeyId, accessKeySecret, securityToken, body, contentType, objectKey }) {
  const bucket = "viapi-customer-temp";
  const host = `${bucket}.oss-cn-shanghai.aliyuncs.com`;
  const date = new Date().toUTCString();
  const resource = `/${bucket}/${objectKey}`;
  const ossHeaders = {
    "x-oss-security-token": securityToken,
  };
  const canonicalizedOssHeaders = Object.entries(ossHeaders)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}:${value}\n`)
    .join("");
  const stringToSign = ["PUT", "", contentType, date, `${canonicalizedOssHeaders}${resource}`].join("\n");
  const signature = await signString(stringToSign, `${accessKeySecret}`);
  const encodedKey = objectKey.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(`https://${host}/${encodedKey}`, {
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
    throw new Error(`VIAPI temp OSS upload failed: ${text || response.statusText}`);
  }
}

async function callAlibabaRpc(action, extraParams, env, options = {}) {
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

  const canonicalQuery = buildCanonicalQuery(params);
  const stringToSign = `POST&${strictEncode("/")}&${strictEncode(canonicalQuery)}`;
  const signature = await signString(stringToSign, `${env.ALIBABA_ACCESS_KEY_SECRET}&`);
  endpoint.search = `${canonicalQuery}&Signature=${strictEncode(signature)}`;

  const response = await fetch(endpoint.toString(), {
    method: "POST",
    headers: jsonHeaders,
  });
  const text = await response.text();
  let data;

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!response.ok || data.Code || data.code) {
    const message = data.Message || data.message || text || response.statusText;
    const lower = String(message).toLowerCase();
    const ignored = (options.ignoreErrors || []).some((pattern) => lower.includes(String(pattern).toLowerCase()));
    if (!ignored) {
      throw new Error(message);
    }
  }

  return data;
}

async function fetchPhotosByIds(photoIds, env) {
  const statements = photoIds.map((photoId) =>
    env.DB.prepare(
      "SELECT p.id, p.class_id, c.name AS class_name, p.original_name, p.r2_key, p.content_type, p.size_bytes FROM photos p LEFT JOIN photo_classes c ON c.id = p.class_id WHERE p.id = ?1 LIMIT 1"
    ).bind(photoId)
  );
  const results = await env.DB.batch(statements);

  return results
    .map((result) => result.results?.[0])
    .filter(Boolean);
}

async function fetchPhotosByEntityIds(entityIds, env) {
  const statements = entityIds.map((entityId) =>
    env.DB.prepare(
      "SELECT p.id, p.vector_id, p.class_id, c.name AS class_name, p.original_name, p.r2_key, p.content_type, p.size_bytes FROM photos p INNER JOIN photo_classes c ON c.id = p.class_id AND c.is_open = 1 WHERE p.vector_id = ?1 LIMIT 1"
    ).bind(entityId)
  );
  const results = await env.DB.batch(statements);

  return results
    .map((result) => result.results?.[0])
    .filter(Boolean);
}

async function streamAssetByKey(key, env, extraHeaders = {}) {
  const object = await env.PHOTO_BUCKET.get(key);

  if (!object) {
    return jsonResponse({ error: "Asset not found" }, 404);
  }

  const headers = new Headers(extraHeaders);
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=3600");

  return new Response(object.body, {
    status: 200,
    headers,
  });
}

function parseMessageBody(body) {
  if (typeof body === "string") {
    return JSON.parse(body);
  }

  return body;
}

function extractFiles(formData, fieldName) {
  const preferred = formData.getAll(fieldName).filter((value) => value instanceof File);
  if (preferred.length) {
    return preferred;
  }

  return [...formData.values()].filter((value) => value instanceof File);
}

function buildObjectKey(prefix, filename, seed) {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const extension = filename.includes(".") ? filename.split(".").pop() : "bin";

  return `${prefix}/${year}/${month}/${day}/${seed}.${sanitizeExtension(extension)}`;
}

function sanitizeExtension(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
}

function sanitizeFilename(value) {
  return String(value).replace(/[^a-zA-Z0-9._ -]/g, "_");
}

function decodeR2Key(value) {
  return value
    .split("/")
    .map((segment) => decodeURIComponent(segment))
    .join("/");
}

function buildAssetProxyUrl(objectKey, origin = null) {
  const base = (origin || "").replace(/\/$/, "");
  if (!base) {
    throw new Error("A public origin is required to build asset URLs for Alibaba callbacks");
  }
  const encoded = objectKey.split("/").map(encodeURIComponent).join("/");
  return `${base}/api/assets/${encoded}`;
}

function buildPhotoFileUrl(photoId, origin = null) {
  const base = (origin || "").replace(/\/$/, "");
  return base ? `${base}/api/photos/${photoId}/file` : `/api/photos/${photoId}/file`;
}

function configuredOrigin(env) {
  return (env.PUBLIC_APP_ORIGIN || "").replace(/\/$/, "");
}

async function requireUser(request, env) {
  const user = await getSessionUser(request, env);
  if (!user) {
    throw new HttpError("Authentication required", 401);
  }
  return user;
}

async function requireAdmin(request, env) {
  const user = await requireUser(request, env);
  if (user.role !== "admin") {
    throw new HttpError("Admin only", 403);
  }
  return user;
}

async function requireBoundUser(request, env) {
  const user = await requireUser(request, env);
  if (!user.auth_uuid) {
    throw new HttpError("Aryuki Auth Center binding required", 403);
  }
  return user;
}

async function getSessionUser(request, env) {
  const sid = getCookie(request, "pd_session");
  if (!sid) {
    return null;
  }

  const user = await env.DB.prepare(
    "SELECT u.* FROM app_sessions s INNER JOIN app_users u ON u.id = s.user_id WHERE s.id = ?1 AND s.expires_at > CURRENT_TIMESTAMP LIMIT 1"
  )
    .bind(sid)
    .first();

  if (user) {
    await env.DB.prepare("UPDATE app_users SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?1").bind(user.id).run();
  }

  return user || null;
}

async function createSession(env, userId) {
  const sid = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare("INSERT INTO app_sessions (id, user_id, expires_at) VALUES (?1, ?2, ?3)")
    .bind(sid, userId, expiresAt)
    .run();
  return sid;
}

function sessionCookie(sid) {
  return `pd_session=${sid}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=1209600`;
}

function clearSessionCookie() {
  return "pd_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
}

function getCookie(request, name) {
  const cookie = request.headers.get("cookie") || "";
  const found = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : "";
}

async function verifyAuthToken(token, env) {
  const response = await fetch(`${getAuthOrigin(env)}/api/verify?app_id=${encodeURIComponent(getAppId(env))}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    throw new HttpError(data.error || data.message || text || "SSO verification failed", response.status);
  }
  return data;
}

function normalizeVerifiedUser(verified, token) {
  const payload = decodeJwtPayload(token);
  const user = verified.user || verified || {};
  return {
    uuid: user.uuid || payload.uuid,
    user_id: user.user_id || payload.user_id || null,
    name: user.name || payload.name || user.username || payload.username || "Aryuki User",
    username: user.username || payload.username || "",
    avatar_url: user.avatar_url || payload.avatar_url || "",
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

function isAdminUser(user, env) {
  const allowed = String(env.ADMIN_USERNAMES || "admin")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(String(user.username || "").toLowerCase()) || allowed.includes(String(user.name || "").toLowerCase());
}

function publicUser(user) {
  return {
    id: user.id,
    kind: user.kind,
    role: user.role,
    authUuid: user.auth_uuid,
    name: user.name,
    username: user.username,
    avatarUrl: user.avatar_url,
    authCenterUrl: user.auth_uuid ? `${getStaticAuthOrigin()}/${user.auth_uuid}` : "",
  };
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

async function safeJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function shortId() {
  return crypto.randomUUID().split("-")[0];
}

function randomAmericanName() {
  const first = ["James", "Olivia", "Liam", "Emma", "Noah", "Ava", "Ethan", "Mia", "Lucas", "Sophia", "Mason", "Amelia", "Logan", "Harper", "Caleb", "Grace"];
  const last = ["Miller", "Johnson", "Parker", "Bennett", "Carter", "Reed", "Morgan", "Hayes", "Brooks", "Collins", "Turner", "Cooper", "Bailey", "Foster", "Ward", "Sullivan"];
  return `${first[Math.floor(Math.random() * first.length)]} ${last[Math.floor(Math.random() * last.length)]}`;
}

class HttpError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function getAlibabaDbName(env) {
  return env.ALIBABA_DB_NAME || "default";
}

function buildAlibabaEntityId(photoId) {
  return `p_${String(photoId).replace(/[^A-Za-z0-9_]/g, "_")}`.slice(0, 64);
}

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function extensionFromContentTypeOrKey(contentType, key) {
  if (contentType.includes("png")) {
    return "png";
  }
  if (contentType.includes("webp")) {
    return "webp";
  }
  if (contentType.includes("gif")) {
    return "gif";
  }
  const extension = key.includes(".") ? key.split(".").pop() : "jpg";
  return sanitizeExtension(extension || "jpg");
}

function flattenObject(value, out = {}) {
  if (!value || typeof value !== "object") {
    return out;
  }

  for (const [key, child] of Object.entries(value)) {
    if (child && typeof child === "object" && !Array.isArray(child)) {
      flattenObject(child, out);
    } else {
      out[key] = child;
    }
  }

  return out;
}

function buildCanonicalQuery(params) {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${strictEncode(key)}=${strictEncode(String(value))}`)
    .join("&");
}

function strictEncode(value) {
  return encodeURIComponent(value)
    .replace(/\+/g, "%20")
    .replace(/\*/g, "%2A")
    .replace(/%7E/g, "~");
}

async function signString(value, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return arrayBufferToBase64(signature);
}

function arrayBufferToBase64(buffer) {
  let binary = "";
  for (const value of new Uint8Array(buffer)) {
    binary += String.fromCharCode(value);
  }
  return btoa(binary);
}

function walkPayload(value, visitor) {
  visitor(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      walkPayload(item, visitor);
    }
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  for (const child of Object.values(value)) {
    walkPayload(child, visitor);
  }
}

function extractEntityIds(payload) {
  const values = [];

  walkPayload(payload, (value) => {
    if (!value || typeof value !== "object") {
      return;
    }

    for (const [key, child] of Object.entries(value)) {
      const normalized = key.toLowerCase();
      if (normalized === "entityid") {
        values.push(String(child));
      }
    }
  });

  return [...new Set(values.filter(Boolean))];
}

function extractAlibabaMatches(payload, env) {
  const scoreThreshold = toFiniteNumber(env.ALIBABA_SCORE_THRESHOLD, 0.6);
  const confidenceThreshold = toFiniteNumber(env.ALIBABA_CONFIDENCE_THRESHOLD, 72.62);
  const deduped = new Map();

  walkPayload(payload, (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return;
    }

    const entityId = readCaseInsensitive(value, "EntityId");
    const score = toFiniteNumber(readCaseInsensitive(value, "Score"), null);
    const confidence = toFiniteNumber(readCaseInsensitive(value, "Confidence"), null);

    if (!entityId || (score === null && confidence === null)) {
      return;
    }

    if (score !== null && score < scoreThreshold) {
      return;
    }

    if (confidence !== null && confidence < confidenceThreshold) {
      return;
    }

    const normalizedEntityId = String(entityId);
    const next = {
      entityId: normalizedEntityId,
      score: score === null ? -1 : score,
      confidence: confidence === null ? -1 : confidence,
    };
    const current = deduped.get(normalizedEntityId);

    if (
      !current ||
      next.confidence > current.confidence ||
      (next.confidence === current.confidence && next.score > current.score)
    ) {
      deduped.set(normalizedEntityId, next);
    }
  });

  return [...deduped.values()].sort((left, right) => {
    if (right.confidence !== left.confidence) {
      return right.confidence - left.confidence;
    }
    return right.score - left.score;
  });
}

function readCaseInsensitive(value, key) {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const normalizedKey = String(key).toLowerCase();
  for (const [entryKey, entryValue] of Object.entries(value)) {
    if (entryKey.toLowerCase() === normalizedKey) {
      return entryValue;
    }
  }

  return undefined;
}

function toFiniteNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: jsonHeaders,
  });
}

function htmlResponse(payload, status = 200) {
  return new Response(payload, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  });
}

function withCors(response) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders)) {
    headers.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    headers,
  });
}
