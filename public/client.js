const jsonHeaders = { "content-type": "application/json" };

export class ApiError extends Error {
  constructor(message, status = 0, details = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export async function request(path, options = {}) {
  const { json, timeout = 30_000, ...fetchOptions } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const signal = options.signal || controller.signal;
  try {
    const response = await fetch(path, {
      credentials: "same-origin",
      ...fetchOptions,
      signal,
      headers: json === undefined
        ? fetchOptions.headers
        : { ...jsonHeaders, ...fetchOptions.headers },
      body: json === undefined ? fetchOptions.body : JSON.stringify(json),
    });
    const type = response.headers.get("content-type") || "";
    const payload = type.includes("json")
      ? await response.json().catch(() => ({}))
      : await response.text().catch(() => "");
    if (!response.ok) {
      const message = payload?.error || payload?.message || `请求失败（${response.status}）`;
      throw new ApiError(message, response.status, payload);
    }
    return payload;
  } catch (error) {
    if (error.name === "AbortError") throw new ApiError("请求超时，请稍后重试。", 408);
    if (error instanceof ApiError) throw error;
    throw new ApiError("无法连接服务器，请检查网络后重试。", 0, error);
  } finally {
    clearTimeout(timer);
  }
}

const id = (value) => encodeURIComponent(String(value));
const query = (value) => encodeURIComponent(String(value || ""));
const uploadRangeQuery = (range = {}) => {
  const params = new URLSearchParams();
  if (range.all) params.set("all", "1");
  else {
    if (range.from) params.set("from", range.from);
    if (range.to) params.set("to", range.to);
  }
  return params.toString();
};

export const Client = {
  me: () => request("/api/me"),
  loginUrl: (mode = "bind", next = location.pathname) =>
    request(`/api/auth/login-url?mode=${query(mode)}&next=${query(next)}`),
  temporarySession: () => request("/api/auth/temp", { method: "POST" }),
  logout: () => request("/api/logout", { method: "POST" }),

  searchClasses: (value) => request(`/api/class-search?q=${query(value)}`),
  history: () => request("/api/history"),
  recentSearches: () => request("/api/class-search-history"),
  saveSearchHistory: (entry) => request("/api/class-search-history", { method: "POST", json: entry }),
  deleteHistory: (type, historyId) =>
    request(`/api/history/${id(type)}/${id(historyId)}`, { method: "DELETE" }),

  startFaceSearch(file) {
    const body = new FormData();
    body.append("selfie", file);
    return request("/api/search", { method: "POST", body, timeout: 60_000 });
  },
  searchStatus: (taskId) => request(`/api/status/${id(taskId)}`),

  classes: (scope = "accessible") => request(`/api/classes?scope=${query(scope)}`),
  classPhotos: (classId) => request(`/api/classes/${id(classId)}/photos`),
  createClass: (data) => request("/api/classes", { method: "POST", json: data }),
  updateClass: (classId, data) =>
    request(`/api/classes/${id(classId)}`, { method: "PATCH", json: data }),
  deleteClass: (classId) =>
    request(`/api/classes/${id(classId)}`, { method: "DELETE" }),
  async uploadPhotos(classId, files, onProgress = () => {}) {
    const body = new FormData();
    body.append("class_id", classId);
    for (const file of files) body.append("photos", file);
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `/api/classes/${id(classId)}/photos`);
      xhr.timeout = 15 * 60_000;
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
      });
      xhr.addEventListener("load", () => {
        let payload = {};
        try {
          payload = xhr.responseText ? JSON.parse(xhr.responseText) : {};
        } catch {
          payload = xhr.responseText || {};
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress(100);
          resolve(payload);
        } else {
          reject(new ApiError(payload?.error || payload?.message || `Request failed (${xhr.status})`, xhr.status, payload));
        }
      });
      xhr.addEventListener("error", () => reject(new ApiError("Unable to reach the server.", 0)));
      xhr.addEventListener("timeout", () => reject(new ApiError("上传等待时间过长，请检查网络后重试。", 408)));
      xhr.send(body);
    });
  },
  deletePhoto: (photoId) =>
    request(`/api/photos/${id(photoId)}`, { method: "DELETE" }),

  storage: () => request("/api/storage"),
  saved: () => request("/api/saved"),
  savePhoto: (photoId) => request(`/api/saved/photos/${id(photoId)}`, { method: "POST" }),
  saveClass: (classId) => request(`/api/saved/classes/${id(classId)}`, { method: "POST" }),
  removeSavedPhoto: (photoId) => request(`/api/saved/photos/${id(photoId)}`, { method: "DELETE" }),
  removeSavedClass: (classId) => request(`/api/saved/classes/${id(classId)}`, { method: "DELETE" }),

  shareLinks: (includeContent = false) =>
    request(`/api/share-links${includeContent ? "?include=content" : ""}`),
  shareLink: (shareId) => request(`/api/share-links/${id(shareId)}`),
  createShareLink: (data) => request("/api/share-links", { method: "POST", json: data }),
  updateShareLink: (shareId, data) =>
    request(`/api/share-links/${id(shareId)}`, { method: "PATCH", json: data }),
  deleteShareLink: (shareId) =>
    request(`/api/share-links/${id(shareId)}`, { method: "DELETE" }),
  publicShare: (slug) => request(`/api/public/shares/${id(slug)}`),
  unlockShare: (slug, password) =>
    request(`/api/public/shares/${id(slug)}/unlock`, { method: "POST", json: { password } }),

  adminOverview: () => request("/api/admin/overview"),
  adminUploads: (range = {}) => request(`/api/admin/uploads?${uploadRangeQuery(range)}`),
  adminUploadRecords: (key, range = {}) =>
    request(`/api/admin/uploads/records?key=${query(key)}&${uploadRangeQuery(range)}`),
  imageProcessing: () => request("/api/admin/image-processing"),
  updateImageProcessing: (enabled) =>
    request("/api/admin/image-processing", { method: "PATCH", json: { enabled } }),
  adminAudit: () => request("/api/admin/audit"),
  adminClasses: () => request("/api/admin/classes"),
  retryIngest: (limit = 100) =>
    request(`/api/admin/retry-ingest?limit=${id(limit)}`, { method: "POST" }),
  users: () => request("/api/admin/users"),
  updateUser: (userId, data) =>
    request(`/api/admin/users/${id(userId)}`, { method: "PATCH", json: data }),
  roles: () => request("/api/admin/roles"),
  createRole: (data) => request("/api/admin/roles", { method: "POST", json: data }),
  updateRole: (roleId, data) =>
    request(`/api/admin/roles/${id(roleId)}`, { method: "PATCH", json: data }),
  deleteRole: (roleId) => request(`/api/admin/roles/${id(roleId)}`, { method: "DELETE" }),
  forceDeleteClass: (classId) =>
    request(`/api/admin/classes/${id(classId)}?force=1`, { method: "DELETE" }),
  forceDeletePhoto: (photoId) =>
    request(`/api/admin/photos/${id(photoId)}?force=1`, { method: "DELETE" }),

  background: () => request("/api/background"),
  setBackgroundMode: (mode) =>
    request("/api/background/mode", { method: "POST", json: { mode } }),
  saveBackground(original, cropped) {
    const body = new FormData();
    if (original) body.append("original", original);
    body.append("cropped", cropped);
    return request("/api/background", { method: "POST", body, timeout: 60_000 });
  },
  deleteBackground: () => request("/api/background", { method: "DELETE" }),
  restoreBackground: (restoreToken) =>
    request("/api/background/restore", { method: "POST", json: { restoreToken } }),
};

export function photoUrl(photo) {
  return photo?.url || photo?.file_url || photo?.fileUrl || `/api/photos/${id(photo?.id)}/file`;
}

export function photoThumbnailUrl(photo) {
  return photo?.thumbnailUrl || photo?.thumbnail_url || `/api/photos/${id(photo?.id)}/thumbnail`;
}

export function photoPreviewUrl(photo) {
  return photo?.previewUrl || photo?.preview_url || `/api/photos/${id(photo?.id)}/preview`;
}
