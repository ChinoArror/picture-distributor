const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
};

export async function handleQueueBatch(batch, env) {
  for (const message of batch.messages) {
    try {
      const payload = parseMessageBody(message.body);

      switch (payload.type) {
        case "photo.ingest":
          await handleIngestTask(payload, env);
          break;
        case "search.run":
          await handleSearchTask(payload, env);
          break;
        default:
          throw new Error(`Unsupported queue message type: ${payload.type}`);
      }

      message.ack();
    } catch (error) {
      console.error("Queue message failed", error);
      message.retry();
    }
  }
}

function parseMessageBody(body) {
  if (typeof body === "string") {
    return JSON.parse(body);
  }

  return body;
}

async function handleIngestTask(payload, env) {
  const photo = await env.DB.prepare(
    "SELECT id, r2_key FROM photos WHERE id = ?1 LIMIT 1"
  )
    .bind(payload.photoId)
    .first();

  if (!photo) {
    throw new Error(`Photo ${payload.photoId} not found`);
  }

  await env.DB.prepare(
    "UPDATE photos SET status = 'indexing', error_message = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?1"
  )
    .bind(payload.photoId)
    .run();

  try {
    const imageUrl = buildAlibabaAccessibleUrl(env, photo.r2_key);
    const entityId = photo.id;

    const response = await callAlibabaFaceRpc(
      "AddFace",
      {
        DbName: env.ALIBABA_FACE_DB,
        EntityId: entityId,
        ImageUrl: imageUrl,
        ImageURL: imageUrl,
      },
      env
    );

    const faceIds = extractFaceIds(response);

    await env.DB.prepare("DELETE FROM face_map WHERE photo_id = ?1")
      .bind(photo.id)
      .run();

    if (!faceIds.length) {
      throw new Error("Alibaba AddFace succeeded but returned no face identifiers");
    }

    const inserts = faceIds.map((faceId) =>
      env.DB.prepare(
        "INSERT INTO face_map (photo_id, entity_id, face_id) VALUES (?1, ?2, ?3)"
      ).bind(photo.id, entityId, faceId)
    );

    await env.DB.batch(inserts);

    await env.DB.prepare(
      "UPDATE photos SET status = 'indexed', face_entity_id = ?2, indexed_at = CURRENT_TIMESTAMP, error_message = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?1"
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
    const imageUrl = buildAlibabaAccessibleUrl(env, task.selfie_key);
    const response = await callAlibabaFaceRpc(
      "SearchFace",
      {
        DbName: env.ALIBABA_FACE_DB,
        ImageUrl: imageUrl,
        ImageURL: imageUrl,
        Limit: env.ALIBABA_SEARCH_LIMIT || "40",
      },
      env
    );

    const entityIds = extractEntityIds(response);
    const faceIds = extractFaceIds(response);
    const resolvedPhotoIds = await resolvePhotoIds(entityIds, faceIds, env);
    const photos = resolvedPhotoIds.length
      ? await fetchPhotos(resolvedPhotoIds, env)
      : [];
    const matchedUrls = photos.map((photo) => buildDownloadUrl(env, photo));

    await env.DB.prepare(
      "UPDATE search_tasks SET status = 'completed', match_count = ?2, matched_photo_ids = ?3, matched_urls = ?4, completed_at = CURRENT_TIMESTAMP, error_message = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?1"
    )
      .bind(
        task.id,
        photos.length,
        JSON.stringify(photos.map((photo) => photo.id)),
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

async function resolvePhotoIds(entityIds, faceIds, env) {
  const found = new Set();

  for (const entityId of entityIds) {
    if (entityId) {
      found.add(entityId);
    }
  }

  if (!found.size && faceIds.length) {
    const lookupStatements = faceIds.map((faceId) =>
      env.DB.prepare("SELECT photo_id FROM face_map WHERE face_id = ?1 LIMIT 1").bind(faceId)
    );
    const lookupResults = await env.DB.batch(lookupStatements);

    for (const result of lookupResults) {
      const row = result.results?.[0];
      if (row?.photo_id) {
        found.add(row.photo_id);
      }
    }
  }

  return [...found];
}

async function fetchPhotos(photoIds, env) {
  const statements = photoIds.map((photoId) =>
    env.DB.prepare(
      "SELECT id, original_name, r2_key, content_type, size_bytes FROM photos WHERE id = ?1 LIMIT 1"
    ).bind(photoId)
  );
  const results = await env.DB.batch(statements);

  return results
    .map((result) => result.results?.[0])
    .filter(Boolean);
}

function buildDownloadUrl(env, photo) {
  if (env.PUBLIC_R2_BASE_URL) {
    return `${env.PUBLIC_R2_BASE_URL.replace(/\/$/, "")}/${photo.r2_key
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`;
  }

  const origin = (env.PUBLIC_APP_ORIGIN || "").replace(/\/$/, "");
  if (!origin) {
    return `/api/photos/${photo.id}/file`;
  }

  return `${origin}/api/photos/${photo.id}/file`;
}

function buildAlibabaAccessibleUrl(env, objectKey) {
  const origin = (env.PUBLIC_APP_ORIGIN || "").replace(/\/$/, "");
  if (!origin) {
    throw new Error("PUBLIC_APP_ORIGIN is required so Alibaba Cloud can fetch worker-hosted image URLs");
  }

  return `${origin}/api/assets/${objectKey
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

async function callAlibabaFaceRpc(action, extraParams, env) {
  const endpoint = new URL(env.ALIBABA_FACE_ENDPOINT || "https://facebody.cn-shanghai.aliyuncs.com/");
  const params = {
    AccessKeyId: env.ALIBABA_ACCESS_KEY_ID,
    Action: action,
    Format: "JSON",
    RegionId: env.ALIBABA_REGION_ID || "cn-shanghai",
    SignatureMethod: "HMAC-SHA1",
    SignatureNonce: crypto.randomUUID(),
    SignatureVersion: "1.0",
    Timestamp: new Date().toISOString(),
    Version: env.ALIBABA_API_VERSION || "2019-12-30",
    ...extraParams,
  };

  if (!params.AccessKeyId || !env.ALIBABA_ACCESS_KEY_SECRET) {
    throw new Error("Alibaba Cloud secrets are missing");
  }

  const canonicalQuery = buildCanonicalQuery(params);
  const stringToSign = `POST&${strictEncode("/")}&${strictEncode(canonicalQuery)}`;
  const signature = await signString(stringToSign, `${env.ALIBABA_ACCESS_KEY_SECRET}&`);
  endpoint.search = `${canonicalQuery}&Signature=${strictEncode(signature)}`;

  const response = await fetch(endpoint.toString(), {
    method: "POST",
    headers: jsonHeaders,
  });

  const body = await response.text();
  let parsed;

  try {
    parsed = body ? JSON.parse(body) : {};
  } catch {
    parsed = { raw: body };
  }

  if (!response.ok || parsed.Code || parsed.code) {
    throw new Error(
      `Alibaba ${action} failed: ${parsed.Message || parsed.message || body || response.statusText}`
    );
  }

  return parsed;
}

function buildCanonicalQuery(params) {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([a], [b]) => a.localeCompare(b))
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
  const bytes = new Uint8Array(buffer);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function extractFaceIds(payload) {
  const values = [];
  walkPayload(payload, (key, value) => {
    const normalizedKey = key.toLowerCase();
    if (normalizedKey === "faceid" || normalizedKey === "faceids") {
      if (Array.isArray(value)) {
        values.push(...value);
      } else if (value) {
        values.push(value);
      }
    }
  });

  return [...new Set(values.filter(Boolean).map(String))];
}

function extractEntityIds(payload) {
  const values = [];
  walkPayload(payload, (key, value) => {
    const normalizedKey = key.toLowerCase();
    if (normalizedKey === "entityid" || normalizedKey === "entityids") {
      if (Array.isArray(value)) {
        values.push(...value);
      } else if (value) {
        values.push(value);
      }
    }
  });

  return [...new Set(values.filter(Boolean).map(String))];
}

function walkPayload(value, visitor, parentKey = "") {
  if (Array.isArray(value)) {
    for (const item of value) {
      walkPayload(item, visitor, parentKey);
    }
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    visitor(key, child, parentKey);
    walkPayload(child, visitor, key);
  }
}
