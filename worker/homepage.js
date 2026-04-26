export function renderHomePage() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>PhotoFinder</title>
  <script src="https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js"></script>
  <style>
    :root{--bg:#f6efe8;--bg2:#ead9c7;--card:rgba(255,255,255,.78);--line:rgba(255,255,255,.72);--text:#132235;--muted:#627286;--brand:#111827;--cyan:#8befff;--cyan2:#06b6d4}
    *{box-sizing:border-box}body{margin:0;font-family:"Segoe UI","PingFang SC",sans-serif;color:var(--text);background:radial-gradient(circle at top left,rgba(255,255,255,.98),transparent 34%),radial-gradient(circle at 86% 14%,rgba(250,211,167,.64),transparent 24%),linear-gradient(135deg,var(--bg),var(--bg2));min-height:100vh}
    .shell{width:min(1180px,calc(100vw - 28px));margin:0 auto;padding:24px 0 56px}.hero,.panel,.gallery-wrap{background:var(--card);border:1px solid var(--line);backdrop-filter:blur(22px);box-shadow:0 20px 80px rgba(86,61,27,.12);border-radius:30px}
    .hero{padding:28px}.eyebrow{margin:0 0 12px;font-size:12px;letter-spacing:.3em;text-transform:uppercase;color:#a86d24;font-weight:800}.title{margin:0;font-size:clamp(38px,6vw,72px);line-height:.95;letter-spacing:-.05em}.subtitle{max-width:760px;margin:16px 0 0;line-height:1.8;color:var(--muted)}
    .metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:24px}.metric{background:rgba(255,255,255,.88);border:1px solid rgba(255,255,255,.8);border-radius:22px;padding:16px 18px}.metric small{display:block;font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:var(--muted)}.metric strong{display:block;margin-top:8px;font-size:28px;letter-spacing:-.04em}
    .grid{display:grid;grid-template-columns:1.1fr .9fr;gap:24px;margin-top:24px}.panel{padding:24px}.panel.dark{background:radial-gradient(circle at top,rgba(39,211,239,.18),transparent 34%),linear-gradient(180deg,#111a2c,#0d1320);color:#fff;border-color:rgba(255,255,255,.08)}.head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;margin-bottom:18px}.head h2{margin:0;font-size:28px;letter-spacing:-.03em}.head p{margin:8px 0 0;line-height:1.7;color:var(--muted)}.dark .head p{color:rgba(229,236,245,.78)}
    .badge{padding:10px 14px;border-radius:999px;font-size:11px;text-transform:uppercase;letter-spacing:.22em;white-space:nowrap}.badge.light{background:#fce8cf;color:#9a611c}.badge.dark{background:rgba(39,211,239,.12);color:#bdf5ff;border:1px solid rgba(39,211,239,.24)}
    .drop,.scanner{position:relative;border-radius:26px;overflow:hidden}.drop{min-height:220px;border:1px dashed #d5aa71;background:linear-gradient(180deg,rgba(255,255,255,.9),rgba(251,243,233,.96));display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;cursor:pointer}.drop input,.scanner input{display:none}
    .pill,.btn,.ghost{border:0;border-radius:999px;font-weight:800;cursor:pointer;transition:.18s ease}.pill{background:var(--brand);color:#fff;padding:12px 20px;font-size:12px;letter-spacing:.28em;text-transform:uppercase}.btn{background:var(--brand);color:#fff;padding:14px 22px;box-shadow:0 14px 32px rgba(15,23,42,.28)}.btn.cyan{background:var(--cyan);color:#082433;box-shadow:0 14px 36px rgba(34,211,238,.28)}.ghost{background:rgba(255,255,255,.88);color:var(--brand);border:1px solid #dce2ea;padding:12px 18px}.btn:disabled,.ghost:disabled{opacity:.55;cursor:not-allowed}
    .chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}.chip{background:#f3f5f8;border-radius:999px;padding:8px 12px;font-size:12px;color:#58677c}.note{font-size:14px;line-height:1.8}
    .scanner{min-height:360px;padding:20px;border:1px solid rgba(255,255,255,.08);background:radial-gradient(circle at top,rgba(34,211,238,.18),transparent 35%),linear-gradient(180deg,#121a2b,#0d1320);cursor:pointer}.scanner-empty,.preview{width:min(320px,100%);aspect-ratio:4/5;margin:0 auto;border-radius:24px;overflow:hidden}.scanner-empty{border:1px dashed rgba(103,232,249,.24);background:rgba(255,255,255,.04);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px}.preview{position:relative;border:1px solid rgba(255,255,255,.08);background:#0c1420;display:none}.preview img{width:100%;height:100%;object-fit:cover;display:block}
    .overlay{position:absolute;inset:0;display:none}.overlay.active{display:block}.ring{position:absolute;inset:24px;border-radius:20px;border:1px solid rgba(103,232,249,.7);animation:pulse 2.2s ease-in-out infinite}.line{position:absolute;inset-inline:0;top:0;height:72px;background:linear-gradient(180deg,rgba(34,211,238,0),rgba(34,211,238,.35),rgba(34,211,238,0));animation:scan 2.8s ease-in-out infinite}.tag{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);padding:10px 14px;border-radius:999px;background:rgba(15,23,42,.76);color:#c6f7ff;font-size:11px;letter-spacing:.26em;text-transform:uppercase}
    .row{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:20px}.task{font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:rgba(229,236,245,.62)}.alert{display:none;margin-top:18px;padding:16px 18px;border-radius:22px;border:1px solid #ffd0d0;background:#fff1f1;color:#ab2d2d;line-height:1.7}
    .gallery-wrap{margin-top:24px;padding:24px}.gallery-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;margin-bottom:18px}.gallery-actions{display:flex;gap:10px;flex-wrap:wrap}.status{display:none;border-radius:26px;border:1px solid rgba(125,211,252,.5);background:linear-gradient(180deg,rgba(240,249,255,.95),rgba(224,242,254,.7));padding:24px}.status.active{display:block}.status-row{display:flex;align-items:center;gap:20px}.orb{position:relative;width:112px;height:112px;border-radius:999px;background:#fff;flex:none}.orb:before,.orb:after{content:"";position:absolute;border-radius:inherit}.orb:before{inset:0;border:2px solid var(--cyan2);animation:pulse 2.2s ease-in-out infinite}.orb:after{inset:12px;border:1px dashed rgba(6,182,212,.9);animation:rotate 5.5s linear infinite}.orb b{position:absolute;inset:0;margin:auto;width:12px;height:12px;border-radius:999px;background:var(--cyan2);box-shadow:0 0 24px rgba(34,211,238,.9)}
    .failed,.empty{display:none;border-radius:24px;padding:28px}.empty.active{display:block;text-align:center;color:#67788d;background:#f7f8fa;border:1px solid #e8edf3}.failed.active{display:block;background:#fff1f1;color:#ab2d2d;border:1px solid #ffd0d0}
    .gallery{columns:3;column-gap:16px;display:none}.gallery.active{display:block}.gallery.select-mode .tick{display:flex}.card{break-inside:avoid;margin-bottom:16px;border-radius:28px;overflow:hidden;background:#fff;border:1px solid rgba(255,255,255,.84);box-shadow:0 16px 44px rgba(99,69,32,.12);transform:translateY(18px);opacity:0;transition:.32s ease}.card.show{transform:translateY(0);opacity:1}.card.selectable{cursor:pointer}.card.selected{border-color:var(--cyan2);box-shadow:0 16px 44px rgba(34,211,238,.24)}.card img{width:100%;display:block}.card-body{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px}.name{font-size:14px;font-weight:800}.meta{margin-top:4px;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#738398}.tick{width:32px;height:32px;border-radius:999px;border:1px solid #d2dae4;display:none;align-items:center;justify-content:center;font-size:13px;font-weight:800}.card.selected .tick{background:var(--cyan2);color:#fff;border-color:var(--cyan2)}
    .float{position:fixed;right:24px;bottom:24px;z-index:10;display:none;border:0;border-radius:999px;background:var(--brand);color:#fff;padding:16px 22px;font-weight:800;box-shadow:0 22px 48px rgba(15,23,42,.32);cursor:pointer}.float.active{display:inline-flex}
    @keyframes pulse{0%,100%{transform:scale(1);opacity:.35}50%{transform:scale(1.08);opacity:.12}}@keyframes rotate{from{transform:rotate(0)}to{transform:rotate(360deg)}}@keyframes scan{0%,100%{transform:translateY(0)}50%{transform:translateY(360%)}}
    @media (max-width:980px){.grid{grid-template-columns:1fr}.metrics{grid-template-columns:1fr}.gallery{columns:2}}@media (max-width:640px){.shell{width:min(100vw - 20px,1180px)}.hero,.panel,.gallery-wrap{padding:18px;border-radius:24px}.gallery{columns:1}.head,.gallery-head,.status-row{flex-direction:column;align-items:flex-start}.float{left:16px;right:16px;justify-content:center}}
  </style>
</head>
<body>
  <div class="shell">
    <section class="hero">
      <p class="eyebrow">PhotoFinder</p>
      <h1 class="title">高端活动照片分发系统</h1>
      <p class="subtitle">管理员批量上传照片进入异步索引队列，用户上传自拍后立即得到任务号，系统轮询检索结果并以平滑画廊方式呈现。</p>
      <div class="metrics">
        <div class="metric"><small>Queued Uploads</small><strong id="mUploads">0</strong></div>
        <div class="metric"><small>Scan Status</small><strong id="mStatus">idle</strong></div>
        <div class="metric"><small>Matches</small><strong id="mMatches">0</strong></div>
      </div>
    </section>

    <section class="grid">
      <form class="panel" id="adminForm">
        <div class="head">
          <div><h2>管理员入库</h2><p>多图上传到 R2，写入 D1，并推送到 ingest-queue。</p></div>
          <div class="badge light">Multi-file</div>
        </div>
        <label class="drop">
          <input id="adminInput" type="file" accept="image/*" multiple />
          <div>
            <div class="pill">Choose photos</div>
            <p class="note">拖拽或选择活动照片，系统会自动进入异步人脸向量索引流程。</p>
            <div id="adminHint" class="note" style="font-weight:800;color:#233347;">暂未选择文件</div>
          </div>
        </label>
        <div class="chips" id="adminChips"></div>
        <button class="btn" id="adminSubmit" type="submit">Start ingest pipeline</button>
      </form>

      <form class="panel dark" id="searchForm">
        <div class="head">
          <div><h2>用户找图</h2><p>上传自拍，立即返回 task_id，由 search-queue 完成检索。</p></div>
          <div class="badge dark">Async scan</div>
        </div>
        <label class="scanner">
          <input id="selfieInput" type="file" accept="image/*" capture="user" />
          <div id="selfieEmpty" class="scanner-empty">
            <div class="pill" style="background:rgba(39,211,239,.14);color:#bdf5ff;letter-spacing:.24em;">Scan Face</div>
            <p class="note" style="color:#d7e6f2;margin-top:18px;">上传一张清晰自拍，系统会创建检索任务并自动轮询。</p>
          </div>
          <div id="selfiePreview" class="preview">
            <img id="selfieImage" alt="Selfie preview" />
            <div id="overlay" class="overlay"><div class="ring"></div><div class="line"></div><div class="tag">Matching faces</div></div>
          </div>
        </label>
        <div class="row">
          <button class="btn cyan" id="searchSubmit" type="submit">Start face scan</button>
          <span class="task" id="taskLabel"></span>
        </div>
      </form>
    </section>

    <div class="alert" id="alert"></div>

    <section class="gallery-wrap">
      <div class="gallery-head">
        <div><h2 style="margin:0;font-size:32px;letter-spacing:-.03em;">匹配结果画廊</h2><p style="margin:10px 0 0;color:var(--muted);line-height:1.8;">瀑布流布局、扫描态展示、批量选择与 ZIP 下载。</p></div>
        <div class="gallery-actions">
          <button class="ghost" id="toggleSelect" type="button" disabled>Select mode</button>
          <button class="ghost" id="toggleAll" type="button" style="display:none;">Select all</button>
        </div>
      </div>
      <div class="status" id="status"><div class="status-row"><div class="orb"><b></b></div><div><div class="eyebrow" style="margin-bottom:8px;color:#0f7b98;">Face Scanning</div><div style="font-size:30px;font-weight:800;letter-spacing:-.03em;">系统正在队列中匹配照片</div><div style="margin-top:10px;color:#54677d;line-height:1.8;">任务已创建，页面每 2 秒轮询一次状态，待完成后自动展示匹配画廊。</div></div></div></div>
      <div class="failed" id="failed"></div>
      <div class="empty" id="empty">当前自拍没有检索到匹配照片。</div>
      <div class="gallery" id="gallery"></div>
    </section>
  </div>
  <button class="float" id="download">Download selected (0)</button>
  <script>
    const state={adminFiles:[],selfieFile:null,taskId:'',taskStatus:'idle',searching:false,selectMode:false,selectedIds:new Set(),results:[],poller:null,uploadCount:0};
    const el={
      mUploads:document.getElementById('mUploads'),mStatus:document.getElementById('mStatus'),mMatches:document.getElementById('mMatches'),
      adminForm:document.getElementById('adminForm'),adminInput:document.getElementById('adminInput'),adminHint:document.getElementById('adminHint'),adminChips:document.getElementById('adminChips'),adminSubmit:document.getElementById('adminSubmit'),
      searchForm:document.getElementById('searchForm'),selfieInput:document.getElementById('selfieInput'),selfieEmpty:document.getElementById('selfieEmpty'),selfiePreview:document.getElementById('selfiePreview'),selfieImage:document.getElementById('selfieImage'),overlay:document.getElementById('overlay'),searchSubmit:document.getElementById('searchSubmit'),taskLabel:document.getElementById('taskLabel'),
      alert:document.getElementById('alert'),status:document.getElementById('status'),failed:document.getElementById('failed'),empty:document.getElementById('empty'),gallery:document.getElementById('gallery'),
      toggleSelect:document.getElementById('toggleSelect'),toggleAll:document.getElementById('toggleAll'),download:document.getElementById('download')
    };

    el.adminInput.addEventListener('change',()=>{state.adminFiles=Array.from(el.adminInput.files||[]);renderAdminFiles()});
    el.selfieInput.addEventListener('change',()=>{const file=(el.selfieInput.files||[])[0]||null;state.selfieFile=file;if(!file){el.selfiePreview.style.display='none';el.selfieEmpty.style.display='flex';return}const url=URL.createObjectURL(file);el.selfieImage.src=url;el.selfieEmpty.style.display='none';el.selfiePreview.style.display='block'});
    el.adminForm.addEventListener('submit',submitAdmin);
    el.searchForm.addEventListener('submit',submitSearch);
    el.toggleSelect.addEventListener('click',()=>{state.selectMode=!state.selectMode;if(!state.selectMode)state.selectedIds=new Set();renderControls();renderResults(state.results)});
    el.toggleAll.addEventListener('click',()=>{state.selectedIds=state.selectedIds.size===state.results.length?new Set():new Set(state.results.map(x=>x.id));renderControls();renderResults(state.results)});
    el.download.addEventListener('click',downloadSelected);

    async function submitAdmin(event){
      event.preventDefault();
      if(!state.adminFiles.length)return showAlert('请先选择要上传的活动照片。');
      showAlert('');el.adminSubmit.disabled=true;el.adminSubmit.textContent='Uploading to queue...';
      try{
        const formData=new FormData();state.adminFiles.forEach(file=>formData.append('photos',file));
        const data=await fetchJson('/api/admin/photos',{method:'POST',body:formData});
        state.uploadCount+=Number(data.uploaded||0);state.adminFiles=[];el.adminInput.value='';renderAdminFiles();renderMetrics();
      }catch(error){showAlert(getError(error))}finally{el.adminSubmit.disabled=false;el.adminSubmit.textContent='Start ingest pipeline'}
    }

    async function submitSearch(event){
      event.preventDefault();
      if(!state.selfieFile)return showAlert('请先上传一张自拍。');
      showAlert('');clearPolling();state.searching=true;state.taskStatus='pending';state.results=[];state.selectedIds=new Set();state.selectMode=false;
      renderResults([]);renderControls();renderMetrics();el.overlay.classList.add('active');el.status.classList.add('active');el.failed.classList.remove('active');el.empty.classList.remove('active');el.searchSubmit.disabled=true;el.searchSubmit.textContent='Scanning in queue...';
      try{
        const formData=new FormData();formData.append('selfie',state.selfieFile);
        const data=await fetchJson('/api/search',{method:'POST',body:formData});
        state.taskId=data.taskId;state.taskStatus=data.status||'pending';el.taskLabel.textContent='Task '+state.taskId.slice(0,8);renderMetrics();startPolling();
      }catch(error){finishSearchWithError(getError(error))}
    }

    function startPolling(){
      clearPolling();
      state.poller=setInterval(async()=>{
        try{
          const data=await fetchJson('/api/status/'+state.taskId);
          state.taskStatus=data.status||'pending';state.results=Array.isArray(data.results)?data.results:[];renderMetrics();
          if(data.status==='completed'){clearPolling();state.searching=false;el.overlay.classList.remove('active');el.status.classList.remove('active');el.searchSubmit.disabled=false;el.searchSubmit.textContent='Start face scan';renderResults(state.results);renderControls();if(!state.results.length)el.empty.classList.add('active')}
          if(data.status==='failed'){clearPolling();finishSearchWithError(data.error||'检索任务失败。')}
        }catch(error){clearPolling();finishSearchWithError(getError(error))}
      },2000);
    }

    function clearPolling(){if(state.poller){clearInterval(state.poller);state.poller=null}}
    function finishSearchWithError(message){state.searching=false;state.taskStatus='failed';renderMetrics();el.overlay.classList.remove('active');el.status.classList.remove('active');el.searchSubmit.disabled=false;el.searchSubmit.textContent='Start face scan';el.failed.textContent=message;el.failed.classList.add('active');showAlert(message)}
    function renderAdminFiles(){el.adminHint.textContent=state.adminFiles.length?state.adminFiles.length+' file(s) ready':'暂未选择文件';el.adminChips.innerHTML=state.adminFiles.slice(0,8).map(file=>'<span class="chip">'+safe(file.name)+'</span>').join('')}
    function renderMetrics(){el.mUploads.textContent=String(state.uploadCount);el.mStatus.textContent=state.taskStatus||'idle';el.mMatches.textContent=String(state.results.length)}
    function renderControls(){el.toggleSelect.disabled=!state.results.length;el.toggleSelect.textContent=state.selectMode?'Exit select mode':'Select mode';el.toggleAll.style.display=state.selectMode&&state.results.length?'inline-flex':'none';el.toggleAll.textContent=state.selectedIds.size===state.results.length&&state.results.length?'Clear all':'Select all';el.gallery.classList.toggle('select-mode',state.selectMode);updateDownload()}
    function updateDownload(){const count=state.selectedIds.size;el.download.classList.toggle('active',state.selectMode&&count>0);el.download.textContent='Download selected ('+count+')'}
    function renderResults(results){
      el.gallery.innerHTML='';el.gallery.classList.remove('active');el.empty.classList.remove('active');el.failed.classList.remove('active');
      if(!results.length){renderControls();return}
      results.forEach((item,index)=>{const card=document.createElement('button');card.type='button';card.className='card'+(state.selectMode?' selectable':'')+(state.selectedIds.has(item.id)?' selected':'');card.innerHTML='<img alt="'+safe(item.name||item.id)+'" src="'+safe(item.url)+'"/><div class="card-body"><div><div class="name">'+safe(item.name||item.id)+'</div><div class="meta">'+safe((item.contentType||'image').replace('image/',''))+'</div></div><div class="tick">'+(state.selectedIds.has(item.id)?'X':'')+'</div></div>';card.addEventListener('click',()=>{if(!state.selectMode)return;if(state.selectedIds.has(item.id))state.selectedIds.delete(item.id);else state.selectedIds.add(item.id);renderControls();renderResults(state.results)});el.gallery.appendChild(card);setTimeout(()=>card.classList.add('show'),60*index)});
      el.gallery.classList.add('active');renderControls();
    }

    async function downloadSelected(){
      const items=state.results.filter(item=>state.selectedIds.has(item.id));if(!items.length)return;
      el.download.disabled=true;el.download.textContent='Preparing zip...';
      try{
        const zip=new window.JSZip();
        for(const item of items){const response=await fetch(item.url);if(!response.ok)throw new Error('下载失败: '+(item.name||item.id));zip.file(item.name||(item.id+'.jpg'),await response.blob())}
        const archive=await zip.generateAsync({type:'blob',streamFiles:true,compression:'DEFLATE',compressionOptions:{level:6}});
        const href=URL.createObjectURL(archive);const a=document.createElement('a');a.href=href;a.download='photofinder-selection-'+Date.now()+'.zip';a.click();URL.revokeObjectURL(href);
      }catch(error){showAlert(getError(error))}finally{el.download.disabled=false;updateDownload()}
    }

    async function fetchJson(url,init){const response=await fetch(url,init);const data=await response.json();if(!response.ok)throw new Error(data.error||'Request failed');return data}
    function showAlert(message){if(!message){el.alert.style.display='none';el.alert.textContent='';return}el.alert.style.display='block';el.alert.textContent=message}
    function getError(error){return error instanceof Error?error.message:'发生了未知错误'}
    function safe(value){return String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}

    renderAdminFiles();renderMetrics();renderControls();
  </script>
</body>
</html>`;
}
