export function renderHomePage() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>PhotoFinder</title>
  <script src="https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js"></script>
  <style>
    :root{--paper:rgba(255,255,255,.82);--ink:#122033;--muted:#64748b;--line:#d9e0e7;--line-strong:#cfd8e3;--brand:#0f172a;--accent:#95f0ff;--accent-ink:#0b3340;--danger:#ffe5e7;--danger-ink:#a93242;--shadow:0 20px 70px rgba(54,39,15,.12);--radius-xl:30px}
    *{box-sizing:border-box}body{margin:0;color:var(--ink);font-family:"Segoe UI","PingFang SC",sans-serif;background:radial-gradient(circle at top left,rgba(255,255,255,.96),transparent 34%),radial-gradient(circle at top right,rgba(245,191,118,.38),transparent 22%),linear-gradient(135deg,#f8f3eb,#eadac7 58%,#e6d4c0);min-height:100vh}button,input{font:inherit}.hidden{display:none!important}.shell{width:min(1280px,calc(100vw - 28px));margin:0 auto;padding:24px 0 56px}.card{background:var(--paper);border:1px solid rgba(255,255,255,.78);border-radius:var(--radius-xl);box-shadow:var(--shadow);backdrop-filter:blur(24px)}.loginView{min-height:calc(100vh - 48px);display:grid;place-items:center}.loginCard{width:min(760px,100%);padding:44px}.eyebrow{margin:0 0 10px;color:#a56b27;letter-spacing:.28em;text-transform:uppercase;font-size:12px;font-weight:800}.heroTitle{margin:0;font-size:clamp(42px,8vw,80px);line-height:.92;letter-spacing:-.06em}.heroText,.meta{color:var(--muted);line-height:1.7}.buttonRow,.toolbar,.headerActions,.panelHead{display:flex;gap:12px;flex-wrap:wrap;align-items:center}.buttonRow{margin-top:28px}.btn{border:0;border-radius:999px;padding:13px 20px;font-weight:800;cursor:pointer;background:var(--brand);color:#fff;box-shadow:0 14px 34px rgba(15,23,42,.22)}.btn.secondary{background:#fff;color:var(--brand);border:1px solid var(--line);box-shadow:none}.btn.accent{background:var(--accent);color:var(--accent-ink)}.btn.small{padding:10px 14px;font-size:13px}.btn:disabled{opacity:.5;cursor:not-allowed}.pageHead{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:18px}.brand h1{margin:0;font-size:38px;letter-spacing:-.05em}.brand p{margin:0}.userWrap{position:relative}.menu{position:absolute;top:48px;right:0;width:min(300px,84vw);padding:16px;border-radius:22px;background:#fff;border:1px solid var(--line);box-shadow:0 24px 56px rgba(15,23,42,.16);z-index:20}.menu .stack{display:grid;gap:8px}.notice{display:none;margin-bottom:18px;padding:14px 16px;border-radius:18px;background:var(--danger);color:var(--danger-ink);border:1px solid #ffd1d6}.adminShell{display:grid;grid-template-columns:minmax(280px,380px) minmax(0,1fr);gap:18px}.panel{padding:22px}.panelHead{justify-content:space-between;margin-bottom:16px}.panelHead h2,.panelHead h3{margin:0;letter-spacing:-.03em}.dark{color:#f8fbff;background:radial-gradient(circle at top,rgba(149,240,255,.16),transparent 35%),linear-gradient(180deg,#111827,#0b1220);border:1px solid rgba(255,255,255,.08)}.dark .meta{color:#c7d7e8}.field{width:100%;border:1px solid var(--line);border-radius:16px;padding:12px 14px;background:#fff;color:var(--ink)}.classList{display:grid;gap:12px}.classCard{width:100%;border:1px solid transparent;border-radius:22px;padding:18px;text-align:left;background:rgba(255,255,255,.72);cursor:pointer;transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease}.classCard:hover{transform:translateY(-2px);border-color:#c7d8e8;box-shadow:0 12px 28px rgba(15,23,42,.08)}.classCard.active{border-color:#89dceb;background:#fff}.classTitle{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.pill{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;font-size:12px;font-weight:800;background:#eef3f8;color:#334155}.pill.open{background:#dff8ec;color:#0d6b3d}.pill.closed{background:#f5e5e7;color:#8b3742}.classDetailEmpty{min-height:360px;display:grid;place-items:center;text-align:center;padding:28px;border:1px dashed var(--line-strong);border-radius:24px;color:var(--muted);background:rgba(255,255,255,.5)}.historyList{display:grid;gap:14px;margin-top:14px}.historyCard{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.1);border-radius:22px;padding:16px}.historyHead{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:12px}.historySelfie{width:88px;height:88px;border-radius:18px;overflow:hidden;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.08)}.historySelfie img{width:100%;height:100%;object-fit:cover;display:block}.historyResults{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px}.historyThumb{display:block;border-radius:18px;overflow:hidden;background:#fff;color:inherit;text-decoration:none}.historyThumb img{width:100%;aspect-ratio:1/1;object-fit:cover;display:block}.historyThumb div{padding:8px 10px;font-size:12px;color:var(--muted)}.scanBox{position:relative;width:min(360px,100%);aspect-ratio:4/5;border-radius:26px;overflow:hidden;margin:0 auto;border:1px solid rgba(255,255,255,.14);background:#08121e}.scanBox img{width:100%;height:100%;object-fit:cover;display:block}.scanEmpty{height:100%;display:grid;place-items:center;padding:24px;text-align:center;color:#d6e5f4}.scanPulse{position:absolute;inset:12% 12%;border:2px solid rgba(149,240,255,.55);border-radius:50%;box-shadow:0 0 0 1px rgba(149,240,255,.18),0 0 28px rgba(149,240,255,.14) inset;opacity:0}.scanning .scanPulse{animation:pulse 1.8s infinite ease-out}.scanLine{position:absolute;inset-inline:0;top:-15%;height:22%;background:linear-gradient(180deg,transparent,rgba(149,240,255,.35),transparent);opacity:0}.scanning .scanLine{opacity:1;animation:scan 2.2s infinite ease-in-out}.scanStatus{margin-top:12px;text-align:center;color:#d6e5f4;min-height:24px}@keyframes pulse{0%{transform:scale(.82);opacity:.15}55%{transform:scale(1);opacity:.95}100%{transform:scale(1.12);opacity:0}}@keyframes scan{0%,100%{transform:translateY(0)}50%{transform:translateY(410%)}}.resultsShell{margin-top:18px}.resultGroup{margin-top:22px}.resultGroup h3{margin:0 0 10px;font-size:22px;letter-spacing:-.02em}.gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:14px}.photoCard{position:relative;border-radius:22px;overflow:hidden;background:#fff;border:1px solid rgba(217,224,231,.9);box-shadow:0 12px 28px rgba(15,23,42,.08)}.thumbButton{display:block;width:100%;padding:0;border:0;background:#fff;text-align:left;cursor:pointer}.thumbButton img{width:100%;aspect-ratio:1/1;object-fit:cover;display:block}.photoMeta{padding:12px}.photoName{font-weight:800;word-break:break-word}.photoSub{margin-top:4px;font-size:13px;color:var(--muted)}.checkButton{position:absolute;top:10px;right:10px;width:38px;height:38px;border-radius:999px;border:1px solid rgba(255,255,255,.85);background:rgba(255,255,255,.88);backdrop-filter:blur(12px);font-weight:900;cursor:pointer;box-shadow:0 10px 24px rgba(15,23,42,.18);transition:transform .18s ease,background .18s ease,border-color .18s ease}.checkButton:hover{transform:scale(1.04)}.checkButton.active{background:linear-gradient(135deg,#06b6d4,#38bdf8);color:#fff;border-color:rgba(255,255,255,.2)}.emptyState{padding:28px;border:1px dashed var(--line-strong);border-radius:24px;text-align:center;color:var(--muted);background:rgba(255,255,255,.45)}.modal{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(5,10,18,.9);z-index:40}.modal.show{display:flex}.modal img{max-width:94vw;max-height:88vh;object-fit:contain}.navBtn,.closeBtn{position:absolute;border:0;border-radius:999px;background:rgba(255,255,255,.14);backdrop-filter:blur(16px);color:#fff;cursor:pointer;box-shadow:0 14px 34px rgba(0,0,0,.26)}.navBtn{top:50%;transform:translateY(-50%);width:68px;height:68px;padding:0;display:grid;place-items:center}.navBtn svg{width:28px;height:28px;display:block}.navPrev{left:18px}.navNext{right:18px}.closeBtn{top:18px;right:18px;padding:11px 16px;font-weight:800}@media (max-width:980px){.adminShell{grid-template-columns:1fr}}@media (max-width:720px){.pageHead,.panelHead,.historyHead{align-items:flex-start}.brand h1{font-size:32px}.shell{width:min(100vw - 20px,1280px)}.panel{padding:18px}}@media (max-width:560px){.buttonRow,.toolbar,.headerActions{flex-direction:column;align-items:stretch}.btn{width:100%}.gallery,.historyResults{grid-template-columns:1fr 1fr}.navBtn{width:54px;height:54px}.navBtn svg{width:24px;height:24px}}@media (max-width:420px){.gallery,.historyResults{grid-template-columns:1fr}}
  </style>
</head>
<body>
  <div class="shell">
    <section id="loginView" class="loginView">
      <div class="loginCard card">
        <p class="eyebrow">PhotoFinder</p>
        <h1 class="heroTitle">Find your event photos</h1>
        <p class="heroText">Admins can upload and organize classes. Guests can start with a temporary identity, scan a selfie, and later bind their account with Aryuki Auth Center.</p>
        <div class="buttonRow">
          <button id="adminLogin" class="btn">Login As Admin</button>
          <button id="tempLogin" class="btn accent">Find My Photos</button>
        </div>
      </div>
    </section>
    <section id="appView" class="hidden">
      <div class="pageHead">
        <div class="brand">
          <p class="eyebrow">PhotoFinder</p>
          <h1>Photo Distributor</h1>
        </div>
        <div class="userWrap">
          <button id="userButton" class="btn secondary small">Account</button>
          <div id="userMenu" class="menu hidden"></div>
        </div>
      </div>
      <div id="notice" class="notice"></div>
      <section id="adminPanel" class="card panel hidden">
        <div class="panelHead">
          <div>
            <h2>Class Manager</h2>
            <p class="meta">Keep classes open or closed at the class level so query visibility changes stay cheap and instant.</p>
          </div>
        </div>
        <div class="adminShell">
          <div>
            <div class="toolbar">
              <input id="className" class="field" placeholder="New class name" />
              <button id="createClass" class="btn small">Create Class</button>
              <button id="refreshClasses" class="btn secondary small">Refresh</button>
            </div>
            <div id="classList" class="classList" style="margin-top:14px"></div>
          </div>
          <div id="classDetailHost">
            <div id="classDetailEmpty" class="classDetailEmpty">
              <div>
                <h3 style="margin:0 0 8px">Choose a class</h3>
                <p class="meta" style="margin:0">Pick a class on the left to see thumbnails, open or close query access, and upload more photos.</p>
              </div>
            </div>
            <div id="classDetail" class="hidden">
              <div class="panelHead">
                <div>
                  <h3 id="classTitle">Class</h3>
                  <p id="classMeta" class="meta"></p>
                </div>
                <div class="headerActions">
                  <button id="toggleClass" class="btn secondary small">Toggle</button>
                  <button id="deleteClass" class="btn secondary small">Delete Class</button>
                  <label class="btn small">+ Upload Photos<input id="adminFiles" type="file" multiple style="display:none" /></label>
                </div>
              </div>
              <div id="classPhotos" class="gallery"></div>
            </div>
          </div>
        </div>
      </section>
      <section class="card panel dark" style="margin-top:18px">
        <div class="panelHead">
          <div>
            <h2>Find My Photos</h2>
            <p class="meta">Upload a selfie or open the camera on mobile. Search runs asynchronously and the gallery appears as soon as the task completes.</p>
          </div>
        </div>
        <div class="toolbar" style="margin-bottom:14px">
          <label class="btn accent">Take Selfie<input id="selfieCapture" type="file" accept="image/*" capture="user" style="display:none" /></label>
          <label class="btn secondary">Upload Image<input id="selfieUpload" type="file" accept="image/*" style="display:none" /></label>
          <button id="startSearch" class="btn">Start Face Scan</button>
          <button id="toggleHistory" class="btn secondary hidden">History</button>
        </div>
        <div class="scanBox" id="scanBox">
          <img id="scanImage" class="hidden" alt="Selfie preview" />
          <div id="scanEmpty" class="scanEmpty">
            <div>
              <strong>No selfie selected yet</strong>
              <div class="meta">Choose a file or open the camera to start.</div>
            </div>
          </div>
          <div class="scanPulse"></div>
          <div class="scanLine"></div>
        </div>
        <div id="scanStatus" class="scanStatus">Waiting for your selfie.</div>
        <div id="historyPanel" class="hidden">
          <div id="historyList" class="historyList"></div>
        </div>
      </section>
      <section class="card panel resultsShell">
        <div class="panelHead">
          <div>
            <h2>Matched Photos</h2>
            <p class="meta">Tap a thumbnail to open the full-size image. Use the round selection button for batch download.</p>
          </div>
          <div class="headerActions">
            <button id="selectAll" class="btn secondary small">Select All</button>
            <button id="downloadDirect" class="btn secondary small">Download Selected</button>
            <button id="downloadZip" class="btn small">Download ZIP</button>
          </div>
        </div>
        <div id="results"></div>
      </section>
    </section>
  </div>
  <div id="uploadStatus" class="card hidden" style="position:fixed;right:18px;bottom:18px;z-index:45;width:min(360px,calc(100vw - 24px));padding:16px">
    <div class="photoName" id="uploadStatusName">Preparing upload...</div>
    <div class="meta" id="uploadStatusStep" style="margin-top:4px">Waiting</div>
    <div style="margin-top:12px;height:10px;border-radius:999px;background:#e8edf3;overflow:hidden">
      <div id="uploadStatusBar" style="height:100%;width:0%;background:linear-gradient(90deg,#06b6d4,#7dd3fc)"></div>
    </div>
    <div class="meta" id="uploadStatusSummary" style="margin-top:10px">0 / 0</div>
  </div>
  <div id="modal" class="modal">
    <button id="closeModal" class="closeBtn">Close</button>
    <button id="prevModal" class="navBtn navPrev" aria-label="Previous image"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14.5 5.5L8 12l6.5 6.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    <img id="modalImage" alt="Full-size preview" />
    <button id="nextModal" class="navBtn navNext" aria-label="Next image"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9.5 5.5L16 12l-6.5 6.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
  </div>
  <script>
    const $ = (id) => document.getElementById(id);
    let me = null;
    let classes = [];
    let activeClassId = "";
    let classPhotos = [];
    let results = [];
    let historyItems = [];
    let historyLoaded = false;
    let selected = new Set();
    let modalPhotos = [];
    let modalIndex = 0;
    let selfieFile = null;
    const api = async (url, options = {}) => {
      const response = await fetch(url, options);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Request failed");
      return payload;
    };
    const showNotice = (message) => {
      const node = $("notice");
      node.textContent = message || "";
      node.style.display = message ? "block" : "none";
    };
    async function init() {
      try {
        const session = await api("/api/me");
        me = session.user || null;
      } catch {
        me = null;
      }
      bindTopLevelEvents();
      renderShell();
      if (me) await loadClasses();
    }
    function bindTopLevelEvents() {
      $("adminLogin").onclick = async () => {
        const data = await api("/api/auth/login-url?mode=admin");
        location.href = data.url;
      };
      $("tempLogin").onclick = async () => {
        const data = await api("/api/auth/temp", { method: "POST" });
        me = data.user;
        renderShell();
        await loadClasses();
      };
      $("userButton").onclick = () => $("userMenu").classList.toggle("hidden");
      $("createClass").onclick = createClass;
      $("refreshClasses").onclick = loadClasses;
      $("toggleClass").onclick = toggleClassVisibility;
      $("deleteClass").onclick = deleteCurrentClass;
      $("adminFiles").onchange = uploadAdminPhotos;
      $("selfieCapture").onchange = (event) => setSelfieFile((event.target.files || [])[0] || null);
      $("selfieUpload").onchange = (event) => setSelfieFile((event.target.files || [])[0] || null);
      $("startSearch").onclick = startSearch;
      $("toggleHistory").onclick = toggleHistory;
      $("selectAll").onclick = toggleSelectAll;
      $("downloadDirect").onclick = downloadSelectedDirect;
      $("downloadZip").onclick = downloadSelectedZip;
      $("closeModal").onclick = closeModal;
      $("prevModal").onclick = () => stepModal(-1);
      $("nextModal").onclick = () => stepModal(1);
      $("modal").onclick = (event) => { if (event.target === $("modal")) closeModal(); };
    }
    function renderShell() {
      const loggedIn = !!me;
      $("loginView").classList.toggle("hidden", loggedIn);
      $("appView").classList.toggle("hidden", !loggedIn);
      if (!loggedIn) return;
      $("adminPanel").classList.toggle("hidden", me.role !== "admin");
      $("toggleHistory").classList.toggle("hidden", !me.authUuid);
      $("userButton").textContent = (me.role === "admin" ? "Admin: " : "") + (me.name || "User");
      renderUserMenu();
      renderResults();
    }
    function renderUserMenu() {
      const pieces = ['<div class="stack">','<strong>' + esc(me.name || "User") + '</strong>','<div class="meta">' + esc(me.username || me.kind || "") + '</div>','<div class="meta">Role: ' + esc(me.role || "user") + '</div>'];
      if (me.kind === "temp") pieces.push('<button class="btn small" onclick="bindAuth()">Band With Aryuki Auth Center</button>');
      if (me.authCenterUrl) pieces.push('<a class="btn secondary small" style="text-decoration:none;text-align:center" href="' + esc(me.authCenterUrl) + '" target="_blank" rel="noreferrer">Open User Center</a>');
      pieces.push('<button class="btn secondary small" onclick="logoutUser()">Logout</button>');
      pieces.push("</div>");
      $("userMenu").innerHTML = pieces.join("");
    }
    window.bindAuth = async () => {
      const data = await api("/api/auth/login-url?mode=bind");
      location.href = data.url;
    };
    window.logoutUser = async () => {
      const authLogout = "https://accounts.aryuki.com/logout?redirect=" + encodeURIComponent(location.origin + "/login");
      const useSsoLogout = me && me.kind !== "temp";
      await api("/api/logout", { method: "POST" }).catch(() => {});
      location.href = useSsoLogout ? authLogout : "/login";
    };
    async function loadClasses() {
      if (!me) return;
      const data = await api("/api/classes");
      classes = data.classes || [];
      if (activeClassId && !classes.some((item) => item.id === activeClassId)) activeClassId = "";
      renderClasses();
      if (activeClassId) await loadClassPhotos(activeClassId);
    }
    function renderClasses() {
      const host = $("classList");
      host.innerHTML = classes.length ? classes.map((item) => '<button class="classCard' + (item.id === activeClassId ? ' active' : '') + '" onclick="selectClass(\\'' + item.id + '\\')"><div class="classTitle"><div><div class="photoName">' + esc(item.name) + '</div><div class="photoSub">' + esc(item.id) + '</div></div><span class="pill ' + (item.is_open ? 'open' : 'closed') + '">' + (item.is_open ? 'Open' : 'Closed') + '</span></div><div class="meta" style="margin-top:12px">' + Number(item.photo_count || 0) + ' photos</div></button>').join("") : '<div class="emptyState">No classes yet. Create one to start uploading photos.</div>';
      renderClassDetail();
    }
    window.selectClass = async (classId) => {
      activeClassId = classId;
      renderClasses();
      await loadClassPhotos(classId);
    };
    async function createClass() {
      const input = $("className");
      const name = (input.value || "").trim() || "Untitled Class";
      await api("/api/classes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
      input.value = "";
      await loadClasses();
    }
    function renderClassDetail() {
      const item = classes.find((entry) => entry.id === activeClassId);
      $("classDetailEmpty").classList.toggle("hidden", !!item);
      $("classDetail").classList.toggle("hidden", !item);
      if (!item) return;
      $("classTitle").textContent = item.name;
      $("classMeta").textContent = item.id + " • " + Number(item.photo_count || 0) + " photos • " + (item.is_open ? "Visible in search" : "Hidden from search");
      $("toggleClass").textContent = item.is_open ? "Close Query" : "Open Query";
    }
    async function loadClassPhotos(classId) {
      const data = await api("/api/classes/" + classId + "/photos");
      classPhotos = data.photos || [];
      renderClassPhotos();
    }
    function renderClassPhotos() {
      $("classPhotos").innerHTML = classPhotos.length ? classPhotos.map((photo) => renderPhotoCard(photo, false)).join("") : '<div class="emptyState" style="grid-column:1/-1">No photos in this class yet.</div>';
    }
    async function toggleClassVisibility() {
      const current = classes.find((entry) => entry.id === activeClassId);
      if (!current) return;
      const data = await api("/api/classes/" + current.id, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ isOpen: !current.is_open }) });
      classes = classes.map((entry) => entry.id === current.id ? { ...entry, is_open: data.class.is_open } : entry);
      renderClasses();
    }
    async function deleteCurrentClass() {
      const current = classes.find((entry) => entry.id === activeClassId);
      if (!current) return;
      if (!confirm('Delete class "' + current.name + '" and all photos inside it? This cannot be undone.')) return;
      await api("/api/classes/" + current.id, { method: "DELETE" });
      activeClassId = "";
      classPhotos = [];
      showNotice('Class "' + current.name + '" was deleted.');
      await loadClasses();
    }
    async function uploadAdminPhotos(event) {
      const files = [...(event.target.files || [])];
      if (!activeClassId) {
        showNotice("Choose a class before uploading photos.");
        return;
      }
      if (!files.length) {
        showNotice("Please choose at least one image to upload.");
        return;
      }
      const total = files.length;
      let completed = 0;
      try {
        for (const file of files) {
          await uploadSinglePhoto(file, activeClassId, completed, total);
          completed += 1;
          setUploadStatus({
            name: file.name,
            step: "Queued for indexing",
            progress: 100,
            summary: completed + " / " + total + " completed • " + (total - completed) + " remaining"
          });
        }
        showNotice("Photos uploaded and queued for indexing.");
        await loadClasses();
      } catch (error) {
        showNotice(error.message || "Upload failed.");
      } finally {
        event.target.value = "";
        setTimeout(() => $("uploadStatus").classList.add("hidden"), 2200);
      }
    }
    function uploadSinglePhoto(file, classId, completed, total) {
      return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append("class_id", classId);
        formData.append("photos", file);
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/admin/photos");
        xhr.responseType = "json";
        xhr.upload.onprogress = (event) => {
          const progress = event.lengthComputable ? Math.round((event.loaded / event.total) * 92) : 35;
          setUploadStatus({
            name: file.name,
            step: "Uploading to Worker",
            progress,
            summary: completed + " / " + total + " completed • " + (total - completed) + " remaining"
          });
        };
        xhr.onloadstart = () => {
          setUploadStatus({
            name: file.name,
            step: "Preparing request",
            progress: 4,
            summary: completed + " / " + total + " completed • " + (total - completed) + " remaining"
          });
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setUploadStatus({
              name: file.name,
              step: "Writing to R2 and queueing ingest task",
              progress: 100,
              summary: completed + " / " + total + " completed • " + (total - completed) + " remaining"
            });
            resolve(xhr.response);
            return;
          }
          const response = xhr.response || {};
          reject(new Error(response.error || "Upload failed"));
        };
        xhr.onerror = () => reject(new Error("Upload failed"));
        xhr.send(formData);
      });
    }
    function setUploadStatus({ name, step, progress, summary }) {
      $("uploadStatus").classList.remove("hidden");
      $("uploadStatusName").textContent = name;
      $("uploadStatusStep").textContent = step;
      $("uploadStatusBar").style.width = Math.max(0, Math.min(100, progress)) + "%";
      $("uploadStatusSummary").textContent = summary;
    }
    function setSelfieFile(file) {
      selfieFile = file || null;
      const image = $("scanImage");
      const empty = $("scanEmpty");
      if (!selfieFile) {
        image.src = "";
        image.classList.add("hidden");
        empty.classList.remove("hidden");
        $("scanStatus").textContent = "Waiting for your selfie.";
        return;
      }
      image.src = URL.createObjectURL(selfieFile);
      image.classList.remove("hidden");
      empty.classList.add("hidden");
      $("scanStatus").textContent = selfieFile.name;
    }
    async function startSearch() {
      if (!selfieFile) {
        showNotice("Please choose a selfie first.");
        return;
      }
      showNotice("");
      $("scanBox").classList.add("scanning");
      $("scanStatus").textContent = "Scanning in queue...";
      const formData = new FormData();
      formData.append("selfie", selfieFile);
      const data = await api("/api/search", { method: "POST", body: formData });
      pollTask(data.taskId);
    }
    function pollTask(taskId) {
      const timer = setInterval(async () => {
        try {
          const data = await api("/api/status/" + taskId);
          if (data.status === "pending" || data.status === "processing") {
            $("scanStatus").textContent = data.status === "processing" ? "Searching open classes..." : "Waiting in queue...";
            return;
          }
          clearInterval(timer);
          $("scanBox").classList.remove("scanning");
          if (data.status === "failed") {
            showNotice(data.error || "Search failed.");
            $("scanStatus").textContent = "Search failed.";
            return;
          }
          results = data.results || [];
          selected = new Set();
          renderResults();
          if (me && me.authUuid && !$("historyPanel").classList.contains("hidden")) {
            await loadHistory();
          }
          $("scanStatus").textContent = results.length ? "Search complete." : "No matching photos found.";
        } catch (error) {
          clearInterval(timer);
          $("scanBox").classList.remove("scanning");
          showNotice(error.message || "Search failed.");
          $("scanStatus").textContent = "Search interrupted.";
        }
      }, 2000);
    }
    function renderResults() {
      if (!results.length) {
        $("results").innerHTML = '<div class="emptyState">No search results yet. Upload a selfie to begin.</div>';
        return;
      }
      const grouped = {};
      results.forEach((photo) => {
        const key = photo.className || "Ungrouped";
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(photo);
      });
      $("results").innerHTML = Object.entries(grouped).map(([name, items]) => '<section class="resultGroup"><h3>' + esc(name) + '</h3><div class="gallery">' + items.map((photo) => renderPhotoCard(photo, true)).join("") + '</div></section>').join("");
    }
    async function toggleHistory() {
      const panel = $("historyPanel");
      const opening = panel.classList.contains("hidden");
      panel.classList.toggle("hidden", !opening);
      $("toggleHistory").textContent = opening ? "Hide History" : "History";
      if (opening && !historyLoaded) {
        await loadHistory();
      }
    }
    async function loadHistory() {
      const data = await api("/api/history");
      historyItems = data.tasks || [];
      historyLoaded = true;
      renderHistory();
    }
    function renderHistory() {
      const host = $("historyList");
      if (!historyItems.length) {
        host.innerHTML = '<div class="emptyState">No history yet for this bound account.</div>';
        return;
      }
      host.innerHTML = historyItems.map((task) => {
        const resultHtml = task.results.length
          ? task.results.map((photo) => '<a class="historyThumb" href="' + esc(photo.url) + '" target="_blank" rel="noreferrer"><img src="' + esc(thumbUrl(photo.url, 220)) + '" alt="' + esc(photo.name || photo.id) + '" loading="lazy" decoding="async" onerror="this.onerror=null;this.src=' + "'" + esc(photo.url) + "'" + '" /><div>' + esc(photo.name || photo.id) + '</div></a>').join("")
          : '<div class="meta">No matched photos in this task.</div>';
        return '<article class="historyCard"><div class="historyHead"><div style="display:flex;gap:12px;align-items:center"><div class="historySelfie"><img src="' + esc(thumbUrl(task.selfie.url, 220)) + '" alt="' + esc(task.selfie.name) + '" loading="lazy" decoding="async" onerror="this.onerror=null;this.src=' + "'" + esc(task.selfie.url) + "'" + '" /></div><div><div class="photoName">' + esc(task.selfie.name) + '</div><div class="meta">' + esc(task.createdAt || "") + '</div><div class="meta">Status: ' + esc(task.status) + ' • Matches: ' + Number(task.matchCount || 0) + '</div></div></div><div class="headerActions"><button class="btn secondary small" onclick="downloadHistoryDirect(\\'' + task.taskId + '\\')">Download All</button><button class="btn small" onclick="downloadHistoryZip(\\'' + task.taskId + '\\')">ZIP</button></div></div><div class="historyResults">' + resultHtml + '</div></article>';
      }).join("");
    }
    function renderPhotoCard(photo, selectable) {
      const deleteButton = !selectable && me && me.role === "admin"
        ? '<button class="checkButton" style="left:10px;right:auto;background:#fff7ed;color:#9a3412;border-color:#fdba74" onclick="event.stopPropagation();deletePhotoFromClass(\\'' + photo.id + '\\',\\'' + esc(photo.name || photo.original_name || photo.id) + '\\')">×</button>'
        : "";
      return '<article class="photoCard">' + deleteButton + '<button class="thumbButton" onclick="openPreview(\\'' + photo.id + '\\')"><img src="' + esc(thumbUrl(photo.url, 360)) + '" alt="' + esc(photo.name || photo.original_name || photo.id) + '" loading="lazy" decoding="async" onerror="this.onerror=null;this.src=' + "'" + esc(photo.url) + "'" + '" /><div class="photoMeta"><div class="photoName">' + esc(photo.name || photo.original_name || photo.id) + '</div><div class="photoSub">' + esc(photo.className || photo.status || photo.contentType || "image") + '</div></div></button>' + (selectable ? '<button class="checkButton ' + (selected.has(photo.id) ? 'active' : '') + '" onclick="event.stopPropagation();toggleSelect(\\'' + photo.id + '\\')">' + (selected.has(photo.id) ? '&#10003;' : '') + '</button>' : '') + '</article>';
    }
    window.toggleSelect = (photoId) => {
      if (selected.has(photoId)) selected.delete(photoId); else selected.add(photoId);
      renderResults();
    };
    function toggleSelectAll() {
      if (!results.length) return;
      selected = selected.size === results.length ? new Set() : new Set(results.map((photo) => photo.id));
      renderResults();
    }
    function getSelectedPhotos() {
      return [...selected].map((id) => results.find((photo) => photo.id === id)).filter(Boolean);
    }
    function downloadPhotosDirect(items) {
      items.forEach((photo) => {
        const anchor = document.createElement("a");
        anchor.href = photo.url;
        anchor.download = photo.name || photo.id;
        anchor.click();
      });
    }
    async function downloadPhotosZip(items, filename) {
      const zip = new JSZip();
      for (const photo of items) {
        const blob = await (await fetch(photo.url)).blob();
        zip.file(photo.name || photo.id, blob);
      }
      const archive = await zip.generateAsync({ type: "blob" });
      const anchor = document.createElement("a");
      anchor.href = URL.createObjectURL(archive);
      anchor.download = filename;
      anchor.click();
    }
    function downloadSelectedDirect() {
      const items = getSelectedPhotos();
      if (!items.length) {
        showNotice("Select at least one photo first.");
        return;
      }
      downloadPhotosDirect(items);
    }
    async function downloadSelectedZip() {
      const items = getSelectedPhotos();
      if (!items.length) {
        showNotice("Select at least one photo first.");
        return;
      }
      await downloadPhotosZip(items, "photofinder.zip");
    }
    window.downloadHistoryDirect = (taskId) => {
      const task = historyItems.find((item) => item.taskId === taskId);
      if (!task || !task.results.length) {
        showNotice("This history entry does not have downloadable results.");
        return;
      }
      downloadPhotosDirect(task.results);
    };
    window.downloadHistoryZip = async (taskId) => {
      const task = historyItems.find((item) => item.taskId === taskId);
      if (!task || !task.results.length) {
        showNotice("This history entry does not have downloadable results.");
        return;
      }
      await downloadPhotosZip(task.results, "photofinder-history-" + taskId + ".zip");
    };
    window.deletePhotoFromClass = async (photoId, photoName) => {
      if (!confirm('Delete photo "' + photoName + '"? This cannot be undone.')) return;
      await api("/api/photos/" + photoId, { method: "DELETE" });
      classPhotos = classPhotos.filter((photo) => photo.id !== photoId);
      showNotice('Photo "' + photoName + '" was deleted.');
      await loadClasses();
      if (activeClassId) await loadClassPhotos(activeClassId);
    };
    window.openPreview = (photoId) => {
      modalPhotos = results.some((photo) => photo.id === photoId) ? results : classPhotos;
      modalIndex = Math.max(0, modalPhotos.findIndex((photo) => photo.id === photoId));
      showModal();
    };
    function showModal() {
      if (!modalPhotos.length) return;
      $("modalImage").src = modalPhotos[modalIndex].url;
      $("modal").classList.add("show");
    }
    function closeModal() {
      $("modal").classList.remove("show");
    }
    function stepModal(step) {
      if (!modalPhotos.length) return;
      modalIndex = (modalIndex + step + modalPhotos.length) % modalPhotos.length;
      showModal();
    }
    function thumbUrl(url, size) {
      const absolute = url.startsWith("http") ? url : location.origin + url;
      return "/cdn-cgi/image/width=" + size + ",height=" + size + ",fit=cover,quality=72,format=auto/" + encodeURI(absolute);
    }
    function esc(value) {
      return String(value || "").replace(/[&<>"']/g, (char) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[char]));
    }
    init();
  </script>
</body>
</html>`;
}
