import { ApiError, Client, photoThumbnailUrl, photoUrl } from "./client.js";
import { dateLocale, getLocale, setLocale, translateText, watchLocale } from "./i18n.js";
import { parseSearchQuery, SEARCH_HELP, syntaxChips } from "./search-syntax.js";

const app = document.querySelector("#app");
const modalRoot = document.querySelector("#modal-root");
const toastRoot = document.querySelector("#toast-root");
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

function setPageTitle(title) {
  document.title = `${translateText(title)} · Aryuki Photo`;
}

const state = {
  user: null,
  selected: new Set(),
  activePhotos: [],
  routeVersion: 0,
  cameraStream: null,
  selfieFile: null,
  selfieUrl: "",
  suggestions: [],
  suggestionIndex: -1,
  shareLinks: [],
  shareClasses: [],
  shareLoosePhotos: [],
  shareSelection: { classIds: new Set(), photoIds: new Set() },
  expandedShareClasses: new Map(),
  dialogFocus: null,
  pageCleanup: [],
  background: null,
};

const icons = {
  camera: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m7.2 8.3 1.5-2.5h6.6l1.5 2.5H19a2.1 2.1 0 0 1 2.1 2.1v6.7a2.1 2.1 0 0 1-2.1 2.1H5a2.1 2.1 0 0 1-2.1-2.1v-6.7A2.1 2.1 0 0 1 5 8.3h2.2Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="13.3" r="3.2" stroke="currentColor" stroke-width="1.8"/></svg>',
  lens: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 4H6a2 2 0 0 0-2 2v2" stroke="#4285f4" stroke-width="2.2" stroke-linecap="round"/><path d="M16 4h2a2 2 0 0 1 2 2v2" stroke="#ea4335" stroke-width="2.2" stroke-linecap="round"/><path d="M4 16v2a2 2 0 0 0 2 2h2" stroke="#fbbc05" stroke-width="2.2" stroke-linecap="round"/><circle cx="11.5" cy="11.5" r="4.2" stroke="#4285f4" stroke-width="2"/><circle cx="18.2" cy="17.8" r="1.8" fill="#34a853"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6" stroke="currentColor" stroke-width="1.9"/><path d="m15.3 15.3 4.4 4.4" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.8"/><path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="9" cy="8" r="3.4" stroke="currentColor" stroke-width="1.8"/><path d="M3.3 19a5.7 5.7 0 0 1 11.4 0M17 10a2.8 2.8 0 0 0 0-5.6M17.4 14a5 5 0 0 1 3.3 4.7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  image: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="2.2" stroke="currentColor" stroke-width="1.8"/><path d="m5.7 17 4.4-4.2 3 2.8 2.4-2.4 2.9 3.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="16.4" cy="9" r="1.2" fill="currentColor"/></svg>',
  history: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4.3 8.2A8.4 8.4 0 1 1 3.8 15M4 4.8v4h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 7.5V12l3 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.8"/><path d="M12 2.5v2M12 19.5v2M21.5 12h-2M4.5 12h-2M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4M18.7 18.7l-1.4-1.4M6.7 6.7 5.3 5.3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 15a8 8 0 1 1-11-11 6.8 6.8 0 0 0 11 11Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m8 10 4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m4 10.8 8-6.6 8 6.6v8a1.7 1.7 0 0 1-1.7 1.7H5.7A1.7 1.7 0 0 1 4 18.8v-8Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9.2 20.4v-6.2h5.6v6.2" stroke="currentColor" stroke-width="1.8"/></svg>',
  class: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 4.2h14a1.8 1.8 0 0 1 1.8 1.8v12A1.8 1.8 0 0 1 19 19.8H5A1.8 1.8 0 0 1 3.2 18V6A1.8 1.8 0 0 1 5 4.2Z" stroke="currentColor" stroke-width="1.8"/><path d="M3.5 9h17M8 4.5V9" stroke="currentColor" stroke-width="1.8"/></svg>',
  save: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 3.8h10l2 2v14.4H6a2 2 0 0 1-2-2V5.8a2 2 0 0 1 2-2Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 3.8v5h7v-5M8 20v-6h8v6" stroke="currentColor" stroke-width="1.8"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="18" cy="5.5" r="2.5" stroke="currentColor" stroke-width="1.8"/><circle cx="6" cy="12" r="2.5" stroke="currentColor" stroke-width="1.8"/><circle cx="18" cy="18.5" r="2.5" stroke="currentColor" stroke-width="1.8"/><path d="m8.2 10.8 7.6-4.1M8.2 13.2l7.6 4.1" stroke="currentColor" stroke-width="1.8"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 21s7-3.4 7-9.6V5.5L12 3 5 5.5v5.9C5 17.6 12 21 12 21Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="m8.7 12 2.1 2.1 4.5-4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  key: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="8.5" cy="12" r="4.5" stroke="currentColor" stroke-width="1.8"/><path d="M13 12h8m-3 0v3m-3-3v2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  database: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><ellipse cx="12" cy="5.5" rx="8" ry="3" stroke="currentColor" stroke-width="1.8"/><path d="M4 5.5v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6M4 11.5v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" stroke="currentColor" stroke-width="1.8"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 15V4m0 0L8 8m4-4 4 4M5 16v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 4v11m0 0 4-4m-4 4-4-4M5 16v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  zip: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 3.5h7l4 4v13H7a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z" stroke="currentColor" stroke-width="1.8"/><path d="M14 3.5v4h4M9.5 6h2m-2 3h2m-2 3h2m-1 2v3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m4 16.8 12-12a2.1 2.1 0 0 1 3 3l-12 12-4 .8 1-3.8Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6.5 7.5h11M9 7.5V5h6v2.5M8 10.5v6m4-6v6m4-6v6M7 7.5l.6 11.2a1.5 1.5 0 0 0 1.5 1.4h5.8a1.5 1.5 0 0 0 1.5-1.4L17 7.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" stroke-width="1.8"/></svg>',
  globe: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M3 12h18M12 3c2.4 2.5 3.6 5.5 3.6 9s-1.2 6.5-3.6 9c-2.4-2.5-3.6-5.5-3.6-9S9.6 5.5 12 3Z" stroke="currentColor" stroke-width="1.8"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  left: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m15 5-7 7 7 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  right: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m9 5 7 7-7 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 10.5V17M12 7h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  logout: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M10 5H5v14h5M14 8l4 4-4 4m4-4H9" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" stroke="currentColor" stroke-width="1.8"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m5 12.5 4.3 4.3L19 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

const icon = (name) => icons[name] || icons.info;
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[char]);
const escapeAttr = escapeHtml;
const byId = (id) => document.getElementById(id);
const one = (selector, root = document) => root.querySelector(selector);
const all = (selector, root = document) => [...root.querySelectorAll(selector)];

function Button(label, { id = "", iconName = "", tone = "", size = "", type = "button", attrs = "" } = {}) {
  return `<button ${id ? `id="${escapeAttr(id)}"` : ""} type="${type}" class="button ${tone} ${size}" ${attrs}>${iconName ? icon(iconName) : ""}<span>${escapeHtml(label)}</span></button>`;
}

function Card(content, extra = "") {
  return `<section class="card ${extra}">${content}</section>`;
}

function AryukiMark(small = false) {
  return `<div class="aryuki-mark ${small ? "small" : ""}" aria-label="Aryuki"><span>A</span><span>r</span><span>y</span><span>u</span><span>k</span><span>i</span></div>`;
}

function ThemeToggle() {
  const dark = document.documentElement.dataset.theme === "dark";
  return `<button class="icon-button" type="button" data-theme-toggle aria-label="${dark ? "切换到浅色模式" : "切换到深色模式"}">${icon(dark ? "sun" : "moon")}</button>`;
}

function LocaleToggle() {
  const label = getLocale() === "zh" ? "EN" : "中文";
  return `<button class="language-button" type="button" data-locale-toggle aria-label="切换语言">${label}</button>`;
}

function UserMenu() {
  const user = state.user;
  if (!user) return Button("登录", { tone: "primary", attrs: "data-login" });
  const admin = Boolean(user.isAdmin || user.is_admin || user.role === "admin");
  const name = primaryUserName(user);
  const secondary = secondaryUserName(user);
  const initials = [...String(name)].slice(0, 2).join("").toUpperCase();
  return `<div class="user-menu">
    <button class="user-trigger" type="button" data-user-trigger aria-haspopup="menu" aria-expanded="false">
      <span class="avatar">${escapeHtml(initials)}</span><span class="user-name">${escapeHtml(name)}</span>${icon("chevron")}
    </button>
    <div class="menu-popover" role="menu" hidden>
      <div class="menu-summary"><strong>${escapeHtml(name)}</strong>${secondary ? `<br><small>${escapeHtml(secondary)}</small>` : ""}<br><small>${escapeHtml(user.roleName || user.role_name || user.role || "用户")}</small></div>
      ${!admin && user.authCenterUrl ? `<a class="menu-item" href="${escapeAttr(user.authCenterUrl)}" target="_blank" rel="noopener">${icon("shield")}前往 Auth Center</a>` : ""}
      ${admin ? `<a class="menu-item" href="/admin" data-nav>${icon("shield")}管理后台</a>` : ""}
      ${admin ? `<button class="menu-item" type="button" data-admin-login>${icon("key")}重新验证管理员身份</button>` : ""}
      <a class="menu-item" href="/account" data-nav>${icon("user")}账户</a>
      <a class="menu-item" href="/save/" data-nav>${icon("database")}我的存储</a>
      <button class="menu-item danger" type="button" data-logout>${icon("logout")}退出登录</button>
    </div>
  </div>`;
}

function HeaderActions() {
  return `<div class="header-actions">
    <a class="icon-button history-button" href="/history" data-nav aria-label="历史记录">${icon("history")}</a>
    ${LocaleToggle()}${ThemeToggle()}${UserMenu()}
  </div>`;
}

function AppHeader() {
  return `<header class="app-header minimal">
    <span class="header-spacer" aria-hidden="true"></span>
    ${HeaderActions()}
  </header>`;
}

const userNav = [
  ["/home", "home", "图库"],
  ["/selfie-recognition", "camera", "人脸识别"],
  ["/history", "history", "历史"],
  ["/save/", "database", "我的存储"],
  ["/share-link", "share", "分享链接"],
  ["/account", "user", "账户"],
];

const adminNav = [
  ["/admin", "home", "概览"],
  ["/admin/classes", "class", "全部类"],
  ["/admin/users", "users", "用户控制"],
  ["/admin/roles", "key", "权限控制"],
  ["/admin/audit", "history", "审计"],
];

function Sidebar(active, admin = false, storage = null) {
  const nav = admin ? adminNav : userNav;
  return `<aside class="sidebar" aria-label="${admin ? "管理员" : "用户"}导航">
    <div class="sidebar-label">${admin ? "管理后台" : "Aryuki Photo"}</div>
    ${nav.map(([href, iconName, label]) => `<a class="side-link ${active === href ? "active" : ""}" href="${href}" data-nav>${icon(iconName)}<span>${label}</span></a>`).join("")}
    ${!admin && storage ? `<div class="sidebar-storage"><strong>存储用量</strong>${StorageMeter(storage)}<small>${formatBytes(storage.usedBytes)} / ${formatQuota(storage.quotaBytes)}</small></div>` : ""}
  </aside>`;
}

function Workspace(content, active, { admin = false, storage = null } = {}) {
  return `${AppHeader()}
    <main id="main" class="workspace">${Sidebar(active, admin, storage)}<section class="page">${content}</section></main>`;
}

function StorageMeter(storage = {}) {
  const used = Number(storage.usedBytes ?? storage.used_bytes ?? 0);
  const quota = Number(storage.quotaBytes ?? storage.quota_bytes ?? 0);
  const percent = quota > 0 ? Math.min(100, (used / quota) * 100) : 0;
  return `<div class="storage-bar" role="progressbar" aria-label="存储使用率" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(percent)}"><span style="--used:${percent.toFixed(2)}%"></span></div>`;
}

function VisibilitySwitch(item, disabled = false) {
  const visibility = classVisibility(item);
  const isPublic = visibility === "public";
  return `<span class="visibility"><button class="switch ${isPublic ? "on" : ""}" type="button" role="switch" aria-checked="${isPublic}" aria-label="切换 ${escapeAttr(item.name)} 的公开状态" data-visibility="${escapeAttr(item.id)}" ${disabled ? "disabled" : ""}></button><span>${isPublic ? "公开" : "私有"}</span></span>`;
}

