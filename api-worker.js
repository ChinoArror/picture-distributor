import { handleQueueBatch } from "./consumer-worker.js";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type",
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);

    try {
      if (request.method === "POST" && url.pathname === "/api/admin/photos") {
        return withCors(await handleAdminUpload(request, env));
      }

      if (request.method === "POST" && url.pathname === "/api/search") {
        return withCors(await handleSearchUpload(request, env));
      }

      if (request.method === "GET" && url.pathname.startsWith("/api/status/")) {
        const taskId = url.pathname.replace("/api/status/", "");
        return withCors(await handleTaskStatus(taskId, env));
      }

      if (request.method === "GET" && url.pathname.startsWith("/api/photos/") && url.pathname.endsWith("/file")) {
        const photoId = url.pathname.replace("/api/photos/", "").replace("/file", "").replace(/\/$/, "");
        return withCors(await handlePhotoStream(photoId, env));
      }

      if (request.method === "GET" && url.pathname.startsWith("/api/assets/")) {
        const key = decodeURIComponent(url.pathname.replace("/api/assets/", ""));
        return withCors(await streamAssetByKey(key, env));
      }

      return withCors(jsonResponse({ error: "Not Found" }, 404));
    } catch (error) {
      console.error("API request failed", error);
      return withCors(
        jsonResponse(
          { error: error instanceof Error ? error.message : "Unexpected error" },
          500
        )
      );
    }
  },

  async queue(batch, env, ctx) {
    return handleQueueBatch(batch, env, ctx);
  },
};

async function handleAdminUpload(request, env) {
  const formData = await request.formData();
  const files = extractFiles(formData, "photos");

  if (!files.length) {
    return jsonResponse({ error: "No photos were uploaded" }, 400);
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
      },
    });

    rows.push({
      id: photoId,
      r2Key: objectKey,
      originalName: file.name,
      contentType: file.type || "application/octet-stream",
      sizeBytes: file.size,
    });
  }

  const inserts = rows.map((row) =>
    env.DB.prepare(
      "INSERT INTO photos (id, r2_key, original_name, content_type, size_bytes, status) VALUES (?1, ?2, ?3, ?4, ?5, 'uploaded')"
    ).bind(row.id, row.r2Key, row.originalName, row.contentType, row.sizeBytes)
  );
  await env.DB.batch(inserts);

  await Promise.all(
    rows.map((row) =>
      env.INGEST_QUEUE.send({
        type: "photo.ingest",
        photoId: row.id,
        r2Key: row.r2Key,
      })
    )
  );

  return jsonResponse({
    uploaded: rows.length,
    photos: rows,
  });
}

async function handleSearchUpload(request, env) {
  const formData = await request.formData();
  const selfie = formData.get("selfie");

  if (!(selfie instanceof File)) {
    return jsonResponse({ error: "A selfie file is required" }, 400);
  }

  const taskId = crypto.randomUUID();
  const objectKey = buildObjectKey("selfies", selfie.name, taskId);

  await env.PHOTO_BUCKET.put(objectKey, selfie.stream(), {
    httpMetadata: {
      contentType: selfie.type || "application/octet-stream",
    },
  });

  await env.DB.prepare(
    "INSERT INTO search_tasks (id, selfie_key, status) VALUES (?1, ?2, 'pending')"
  )
    .bind(taskId, objectKey)
    .run();

  await env.SEARCH_QUEUE.send({
    type: "search.run",
    taskId,
    selfieKey: objectKey,
  });

  return jsonResponse({
    taskId,
    status: "pending",
  });
}

async function handleTaskStatus(taskId, env) {
  const task = await env.DB.prepare(
    "SELECT id, status, match_count, matched_photo_ids, matched_urls, error_message, created_at, updated_at, completed_at FROM search_tasks WHERE id = ?1 LIMIT 1"
  )
    .bind(taskId)
    .first();

  if (!task) {
    return jsonResponse({ error: "Task not found" }, 404);
  }

  const matchedPhotoIds = parseJsonArray(task.matched_photo_ids);
  const matchedUrls = parseJsonArray(task.matched_urls);
  const photos = matchedPhotoIds.length ? await fetchPhotoMetadata(matchedPhotoIds, env) : [];

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
        url: matchedUrls[index] || buildFallbackPhotoUrl(requestOrigin(env), photo.id),
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

async function fetchPhotoMetadata(photoIds, env) {
  const statements = photoIds.map((photoId) =>
    env.DB.prepare(
      "SELECT id, original_name, content_type, size_bytes FROM photos WHERE id = ?1 LIMIT 1"
    ).bind(photoId)
  );
  const results = await env.DB.batch(statements);

  return results
    .map((result) => result.results?.[0])
    .filter(Boolean);
}

function extractFiles(formData, expectedFieldName) {
  const preferred = formData.getAll(expectedFieldName).filter((value) => value instanceof File);
  if (preferred.length) {
    return preferred;
  }

  return [...formData.values()].filter((value) => value instanceof File);
}

function buildObjectKey(prefix, filename, seed) {
  const date = new Date();
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const extension = filename.includes(".") ? filename.split(".").pop() : "bin";

  return `${prefix}/${year}/${month}/${day}/${seed}.${sanitizeExtension(extension)}`;
}

function sanitizeExtension(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
}

function sanitizeFilename(value) {
  return String(value).replace(/[^a-zA-Z0-9.\-_ ]/g, "_");
}

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function requestOrigin(env) {
  return (env.PUBLIC_APP_ORIGIN || "").replace(/\/$/, "");
}

function buildFallbackPhotoUrl(origin, photoId) {
  return origin ? `${origin}/api/photos/${photoId}/file` : `/api/photos/${photoId}/file`;
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
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