function AdminTable(columns, rows, emptyText = "暂无数据") {
  if (!rows.length) return EmptyState("database", emptyText);
  return `<div class="table-wrap"><table class="admin-table"><thead><tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
}

function normalizePhoto(photo, className = "") {
  const available = photo?.available !== false && photo?.deleted !== true;
  let metadata = photo?.metadata || {};
  if (typeof metadata === "string") {
    try { metadata = JSON.parse(metadata); } catch { metadata = {}; }
  }
  return {
    ...photo,
    id: String(photo?.id || ""),
    classId: String(photo?.classId || photo?.class_id || ""),
    name: photo?.name || photo?.original_name || photo?.originalName || "照片",
    url: available ? photoUrl(photo) : "",
    thumbnailUrl: available ? photoThumbnailUrl(photo) : "",
    className: photo?.className || photo?.class_name || className,
    sizeBytes: Number(photo?.sizeBytes ?? photo?.size_bytes ?? photo?.byteSize ?? photo?.byte_size ?? 0),
    metadata: metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {},
    match: Number(photo?.match ?? photo?.score ?? photo?.confidence ?? 0),
    available,
    owned: Boolean(photo?.owned),
    classRemoved: Boolean(photo?.classRemoved ?? photo?.class_removed),
    savedAt: photo?.savedAt || photo?.saved_at || "",
    classCreatedAt: photo?.classCreatedAt || photo?.class_created_at || "",
    savedKind: photo?.savedKind || photo?.saved_kind || "",
  };
}

function normalizeClass(item) {
  return {
    ...item,
    id: String(item?.id || ""),
    name: item?.name || "未命名类",
    description: item?.description || "",
    visibility: classVisibility(item),
    photoCount: Number(item?.photoCount ?? item?.photo_count ?? item?.photos?.length ?? 0),
    sizeBytes: Number(item?.sizeBytes ?? item?.size_bytes ?? item?.byteSize ?? item?.byte_size ?? item?.storageBytes ?? item?.storage_bytes ?? 0),
    ownerName: item?.ownerName || item?.owner_name || item?.uploaderName || item?.uploader_name || "—",
  };
}

function classVisibility(item) {
  if (item?.visibility) return String(item.visibility).toLowerCase();
  return item?.is_open === 1 || item?.is_open === true || item?.isOpen === true ? "public" : "private";
}

function PhotoCard(photo, { selectable = true } = {}) {
  const item = normalizePhoto(photo);
  const selected = state.selected.has(item.id);
  if (!item.available) {
    return `<article class="photo-card" aria-label="图片不可用"><div class="empty">${icon("image")}<span>图片已不可见</span></div></article>`;
  }
  return `<article class="photo-card ${selected ? "selected" : ""}">
    <button class="photo-open-button" type="button" data-photo-open="${escapeAttr(item.id)}" aria-label="预览 ${escapeAttr(item.name)}">
      <img src="${escapeAttr(item.thumbnailUrl || item.url)}" alt="${escapeAttr(item.name)}" loading="lazy" decoding="async">
    </button>
    ${selectable ? `<button class="photo-check ${selected ? "on" : ""}" type="button" data-photo-select="${escapeAttr(item.id)}" aria-label="${selected ? "取消选择" : "选择"} ${escapeAttr(item.name)}"></button>` : ""}
  </article>`;
}

function PhotoGrid(photos, options = {}) {
  const list = photos.map((photo) => normalizePhoto(photo, options.className));
  if (!list.length) return EmptyState("image", options.emptyText || "这里还没有照片");
  return `<div class="photo-grid">${list.map((photo) => PhotoCard(photo, options)).join("")}</div>`;
}

function SelectionToolbar() {
  const count = state.selected.size;
  if (!count) return "";
  return `<aside class="selection-toolbar" aria-label="已选照片操作">
    <strong>已选择 ${count} 张照片</strong>
    <div class="actions">
      ${Button("另存到自己", { iconName: "save", size: "small", attrs: "data-save-selected" })}
      ${Button("下载", { iconName: "download", size: "small", attrs: "data-download-selected" })}
      ${Button("ZIP", { iconName: "zip", tone: "primary", size: "small", attrs: "data-zip-selected" })}
    </div>
  </aside>`;
}

function EmptyState(iconName, text, action = "") {
  return `<div class="empty">${icon(iconName)}<span>${escapeHtml(text)}</span>${action}</div>`;
}

function ErrorState(error, retry = "") {
  const message = friendlyError(error);
  return `<div class="error-state">${icon("info")}<strong>${escapeHtml(message)}</strong>${retry ? Button("重试", { attrs: retry }) : ""}</div>`;
}

function PageHead(title, description, actions = "") {
  return `<header class="page-head"><div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div><div class="page-actions">${actions}</div></header>`;
}

function GoogleSearchBox(value = "", id = "main-search") {
  return `<form class="google-search-wrap" data-search-form autocomplete="off" role="search">
    <div class="google-search">${icon("search")}
      <input id="${id}" name="q" value="${escapeAttr(value)}" maxlength="160" placeholder="搜索类名称" aria-label="搜索类名称" aria-autocomplete="list" aria-controls="search-suggestions" aria-expanded="false">
      <button class="icon-button search-camera" type="button" data-nav-camera aria-label="使用相机进行人脸识别">${icon("lens")}</button>
      <button class="icon-button search-submit" type="submit" aria-label="搜索">${icon("search")}</button>
    </div>
    <div id="search-suggestions" class="suggestions" role="listbox" hidden></div>
  </form>`;
}

function SearchTopbar(value) {
  return `<header class="search-topbar">
    <a class="search-wordmark" href="/home" data-nav aria-label="Aryuki Photo 首页">${AryukiMark(true)}</a>
    <div class="search-topbar-box">${GoogleSearchBox(value, "result-search")}</div>
    ${HeaderActions()}
  </header>`;
}

function renderHome() {
  setPageTitle("Aryuki 搜索");
  app.innerHTML = `${AppHeader()}<main id="main" class="home-page">
    <section class="google-stage">
      ${AryukiMark()}
      ${GoogleSearchBox()}
      <div class="google-actions">
        <button class="google-action" type="button" data-search-submit>Aryuki 搜索</button>
        <button class="google-action" type="button" data-toggle-syntax>搜索语法</button>
      </div>
      <p class="search-hints">搜索公开类，或用相机查找你的照片。</p>
      <div id="syntax-help" class="syntax-help" hidden>${SEARCH_HELP.map(([code, text]) => `<div><code>${escapeHtml(code)}</code><span>${escapeHtml(text)}</span></div>`).join("")}</div>
    </section>
    <footer class="home-footer"><span>Aryuki Photo</span></footer>
  </main>`;
  bindSearchBox();
  loadHomeBackground();
  one("[data-search-submit]").addEventListener("click", () => one("[data-search-form]").requestSubmit());
  one("[data-toggle-syntax]").addEventListener("click", (event) => {
    const help = byId("syntax-help");
    help.hidden = !help.hidden;
    event.currentTarget.setAttribute("aria-expanded", String(!help.hidden));
  });
}

async function loadHomeBackground() {
  if (!state.user || state.user.kind === "temp") return;
  try {
    const data = await Client.background();
    state.backgroundSettings = data;
    state.background = data.background || null;
    if (location.pathname !== "/home") return;
    const source = state.background?.source === "bing"
      ? `${state.background.url}?mkt=${getLocale() === "zh" ? "zh-CN" : "en-US"}`
      : `${state.background?.url || ""}?v=${Date.now()}`;
    app.classList.toggle("has-home-background", Boolean(state.background?.url));
    app.style.setProperty("--home-background", state.background?.url
      ? `url("${source}")`
      : "none");
  } catch {
    state.background = null;
    state.backgroundSettings = null;
  }
}

function openBackgroundManager() {
  const restoreKey = `aryuki-background-restore:${state.user?.id || ""}`;
  const restoreToken = sessionStorage.getItem(restoreKey) || "";
  const hasCustom = Boolean(state.backgroundSettings?.customAvailable);
  openDialog({
    title: "自定义背景",
    hideActions: true,
    modalClass: "background-manager",
    body: `<div class="background-preview ${hasCustom ? "has-image" : ""}" style="${hasCustom ? `background-image:url('/api/background/file?kind=cropped&v=${Date.now()}')` : ""}">
      ${hasCustom ? "" : `<span>${icon("image")}暂无自定义背景</span>`}
    </div>
    <p class="camera-note">裁切比例为 16:9。搜索栏和按钮会自动保持清晰。</p>
    <div class="background-actions">
      <label class="button primary">${icon("upload")}上传<input type="file" accept="image/*" hidden data-background-upload></label>
      ${Button("调整", { iconName: "edit", attrs: `data-background-adjust ${state.backgroundSettings?.background?.hasOriginal || hasCustom ? "" : "disabled"}` })}
      ${Button("删除", { iconName: "trash", tone: "danger", attrs: `data-background-delete ${hasCustom ? "" : "disabled"}` })}
      ${Button("还原", { iconName: "history", attrs: `data-background-restore ${restoreToken ? "" : "disabled"}` })}
    </div>`,
  });
  one("[data-background-upload]")?.addEventListener("change", (event) => {
    const file = event.currentTarget.files?.[0];
    if (file) openBackgroundCrop(file);
  });
  one("[data-background-adjust]")?.addEventListener("click", async (event) => {
    event.currentTarget.disabled = true;
    try {
      const response = await fetch("/api/background/file?kind=original", { credentials: "same-origin" });
      if (!response.ok) throw new ApiError("原始背景不可用。", response.status);
      const blob = await response.blob();
      await openBackgroundCrop(new File([blob], "background-original", { type: blob.type || "image/jpeg" }));
    } catch (error) {
      toast(friendlyError(error), true);
      event.currentTarget.disabled = false;
    }
  });
  one("[data-background-delete]")?.addEventListener("click", () => {
    confirmAction("删除主页背景？", "删除后可在 30 分钟内还原。", async () => {
      const result = await Client.deleteBackground();
      sessionStorage.setItem(restoreKey, result.restoreToken);
      state.background = null;
      await loadHomeBackground();
      if (location.pathname === "/account") await loadAccountBackgroundSettings();
      toast("背景已删除，可在 30 分钟内还原。");
    }, true);
  });
  one("[data-background-restore]")?.addEventListener("click", async () => {
    try {
      await Client.restoreBackground(restoreToken);
      sessionStorage.removeItem(restoreKey);
      closeDialog();
      await loadHomeBackground();
      if (location.pathname === "/account") await loadAccountBackgroundSettings();
      toast("背景已还原。");
    } catch (error) { toast(friendlyError(error), true); }
  });
}

async function openBackgroundCrop(originalFile) {
  if (!originalFile.type.startsWith("image/")) return toast("请选择图片文件。", true);
  const sourceUrl = URL.createObjectURL(originalFile);
  const image = new Image();
  image.src = sourceUrl;
  try {
    await image.decode();
  } catch {
    URL.revokeObjectURL(sourceUrl);
    return toast("无法读取这张图片。", true);
  }
  openDialog({
    title: "调整主页背景",
    modalClass: "background-crop-dialog",
    body: `<canvas class="background-crop-canvas" width="1600" height="900"></canvas>
      <div class="crop-controls">
        <label class="field"><span>缩放</span><input type="range" min="100" max="300" value="100" data-crop-zoom></label>
        <label class="field"><span>水平位置</span><input type="range" min="-100" max="100" value="0" data-crop-x></label>
        <label class="field"><span>垂直位置</span><input type="range" min="-100" max="100" value="0" data-crop-y></label>
      </div>`,
    submitText: "保存裁切",
    onSubmit: async () => {
      const canvas = one(".background-crop-canvas", modalRoot);
      const cropped = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", .9));
      if (!cropped) throw new ApiError("无法保存裁切结果。");
      await Client.saveBackground(
        originalFile,
        new File([cropped], "home-background-1600x900.jpg", { type: "image/jpeg" })
      );
      state.background = { url: "/api/background/file?kind=cropped", hasOriginal: true };
      await loadHomeBackground();
      if (location.pathname === "/account") await loadAccountBackgroundSettings();
      toast("主页背景已保存。");
    },
  });
  const canvas = one(".background-crop-canvas", modalRoot);
  const context = canvas.getContext("2d");
  const draw = () => {
    const zoom = Number(one("[data-crop-zoom]", modalRoot).value) / 100;
    const x = Number(one("[data-crop-x]", modalRoot).value) / 100;
    const y = Number(one("[data-crop-y]", modalRoot).value) / 100;
    const scale = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight) * zoom;
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    const left = -((width - canvas.width) / 2) * (1 + x);
    const top = -((height - canvas.height) / 2) * (1 + y);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, left, top, width, height);
  };
  all('input[type="range"]', modalRoot).forEach((input) => input.addEventListener("input", draw));
  draw();
  state.pageCleanup.push(() => URL.revokeObjectURL(sourceUrl));
}

async function renderSearch() {
  setPageTitle("搜索结果");
  const value = new URLSearchParams(location.search).get("q") || "";
  if (value.trim()) {
    try {
      await ensureTemporarySession();
    } catch {
      // Public search remains available if temporary history cannot be created.
    }
  }
  app.innerHTML = `${SearchTopbar(value)}<main id="main" class="search-page">
    <section class="search-layout"><div id="search-results" class="loading-state">正在搜索公开类…</div></section>
  </main>`;
  bindSearchBox();
  const version = state.routeVersion;
  const parsed = parseSearchQuery(value);
  if (!value.trim()) {
    byId("search-results").className = "";
    byId("search-results").innerHTML = EmptyState("search", "输入类名称开始搜索");
    return;
  }
  try {
    const data = await Client.searchClasses(value);
    if (version !== state.routeVersion) return;
    const classes = listOf(data, "classes").map(normalizeClass);
    state.activePhotos = classes.flatMap((item) =>
      listOf(item, "photos").map((photo) => normalizePhoto(photo, item.name)));
    const chips = syntaxChips(parsed);
    const total = classes.reduce((sum, item) => sum + item.photoCount, 0);
    byId("search-results").className = "";
    byId("search-results").innerHTML = `<div class="search-summary">
      找到 <strong>${classes.length}</strong> 个公开类、<strong>${total}</strong> 张照片
      ${chips.length ? `<div class="syntax-chips">${chips.map((chip) => `<span class="badge purple">${escapeHtml(chip.type)} ${escapeHtml(chip.value)}</span>`).join("")}</div>` : ""}
    </div>
    ${classes.length ? classes.map((item) => {
      const photos = listOf(item, "photos").map((photo) => normalizePhoto(photo, item.name));
      return `<section class="result-group"><header class="result-group-head"><div><h2>${escapeHtml(item.name)}</h2><span class="result-meta">${photos.length} 张照片</span></div>${Button("另存整个类", { iconName: "save", size: "small", attrs: `data-save-class="${escapeAttr(item.id)}" data-save-count="${photos.length}"` })}</header>${PhotoGrid(photos, { className: item.name })}</section>`;
    }).join("") : EmptyState("search", "没有匹配的公开类，试试更少的词或检查拼写。")}
    ${SelectionToolbar()}`;
    bindPhotoActions(state.activePhotos);
  } catch (error) {
    if (version !== state.routeVersion) return;
    byId("search-results").className = "";
    byId("search-results").innerHTML = ErrorState(error, "data-retry-search");
    one("[data-retry-search]")?.addEventListener("click", renderSearch);
  }
}

function bindSearchBox() {
  const form = one("[data-search-form]");
  const input = one('input[name="q"]', form);
  const list = one(".suggestions", form);
  if (!form || !input || !list) return;

  const refresh = () => {
    const value = input.value.trim().toLowerCase();
    const recent = readRecentSearches();
    const commands = SEARCH_HELP.map(([command]) => command);
    state.suggestions = [...new Set([...recent, ...commands])]
      .filter((item) => !value || item.toLowerCase().includes(value))
      .slice(0, 7);
    state.suggestionIndex = -1;
    list.innerHTML = state.suggestions.map((item, index) =>
      `<button class="suggestion" type="button" role="option" data-suggestion="${index}">${icon(item.includes(":") || item.startsWith("-") ? "info" : "history")}<span>${escapeHtml(item)}</span></button>`).join("");
    list.hidden = !state.suggestions.length;
    input.setAttribute("aria-expanded", String(!list.hidden));
    all("[data-suggestion]", list).forEach((button) => button.addEventListener("click", () => {
      input.value = state.suggestions[Number(button.dataset.suggestion)];
      list.hidden = true;
      form.requestSubmit();
    }));
  };

  input.addEventListener("focus", refresh);
  input.addEventListener("input", refresh);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      list.hidden = true;
      input.setAttribute("aria-expanded", "false");
      return;
    }
    if (!["ArrowDown", "ArrowUp"].includes(event.key) || list.hidden) return;
    event.preventDefault();
    const delta = event.key === "ArrowDown" ? 1 : -1;
    state.suggestionIndex = (state.suggestionIndex + delta + state.suggestions.length) % state.suggestions.length;
    all("[data-suggestion]", list).forEach((item, index) => {
      item.classList.toggle("active", index === state.suggestionIndex);
      item.setAttribute("aria-selected", String(index === state.suggestionIndex));
    });
    input.value = state.suggestions[state.suggestionIndex];
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = input.value.trim();
    if (!value) return input.focus();
    rememberSearch(value);
    const stage = one(".google-stage");
    stage?.classList.add("compact");
    const delay = reduceMotion.matches || location.pathname === "/search" ? 0 : 340;
    setTimeout(() => navigate(`/search?q=${encodeURIComponent(value)}`), delay);
  });

  const closeOutside = (event) => {
    if (event.composedPath().includes(form)) return;
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
  };
  document.addEventListener("pointerdown", closeOutside, true);
  state.pageCleanup.push(() => document.removeEventListener("pointerdown", closeOutside, true));
}

function readRecentSearches() {
  try { return JSON.parse(localStorage.getItem("aryuki-recent-searches") || "[]"); }
  catch { return []; }
}

function rememberSearch(value) {
  const next = [value, ...readRecentSearches().filter((item) => item !== value)].slice(0, 12);
  localStorage.setItem("aryuki-recent-searches", JSON.stringify(next));
}

function bindPhotoActions(photos, root = document) {
  const localPhotos = photos.map(normalizePhoto);
  state.activePhotos = localPhotos;
  all("[data-photo-select]", root).forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    state.activePhotos = localPhotos;
    togglePhotoSelection(button.dataset.photoSelect);
  }));
  all("[data-photo-open]", root).forEach((card) => {
    const open = () => openLightbox(card.dataset.photoOpen, localPhotos);
    card.addEventListener("click", open);
  });
  all("[data-save-class]", root).forEach((button) => button.addEventListener("click", () =>
    saveClass(button.dataset.saveClass, Number(button.dataset.saveCount || 0))));
  bindSelectionToolbar();
}

function togglePhotoSelection(photoId) {
  state.selected.has(photoId) ? state.selected.delete(photoId) : state.selected.add(photoId);
  all(`[data-photo-open="${cssEscape(photoId)}"]`).forEach((card) => {
    const shell = card.closest(".photo-card");
    shell?.classList.toggle("selected", state.selected.has(photoId));
    const check = one("[data-photo-select]", shell);
    check?.classList.toggle("on", state.selected.has(photoId));
    check?.setAttribute("aria-label", `${state.selected.has(photoId) ? "取消选择" : "选择"}照片`);
  });
  updateSelectionToolbar();
}

function updateSelectionToolbar() {
  one(".selection-toolbar")?.remove();
  if (!state.selected.size) return;
  document.body.insertAdjacentHTML("beforeend", SelectionToolbar());
  bindSelectionToolbar();
}

function bindSelectionToolbar() {
  one("[data-save-selected]")?.addEventListener("click", saveSelected);
  one("[data-download-selected]")?.addEventListener("click", () => downloadSelected(false));
  one("[data-zip-selected]")?.addEventListener("click", () => downloadSelected(true));
}

function confirmLargeBatch(actionName, count, action) {
  if (count <= 5) return action();
  confirmAction(
    `${actionName} ${count} 张照片？`,
    "数量较多，可能需要一点时间。",
    action,
  );
}

function saveSelected() {
  const ids = [...state.selected];
  if (!ids.length) return;
  return confirmLargeBatch("另存", ids.length, async () => {
    try {
      for (const photoId of ids) await Client.savePhoto(photoId);
      toast(`${ids.length} 张照片已加入队列，可离开页面。`);
    } catch (error) {
      toast(friendlyError(error), true);
    }
  });
}

function saveClass(classId, photoCount = 0) {
  return confirmLargeBatch("另存", photoCount, async () => {
    try {
      await Client.saveClass(classId);
      toast("已加入队列，可离开页面。");
    } catch (error) {
      toast(friendlyError(error), true);
    }
  });
}

function downloadSelected(zip = false) {
  const photos = state.activePhotos.filter((photo) => state.selected.has(photo.id) && photo.available);
  if (!photos.length) return toast("请先选择照片。", true);
  return confirmLargeBatch("下载", photos.length, async () => {
    try {
      if (zip) await downloadZip(photos);
      else for (const photo of photos) await downloadPhoto(photo);
      toast(zip ? "压缩包已生成。" : "下载已开始。");
    } catch (error) {
      toast(friendlyError(error), true);
    }
  });
}

async function downloadPhoto(photo) {
  const response = await fetch(photo.url, { credentials: "same-origin" });
  if (!response.ok) throw new ApiError("无法下载这张照片。", response.status);
  const url = URL.createObjectURL(await response.blob());
  triggerDownload(url, photo.name || `${photo.id}.jpg`);
  setTimeout(() => URL.revokeObjectURL(url), 2_000);
}

async function downloadZip(photos) {
  if (!window.JSZip) throw new ApiError("ZIP 组件尚未加载，请稍后重试。");
  const zip = new window.JSZip();
  for (const [index, photo] of photos.entries()) {
    const response = await fetch(photo.url, { credentials: "same-origin" });
    if (!response.ok) throw new ApiError(`第 ${index + 1} 张照片下载失败。`, response.status);
    zip.file(uniqueFilename(photo.name || `${photo.id}.jpg`, index), await response.blob());
  }
  const url = URL.createObjectURL(await zip.generateAsync({ type: "blob" }));
  triggerDownload(url, `aryuki-${new Date().toISOString().slice(0, 10)}.zip`);
  setTimeout(() => URL.revokeObjectURL(url), 2_000);
}

function triggerDownload(url, name) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

function uniqueFilename(name, index) {
  const clean = String(name).replace(/[\\/:*?"<>|]/g, "_");
  return `${String(index + 1).padStart(3, "0")}-${clean}`;
}

function PhotoMetadata(photo) {
  const data = photo.metadata || {};
  const exposure = Number(data.exposureSeconds);
  const rows = [
    ["大小", formatPhotoSize(photo.sizeBytes)],
    data.width && data.height ? ["尺寸", `${data.width} × ${data.height}`] : null,
    data.takenAt ? ["拍摄时间", String(data.takenAt).replace(/^(\d{4}):(\d{2}):/, "$1-$2-")] : null,
    data.camera ? ["相机", data.camera] : null,
    exposure > 0 ? ["曝光", exposure < 1 ? `1/${Math.round(1 / exposure)} s` : `${exposure.toFixed(2)} s`] : null,
    Number(data.aperture) > 0 ? ["光圈", `f/${Number(data.aperture).toFixed(1)}`] : null,
    Number(data.iso) > 0 ? ["ISO", String(Math.round(Number(data.iso)))] : null,
    Number(data.focalLengthMm) > 0 ? ["焦距", `${Number(data.focalLengthMm).toFixed(1)} mm`] : null,
  ].filter(Boolean);
  return `<dl class="photo-metadata">${rows.map(([label, value]) =>
    `<div><dt>${escapeHtml(label)}</dt><dd title="${escapeAttr(value)}">${escapeHtml(value)}</dd></div>`).join("")}</dl>`;
}

function ModalLightbox(photos, index) {
  const photo = photos[index];
  return `<div class="modal-overlay" data-modal-overlay><section class="dialog lightbox" role="dialog" aria-modal="true" aria-label="照片预览" tabindex="-1">
    <div class="lightbox-body">
      <section class="lightbox-media">
        <img src="${escapeAttr(photo.url)}" alt="${escapeAttr(photo.name)}">
        <button class="icon-button lightbox-close" type="button" data-lightbox-close aria-label="关闭">${icon("close")}</button>
        ${photos.length > 1 ? `<button class="icon-button lightbox-arrow prev" type="button" data-lightbox-prev aria-label="上一张">${icon("left")}</button><button class="icon-button lightbox-arrow next" type="button" data-lightbox-next aria-label="下一张">${icon("right")}</button>` : ""}
      </section>
      <aside class="lightbox-info">
        <span class="badge purple">${index + 1} / ${photos.length}</span>
        <h2>${escapeHtml(photo.className || "照片")}</h2>
        ${PhotoMetadata(photo)}
        <div class="lightbox-actions">
          ${Button("下载照片", { iconName: "download", tone: "primary", attrs: "data-lightbox-download" })}
          ${Button(state.selected.has(photo.id) ? "取消选择" : "加入选择", { iconName: "plus", attrs: "data-lightbox-select" })}
          ${Button("另存到自己", { iconName: "save", tone: "soft", attrs: "data-lightbox-save" })}
        </div>
      </aside>
    </div>
  </section></div>`;
}

function openLightbox(photoId, photos = state.activePhotos) {
  const available = photos.filter((photo) => normalizePhoto(photo).available).map(normalizePhoto);
  if (!available.length) return;
  let index = Math.max(0, available.findIndex((photo) => photo.id === photoId));
  state.dialogFocus = document.activeElement;
  lockPageScroll();

  const render = () => {
    modalRoot.innerHTML = ModalLightbox(available, index);
    const dialog = one(".lightbox", modalRoot);
    dialog.focus();
    one("[data-lightbox-close]", dialog).addEventListener("click", closeDialog);
    one("[data-modal-overlay]", modalRoot).addEventListener("click", (event) => {
      if (event.target === event.currentTarget) closeDialog();
    });
    one("[data-lightbox-prev]", dialog)?.addEventListener("click", () => {
      index = (index - 1 + available.length) % available.length;
      render();
    });
    one("[data-lightbox-next]", dialog)?.addEventListener("click", () => {
      index = (index + 1) % available.length;
      render();
    });
    one("[data-lightbox-download]", dialog).addEventListener("click", () =>
      downloadPhoto(available[index]).catch((error) => toast(friendlyError(error), true)));
    one("[data-lightbox-select]", dialog).addEventListener("click", () => {
      togglePhotoSelection(available[index].id);
      render();
    });
    one("[data-lightbox-save]", dialog).addEventListener("click", async () => {
      try {
        await Client.savePhoto(available[index].id);
        toast("已加入队列，可离开页面。");
      } catch (error) {
        toast(friendlyError(error), true);
      }
    });
    dialog.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") { event.preventDefault(); index = (index - 1 + available.length) % available.length; render(); }
      if (event.key === "ArrowRight") { event.preventDefault(); index = (index + 1) % available.length; render(); }
      if (event.key === "Escape") closeDialog();
    });
  };
  render();
}

function renderSelfieRecognition() {
  setPageTitle("自拍识别");
  const mobile = isMobileCamera();
  app.innerHTML = Workspace(`
    ${PageHead("自拍识别", "拍摄或上传清晰正脸照片，系统将查找包含你的照片。", Button("历史记录", { iconName: "history", attrs: 'data-nav-to="/history"' }))}
    <div class="face-layout">
      ${Card(`<div class="camera-frame" id="camera-frame">
        <div class="camera-placeholder">${icon("camera")}<strong>${mobile ? "使用手机前置相机拍摄" : "启动摄像头或上传照片"}</strong></div>
      </div>
      <div class="camera-actions ${mobile ? "mobile" : "desktop"}">
        ${mobile ? `<label class="button primary">${icon("camera")}拍摄自拍<input id="selfie-input" type="file" accept="image/*" capture="user" hidden></label>` : Button("启动", { iconName: "camera", tone: "primary", attrs: "data-start-camera" })}
        ${!mobile ? Button("拍照", { iconName: "camera", attrs: "data-capture-camera disabled" }) : ""}
        <label class="button">${icon("upload")}选择照片<input id="${mobile ? "selfie-upload" : "selfie-input"}" type="file" accept="image/*" hidden></label>
      </div>
      ${Button("查找我的照片", { iconName: "search", tone: "primary full", attrs: "data-face-search disabled" })}`, "camera-card")}
      <section id="selfie-results">${EmptyState("image", "识别结果会显示在这里")}</section>
    </div>
  `, "/selfie-recognition");
  one("[data-start-camera]")?.addEventListener("click", startCamera);
  one("[data-capture-camera]")?.addEventListener("click", captureCamera);
  byId("selfie-input")?.addEventListener("change", useSelfieInput);
  byId("selfie-upload")?.addEventListener("change", useSelfieInput);
  one("[data-face-search]")?.addEventListener("click", startFaceSearch);
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    toast("此浏览器无法直接使用摄像头，请改为上传照片。", true);
    return;
  }
  try {
    stopCamera();
    if (state.selfieUrl) URL.revokeObjectURL(state.selfieUrl);
    state.selfieUrl = "";
    state.selfieFile = null;
    const searchButton = one("[data-face-search]");
    if (searchButton) searchButton.disabled = true;
    state.cameraStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } },
    });
    const frame = byId("camera-frame");
    frame.innerHTML = '<video id="camera-video" autoplay muted playsinline aria-label="相机预览"></video>';
    const video = byId("camera-video");
    video.srcObject = state.cameraStream;
    await video.play();
    one("[data-capture-camera]").disabled = false;
  } catch (error) {
    stopCamera();
    toast(error.name === "NotAllowedError" ? "未获得摄像头权限，请在浏览器设置中允许或改为上传照片。" : "无法启动摄像头。", true);
  }
}

async function captureCamera() {
  const video = byId("camera-video");
  if (!video?.videoWidth) return toast("摄像头尚未准备好。", true);
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d");
  context.translate(canvas.width, 0);
  context.scale(-1, 1);
  context.drawImage(video, 0, 0);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", .92));
  if (!blob) return toast("拍照失败，请重试。", true);
  setSelfieFile(new File([blob], `selfie-${Date.now()}.jpg`, { type: "image/jpeg" }));
  stopCamera();
}

function useSelfieInput(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) return toast("请选择图片文件。", true);
  setSelfieFile(file);
}

function setSelfieFile(file) {
  stopCamera();
  if (state.selfieUrl) URL.revokeObjectURL(state.selfieUrl);
  state.selfieFile = file;
  state.selfieUrl = URL.createObjectURL(file);
  const frame = byId("camera-frame");
  if (frame) frame.innerHTML = `<img src="${escapeAttr(state.selfieUrl)}" alt="自拍预览">`;
  const search = one("[data-face-search]");
  if (search) search.disabled = false;
}

async function startFaceSearch() {
  if (!state.selfieFile) return toast("请先拍摄或选择一张自拍。", true);
  stopCamera();
  const button = one("[data-face-search]");
  button.disabled = true;
  button.querySelector("span").textContent = "正在上传…";
  const results = byId("selfie-results");
  results.innerHTML = '<div class="loading-state">正在比对人脸，请稍候…</div>';
  const version = state.routeVersion;
  try {
    await ensureTemporarySession();
    const start = await Client.startFaceSearch(state.selfieFile);
    const taskId = start.taskId || start.task_id || start.id;
    if (!taskId) throw new ApiError("服务器没有返回识别任务 ID。");
    toast("识别已加入队列，可离开页面。");
    results.innerHTML = '<div class="loading-state">识别已加入队列，正在等待结果…</div>';
    for (let attempt = 0; attempt < 90; attempt += 1) {
      await wait(2_000);
      if (version !== state.routeVersion) return;
      const status = await Client.searchStatus(taskId);
      if (status.status === "failed") throw new ApiError(status.error || "人脸识别失败。");
      if (status.status !== "completed") continue;
      const photos = listOf(status, "results", "photos").map(normalizePhoto);
      state.selected.clear();
      state.activePhotos = photos;
      results.innerHTML = `<div class="result-group-head"><div><h2>找到 ${photos.length} 张照片</h2><span class="result-meta">可预览、另存或批量下载</span></div></div>${PhotoGrid(photos)}${SelectionToolbar()}`;
      bindPhotoActions(photos);
      return;
    }
    throw new ApiError("识别等待超时，请重新尝试。", 408);
  } catch (error) {
    if (version === state.routeVersion) results.innerHTML = ErrorState(error, "data-retry-face");
    one("[data-retry-face]")?.addEventListener("click", startFaceSearch);
  } finally {
    if (button?.isConnected) {
      button.disabled = false;
      button.querySelector("span").textContent = "查找我的照片";
    }
  }
}

async function ensureTemporarySession() {
  if (state.user) return state.user;
  const session = await Client.temporarySession();
  state.user = session.user || null;
  return state.user;
}

async function renderHistory() {
  setPageTitle("历史记录");
  app.innerHTML = Workspace(`${PageHead("历史", "自拍识别与类搜索记录按时间合并显示。")}
    <div id="history-list" class="loading-state">正在载入历史记录…</div>`, "/history");
  const version = state.routeVersion;
  try {
    const data = await Client.history();
    if (version !== state.routeVersion) return;
    const items = normalizeHistory(data);
    byId("history-list").className = "history-list";
    byId("history-list").innerHTML = items.length ? items.map((item) => `<article class="card history-item">
      <div class="history-summary">
        <div class="history-icon">${icon(item.type === "selfie" ? "camera" : "search")}</div>
        <div><div class="history-title">${escapeHtml(item.title)}</div><div class="history-meta"><span class="badge ${item.type === "selfie" ? "purple" : "green"}">${item.type === "selfie" ? "自拍" : "搜索"}</span> · ${formatDate(item.createdAt)} · ${item.count} 张结果</div></div>
      </div>
      <div class="row-actions">
        ${item.type === "search" && item.query ? Button("再次搜索", { size: "small", attrs: `data-history-query="${escapeAttr(item.query)}"` }) : ""}
        ${item.photos.length ? Button("查看", { size: "small", attrs: `data-history-view="${escapeAttr(item.key)}"` }) : ""}
        ${Button("删除", { iconName: "trash", tone: "danger", size: "small", attrs: `data-history-delete="${escapeAttr(item.key)}"` })}
      </div>
      <div class="history-photo-panel" data-history-panel="${escapeAttr(item.key)}" hidden></div>
    </article>`).join("") : EmptyState("history", "还没有识别或搜索记录");
    all("[data-history-query]").forEach((button) => button.addEventListener("click", () => navigate(`/search?q=${encodeURIComponent(button.dataset.historyQuery)}`)));
    all("[data-history-view]").forEach((button) => button.addEventListener("click", () => {
      const item = items.find((entry) => entry.key === button.dataset.historyView);
      const panel = one(`[data-history-panel="${cssEscape(button.dataset.historyView)}"]`);
      if (!item || !panel) return;
      panel.hidden = !panel.hidden;
      button.querySelector("span").textContent = panel.hidden ? "查看" : "收起";
      if (panel.hidden || panel.childElementCount) return;
      panel.innerHTML = PhotoGrid(item.photos, { selectable: false, emptyText: "暂无可见照片" });
      bindPhotoActions(item.photos, panel);
    }));
    all("[data-history-delete]").forEach((button) => button.addEventListener("click", () => {
      const item = items.find((entry) => entry.key === button.dataset.historyDelete);
      if (item) confirmAction("删除这条历史记录？", "只会删除记录，不会删除照片。", async () => {
        await Client.deleteHistory(item.type, item.id);
        await renderHistory();
      }, true);
    }));
  } catch (error) {
    if (version === state.routeVersion) byId("history-list").outerHTML = ErrorState(error, "data-retry-history");
    one("[data-retry-history]")?.addEventListener("click", renderHistory);
  }
}

function normalizeHistory(data) {
  const direct = listOf(data, "items", "history", "records");
  const selfie = direct.length ? direct.filter((item) => (item.type || item.kind) === "selfie") : listOf(data, "tasks");
  const searches = direct.length ? direct.filter((item) => (item.type || item.kind) === "search") : listOf(data, "searches", "records", "queries");
  return [
    ...selfie.map((item) => ({
      id: String(item.id || item.taskId || item.task_id || ""),
      type: "selfie",
      title: item.title || item.selfie?.name || "自拍识别",
      createdAt: item.createdAt || item.created_at,
      photos: listOf(item, "photos", "results").map(normalizePhoto),
      count: Number(item.matchCount ?? item.match_count ?? item.resultCount ?? item.results?.length ?? 0),
    })),
    ...searches.map((item) => ({
      id: String(item.id || item.query || ""),
      type: "search",
      title: item.title || `搜索：${item.query || ""}`,
      query: item.query || "",
      createdAt: item.createdAt || item.created_at || item.lastUsed || item.last_used,
      photos: listOf(item, "photos", "results").map(normalizePhoto),
      count: Number(item.resultCount ?? item.result_count ?? item.photos?.length ?? 0),
    })),
  ].map((item) => ({ ...item, key: `${item.type}:${item.id}` }))
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

async function renderSave() {
  setPageTitle("我的存储");
  try {
    const current = await Client.me();
    if (current.user) state.user = current.user;
  } catch {
    // Continue with the current session snapshot.
  }
  const writable = canWriteClasses();
  const ownRead = userAccessMode() === "own_read";
  const allClasses = ["all_read", "all_write"].includes(userAccessMode());
  app.innerHTML = Workspace(`${PageHead("我的存储", "管理你上传和另存的内容。", writable ? Button("新建类", { iconName: "plus", tone: "primary", attrs: "data-create-owned-class" }) : "")}
    <div id="save-content" class="loading-state">正在读取存储信息…</div>`, "/save/");
  const version = state.routeVersion;
  try {
    const [savedData, ownedData, storageData] = await Promise.all([
      Client.saved(),
      ownRead ? Promise.resolve({ classes: [] }) : Client.classes(allClasses ? "accessible" : "owned"),
      Client.storage(),
    ]);
    if (version !== state.routeVersion) return;
    const owned = listOf(ownedData, "classes").map(normalizeClass);
    const savedClasses = listOf(savedData, "classes", "savedClasses").map(normalizeClass);
    const savedPhotos = listOf(savedData, "photos", "savedPhotos").map(normalizePhoto);
    const storage = storageData.storage || {
      usedBytes: state.user?.storageUsedBytes ?? state.user?.storage_used_bytes ?? 0,
      quotaBytes: state.user?.quotaBytes ?? state.user?.quota_bytes ?? 0,
    };
    state.savePage = { owned, savedClasses, savedPhotos, writable, ownRead, allClasses, sort: "saved", storage };
    byId("save-content").className = "";
    byId("save-content").innerHTML = `${ownRead ? "" : Card(`<div class="stats">
      <div class="stat"><div class="stat-label">已用空间</div><div class="stat-value" data-storage-used-value>${formatBytes(storage.usedBytes ?? storage.used_bytes)}</div></div>
      <div class="stat"><div class="stat-label">空间上限</div><div class="stat-value">${formatQuota(storage.quotaBytes ?? storage.quota_bytes)}</div></div>
      <div class="stat"><div class="stat-label">${allClasses ? "可访问类" : "我的类"}</div><div class="stat-value">${owned.length}</div></div>
      <div class="stat"><div class="stat-label">另存照片</div><div class="stat-value">${savedPhotos.length}</div></div>
    </div><div class="storage-meter-label"><strong>存储用量</strong>${StorageMeter(storage)}</div>`, "storage-overview")}
    ${ownRead ? "" : '<section id="owned-section" class="save-section"></section>'}
    <section id="saved-section" class="save-section"></section>`;
    if (!ownRead) renderOwnedSection();
    renderSavedSection();
    state.activePhotos = savedPhotos;
  } catch (error) {
    if (version === state.routeVersion) byId("save-content").outerHTML = ErrorState(error, "data-retry-save");
    one("[data-retry-save]")?.addEventListener("click", renderSave);
  }
  one("[data-create-owned-class]")?.addEventListener("click", () => openClassDialog(null, (created) => {
    if (!created?.id || !state.savePage) return;
    state.savePage.owned.unshift(created);
    renderOwnedSection();
    toast("类已创建。");
  }));
}

function OwnedClassCard(item, writable = true) {
  return Card(`<div class="storage-class-summary">
      <div class="storage-class-title"><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.description || "暂无介绍")}</p></div>
      <div class="storage-class-meta">
        <span class="storage-class-metric"><small>大小</small><strong>${formatBytes(item.sizeBytes)}</strong></span>
        <span class="storage-class-metric"><small>照片</small><strong>${item.photoCount} 张</strong></span>
        <span data-visibility-shell="${escapeAttr(item.id)}">${VisibilitySwitch(item, !writable)}</span>
      </div>
      <div class="row-actions">
      ${Button("查看照片", { iconName: "image", size: "small", attrs: `data-manage-owned="${escapeAttr(item.id)}"` })}
      ${writable ? `
      <label class="button small">${icon("upload")}上传<input type="file" accept="image/*" multiple hidden data-upload-class="${escapeAttr(item.id)}"></label>
      ${Button("删除", { tone: "danger", size: "small", attrs: `data-delete-owned="${escapeAttr(item.id)}"` })}` : ""}
    </div></div><div class="owned-photo-panel" data-owned-photo-panel="${escapeAttr(item.id)}" hidden></div>`, "class-card storage-class-row");
}

function renderOwnedSection() {
  const page = state.savePage;
  const section = byId("owned-section");
  if (!page || !section) return;
  const title = userAccessMode() === "all_write"
    ? "可管理的类"
    : userAccessMode() === "all_read" ? "所有类（只读）" : "我上传的类";
  section.innerHTML = `<header class="save-section-head"><h2>${title}</h2><span class="result-meta">${page.owned.length} 个</span></header>
    ${page.owned.length ? `<div class="class-list storage-class-list">${page.owned.map((item) => OwnedClassCard(item, page.writable)).join("")}</div>` : EmptyState("class", page.writable ? "你还没有创建类" : "当前角色没有类写入权限")}`;
  bindOwnedClasses();
}

function savedPhotoGroups(page = state.savePage) {
  const map = new Map(page.savedClasses.map((item) => [item.id, { item, photos: [] }]));
  for (const photo of page.savedPhotos) {
    const classId = photo.classId || `detached:${photo.id}`;
    if (!map.has(classId)) {
      map.set(classId, {
        item: normalizeClass({
          id: classId,
          name: photo.className || "已移出的照片",
          createdAt: photo.classCreatedAt || photo.createdAt,
        }),
        photos: [],
      });
    }
    map.get(classId).photos.push(photo);
  }
  const groups = [...map.values()];
  const savedTime = (group) => Math.max(0, ...group.photos.map((photo) => new Date(photo.savedAt || 0).getTime()));
  if (page.sort === "name") groups.sort((a, b) => a.item.name.localeCompare(b.item.name, dateLocale()));
  else if (page.sort === "created") groups.sort((a, b) =>
    new Date(b.item.createdAt || b.photos[0]?.classCreatedAt || 0) - new Date(a.item.createdAt || a.photos[0]?.classCreatedAt || 0));
  else groups.sort((a, b) => savedTime(b) - savedTime(a));
  return groups;
}

function renderSavedSection() {
  const page = state.savePage;
  const section = byId("saved-section");
  if (!page || !section) return;
  const groups = savedPhotoGroups(page);
  section.innerHTML = `<header class="save-section-head"><h2>Saved Photos</h2><div class="page-actions saved-section-actions">
      <label class="sort-field"><span>排序</span><select class="select compact" data-saved-sort>
        <option value="saved" ${page.sort === "saved" ? "selected" : ""}>按转存时间</option>
        <option value="created" ${page.sort === "created" ? "selected" : ""}>按创建时间</option>
        <option value="name" ${page.sort === "name" ? "selected" : ""}>按类名称</option>
      </select></label>
      ${page.savedPhotos.length ? Button("移除所选", { iconName: "trash", tone: "danger", size: "small", attrs: "data-remove-saved-selected" }) : ""}
    </div></header>
    ${page.savedPhotos.some((photo) => photo.owned && photo.classRemoved) ? `<p class="badge purple">${page.savedPhotos.filter((photo) => photo.owned && photo.classRemoved).length} 张照片已由你接管</p>` : ""}
    ${groups.length ? `<div class="saved-photo-groups">${groups.map(({ item, photos }) => `<article class="card saved-photo-group">
      <header class="saved-photo-group-head"><div class="saved-photo-group-title"><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.description || "")}</p></div><div class="saved-photo-group-actions">
        <span class="result-meta">${photos.length} 张 · ${formatBytes(photos.reduce((sum, photo) => sum + photo.sizeBytes, 0))}</span>
        ${Button("查看", { iconName: "image", size: "small", attrs: `data-view-saved-group="${escapeAttr(item.id)}"` })}
        ${Button("删除", { tone: "danger", size: "small", attrs: `data-remove-saved-group="${escapeAttr(item.id)}"` })}
      </div></header>
      <div class="saved-photo-panel" data-saved-panel="${escapeAttr(item.id)}" hidden></div>
    </article>`).join("")}</div>` : EmptyState("save", "还没有另存照片")}`;
  bindSavedActions();
}

function bindOwnedClasses() {
  const { owned, writable } = state.savePage;
  all("[data-visibility]").forEach((button) => button.addEventListener("click", async () => {
    const item = owned.find((entry) => entry.id === button.dataset.visibility);
    if (!item) return;
    try {
      const next = item.visibility === "public" ? "private" : "public";
      const data = await Client.updateClass(item.id, { visibility: next });
      Object.assign(item, normalizeClass(data.class || { ...item, visibility: next }));
      const shell = one(`[data-visibility-shell="${cssEscape(item.id)}"]`);
      if (shell) shell.innerHTML = VisibilitySwitch(item, !writable);
      one("[data-visibility]", shell)?.addEventListener("click", () => bindVisibilityButton(item, shell, writable));
      toast(next === "public" ? "已设为公开。" : "已设为私有。");
    } catch (error) { toast(friendlyError(error), true); }
  }));
  all("[data-upload-class]").forEach((input) => input.addEventListener("change", async () => {
    if (!input.files?.length) return;
    const files = [...input.files];
    showUploadProgress(files.length);
    try {
      const result = await Client.uploadPhotos(
        input.dataset.uploadClass,
        files,
        updateUploadProgress
      );
      finishUploadProgress(false);
      toast(result.queued === false
        ? "照片已保存，识别功能稍后可用。"
        : "已加入队列，可离开页面。", result.queued === false);
      const item = owned.find((entry) => entry.id === input.dataset.uploadClass);
      if (item) {
        item.photoCount += files.length;
        item.sizeBytes += files.reduce((sum, file) => sum + file.size, 0);
      }
      state.savePage.storage.usedBytes += files.reduce((sum, file) => sum + file.size, 0);
      refreshStorageOverview();
      renderOwnedSection();
    } catch (error) {
      finishUploadProgress(true);
      toast(friendlyError(error), true);
    }
  }));
  all("[data-manage-owned]").forEach((button) => button.addEventListener("click", async () => {
    const panel = one(`[data-owned-photo-panel="${CSS.escape(button.dataset.manageOwned)}"]`);
    if (!panel) return;
    if (!panel.hidden) {
      panel.hidden = true;
      panel.innerHTML = "";
      return;
    }
    all("[data-owned-photo-panel]").forEach((item) => {
      item.hidden = true;
      item.innerHTML = "";
    });
      panel.hidden = false;
    panel.innerHTML = '<div class="loading-state">正在读取类照片…</div>';
    try {
      const data = await Client.classPhotos(button.dataset.manageOwned);
      const ownedClass = owned.find((item) => item.id === button.dataset.manageOwned);
      const photos = listOf(data, "photos").map((photo) => normalizePhoto(photo, ownedClass?.name));
      state.selected.clear();
      state.activePhotos = photos;
      panel.innerHTML = `<div class="owned-photo-head"><strong>${escapeHtml(ownedClass?.name || "类照片")}</strong>
        ${writable && photos.length ? Button("删除所选照片", { iconName: "trash", tone: "danger", size: "small", attrs: `data-delete-owned-photos="${escapeAttr(button.dataset.manageOwned)}"` }) : ""}
      </div>${PhotoGrid(photos, { emptyText: "这个类还没有照片" })}${photos.length ? SelectionToolbar() : ""}`;
      bindPhotoActions(photos);
      one("[data-delete-owned-photos]", panel)?.addEventListener("click", () => {
        if (!state.selected.size) return toast("请先选择要删除的照片。", true);
        confirmAction("删除所选照片？", "照片会立即隐藏；已被他人另存的内容将继续保留。", async () => {
          for (const photoId of state.selected) await Client.deletePhoto(photoId);
          panel.hidden = true;
          const target = owned.find((item) => item.id === button.dataset.manageOwned);
          if (target) target.photoCount = Math.max(0, target.photoCount - state.selected.size);
          renderOwnedSection();
        }, true);
      });
    } catch (error) {
      panel.innerHTML = ErrorState(error);
    }
  }));
  all("[data-delete-owned]").forEach((button) => button.addEventListener("click", () =>
    confirmAction("删除这个类？", "类会立即隐藏；已被他人另存的内容将继续保留。", async () => {
      await Client.deleteClass(button.dataset.deleteOwned);
      state.savePage.owned = owned.filter((item) => item.id !== button.dataset.deleteOwned);
      renderOwnedSection();
    }, true)));
}

async function bindVisibilityButton(item, shell, writable) {
  try {
    const next = item.visibility === "public" ? "private" : "public";
    const data = await Client.updateClass(item.id, { visibility: next });
    Object.assign(item, normalizeClass(data.class || { ...item, visibility: next }));
    shell.innerHTML = VisibilitySwitch(item, !writable);
    one("[data-visibility]", shell)?.addEventListener("click", () => bindVisibilityButton(item, shell, writable));
    toast(next === "public" ? "已设为公开。" : "已设为私有。");
  } catch (error) { toast(friendlyError(error), true); }
}

function refreshStorageOverview() {
  const storage = state.savePage?.storage;
  if (!storage) return;
  const used = Number(storage.usedBytes || 0);
  const quota = Number(storage.quotaBytes || 0);
  const value = one("[data-storage-used-value]");
  if (value) value.textContent = formatBytes(used);
  const bar = one(".storage-overview .storage-bar span");
  if (bar) bar.style.setProperty("--used", `${quota > 0 ? Math.min(100, (used / quota) * 100) : 0}%`);
}

function bindSavedActions() {
  const { savedClasses, savedPhotos } = state.savePage;
  one("[data-saved-sort]")?.addEventListener("change", (event) => {
    state.savePage.sort = event.currentTarget.value;
    renderSavedSection();
  });
  all("[data-view-saved-group]").forEach((button) => button.addEventListener("click", () => {
    const group = savedPhotoGroups().find(({ item }) => item.id === button.dataset.viewSavedGroup);
    const panel = one(`[data-saved-panel="${cssEscape(button.dataset.viewSavedGroup)}"]`);
    if (!group || !panel) return;
    panel.hidden = !panel.hidden;
    button.querySelector("span").textContent = panel.hidden ? "查看" : "收起";
    if (panel.hidden || panel.childElementCount) return;
    panel.innerHTML = PhotoGrid(group.photos, { emptyText: "这个类暂无可见照片" });
    bindPhotoActions(group.photos, panel);
  }));
  all("[data-remove-saved-group]").forEach((button) => button.addEventListener("click", () =>
    confirmAction("删除这组已存照片？", "会从你的存储中移除这组内容。", async () => {
      const classId = button.dataset.removeSavedGroup;
      const group = savedPhotoGroups().find(({ item }) => item.id === classId);
      if (!group) return;
      if (savedClasses.some((item) => item.id === classId)) await Client.removeSavedClass(classId);
      for (const photo of group.photos) {
        if (photo.owned && photo.classRemoved) await Client.deletePhoto(photo.id);
        else if (photo.savedKind === "photo" || !savedClasses.some((item) => item.id === classId)) {
          await Client.removeSavedPhoto(photo.id);
        }
      }
      state.savePage.savedClasses = savedClasses.filter((item) => item.id !== classId);
      state.savePage.savedPhotos = savedPhotos.filter((photo) => photo.classId !== classId);
      renderSavedSection();
    }, true)));
  one("[data-remove-saved-selected]")?.addEventListener("click", () => {
    if (!state.selected.size) return toast("请先选择要移除的照片。", true);
    confirmAction("删除或移除所选照片？", "只属于你的照片会删除；另存内容只会从你的存储中移除。", async () => {
      for (const photoId of state.selected) {
        const photo = savedPhotos.find((item) => item.id === photoId);
        if (photo?.owned && photo?.classRemoved) await Client.deletePhoto(photoId);
        else await Client.removeSavedPhoto(photoId);
      }
      state.savePage.savedPhotos = savedPhotos.filter((photo) => !state.selected.has(photo.id));
      state.selected.clear();
      renderSavedSection();
    }, true);
  });
  state.activePhotos = savedPhotos;
}

async function renderAccount() {
  setPageTitle("账户");
  app.innerHTML = Workspace(`${PageHead("账户", "查看当前身份、角色、权限和存储空间。")}<div id="account-content" class="loading-state">正在读取账户信息…</div>`, "/account");
  try {
    const current = await Client.me();
    if (current.user) state.user = current.user;
  } catch {
    // Keep the current session snapshot if refresh is temporarily unavailable.
  }
  const user = state.user;
  const title = user ? primaryUserName(user) : "尚未登录";
  const secondary = user ? secondaryUserName(user) : "";
  const role = user?.roleName || user?.role_name || user?.role || (user?.kind === "temp" ? "临时访客" : "—");
  const access = user?.kind === "temp" ? "仅识别与历史" : permissionName(user?.accessMode || user?.access_mode);
  const quota = user?.quotaBytes ?? user?.quota_bytes ?? 0;
  const used = user?.storageUsedBytes ?? user?.storage_used_bytes ?? 0;
  const hideStorage = userAccessMode() === "own_read";
  byId("account-content").className = "";
  byId("account-content").innerHTML = `${Card(`<div class="stats ${hideStorage ? "three" : ""}">
      <div class="stat"><div class="stat-label">用户</div><div class="stat-value">${escapeHtml(title)}</div>${secondary ? `<div class="cell-sub">${escapeHtml(secondary)}</div>` : ""}</div>
      <div class="stat"><div class="stat-label">角色</div><div class="stat-value">${escapeHtml(role)}</div></div>
      <div class="stat"><div class="stat-label">权限</div><div class="stat-value" style="font-size:20px">${escapeHtml(access)}</div></div>
      ${hideStorage ? "" : `<div class="stat"><div class="stat-label">存储</div><div class="stat-value">${formatBytes(used)}</div>${StorageMeter({ usedBytes: used, quotaBytes: quota })}<div class="cell-sub">上限 ${formatQuota(quota)}</div></div>`}
    </div><div class="account-bindings">${!user || user.kind === "temp" ? `<p class="camera-note">当前为${user ? "临时身份" : "未登录状态"}。绑定 Auth Center 后才能上传、另存和创建分享链接。</p>${Button("绑定 / 登录 Auth Center", { tone: "primary", attrs: "data-login" })}` : `<span class="badge green">${icon("shield")}已绑定 Auth Center</span>${user.email ? `<span class="badge">${icon("user")}邮箱 ${escapeHtml(user.email)}</span>` : ""}`}</div>`, "account-overview")}
    ${user && user.kind !== "temp" ? Card('<div id="account-background-settings" class="loading-state">正在读取背景设置…</div>', "account-background-card") : ""}`;
  if (user && user.kind !== "temp") await loadAccountBackgroundSettings();
}

async function loadAccountBackgroundSettings() {
  const root = byId("account-background-settings");
  if (!root) return;
  try {
    const data = await Client.background();
    state.backgroundSettings = data;
    state.background = data.background || null;
    const mode = data.mode || "none";
    const previewUrl = mode === "bing"
      ? `/api/background/bing?mkt=${getLocale() === "zh" ? "zh-CN" : "en-US"}`
      : mode === "custom" && data.background?.url
        ? `${data.background.url}?v=${Date.now()}`
        : "";
    root.className = "account-background-settings";
    root.innerHTML = `<div class="account-background-copy"><h2>主页背景</h2><p>只影响你的首页，背景会覆盖顶栏和底栏。</p></div>
      <div class="background-mode-grid" role="group" aria-label="背景来源">
        <button class="background-mode-choice ${mode === "none" ? "selected" : ""}" type="button" data-background-mode="none"><strong>默认</strong><small>使用纯色背景</small></button>
        <button class="background-mode-choice ${mode === "custom" ? "selected" : ""}" type="button" data-background-mode="custom"><strong>自定义</strong><small>${data.customAvailable ? "使用已上传图片" : "需要先上传图片"}</small></button>
        <button class="background-mode-choice ${mode === "bing" ? "selected" : ""}" type="button" data-background-mode="bing"><strong>Bing 每日图片</strong><small>每天自动更新，不占存储</small></button>
      </div>
      <div class="background-settings-preview ${previewUrl ? "has-image" : ""}" ${previewUrl ? `style="background-image:url('${escapeAttr(previewUrl)}')"` : ""}>
        ${previewUrl ? "" : `<span>${icon("image")}默认背景</span>`}
      </div>
      <div class="background-settings-actions">${Button(data.customAvailable ? "管理自定义背景" : "上传自定义背景", { iconName: "image", attrs: "data-background-manager" })}</div>`;
    all("[data-background-mode]", root).forEach((button) => button.addEventListener("click", async () => {
      if (button.dataset.backgroundMode === "custom" && !data.customAvailable) {
        openBackgroundManager();
        return;
      }
      try {
        await Client.setBackgroundMode(button.dataset.backgroundMode);
        await loadAccountBackgroundSettings();
        toast("背景设置已保存。");
      } catch (error) {
        toast(friendlyError(error), true);
      }
    }));
    one("[data-background-manager]", root)?.addEventListener("click", openBackgroundManager);
  } catch (error) {
    root.className = "";
    root.innerHTML = ErrorState(error, "data-retry-background");
    one("[data-retry-background]")?.addEventListener("click", loadAccountBackgroundSettings);
  }
}

async function renderShareLinks() {
  setPageTitle("分享链接");
  const requestedId = new URLSearchParams(location.search).get("id");
  app.innerHTML = Workspace(`${PageHead("分享链接", "按时间、密码和自定义后缀分享类或指定照片。分享只引用原图。", requestedId ? Button("新建分享", { iconName: "plus", tone: "primary", attrs: "data-new-share" }) : "")}
    <div id="share-content" class="loading-state">正在载入分享链接…</div>`, "/share-link");
  one("[data-new-share]")?.addEventListener("click", () => navigate("/share-link"));
  const version = state.routeVersion;
  try {
    const linksData = await Client.shareLinks(true);
    if (version !== state.routeVersion) return;
    state.shareLinks = listOf(linksData, "links", "shareLinks").map(normalizeShare);
    state.shareClasses = listOf(linksData, "classes").map(normalizeClass);
    state.shareLoosePhotos = listOf(linksData, "photos", "savedPhotos")
      .map(normalizePhoto)
      .filter((photo) => photo.savedKind !== "class");
    let selected = state.shareLinks.find((item) => item.id === requestedId) || null;
    if (selected) {
      try { selected = normalizeShare(await Client.shareLink(selected.id).then((data) => data.link || data.shareLink || data)); }
      catch (error) { toast(friendlyError(error), true); }
    }
    resetShareSelection(selected);
    byId("share-content").className = "share-layout";
    byId("share-content").innerHTML = `${Card(`<div class="share-list">
      ${state.shareLinks.length ? state.shareLinks.map((item) => `<button class="share-row ${selected?.id === item.id ? "active" : ""}" type="button" data-share-open="${escapeAttr(item.id)}"><strong>/${escapeHtml(item.slug)}</strong><small>${item.active ? "有效" : "未生效或已过期"} · ${item.passwordRequired ? "需要密码" : "无需密码"}</small></button>`).join("") : EmptyState("share", "暂无分享链接")}
    </div>`)}${renderShareEditor(selected)}`;
    bindSharePage(selected);
  } catch (error) {
    if (version === state.routeVersion) byId("share-content").outerHTML = ErrorState(error, "data-retry-share");
    one("[data-retry-share]")?.addEventListener("click", renderShareLinks);
  }
}

function renderShareEditor(share) {
  const slug = share?.slug || "";
  const startAt = toLocalDateTime(share?.startAt || new Date());
  const endAt = toLocalDateTime(share?.endAt || new Date(Date.now() + 7 * 86_400_000));
  return Card(`<form id="share-form">
    <div class="form-grid">
      <label class="field"><span>自定义后缀</span><input class="input" name="slug" value="${escapeAttr(slug)}" pattern="[A-Za-z0-9_\\-]{3,64}" minlength="3" maxlength="64" placeholder="graduation-2026" required></label>
      <div class="field share-password-field"><label class="check-label"><input class="switch-input" name="passwordEnabled" type="checkbox" data-password-enabled ${share?.passwordRequired ? "checked" : ""}><span class="switch ${share?.passwordRequired ? "on" : ""}" aria-hidden="true"></span><span>需要密码</span></label>
        ${share?.passwordRequired ? `<div class="share-password-owner" data-password-owner>
          <button type="button" data-edit-password title="点击修改密码"><code>${escapeHtml(share.password || "点击设置新密码")}</code></button>
          ${share.password ? `<button class="icon-button" type="button" data-copy-password aria-label="复制密码">${icon("copy")}</button>` : ""}
        </div>` : ""}
        <input class="input" name="password" type="password" minlength="6" autocomplete="new-password" placeholder="至少 6 位" ${share?.passwordRequired ? "hidden disabled" : "disabled"}>
      </div>
      ${DateTimeField("startAt", "开始时间", startAt)}
      ${DateTimeField("endAt", "结束时间", endAt)}
      <div class="field span-2"><div class="share-picker-title"><span>选择分享内容</span>${Button("刷新", { iconName: "history", size: "small", attrs: "data-refresh-share-content" })}</div><p class="camera-note">勾选整个类，或展开后选择其中几张。原内容删除后，对应分享也会隐藏。</p><div id="share-picker" class="share-picker ui-modal-scroll">${renderSharePicker()}</div></div>
    </div>
    <div class="dialog-actions" style="padding:20px 0 0">
      ${share ? Button("复制链接", { iconName: "copy", attrs: "data-copy-share" }) : ""}
      ${share ? Button("删除链接", { iconName: "trash", tone: "danger", attrs: "data-delete-share" }) : ""}
      ${Button(share ? "保存更改" : "创建分享", { tone: "primary", type: "submit" })}
    </div>
  </form>`, "share-editor");
}

function renderSharePicker() {
  if (!state.shareClasses.length && !state.shareLoosePhotos.length) {
    return EmptyState("class", "请先创建类或另存照片");
  }
  const classes = state.shareClasses.map((item) => {
    const photos = state.expandedShareClasses.get(item.id);
    const classChecked = state.shareSelection.classIds.has(item.id);
    return `<section class="share-class">
      <div class="share-class-head">
        <label class="check-label share-check-label"><input class="choice-input" type="checkbox" data-share-class="${escapeAttr(item.id)}" ${classChecked ? "checked" : ""}><span class="photo-check ${classChecked ? "on" : ""}" aria-hidden="true"></span><span><strong>${escapeHtml(item.name)}</strong><br><small>${item.photoCount} 张 · ${item.visibility}</small></span></label>
        ${Button(photos ? "收起照片" : "选择照片", { size: "small", attrs: `data-expand-share="${escapeAttr(item.id)}"` })}
      </div>
      ${photos ? `<div class="share-photo-list">${photos.length ? photos.map((photo) => `<label class="share-photo-choice"><input class="choice-input" type="checkbox" data-share-photo="${escapeAttr(photo.id)}" ${state.shareSelection.photoIds.has(photo.id) ? "checked" : ""} ${classChecked ? "disabled" : ""}><img src="${escapeAttr(photo.thumbnailUrl || photo.url)}" alt="" loading="lazy"><span class="photo-check ${state.shareSelection.photoIds.has(photo.id) ? "on" : ""}" aria-hidden="true"></span></label>`).join("") : "<span class='camera-note'>暂无照片</span>"}</div>` : ""}
    </section>`;
  }).join("");
  const loose = state.shareLoosePhotos.length ? `<section class="share-class">
    <div class="share-class-head"><div><strong>独立照片</strong><br><small>原类删除后由你接管的原图</small></div></div>
    <div class="share-photo-list">${state.shareLoosePhotos.map((photo) => `<label class="share-photo-choice">
      <input class="choice-input" type="checkbox" data-share-photo="${escapeAttr(photo.id)}" ${state.shareSelection.photoIds.has(photo.id) ? "checked" : ""}>
      <img src="${escapeAttr(photo.thumbnailUrl || photo.url)}" alt="" loading="lazy">
      <span class="photo-check ${state.shareSelection.photoIds.has(photo.id) ? "on" : ""}" aria-hidden="true"></span>
    </label>`).join("")}</div>
  </section>` : "";
  return `${classes}${loose}`;
}

function bindSharePage(share) {
  all("[data-share-open]").forEach((button) => button.addEventListener("click", () => navigate(`/share-link?id=${encodeURIComponent(button.dataset.shareOpen)}`)));
  bindSharePicker();
  bindDateTimeFields();
  one("[data-refresh-share-content]")?.addEventListener("click", refreshShareContent);
  byId("share-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const startAt = new Date(String(form.get("startAt") || "")).toISOString();
    const endAt = new Date(String(form.get("endAt") || "")).toISOString();
    if (new Date(endAt) <= new Date(startAt)) return toast("结束时间必须晚于开始时间。", true);
    const payload = {
      slug: String(form.get("slug") || "").trim(),
      startsAt: startAt,
      endsAt: endAt,
      classIds: [...state.shareSelection.classIds],
      photoIds: [...state.shareSelection.photoIds],
      passwordEnabled: form.get("passwordEnabled") === "on",
    };
    const passwordText = String(form.get("password") || "");
    if (payload.passwordEnabled && ((!share?.passwordRequired && passwordText.length < 6) || (passwordText && passwordText.length < 6))) {
      return toast("启用密码时请设置至少 6 位密码。", true);
    }
    if (payload.passwordEnabled && passwordText) payload.password = passwordText;
    if (!payload.passwordEnabled) payload.password = null;
    if (!payload.classIds.length && !payload.photoIds.length) return toast("请至少选择一个类或一张照片。", true);
    const selectedCount = payload.photoIds.length + payload.classIds.reduce((sum, id) =>
      sum + (state.shareClasses.find((item) => item.id === id)?.photoCount || 0), 0);
    const durationDays = (new Date(endAt) - new Date(startAt)) / 86_400_000;
    const risks = [
      durationDays > 30 ? `有效期约 ${Math.ceil(durationDays)} 天` : "",
      selectedCount > 50 ? `包含约 ${selectedCount} 张照片` : "",
      !payload.passwordEnabled && (durationDays > 7 || selectedCount > 5) ? "未设置密码" : "",
    ].filter(Boolean);
    const saveShare = async () => {
      try {
        const data = share
          ? await Client.updateShareLink(share.id, payload)
          : await Client.createShareLink(payload);
        const saved = normalizeShare(data.link || data.shareLink || data);
        toast(share ? "分享设置已保存。" : "分享链接已创建。");
        navigate(`/share-link?id=${encodeURIComponent(saved.id || share?.id || "")}`);
      } catch (error) {
        toast(friendlyError(error), true);
      }
    };
    if (risks.length) {
      confirmAction("确认分享设置？", `${risks.join("，")}。请确认接收范围。`, saveShare, true);
    } else {
      await saveShare();
    }
  });
  one("[data-copy-share]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    await copyText(`${location.origin}/s/${share.slug}`, false);
    button.classList.add("copied");
    button.innerHTML = `${icon("check")}<span>Copied</span>`;
  });
  one("[data-copy-password]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    await copyText(share.password, false);
    button.classList.add("copied");
    button.innerHTML = icon("check");
  });
  one("[data-edit-password]")?.addEventListener("click", () => {
    const password = one('input[name="password"]', byId("share-form"));
    password.hidden = false;
    password.disabled = false;
    one("[data-password-owner]")?.setAttribute("hidden", "");
    password.focus();
  });
  one("[data-password-enabled]")?.addEventListener("change", (event) => {
    const password = one('input[name="password"]', byId("share-form"));
    event.currentTarget.nextElementSibling.classList.toggle("on", event.currentTarget.checked);
    if (!event.currentTarget.checked) {
      password.value = "";
      password.disabled = true;
      password.hidden = true;
      one("[data-password-owner]")?.setAttribute("hidden", "");
    } else if (!share?.passwordRequired) {
      password.hidden = false;
      password.disabled = false;
      password.focus();
    } else {
      one("[data-password-owner]")?.removeAttribute("hidden");
    }
  });
  one("[data-delete-share]")?.addEventListener("click", () =>
    confirmAction("删除这个分享链接？", "链接将立即失效，原类和照片不会被删除。", async () => {
      await Client.deleteShareLink(share.id);
      navigate("/share-link");
    }, true));
}

function bindSharePicker() {
  all("[data-share-class]").forEach((input) => input.addEventListener("change", () => {
    input.checked ? state.shareSelection.classIds.add(input.dataset.shareClass) : state.shareSelection.classIds.delete(input.dataset.shareClass);
    one("#share-picker").innerHTML = renderSharePicker();
    bindSharePicker();
  }));
  all("[data-share-photo]").forEach((input) => input.addEventListener("change", () => {
    input.checked ? state.shareSelection.photoIds.add(input.dataset.sharePhoto) : state.shareSelection.photoIds.delete(input.dataset.sharePhoto);
  }));
  all("[data-expand-share]").forEach((button) => button.addEventListener("click", async () => {
    const classId = button.dataset.expandShare;
    if (state.expandedShareClasses.has(classId)) state.expandedShareClasses.delete(classId);
    else {
      button.disabled = true;
      try {
        const data = await Client.classPhotos(classId);
        const item = state.shareClasses.find((entry) => entry.id === classId);
        state.expandedShareClasses.set(classId, listOf(data, "photos").map((photo) => normalizePhoto(photo, item?.name)));
      } catch (error) { toast(friendlyError(error), true); }
    }
    one("#share-picker").innerHTML = renderSharePicker();
    bindSharePicker();
  }));
}

async function refreshShareContent(event) {
  const button = event?.currentTarget;
  if (button) button.disabled = true;
  try {
    const data = await Client.shareLinks(true);
    state.shareClasses = listOf(data, "classes").map(normalizeClass);
    state.shareLoosePhotos = listOf(data, "photos", "savedPhotos")
      .map(normalizePhoto)
      .filter((photo) => photo.savedKind !== "class");
    state.expandedShareClasses.clear();
    const picker = byId("share-picker");
    if (picker) {
      picker.innerHTML = renderSharePicker();
      bindSharePicker();
    }
    toast("内容已刷新。");
  } catch (error) {
    toast(friendlyError(error), true);
  } finally {
    if (button?.isConnected) button.disabled = false;
  }
}

function resetShareSelection(share) {
  state.expandedShareClasses.clear();
  state.shareSelection = {
    classIds: new Set(idsOf(share?.classIds || share?.class_ids || share?.classes)),
    photoIds: new Set(idsOf(share?.photoIds || share?.photo_ids || share?.photos)),
  };
}

function normalizeShare(item = {}) {
  const now = Date.now();
  const startAt = item.startAt || item.startsAt || item.start_at || item.starts_at || "";
  const endAt = item.endAt || item.endsAt || item.end_at || item.ends_at || "";
  return {
    ...item,
    id: String(item.id || ""),
    slug: item.slug || item.customSlug || item.custom_slug || "",
    startAt,
    endAt,
    passwordRequired: Boolean(item.passwordRequired ?? item.password_required ?? item.passwordEnabled ?? item.password_enabled ?? item.hasPassword ?? item.has_password),
    active: item.active ?? (item.status !== "disabled" && (!startAt || new Date(startAt).getTime() <= now) && (!endAt || new Date(endAt).getTime() > now)),
  };
}

async function renderPublicShare(slug) {
  setPageTitle("分享照片");
  app.innerHTML = `${AppHeader()}<main id="main" class="public-share"><div id="public-share" class="loading-state">正在打开分享链接…</div></main>`;
  const version = state.routeVersion;
  try {
    const data = await Client.publicShare(slug);
    if (version !== state.routeVersion) return;
    if (data.locked) return renderShareUnlock(slug);
    renderPublicShareData(slug, data);
  } catch (error) {
    if (version !== state.routeVersion) return;
    if (error.status === 401 || error.details?.requiresPassword || error.details?.passwordRequired) renderShareUnlock(slug);
    else byId("public-share").outerHTML = ErrorState(error, "data-retry-public-share");
    one("[data-retry-public-share]")?.addEventListener("click", () => renderPublicShare(slug));
  }
}

function renderShareUnlock(slug) {
  byId("public-share").className = "card public-share-head";
  byId("public-share").innerHTML = `<div style="max-width:420px;margin:auto">${icon("lock")}<h1>此分享需要密码</h1><p class="camera-note">输入分享者设置的密码后即可查看。</p>
    <form id="unlock-share" class="field"><label for="share-password">访问密码</label><input id="share-password" class="input" name="password" type="password" required autocomplete="current-password">${Button("解锁", { tone: "primary", type: "submit" })}</form></div>`;
  byId("unlock-share").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await Client.unlockShare(slug, new FormData(event.currentTarget).get("password"));
      renderPublicShare(slug);
    } catch (error) { toast(friendlyError(error), true); }
  });
}

function renderPublicShareData(slug, data) {
  const share = normalizeShare(data.share || data.link || data);
  const classes = listOf(data, "classes");
  let photos = listOf(data, "photos");
  if (!photos.length) photos = classes.flatMap((item) => listOf(item, "photos").map((photo) => ({ ...photo, className: item.name })));
  photos = photos.map((photo) => {
    const normalized = normalizePhoto(photo);
    if (!photo.url && normalized.available) normalized.url = `/api/public/shares/${encodeURIComponent(slug)}/photos/${encodeURIComponent(normalized.id)}/file`;
    return normalized;
  });
  state.selected.clear();
  state.activePhotos = photos;
  byId("public-share").className = "";
  byId("public-share").innerHTML = `${Card(`<h1>${escapeHtml(share.title || `分享：/${slug}`)}</h1><p>${share.startAt ? formatDate(share.startAt) : "现在"} 至 ${share.endAt ? formatDate(share.endAt) : "长期有效"} · ${photos.length} 张可见照片</p>`, "public-share-head")}${PhotoGrid(photos)}${SelectionToolbar()}`;
  bindPhotoActions(photos);
}

async function renderAdminOverview() {
  setPageTitle("管理概览");
  app.innerHTML = Workspace(`${PageHead("管理概览", "查看全站类、图片、用户和存储状态。")}
    <div id="admin-overview" class="loading-state">正在载入全站数据…</div>`, "/admin", { admin: true });
  const version = state.routeVersion;
  try {
    const [data, classData] = await Promise.all([Client.adminOverview(), Client.adminClasses()]);
    if (version !== state.routeVersion) return;
    const overview = data.overview || data;
    const recent = listOf(classData, "classes").map(normalizeClass);
    const stats = [
      ["全部类", overview.classCount ?? overview.class_count ?? 0],
      ["全部照片", overview.photoCount ?? overview.photo_count ?? 0],
      ["用户", overview.userCount ?? overview.user_count ?? 0],
      ["总存储", formatBytes(overview.storageBytes ?? overview.storage_bytes ?? 0)],
    ];
    byId("admin-overview").className = "";
    byId("admin-overview").innerHTML = `<div class="stats">${stats.map(([label, value]) => Card(`<div class="stat-label">${escapeHtml(label)}</div><div class="stat-value">${escapeHtml(value)}</div>`, "stat")).join("")}</div>
      ${Card(`<div class="save-section-head"><h2>全部类</h2><a class="button small" href="/admin/classes" data-nav>管理类</a></div>${AdminTable(["类", "图片", "占用空间", "上传者", "状态"], recent.map((item) => `<tr><td>${item.deletedAt ? `<span class="cell-main">${escapeHtml(item.name)}</span>` : `<a class="cell-main" href="/admin/classes?id=${encodeURIComponent(item.id)}" data-nav>${escapeHtml(item.name)}</a>`}</td><td>${item.photoCount}</td><td>${formatBytes(item.sizeBytes)}</td><td>${escapeHtml(item.ownerName)}</td><td><span class="badge ${item.deletedAt ? "" : item.visibility === "public" ? "green" : "purple"}">${item.deletedAt ? "待清理" : item.visibility === "public" ? "公开" : "私有"}</span></td></tr>`), "暂无类")}`, "table-card")}`;
  } catch (error) {
    if (version === state.routeVersion) byId("admin-overview").outerHTML = ErrorState(error, "data-retry-admin-overview");
    one("[data-retry-admin-overview]")?.addEventListener("click", renderAdminOverview);
  }
}

async function renderAdminAudit() {
  setPageTitle("审计");
  app.innerHTML = Workspace(`${PageHead("审计", "按用户查看操作记录。")}
    <div id="admin-audit" class="loading-state">正在载入操作记录…</div>`, "/admin/audit", { admin: true });
  const version = state.routeVersion;
  try {
    const data = await Client.adminAudit();
    if (version !== state.routeVersion) return;
    const logs = listOf(data, "logs");
    const groups = new Map();
    for (const log of logs) {
      const key = log.userId || log.authUuid || "unknown";
      if (!groups.has(key)) groups.set(key, { userName: log.userName || "未知用户", authUuid: log.authUuid || "", logs: [] });
      groups.get(key).logs.push(log);
    }
    const root = byId("admin-audit");
    root.className = "audit-list";
    root.innerHTML = groups.size ? [...groups.entries()].map(([key, group]) => `<article class="card audit-user-card">
      <header class="audit-user-head">
        <div><h3>${escapeHtml(group.userName)}</h3><div class="audit-uuid-line"><code class="audit-uuid" title="${escapeAttr(group.authUuid)}">${escapeHtml(group.authUuid || key)}</code>${group.authUuid ? `<button class="icon-button" type="button" data-copy-uuid="${escapeAttr(group.authUuid)}" aria-label="复制 UUID">${icon("copy")}</button>` : ""}</div></div>
        <div class="page-actions"><span class="result-meta">${group.logs.length} 条</span>${Button("查看", { size: "small", attrs: `data-audit-view="${escapeAttr(key)}"` })}</div>
      </header>
      <div class="audit-panel" data-audit-panel="${escapeAttr(key)}" hidden>
        ${group.logs.map((log) => `<div class="audit-row ${log.sensitive ? "sensitive" : ""}">
          <div class="audit-action"><strong>${escapeHtml(auditActionName(log.action))}</strong>${auditTargetMarkup(log)}</div>
          <span>${formatDate(log.createdAt)}</span>
          <code>${escapeHtml(log.ipAddress || "—")}</code>
          <span class="badge">${escapeHtml(log.countryCode || "--")}</span>
        </div>`).join("")}
      </div>
    </article>`).join("") : EmptyState("history", "暂无操作记录");
    all("[data-audit-view]").forEach((button) => button.addEventListener("click", () => {
      const panel = one(`[data-audit-panel="${cssEscape(button.dataset.auditView)}"]`);
      if (!panel) return;
      panel.hidden = !panel.hidden;
      button.querySelector("span").textContent = panel.hidden ? "查看" : "收起";
    }));
    all("[data-copy-uuid],[data-copy-audit-target]").forEach((button) => button.addEventListener("click", async () => {
      await copyText(button.dataset.copyUuid || button.dataset.copyAuditTarget, false);
      button.classList.add("copied");
      button.innerHTML = icon("check");
    }));
  } catch (error) {
    if (version === state.routeVersion) byId("admin-audit").outerHTML = ErrorState(error, "data-retry-admin-audit");
    one("[data-retry-admin-audit]")?.addEventListener("click", renderAdminAudit);
  }
}

function auditTargetMarkup(log) {
  const name = String(log.targetName || "");
  if (!name) return "";
  const label = log.targetKind === "photos"
    ? `「${name}」类下的 ${Number(log.targetCount || 1)} 张照片`
    : name;
  return `<span class="audit-target-line"><span class="audit-target" title="${escapeAttr(label)}">${escapeHtml(label)}</span><button class="icon-button" type="button" data-copy-audit-target="${escapeAttr(name)}" aria-label="复制对象名称">${icon("copy")}</button></span>`;
}

function auditActionName(action) {
  const zh = {
    "class.create": "创建类",
    "class.update": "修改类",
    "class.delete": "删除类",
    "photo.upload": "上传照片",
    "photo.delete": "删除照片",
    "selfie.search": "自拍识别",
    "saved.add": "另存内容",
    "saved.remove": "移除已存内容",
    "share.create": "创建分享",
    "share.update": "修改分享",
    "share.delete": "删除分享",
    "background.upload": "上传背景",
    "background.mode": "切换背景",
    "background.delete": "删除背景",
    "background.restore": "还原背景",
    "admin.user.update": "修改用户角色",
    "admin.role.create": "创建角色",
    "admin.role.update": "修改角色",
    "admin.role.delete": "删除角色",
    "admin.force_delete": "强制删除",
  };
  const en = {
    "class.create": "Created class",
    "class.update": "Updated class",
    "class.delete": "Deleted class",
    "photo.upload": "Uploaded photos",
    "photo.delete": "Deleted photos",
    "selfie.search": "Selfie search",
    "saved.add": "Saved content",
    "saved.remove": "Removed saved content",
    "share.create": "Created share",
    "share.update": "Updated share",
    "share.delete": "Deleted share",
    "background.upload": "Uploaded background",
    "background.mode": "Changed background",
    "background.delete": "Deleted background",
    "background.restore": "Restored background",
    "admin.user.update": "Changed user role",
    "admin.role.create": "Created role",
    "admin.role.update": "Updated role",
    "admin.role.delete": "Deleted role",
    "admin.force_delete": "Force deleted",
  };
  return (getLocale() === "en" ? en : zh)[action] || action;
}

async function renderAdminClasses() {
  const classId = new URLSearchParams(location.search).get("id");
  if (classId) return renderAdminClassDetail(classId);
  setPageTitle("类管理");
  app.innerHTML = Workspace(`${PageHead("全部类", "管理可见性、上传者、照片数量和实际占用空间。", Button("新建类", { iconName: "plus", tone: "primary", attrs: "data-admin-create-class" }))}
    <div id="admin-classes" class="loading-state">正在载入类…</div>`, "/admin/classes", { admin: true });
  const version = state.routeVersion;
  try {
    const data = await Client.adminClasses();
    if (version !== state.routeVersion) return;
    const classes = listOf(data, "classes").map(normalizeClass);
    const rows = classes.map((item) => `<tr>
      <td>${item.deletedAt ? `<span class="cell-main">${escapeHtml(item.name)}</span>` : `<a class="cell-main" href="/admin/classes?id=${encodeURIComponent(item.id)}" data-nav>${escapeHtml(item.name)}</a>`}<div class="cell-sub">${escapeHtml(item.id)}</div></td>
      <td>${item.photoCount}</td><td>${formatBytes(item.sizeBytes)}</td><td>${escapeHtml(item.ownerName)}</td><td>${item.deletedAt ? '<span class="badge">待清理</span>' : `<span data-admin-visibility-shell="${escapeAttr(item.id)}">${VisibilitySwitch(item)}</span>`}</td>
      <td><div class="row-actions">${item.deletedAt ? "" : Button("管理", { size: "small", attrs: `data-manage-class="${escapeAttr(item.id)}"` })}${Button(item.deletedAt ? "立即抹除" : "强制删除", { iconName: "trash", tone: "danger", size: "small", attrs: `data-force-class="${escapeAttr(item.id)}"` })}</div></td>
    </tr>`);
    byId("admin-classes").className = "";
    byId("admin-classes").innerHTML = AdminTable(["类", "图片", "占用空间", "上传者", "可见性", "操作"], rows, "还没有类");
    all("[data-manage-class]").forEach((button) => button.addEventListener("click", () => navigate(`/admin/classes?id=${encodeURIComponent(button.dataset.manageClass)}`)));
    all("[data-visibility]").forEach((button) => button.addEventListener("click", async () => {
      const item = classes.find((entry) => entry.id === button.dataset.visibility);
      try {
        const next = item.visibility === "public" ? "private" : "public";
        const result = await Client.updateClass(item.id, { visibility: next });
        Object.assign(item, normalizeClass(result.class || { ...item, visibility: next }));
        const shell = one(`[data-admin-visibility-shell="${cssEscape(item.id)}"]`);
        if (shell) {
          shell.innerHTML = VisibilitySwitch(item);
          one("[data-visibility]", shell)?.addEventListener("click", () => bindVisibilityButton(item, shell, true));
        }
        toast(next === "public" ? "已设为公开。" : "已设为私有。");
      } catch (error) { toast(friendlyError(error), true); }
    }));
    all("[data-force-class]").forEach((button) => button.addEventListener("click", () =>
      confirmAction("强制删除这个类？", "仅管理员可执行。原文件和所有相关内容会永久删除。", async () => {
        await Client.forceDeleteClass(button.dataset.forceClass);
        await renderAdminClasses();
      }, true)));
  } catch (error) {
    if (version === state.routeVersion) byId("admin-classes").outerHTML = ErrorState(error, "data-retry-admin-classes");
    one("[data-retry-admin-classes]")?.addEventListener("click", renderAdminClasses);
  }
  one("[data-admin-create-class]")?.addEventListener("click", () => openClassDialog(null, renderAdminClasses));
}

async function renderAdminClassDetail(classId) {
  setPageTitle("类详情");
  app.innerHTML = Workspace(`${PageHead("类详情", "载入类信息…", `<a class="button" href="/admin/classes" data-nav>${icon("left")}返回全部类</a>`)}
    <div id="admin-class-detail" class="loading-state">正在载入照片…</div>`, "/admin/classes", { admin: true });
  const version = state.routeVersion;
  try {
    const [classesData, photosData] = await Promise.all([Client.adminClasses(), Client.classPhotos(classId)]);
    if (version !== state.routeVersion) return;
    const item = listOf(classesData, "classes").map(normalizeClass).find((entry) => entry.id === classId)
      || normalizeClass(photosData.class || { id: classId });
    const photos = listOf(photosData, "photos").map((photo) => normalizePhoto(photo, item.name));
    state.selected.clear();
    state.activePhotos = photos;
    one(".page-head h1").textContent = item.name;
    one(".page-head p").textContent = `${photos.length} 张照片 · ${formatBytes(item.sizeBytes)} · 上传者 ${item.ownerName}`;
    byId("admin-class-detail").className = "";
    byId("admin-class-detail").innerHTML = `${Card(`<div class="page-actions">
      <label class="button primary">${icon("upload")}上传照片<input id="admin-photo-upload" type="file" accept="image/*" multiple hidden></label>
      ${Button("重试未索引", { iconName: "history", attrs: "data-retry-ingest" })}
      ${Button("全选", { attrs: "data-select-all-admin" })}
      ${Button("删除所选", { iconName: "trash", tone: "danger", attrs: "data-delete-selected-admin" })}
      ${Button("强制删除所选", { iconName: "trash", tone: "danger", attrs: "data-force-selected-admin" })}
      <span style="margin-left:auto">${VisibilitySwitch(item)}</span>
    </div><p class="camera-note"><strong>公开：</strong>可从首页搜索。<strong>私有：</strong>只能通过分享链接访问。</p>`, "class-top-card")}
    <div style="margin-top:18px">${PhotoGrid(photos)}</div>${SelectionToolbar()}`;
    bindPhotoActions(photos);
    byId("admin-photo-upload").addEventListener("change", async (event) => {
      if (!event.target.files?.length) return;
      const files = [...event.target.files];
      showUploadProgress(files.length);
      try {
        const result = await Client.uploadPhotos(classId, files, updateUploadProgress);
        finishUploadProgress(false);
        toast(result.queued === false
          ? "照片已保存，识别功能稍后可用。"
          : "已加入队列，可离开页面。", result.queued === false);
        await renderAdminClassDetail(classId);
      } catch (error) {
        finishUploadProgress(true);
        toast(friendlyError(error), true);
      }
    });
    one("[data-retry-ingest]").addEventListener("click", async (event) => {
      event.currentTarget.disabled = true;
      try {
        const result = await Client.retryIngest();
        toast(`已重新排队 ${Number(result.requeued || 0)} 张照片。`);
        await renderAdminClassDetail(classId);
      } catch (error) {
        event.currentTarget.disabled = false;
        toast(friendlyError(error), true);
      }
    });
    one("[data-select-all-admin]").addEventListener("click", () => {
      state.selected = new Set(photos.map((photo) => photo.id));
      all("[data-photo-open]").forEach((card) => {
        card.closest(".photo-card")?.classList.add("selected");
        one("[data-photo-select]", card.closest(".photo-card"))?.classList.add("on");
      });
      updateSelectionToolbar();
    });
    one("[data-delete-selected-admin]").addEventListener("click", () =>
      state.selected.size ? confirmAction("删除所选照片？", "照片会立即隐藏；已被他人另存的内容将继续保留。", async () => {
        for (const photoId of state.selected) await Client.deletePhoto(photoId);
        await renderAdminClassDetail(classId);
      }, true) : toast("请先选择照片。", true));
    one("[data-force-selected-admin]").addEventListener("click", () =>
      state.selected.size ? confirmAction("强制删除所选照片？", "仅管理员可执行。原文件和所有相关内容会永久删除。", async () => {
        for (const photoId of state.selected) await Client.forceDeletePhoto(photoId);
        await renderAdminClassDetail(classId);
      }, true) : toast("请先选择照片。", true));
    one("[data-visibility]").addEventListener("click", async () => {
      try {
        await Client.updateClass(item.id, { visibility: item.visibility === "public" ? "private" : "public" });
        await renderAdminClassDetail(classId);
      } catch (error) { toast(friendlyError(error), true); }
    });
  } catch (error) {
    if (version === state.routeVersion) byId("admin-class-detail").outerHTML = ErrorState(error, "data-retry-admin-class");
    one("[data-retry-admin-class]")?.addEventListener("click", () => renderAdminClassDetail(classId));
  }
}

async function renderAdminUsers() {
  setPageTitle("用户控制");
  app.innerHTML = Workspace(`${PageHead("用户控制", "查看用户身份、角色权限和存储用量，并调整角色归属。")}
    <div id="admin-users" class="loading-state">正在载入用户…</div>`, "/admin/users", { admin: true });
  const version = state.routeVersion;
  try {
    const [usersData, rolesData] = await Promise.all([Client.users(), Client.roles()]);
    if (version !== state.routeVersion) return;
    const users = listOf(usersData, "users");
    const roles = listOf(rolesData, "roles");
    const rows = users.map((user) => {
      const role = roles.find((item) => String(item.id) === String(user.roleId || user.role_id));
      const used = Number(user.storageUsedBytes ?? user.storage_used_bytes ?? 0);
      const quota = Number(user.quotaBytes ?? user.quota_bytes ?? role?.quotaBytes ?? role?.quota_bytes ?? 0);
      return `<tr><td><span class="cell-main">${escapeHtml(primaryUserName(user))}</span><div class="cell-sub">${escapeHtml(secondaryUserName(user) || user.authUuid || user.auth_uuid || user.id)}</div></td>
        <td><span class="badge purple">${escapeHtml(role?.name || user.roleName || user.role_name || "未分配")}</span></td>
        <td>${escapeHtml(permissionName(role?.accessMode || role?.access_mode || user.accessMode || user.access_mode))}</td>
        <td>${formatBytes(used)} / ${formatQuota(quota)}${StorageMeter({ usedBytes: used, quotaBytes: quota })}</td>
        <td><div class="row-actions">${Button("修改", { iconName: "edit", size: "small", attrs: `data-edit-user="${escapeAttr(user.id)}"` })}</div></td></tr>`;
    });
    byId("admin-users").className = "";
    byId("admin-users").innerHTML = AdminTable(["用户", "角色", "权限", "存储用量", "操作"], rows, "暂无用户");
    all("[data-edit-user]").forEach((button) => button.addEventListener("click", () => {
      const user = users.find((item) => String(item.id) === button.dataset.editUser);
      if (user) openUserDialog(user, roles);
    }));
  } catch (error) {
    if (version === state.routeVersion) byId("admin-users").outerHTML = ErrorState(error, "data-retry-admin-users");
    one("[data-retry-admin-users]")?.addEventListener("click", renderAdminUsers);
  }
}

function openUserDialog(user, roles) {
  const current = String(user.roleId || user.role_id || "");
  openDialog({
    title: `修改 ${primaryUserName(user)}`,
    body: `<label class="field"><span>角色</span><select class="select" name="roleId" required>${roles.map((role) => `<option value="${escapeAttr(role.id)}" ${String(role.id) === current ? "selected" : ""}>${escapeHtml(role.name)} · ${escapeHtml(permissionName(role.accessMode || role.access_mode))}</option>`).join("")}</select></label>
      <p class="camera-note">修改后，权限和空间上限立即以新角色为准。</p>`,
    submitText: "保存",
    onSubmit: async (form) => {
      await Client.updateUser(user.id, { roleId: form.get("roleId") });
      await renderAdminUsers();
    },
  });
}

async function renderAdminRoles() {
  setPageTitle("权限控制");
  app.innerHTML = Workspace(`${PageHead("权限控制", "创建多个角色，配置权限、存储空间和新用户默认角色。", Button("新建角色", { iconName: "plus", tone: "primary", attrs: "data-create-role" }))}
    <div id="admin-roles" class="loading-state">正在载入角色…</div>`, "/admin/roles", { admin: true });
  const version = state.routeVersion;
  try {
    const data = await Client.roles();
    if (version !== state.routeVersion) return;
    const roles = listOf(data, "roles");
    const rows = roles.map((role) => `<tr><td><span class="cell-main">${escapeHtml(role.name)}</span>${role.isDefault || role.is_default ? ' <span class="badge purple">默认</span>' : ""}${role.isSystem || role.is_system ? ' <span class="badge">系统</span>' : ""}</td>
      <td>${escapeHtml(permissionName(role.accessMode || role.access_mode))}</td><td>${formatQuota(role.quotaBytes ?? role.quota_bytes)}</td><td>${Number(role.userCount ?? role.user_count ?? 0)}</td>
      <td><div class="row-actions">${Button("修改", { iconName: "edit", size: "small", attrs: `data-edit-role="${escapeAttr(role.id)}"` })}${role.isSystem || role.is_system ? "" : Button("删除", { iconName: "trash", tone: "danger", size: "small", attrs: `data-delete-role="${escapeAttr(role.id)}"` })}</div></td></tr>`);
    byId("admin-roles").className = "";
    byId("admin-roles").innerHTML = AdminTable(["角色", "权限", "空间上限", "用户数", "操作"], rows, "暂无角色");
    one("[data-create-role]")?.addEventListener("click", () => openRoleDialog(null));
    all("[data-edit-role]").forEach((button) => button.addEventListener("click", () => openRoleDialog(roles.find((role) => String(role.id) === button.dataset.editRole))));
    all("[data-delete-role]").forEach((button) => button.addEventListener("click", () => {
      const role = roles.find((item) => String(item.id) === button.dataset.deleteRole);
      confirmAction(`删除角色「${role?.name || ""}」？`, "已有用户或默认角色不能删除，请先调整对应关系。", async () => {
        await Client.deleteRole(button.dataset.deleteRole);
        await renderAdminRoles();
      }, true);
    }));
  } catch (error) {
    if (version === state.routeVersion) byId("admin-roles").outerHTML = ErrorState(error, "data-retry-admin-roles");
    one("[data-retry-admin-roles]")?.addEventListener("click", renderAdminRoles);
  }
}

function openRoleDialog(role) {
  const mode = role?.accessMode || role?.access_mode || "own_write";
  const quota = bytesToGb(role?.quotaBytes ?? role?.quota_bytes ?? 5e9);
  openDialog({
    title: role ? "修改角色" : "新建角色",
    body: `<label class="field"><span>名称</span><input class="input" name="name" value="${escapeAttr(role?.name || "")}" maxlength="50" required></label>
      <fieldset class="field" style="border:0;padding:0"><legend>权限</legend><div class="permission-options">${[
        ["all_read", "所有类只读", "可查看全部类，但不能创建、上传或删除。"],
        ["all_write", "所有类读写", "可查看并管理全部类和图片。"],
        ["own_write", "本人类读写", "可创建类，并管理本人拥有的类和图片。"],
        ["own_read", "本人类只读", "可另存其他类和照片；不能上传，也不显示个人存储用量。"],
      ].map(([value, title, text]) => `<label class="permission-option"><input type="radio" name="accessMode" value="${value}" ${mode === value ? "checked" : ""} required><span><strong>${title}</strong><small>${text}</small></span></label>`).join("")}</div></fieldset>
      <label class="field"><span>存储空间上限（GB）</span><input class="input" name="quotaGb" type="number" min="0" max="100000" step="0.1" value="${quota}" required><small>填写 0 表示不限量；接管原上传者删除的已另存内容时允许暂时超额，之后会暂停新上传。</small></label>
      <label class="check-label"><input type="checkbox" name="isDefault" ${role?.isDefault || role?.is_default ? "checked" : ""}><span>设为默认角色（自动应用给新用户）</span></label>`,
    submitText: role ? "保存" : "创建",
    onSubmit: async (form) => {
      const payload = {
        name: String(form.get("name") || "").trim(),
        accessMode: form.get("accessMode"),
        quotaBytes: Math.round(Number(form.get("quotaGb")) * 1e9),
        isDefault: form.get("isDefault") === "on",
      };
      role ? await Client.updateRole(role.id, payload) : await Client.createRole(payload);
      await renderAdminRoles();
    },
  });
}

function openClassDialog(item, onSaved) {
  const visibility = item?.visibility || "private";
  openDialog({
    title: item ? "修改类" : "新建类",
    body: `<label class="field"><span>类名称</span><input class="input" name="name" value="${escapeAttr(item?.name || "")}" maxlength="80" required autofocus></label>
      <label class="field"><span>介绍</span><textarea class="textarea" name="description" maxlength="240" rows="3" placeholder="简要介绍这个类">${escapeHtml(item?.description || "")}</textarea></label>
      <fieldset class="field" style="border:0;padding:0"><legend>可见性</legend><div class="visibility-segmented">
        <label class="visibility-choice"><input type="radio" name="visibility" value="public" ${visibility === "public" ? "checked" : ""}><span>${icon("globe")}<strong>公开</strong><small>可在 Aryuki 首页直接搜索到</small></span></label>
        <label class="visibility-choice"><input type="radio" name="visibility" value="private" ${visibility === "private" ? "checked" : ""}><span>${icon("lock")}<strong>私有</strong><small>搜索不到，仅分享链接可访问</small></span></label>
      </div></fieldset>`,
    submitText: item ? "保存" : "创建",
    onSubmit: async (form) => {
      const payload = {
        name: String(form.get("name") || "").trim(),
        description: String(form.get("description") || "").trim(),
        visibility: form.get("visibility"),
      };
      const result = item
        ? await Client.updateClass(item.id, payload)
        : await Client.createClass(payload);
      await onSaved?.(normalizeClass(result.class || result));
    },
  });
}

function openDialog({ title, body, submitText = "确定", onSubmit = async () => {}, danger = false, modalClass = "", hideActions = false }) {
  closeDialog();
  state.dialogFocus = document.activeElement;
  modalRoot.innerHTML = `<div class="modal-overlay" data-modal-overlay><section class="dialog ${escapeAttr(modalClass)}" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1">
    <form id="modal-form">
      <header class="dialog-head"><h2 id="modal-title">${escapeHtml(title)}</h2><button class="icon-button" type="button" data-dialog-close aria-label="关闭">${icon("close")}</button></header>
      <div class="dialog-body ui-modal-scroll">${body}</div>
      ${hideActions ? "" : `<footer class="dialog-actions">${Button("取消", { attrs: "data-dialog-close" })}${Button(submitText, { tone: danger ? "danger" : "primary", type: "submit", attrs: "data-dialog-submit" })}</footer>`}
    </form>
  </section></div>`;
  const dialog = one(".dialog", modalRoot);
  lockPageScroll();
  dialog.focus();
  all("[data-dialog-close]", dialog).forEach((button) => button.addEventListener("click", closeDialog));
  one("[data-modal-overlay]", modalRoot).addEventListener("click", (event) => {
    if (event.target === event.currentTarget) closeDialog();
  });
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeDialog();
  });
  if (hideActions) return dialog;
  byId("modal-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = one("[data-dialog-submit]", dialog);
    submit.disabled = true;
    try {
      await onSubmit(new FormData(event.currentTarget));
      closeDialog();
    } catch (error) {
      submit.disabled = false;
      toast(friendlyError(error), true);
    }
  });
}

function confirmAction(title, description, action, destructive = false) {
  openDialog({
    title,
    body: `<p>${escapeHtml(description)}</p>${destructive ? '<p class="badge red">请谨慎确认</p>' : ""}`,
    submitText: destructive ? "确认" : "继续",
    danger: destructive,
    modalClass: "confirm-dialog",
    onSubmit: action,
  });
}

function closeDialog() {
  if (!modalRoot.innerHTML) return;
  modalRoot.innerHTML = "";
  unlockPageScroll();
  state.dialogFocus?.focus?.();
  state.dialogFocus = null;
}

let lockedScrollY = 0;

function lockPageScroll() {
  if (document.body.classList.contains("modal-open")) return;
  lockedScrollY = window.scrollY;
  document.body.classList.add("modal-open");
  Object.assign(document.body.style, {
    position: "fixed",
    top: `-${lockedScrollY}px`,
    left: "0",
    right: "0",
    width: "100%",
  });
}

function unlockPageScroll() {
  if (!document.body.classList.contains("modal-open")) return;
  document.body.classList.remove("modal-open");
  Object.assign(document.body.style, { position: "", top: "", left: "", right: "", width: "" });
  window.scrollTo(0, lockedScrollY);
}

function toast(message, error = false) {
  const item = document.createElement("div");
  item.className = `toast ${error ? "error" : ""}`;
  item.textContent = message;
  toastRoot.append(item);
  setTimeout(() => item.remove(), 3_600);
}

let uploadProgressTimer = 0;

function showUploadProgress(count) {
  clearTimeout(uploadProgressTimer);
  byId("upload-progress")?.remove();
  document.body.insertAdjacentHTML("beforeend", `<aside id="upload-progress" class="upload-progress" aria-live="polite">
    <div class="upload-progress-head"><span>${icon("upload")}<strong>上传 ${count} 张照片</strong></span><button class="icon-button" type="button" data-upload-minimize aria-label="收起">${icon("chevron")}</button></div>
    <div class="upload-progress-bar"><span style="width:0%"></span></div>
    <small data-upload-status>0%</small>
  </aside>
  <button id="upload-progress-mini" class="upload-progress-mini" type="button" aria-label="显示上传进度" hidden>${icon("upload")}</button>`);
  one("[data-upload-minimize]")?.addEventListener("click", () => {
    byId("upload-progress").hidden = true;
    byId("upload-progress-mini").hidden = false;
  });
  byId("upload-progress-mini")?.addEventListener("click", () => {
    byId("upload-progress").hidden = false;
    byId("upload-progress-mini").hidden = true;
  });
}

function updateUploadProgress(percent) {
  const panel = byId("upload-progress");
  if (!panel) return;
  const value = Math.max(0, Math.min(100, Number(percent) || 0));
  one(".upload-progress-bar span", panel).style.width = `${value}%`;
  one("[data-upload-status]", panel).textContent = `${value}%`;
}

function finishUploadProgress(error = false) {
  const panel = byId("upload-progress");
  if (!panel) return;
  panel.classList.toggle("error", error);
  updateUploadProgress(error ? 0 : 100);
  one("[data-upload-status]", panel).textContent = error
    ? "上传失败"
    : "已加入队列，可离开页面";
  if (!error) {
    uploadProgressTimer = setTimeout(() => {
      byId("upload-progress")?.remove();
      byId("upload-progress-mini")?.remove();
    }, 8_000);
  }
}

function navigate(path, { replace = false } = {}) {
  if (path === `${location.pathname}${location.search}`) return renderRoute();
  replace ? history.replaceState(null, "", path) : history.pushState(null, "", path);
  renderRoute();
}

async function renderRoute() {
  cleanupPage();
  state.routeVersion += 1;
  const path = location.pathname.replace(/\/{2,}/g, "/");
  if (path === "/") {
    history.replaceState(null, "", "/home");
    return renderHome();
  }
  if (path === "/home") return renderHome();
  if (path === "/search") return renderSearch();
  if (path === "/selfie-recognition") return renderSelfieRecognition();
  if (path === "/history") return renderHistory();
  if (path === "/save" || path === "/save/") return renderSave();
  if (path === "/share-link") return renderShareLinks();
  if (path === "/account") return renderAccount();
  if (path.startsWith("/s/")) return renderPublicShare(decodeURIComponent(path.slice(3)));
  if (path === "/admin") return renderAdminOverview();
  if (path === "/admin/classes") return renderAdminClasses();
  if (path === "/admin/users") return renderAdminUsers();
  if (path === "/admin/roles") return renderAdminRoles();
  if (path === "/admin/audit") return renderAdminAudit();
  setPageTitle("页面不存在");
  app.innerHTML = `${AppHeader()}<main id="main" class="public-share">${EmptyState("search", "页面不存在", '<a class="button primary" href="/home" data-nav>返回首页</a>')}</main>`;
}

function cleanupPage() {
  state.pageCleanup.splice(0).forEach((cleanup) => cleanup());
  stopCamera();
  closeDialog();
  one(".selection-toolbar")?.remove();
  app.classList.remove("has-home-background");
  app.style.removeProperty("--home-background");
  state.selected.clear();
  state.activePhotos = [];
  if (state.selfieUrl) {
    URL.revokeObjectURL(state.selfieUrl);
    state.selfieUrl = "";
    state.selfieFile = null;
  }
}

function stopCamera() {
  state.cameraStream?.getTracks().forEach((track) => track.stop());
  state.cameraStream = null;
  const video = byId("camera-video");
  if (video) video.srcObject = null;
}

function applyTheme(theme) {
  const next = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", next === "dark" ? "#101321" : "#ffffff");
  localStorage.setItem("aryuki-photo-theme", next);
}

async function loadUser() {
  try {
    const data = await Client.me();
    state.user = data.user || null;
  } catch {
    state.user = null;
  }
}

document.addEventListener("click", async (event) => {
  const nav = event.target.closest("[data-nav]");
  if (nav) {
    event.preventDefault();
    navigate(`${new URL(nav.href, location.origin).pathname}${new URL(nav.href, location.origin).search}`);
    return;
  }
  const navTo = event.target.closest("[data-nav-to]");
  if (navTo) return navigate(navTo.dataset.navTo);
  if (event.target.closest("[data-nav-camera]")) return navigate("/selfie-recognition");
  if (event.target.closest("[data-locale-toggle]")) {
    setLocale(getLocale() === "zh" ? "en" : "zh");
    location.reload();
    return;
  }
  if (event.target.closest("[data-theme-toggle]")) {
    applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
    const button = event.target.closest("[data-theme-toggle]");
    const dark = document.documentElement.dataset.theme === "dark";
    button.innerHTML = icon(dark ? "sun" : "moon");
    button.setAttribute("aria-label", dark ? "切换到浅色模式" : "切换到深色模式");
    return;
  }
  const trigger = event.target.closest("[data-user-trigger]");
  const menu = one(".menu-popover");
  if (trigger && menu) {
    const open = menu.hidden;
    menu.hidden = !open;
    trigger.setAttribute("aria-expanded", String(open));
    return;
  }
  if (!event.target.closest(".user-menu") && menu) menu.hidden = true;
  if (event.target.closest("[data-login]")) {
    try {
      const mode = location.pathname.startsWith("/admin") ? "admin" : "bind";
      const data = await Client.loginUrl(mode, `${location.pathname}${location.search}`);
      location.href = data.url || data.loginUrl || data.login_url;
    } catch (error) { toast(friendlyError(error), true); }
  }
  if (event.target.closest("[data-admin-login]")) {
    try {
      const data = await Client.loginUrl("admin", `${location.pathname}${location.search}`);
      location.href = data.url || data.loginUrl || data.login_url;
    } catch (error) { toast(friendlyError(error), true); }
  }
  if (event.target.closest("[data-logout]")) {
    try { await Client.logout(); } catch {}
    state.user = null;
    navigate("/home");
  }
});

window.addEventListener("popstate", renderRoute);
window.addEventListener("pagehide", stopCamera);

function listOf(object, ...keys) {
  for (const key of keys) if (Array.isArray(object?.[key])) return object[key];
  return [];
}

function idsOf(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(typeof item === "object" ? item.id : item)).filter(Boolean);
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1000)), units.length - 1);
  return `${(bytes / 1000 ** index).toFixed(index > 1 ? 1 : 0)} ${units[index]}`;
}

function formatPhotoSize(value) {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1000)), units.length - 1);
  return index === 0 ? `${bytes} B` : `${(bytes / 1000 ** index).toFixed(2)} ${units[index]}`;
}

function formatQuota(value) {
  return Number(value || 0) === 0 ? "不限" : `${bytesToGb(value)} GB`;
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "未知时间" : new Intl.DateTimeFormat(dateLocale(), {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(date);
}

function toLocalDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function DateTimeField(name, label, value) {
  const date = new Date(value);
  const safe = Number.isNaN(date.getTime()) ? new Date() : date;
  return `<div class="field date-time-field" data-datetime-field>
    <span>${escapeHtml(label)}</span>
    <input type="hidden" name="${escapeAttr(name)}" value="${escapeAttr(toLocalDateTime(safe))}" required>
    <button class="date-trigger" type="button" data-date-trigger>${escapeHtml(formatDate(safe))}</button>
    <div class="date-popover ui-modal-scroll" data-date-popover hidden></div>
  </div>`;
}

function bindDateTimeFields() {
  all("[data-datetime-field]").forEach((field) => {
    const hidden = one('input[type="hidden"]', field);
    const trigger = one("[data-date-trigger]", field);
    const popover = one("[data-date-popover]", field);
    let selected = parseLocalDateTime(hidden.value);
    let view = new Date(selected);

    const commit = () => {
      hidden.value = toLocalDateTime(selected);
      trigger.textContent = formatDate(selected);
    };
    const paint = () => {
      popover.innerHTML = calendarMarkup(view, selected);
      one("[data-calendar-month]", popover).addEventListener("change", (event) => {
        view.setMonth(Number(event.currentTarget.value));
        paint();
      });
      one("[data-calendar-year]", popover).addEventListener("change", (event) => {
        view.setFullYear(Number(event.currentTarget.value));
        paint();
      });
      one("[data-calendar-prev]", popover).addEventListener("click", () => {
        view.setMonth(view.getMonth() - 1);
        paint();
      });
      one("[data-calendar-next]", popover).addEventListener("click", () => {
        view.setMonth(view.getMonth() + 1);
        paint();
      });
      all("[data-calendar-day]", popover).forEach((button) => button.addEventListener("click", () => {
        const next = parseLocalDateTime(button.dataset.calendarDay);
        next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
        selected = next;
        view = new Date(next);
        commit();
        paint();
      }));
      one("[data-calendar-hour]", popover).addEventListener("change", (event) => {
        selected.setHours(Number(event.currentTarget.value));
        commit();
      });
      one("[data-calendar-minute]", popover).addEventListener("change", (event) => {
        selected.setMinutes(Number(event.currentTarget.value));
        commit();
      });
      one("[data-calendar-today]", popover).addEventListener("click", () => {
        const now = new Date();
        now.setSeconds(0, 0);
        selected = now;
        view = new Date(now);
        commit();
        paint();
      });
    };
    trigger.addEventListener("click", () => {
      all("[data-date-popover]").forEach((item) => {
        if (item !== popover) item.hidden = true;
      });
      popover.hidden = !popover.hidden;
      if (!popover.hidden) paint();
    });
  });
  const closeCalendars = (event) => {
    if (event.target.closest("[data-datetime-field]")) return;
    all("[data-date-popover]").forEach((item) => { item.hidden = true; });
  };
  document.addEventListener("pointerdown", closeCalendars);
  state.pageCleanup.push(() => document.removeEventListener("pointerdown", closeCalendars));
}

function calendarMarkup(view, selected) {
  const year = view.getFullYear();
  const month = view.getMonth();
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  const selectedKey = localDateKey(selected);
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = localDateKey(date);
    return `<button type="button" class="calendar-day ${date.getMonth() !== month ? "outside" : ""} ${key === selectedKey ? "selected" : ""}" data-calendar-day="${key}T00:00">${date.getDate()}</button>`;
  }).join("");
  const monthOptions = Array.from({ length: 12 }, (_, index) =>
    `<option value="${index}" ${index === month ? "selected" : ""}>${index + 1} 月</option>`).join("");
  const yearOptions = Array.from({ length: 11 }, (_, index) => year - 5 + index)
    .map((value) => `<option value="${value}" ${value === year ? "selected" : ""}>${value}</option>`).join("");
  const hourOptions = Array.from({ length: 24 }, (_, value) =>
    `<option value="${value}" ${value === selected.getHours() ? "selected" : ""}>${String(value).padStart(2, "0")}</option>`).join("");
  const minuteOptions = Array.from({ length: 60 }, (_, value) =>
    `<option value="${value}" ${value === selected.getMinutes() ? "selected" : ""}>${String(value).padStart(2, "0")}</option>`).join("");
  return `<div class="calendar-head"><button type="button" class="icon-button" data-calendar-prev aria-label="上个月">${icon("left")}</button>
    <select class="select compact" data-calendar-month>${monthOptions}</select>
    <select class="select compact" data-calendar-year>${yearOptions}</select>
    <button type="button" class="icon-button" data-calendar-next aria-label="下个月">${icon("right")}</button></div>
    <div class="calendar-week">${["日","一","二","三","四","五","六"].map((day) => `<span>${day}</span>`).join("")}</div>
    <div class="calendar-days">${days}</div>
    <div class="calendar-foot"><button type="button" class="button small" data-calendar-today>今天</button>
      <label>时间 <select class="select compact" data-calendar-hour>${hourOptions}</select> : <select class="select compact" data-calendar-minute>${minuteOptions}</select></label></div>`;
}

function parseLocalDateTime(value) {
  const parsed = new Date(String(value || ""));
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function bytesToGb(value) {
  const number = Number(value || 0) / 1e9;
  return Number.isInteger(number) ? String(number) : number.toFixed(1);
}

function permissionName(mode) {
  return ({
    all_read: "所有类只读",
    all_write: "所有类读写",
    own_write: "本人类读写",
    own_read: "本人类只读",
  })[mode] || "未配置";
}

function primaryUserName(user = {}) {
  return user.username || user.name || user.email || "用户";
}

function secondaryUserName(user = {}) {
  const secondary = user.name && user.name !== user.username ? user.name : "";
  return secondary || user.email || "";
}

function userAccessMode() {
  return state.user?.accessMode || state.user?.access_mode || state.user?.permissions?.accessMode || state.user?.permissions?.access_mode || "";
}

function canWriteClasses() {
  return state.user?.role === "admin" || ["all_write", "own_write"].includes(userAccessMode());
}

function friendlyError(error) {
  if (error?.status === 401) return "请先绑定或登录 Auth Center 后再继续。";
  if (error?.status === 403 && state.user?.kind === "temp") return "临时身份只能识别和查看历史；请绑定 Auth Center 后再上传、另存或分享。";
  if (error?.status === 403) return "当前角色没有执行此操作的权限。";
  if (error?.status === 404) return "内容不存在或已经不可见。";
  if (error?.status === 409) return error.message || "当前状态冲突，请刷新后重试。";
  if (error?.status === 413) return "文件过大或超过存储空间上限。";
  if (error?.status === 429) return "操作过于频繁，请稍后再试。";
  return error?.message || "操作失败，请稍后重试。";
}

function cssEscape(value) {
  return window.CSS?.escape ? window.CSS.escape(String(value)) : String(value).replace(/["\\]/g, "\\$&");
}

function shorten(value, length) {
  const string = String(value || "");
  return string.length > length ? `${string.slice(0, length - 1)}…` : string;
}

function isMobileCamera() {
  return matchMedia("(pointer: coarse)").matches || !navigator.mediaDevices?.getUserMedia;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function copyText(value, notify = true) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const input = document.createElement("textarea");
    input.value = value;
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.append(input);
    input.select();
    document.execCommand("copy");
    input.remove();
  }
  if (notify) toast("已复制。");
}

applyTheme(localStorage.getItem("aryuki-photo-theme")
  || localStorage.getItem("snapclass-theme")
  || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
watchLocale();
await loadUser();
await renderRoute();
