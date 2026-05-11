export function renderHomePage() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>PhotoFinder</title>
  <script src="https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js"></script>
  <style>
    :root{color-scheme:light dark;--bg:#f5f5f7;--bg2:#e9ebf0;--sheet:rgba(255,255,255,.78);--sheetStrong:rgba(255,255,255,.92);--sheetSoft:rgba(255,255,255,.62);--panel:#fff;--panelSoft:#f2f2f7;--panelMute:#ececf1;--ink:#0f1115;--muted:#6d6e76;--line:rgba(17,17,17,.08);--lineStrong:rgba(17,17,17,.14);--blue:#0a84ff;--blue2:#56a8ff;--green:#30d158;--red:#ff453a;--shadow:0 30px 80px rgba(18,20,29,.16);--shadowSoft:0 12px 30px rgba(18,20,29,.10);--blur:28px}
    @media (prefers-color-scheme:dark){:root{--bg:#000;--bg2:#111214;--sheet:rgba(28,28,30,.76);--sheetStrong:rgba(36,36,38,.92);--sheetSoft:rgba(28,28,30,.62);--panel:#1c1c1e;--panelSoft:#2c2c2e;--panelMute:#3a3a3c;--ink:#f5f5f7;--muted:#a0a1aa;--line:rgba(255,255,255,.08);--lineStrong:rgba(255,255,255,.14);--blue2:#69b3ff;--shadow:0 36px 90px rgba(0,0,0,.45);--shadowSoft:0 18px 42px rgba(0,0,0,.30)}}
    *{box-sizing:border-box}html,body{margin:0;min-height:100%}body{font-family:"SF Pro Display","SF Pro Text","Segoe UI","PingFang SC",sans-serif;color:var(--ink);background:radial-gradient(circle at 20% 0%,rgba(10,132,255,.22),transparent 28%),radial-gradient(circle at 82% 14%,rgba(255,255,255,.58),transparent 22%),linear-gradient(180deg,var(--bg),var(--bg2));letter-spacing:-.01em}@media (prefers-color-scheme:dark){body{background:radial-gradient(circle at 18% 0%,rgba(10,132,255,.18),transparent 26%),radial-gradient(circle at 85% 12%,rgba(255,255,255,.08),transparent 16%),linear-gradient(180deg,#050506,#101114 45%,#000)}}button,input{font:inherit}button{appearance:none}a{color:inherit}.hidden{display:none!important}.shell{width:min(1380px,calc(100vw - 28px));margin:0 auto;padding:18px 0 42px}.glass{background:var(--sheet);border:1px solid var(--line);box-shadow:var(--shadow);backdrop-filter:blur(var(--blur)) saturate(1.2);-webkit-backdrop-filter:blur(var(--blur)) saturate(1.2)}.chip{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:10px 18px;border-radius:999px;border:1px solid transparent;background:var(--panelSoft);color:var(--ink);cursor:pointer;transition:transform .18s ease,background .18s ease,border-color .18s ease,box-shadow .18s ease;font-weight:600;text-decoration:none}.chip:hover{transform:translateY(-1px)}.chip.primary{background:linear-gradient(180deg,var(--blue2),var(--blue));color:#fff;box-shadow:0 10px 24px rgba(10,132,255,.28)}.chip.secondary,.chip.ghost{border-color:var(--line)}.chip.secondary{background:var(--panelSoft)}.chip.ghost{background:var(--sheetSoft)}.chip.small{min-height:36px;padding:8px 14px;font-size:13px}.chip.danger{color:var(--red);background:color-mix(in srgb,var(--red) 8%,var(--panelSoft));border-color:color-mix(in srgb,var(--red) 24%,var(--line))}.field{width:100%;min-height:48px;border-radius:18px;border:1px solid var(--line);background:var(--panelSoft);color:var(--ink);padding:12px 16px;outline:none}.field:focus{border-color:color-mix(in srgb,var(--blue) 40%,var(--line));box-shadow:0 0 0 4px color-mix(in srgb,var(--blue) 16%,transparent);background:var(--panel)}.sectionTitle{margin:0;font-size:28px;line-height:1.05;letter-spacing:-.04em}.eyebrow{margin:0 0 8px;color:var(--muted);font-size:12px;letter-spacing:.18em;text-transform:uppercase;font-weight:700}.meta{margin:0;color:var(--muted);line-height:1.6}.stack{display:grid;gap:12px}.row{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
    .loginView{min-height:calc(100vh - 36px);display:grid;place-items:center;position:relative;overflow:hidden}.loginOrbs{position:absolute;inset:0;pointer-events:none;overflow:hidden}.orb{position:absolute;border-radius:50%;opacity:.95}.orb.one{width:320px;height:320px;left:-60px;top:-40px;background:radial-gradient(circle at 32% 32%,rgba(255,255,255,.95),rgba(10,132,255,.12) 48%,transparent 70%)}.orb.two{width:240px;height:240px;right:6%;top:14%;background:radial-gradient(circle at 30% 30%,rgba(255,255,255,.8),rgba(10,132,255,.18) 48%,transparent 72%)}.orb.three{width:260px;height:260px;left:14%;bottom:-90px;background:radial-gradient(circle at 38% 38%,rgba(255,255,255,.8),rgba(120,120,255,.10) 50%,transparent 74%)}.loginCard{width:min(940px,100%);border-radius:40px;padding:34px;position:relative;z-index:1}.loginHero{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(280px,.9fr);gap:24px;align-items:stretch}.heroCopy{padding:10px 4px 4px;display:flex;flex-direction:column;justify-content:space-between;gap:24px}.heroTitle{margin:0;font-size:clamp(52px,8vw,98px);line-height:.88;letter-spacing:-.075em;max-width:9ch}.heroText{max-width:54ch;font-size:17px;color:var(--muted);line-height:1.7}.heroPills{display:flex;gap:10px;flex-wrap:wrap}.heroPill{min-height:34px;padding:8px 12px;border-radius:999px;background:var(--sheetSoft);border:1px solid var(--line);font-size:13px;color:var(--muted)}.choicePanel{border-radius:32px;padding:18px;display:grid;gap:12px;align-content:start;background:var(--sheetSoft);border:1px solid var(--line)}.choiceCard{padding:18px;border-radius:26px;background:var(--panel);border:1px solid var(--line);box-shadow:var(--shadowSoft)}.choiceCard h3{margin:0 0 8px;font-size:20px;letter-spacing:-.03em}.choiceCard p{margin:0 0 14px;color:var(--muted);line-height:1.65}.loginNotice{display:none;margin-top:14px;padding:12px 14px;border-radius:18px;border:1px solid color-mix(in srgb,var(--red) 20%,var(--line));background:color-mix(in srgb,var(--red) 8%,var(--sheetStrong));color:var(--ink)}
    .appView{display:grid;gap:18px}.topbar{position:sticky;top:12px;z-index:20;border-radius:30px;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;gap:16px}.brandLockup{display:flex;align-items:center;gap:14px}.brandIcon{width:48px;height:48px;border-radius:16px;background:linear-gradient(180deg,rgba(255,255,255,.98),rgba(255,255,255,.62)),radial-gradient(circle at 30% 30%,rgba(10,132,255,.34),transparent 55%);border:1px solid rgba(255,255,255,.54);box-shadow:inset 0 1px 0 rgba(255,255,255,.65),0 8px 18px rgba(10,132,255,.16)}@media (prefers-color-scheme:dark){.brandIcon{background:linear-gradient(180deg,rgba(255,255,255,.12),rgba(255,255,255,.04)),radial-gradient(circle at 30% 30%,rgba(10,132,255,.42),transparent 56%);border-color:rgba(255,255,255,.09)}}.brandTitle{margin:0;font-size:24px;letter-spacing:-.05em}.brandSubtitle{margin:2px 0 0;color:var(--muted);font-size:13px}.userWrap{position:relative}.menu{position:absolute;right:0;top:58px;width:min(340px,calc(100vw - 32px));border-radius:28px;padding:14px;z-index:50}.menu .stack{gap:10px}.menuHead{padding:6px 6px 12px;border-bottom:1px solid var(--line);margin-bottom:12px}.notice{display:none;padding:14px 18px;border-radius:22px;border:1px solid color-mix(in srgb,var(--red) 20%,var(--line));background:color-mix(in srgb,var(--red) 8%,var(--sheetStrong));color:var(--ink)}.layout{display:grid;gap:18px;grid-template-columns:minmax(0,1.02fr) minmax(360px,.98fr);align-items:start}.panel{border-radius:34px;padding:22px}.panelHeader{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;margin-bottom:18px}.panelHeader .meta{max-width:60ch}.adminShell{display:grid;grid-template-columns:minmax(290px,340px) minmax(0,1fr);gap:16px}.listPanel,.detailPanel{border-radius:28px;padding:16px;background:var(--sheetSoft);border:1px solid var(--line)}.classToolbar,.searchButtons,.resultsActions,.detailActions{display:flex;gap:10px;flex-wrap:wrap;align-items:center}.classList{display:grid;gap:10px;margin-top:14px}.classCard{width:100%;padding:16px;border-radius:24px;background:var(--panel);border:1px solid var(--line);color:inherit;cursor:pointer;text-align:left;transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease,background .18s ease;box-shadow:var(--shadowSoft)}.classCard:hover{transform:translateY(-1px)}.classCard.active{border-color:color-mix(in srgb,var(--blue) 38%,var(--line));background:color-mix(in srgb,var(--blue) 7%,var(--panel))}.classCardHead{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.badge{display:inline-flex;align-items:center;justify-content:center;min-height:30px;padding:6px 10px;border-radius:999px;font-size:12px;font-weight:700;background:var(--panelSoft);border:1px solid var(--line);color:var(--muted)}.badge.open{color:var(--green);background:color-mix(in srgb,var(--green) 10%,var(--panelSoft));border-color:color-mix(in srgb,var(--green) 18%,var(--line))}.badge.closed{color:var(--red);background:color-mix(in srgb,var(--red) 9%,var(--panelSoft));border-color:color-mix(in srgb,var(--red) 18%,var(--line))}.classMiniGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:12px}.classMiniThumb{aspect-ratio:1/1;border-radius:14px;overflow:hidden;background:var(--panelMute);border:1px solid var(--line)}.classMiniThumb img{width:100%;height:100%;object-fit:cover;display:block}.detailEmpty{min-height:420px;display:grid;place-items:center;padding:28px;border-radius:28px;border:1px dashed var(--lineStrong);background:var(--sheetSoft);text-align:center}.detailHero{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;margin-bottom:18px}.statsRow{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px}
    .gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(168px,1fr));gap:14px}.photoCard{position:relative;border-radius:26px;overflow:hidden;background:var(--panel);border:1px solid var(--line);box-shadow:var(--shadowSoft)}.thumbButton{display:block;width:100%;padding:0;border:0;background:none;color:inherit;cursor:pointer;text-align:left}.thumbFrame{position:relative;width:100%;aspect-ratio:1/1;overflow:hidden;background:var(--panelMute)}.thumbFrame img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .28s ease}.photoCard:hover .thumbFrame img{transform:scale(1.03)}.photoMeta{padding:12px 14px 14px;display:grid;gap:4px}.photoName{font-size:15px;font-weight:700;line-height:1.35;word-break:break-word}.photoSub{color:var(--muted);font-size:12px;line-height:1.45}.selectBtn,.deleteBtn{position:absolute;top:12px;width:38px;height:38px;border-radius:999px;border:1px solid rgba(255,255,255,.34);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);cursor:pointer;display:grid;place-items:center;box-shadow:0 10px 24px rgba(0,0,0,.16)}.selectBtn{right:12px;background:rgba(255,255,255,.72);color:rgba(0,0,0,.72)}.selectBtn.active{background:linear-gradient(180deg,var(--blue2),var(--blue));color:#fff;border-color:rgba(255,255,255,.18)}.deleteBtn{left:12px;background:rgba(255,255,255,.72);color:var(--red)}@media (prefers-color-scheme:dark){.selectBtn,.deleteBtn{background:rgba(44,44,46,.72);border-color:rgba(255,255,255,.10)}.selectBtn{color:rgba(255,255,255,.86)}.selectBtn.active{color:#fff}}.checkGlyph{width:20px;height:20px;display:block}.searchPanel{overflow:hidden;position:relative}.searchPanel:before{content:"";position:absolute;inset:0;background:radial-gradient(circle at top right,rgba(10,132,255,.18),transparent 30%),linear-gradient(180deg,rgba(255,255,255,.08),transparent 40%);pointer-events:none}@media (prefers-color-scheme:dark){.searchPanel:before{background:radial-gradient(circle at top right,rgba(10,132,255,.22),transparent 32%),linear-gradient(180deg,rgba(255,255,255,.04),transparent 42%)}}.searchGrid{position:relative;display:grid;grid-template-columns:minmax(0,1.08fr) minmax(280px,.92fr);gap:18px;z-index:1}.searchControls{display:grid;gap:14px;align-content:start}.scanStage{border-radius:30px;padding:16px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.10)}.scanBox{position:relative;width:min(360px,100%);margin:0 auto;aspect-ratio:4/5;border-radius:28px;overflow:hidden;background:linear-gradient(180deg,#0f1721,#0c1118 48%,#090c10);border:1px solid rgba(255,255,255,.10);box-shadow:0 18px 40px rgba(0,0,0,.24)}.scanBox img{width:100%;height:100%;object-fit:cover;display:block}.scanEmpty{height:100%;display:grid;place-items:center;text-align:center;padding:24px;color:#d5d8df}.scanPulse{position:absolute;inset:15% 15%;border-radius:50%;border:1.5px solid rgba(107,192,255,.75);box-shadow:0 0 0 1px rgba(107,192,255,.18) inset,0 0 22px rgba(107,192,255,.16);opacity:0}.scanReticle{position:absolute;inset:18px;border-radius:22px;border:1px solid rgba(255,255,255,.08)}.scanLine{position:absolute;left:10%;right:10%;top:-14%;height:20%;border-radius:999px;background:linear-gradient(180deg,transparent,rgba(107,192,255,.42),transparent);opacity:0}.scanning .scanPulse{animation:pulse 1.8s infinite ease-out}.scanning .scanLine{opacity:1;animation:scan 2.35s infinite ease-in-out}.scanStatus{margin-top:14px;text-align:center;color:#d8dde5;min-height:22px;font-size:14px}.scanHints{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:14px}.hintTile{padding:12px;border-radius:18px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.08);color:#d8dde5}.hintTile strong{display:block;font-size:14px;margin-bottom:4px;color:#fff}.historyPanel{margin-top:16px;padding-top:16px;border-top:1px solid rgba(255,255,255,.10)}.historyList{display:grid;gap:12px}.historyCard{border-radius:26px;padding:16px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.10)}.historyHead{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;margin-bottom:12px}.historySelfie{width:88px;height:88px;border-radius:22px;overflow:hidden;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.10);flex:none}.historySelfie img{width:100%;height:100%;object-fit:cover;display:block}.historyResults{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:10px}.historyThumb{display:block;overflow:hidden;border-radius:18px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.08);text-decoration:none}.historyThumb img{width:100%;aspect-ratio:1/1;object-fit:cover;display:block}.historyThumb div{padding:8px 10px 10px;font-size:12px;color:#d8dde5;line-height:1.4;word-break:break-word}.resultsPanel{grid-column:1/-1}.resultsSummary{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px}.resultGroup{margin-top:22px}.resultGroup h3{margin:0 0 10px;font-size:20px;letter-spacing:-.03em}.emptyState{border-radius:26px;padding:28px;border:1px dashed var(--lineStrong);background:var(--sheetSoft);text-align:center;color:var(--muted)}.uploadStatus{position:fixed;right:18px;bottom:18px;z-index:60;width:min(390px,calc(100vw - 24px));border-radius:28px;padding:16px}.progressRail{margin-top:12px;height:10px;border-radius:999px;background:var(--panelMute);overflow:hidden;border:1px solid var(--line)}.progressFill{height:100%;width:0%;border-radius:inherit;background:linear-gradient(90deg,var(--blue),var(--blue2));transition:width .18s ease}
    .themeBar{display:flex;justify-content:flex-end;margin-bottom:16px}.themeSwitch{display:inline-grid;grid-template-columns:1fr 1fr;gap:6px;padding:6px;border-radius:999px;background:var(--panelSoft);border:1px solid var(--line);box-shadow:var(--shadowSoft)}.themeBtn{width:42px;height:42px;border:0;border-radius:999px;background:transparent;color:var(--muted);display:grid;place-items:center;cursor:pointer;transition:background .18s ease,color .18s ease,box-shadow .18s ease}.themeBtn svg{width:18px;height:18px;display:block}.themeBtn.active{background:linear-gradient(180deg,var(--blue2),var(--blue));color:#fff;box-shadow:0 10px 20px rgba(10,132,255,.22)}.loginCard,.choicePanel,.choiceCard,.topbar,.panel,.listPanel,.detailPanel,.scanStage,.menu,.uploadStatus,.photoCard,.historyCard,.historyThumb,.modal img{overflow:hidden;background-clip:padding-box}.modal{position:fixed;inset:0;z-index:80;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.74);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);padding:24px}.modal.show{display:flex}.modalViewport{position:relative;width:min(92vw,1280px);display:flex;align-items:center;justify-content:center}.modal img{max-width:100%;max-height:88vh;object-fit:contain;border-radius:28px;box-shadow:0 26px 80px rgba(0,0,0,.42)}.modalBtn,.closeBtn{position:absolute;border:0;color:#fff;cursor:pointer;display:grid;place-items:center;background:rgba(255,255,255,.12);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);box-shadow:0 12px 30px rgba(0,0,0,.22)}.modalBtn{top:50%;transform:translateY(-50%);width:72px;height:72px;border-radius:999px}.modalBtn svg,.closeBtn svg{display:block}.modalBtn svg{width:30px;height:30px}.modalPrev{left:max(12px,1vw)}.modalNext{right:max(12px,1vw)}.closeBtn{top:14px;right:14px;width:52px;height:52px;border-radius:999px}.closeBtn svg{width:22px;height:22px}body.theme-light{--bg:#f5f5f7;--bg2:#e9ebf0;--sheet:rgba(255,255,255,.78);--sheetStrong:rgba(255,255,255,.92);--sheetSoft:rgba(255,255,255,.62);--panel:#fff;--panelSoft:#f2f2f7;--panelMute:#ececf1;--ink:#0f1115;--muted:#6d6e76;--line:rgba(17,17,17,.08);--lineStrong:rgba(17,17,17,.14);--blue:#0a84ff;--blue2:#56a8ff;--green:#30d158;--red:#ff453a;--shadow:0 30px 80px rgba(18,20,29,.16);--shadowSoft:0 12px 30px rgba(18,20,29,.10);background:radial-gradient(circle at 20% 0%,rgba(10,132,255,.22),transparent 28%),radial-gradient(circle at 82% 14%,rgba(255,255,255,.58),transparent 22%),linear-gradient(180deg,var(--bg),var(--bg2))}body.theme-dark{--bg:#000;--bg2:#111214;--sheet:rgba(28,28,30,.76);--sheetStrong:rgba(36,36,38,.92);--sheetSoft:rgba(28,28,30,.62);--panel:#1c1c1e;--panelSoft:#2c2c2e;--panelMute:#3a3a3c;--ink:#f5f5f7;--muted:#a0a1aa;--line:rgba(255,255,255,.08);--lineStrong:rgba(255,255,255,.14);--blue:#0a84ff;--blue2:#69b3ff;--green:#30d158;--red:#ff453a;--shadow:0 36px 90px rgba(0,0,0,.45);--shadowSoft:0 18px 42px rgba(0,0,0,.30);background:radial-gradient(circle at 18% 0%,rgba(10,132,255,.18),transparent 26%),radial-gradient(circle at 85% 12%,rgba(255,255,255,.08),transparent 16%),linear-gradient(180deg,#050506,#101114 45%,#000)}@keyframes pulse{0%{transform:scale(.84);opacity:.14}55%{transform:scale(1);opacity:.95}100%{transform:scale(1.12);opacity:0}}@keyframes scan{0%,100%{transform:translateY(0)}50%{transform:translateY(430%)}}@media (max-width:1140px){.layout{grid-template-columns:1fr}.searchGrid{grid-template-columns:1fr}.adminShell{grid-template-columns:1fr}}@media (max-width:860px){.loginHero{grid-template-columns:1fr}.panelHeader,.detailHero,.historyHead,.topbar{align-items:flex-start}.topbar{flex-direction:column}.brandLockup,.topbar .row{width:100%}.topbar .row{justify-content:space-between}}@media (max-width:680px){.shell{width:100%;padding:10px 10px 24px}.loginCard,.panel{padding:18px}.loginCard{border-radius:32px;background:var(--sheetStrong)}.choicePanel{border-radius:28px;background:var(--sheetStrong)}.choiceCard{border-radius:24px;background:var(--panel)}.topbar,.panel,.listPanel,.detailPanel,.scanStage,.menu,.uploadStatus{border-radius:26px}.classToolbar,.searchButtons,.resultsActions,.detailActions{flex-direction:column;align-items:stretch}.chip{width:100%}.gallery{grid-template-columns:repeat(2,minmax(0,1fr))}.scanHints{grid-template-columns:1fr}.modalBtn{width:58px;height:58px}.modalBtn svg{width:24px;height:24px}}@media (max-width:420px){.gallery,.historyResults{grid-template-columns:1fr}.heroTitle{font-size:46px}}
  </style>
</head>
<body>
  <div class="shell">
    <section id="loginView" class="loginView">
      <div class="loginOrbs"><div class="orb one"></div><div class="orb two"></div><div class="orb three"></div></div>
      <div class="loginCard glass">
        <div class="themeBar"><div class="themeSwitch"><button id="loginThemeLight" class="themeBtn" type="button" aria-label="Use light mode" data-theme-value="light"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="4.25" stroke="currentColor" stroke-width="1.8"/><path d="M12 2.75v2.5M12 18.75v2.5M21.25 12h-2.5M5.25 12h-2.5M18.54 5.46l-1.77 1.77M7.23 16.77l-1.77 1.77M18.54 18.54l-1.77-1.77M7.23 7.23L5.46 5.46" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button><button id="loginThemeDark" class="themeBtn" type="button" aria-label="Use dark mode" data-theme-value="dark"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M19 14.5A7.5 7.5 0 1 1 9.5 5a6 6 0 1 0 9.5 9.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg></button></div></div>
        <div class="loginHero">
          <div class="heroCopy">
            <div class="stack" style="gap:16px">
              <p class="eyebrow">PhotoFinder</p>
              <h1 class="heroTitle">Find the right photos faster.</h1>
              <p class="heroText">A face-driven photo distribution space for events and classes. Admins curate uploads by class, guests scan a selfie, and bound users keep a downloadable search history.</p>
            </div>
            <div class="heroPills"><span class="heroPill">Face Search</span><span class="heroPill">Class Access Control</span><span class="heroPill">History & ZIP Download</span></div>
          </div>
          <div class="choicePanel">
            <div class="choiceCard"><h3>Login As Admin</h3><p>Enter through Aryuki Auth Center. Only users recognized as admins can manage classes and upload photos.</p><button id="adminLogin" class="chip primary" type="button">Continue as Admin</button></div>
            <div class="choiceCard"><h3>Find My Photos</h3><p>Create a temporary visitor profile instantly, upload or capture a selfie, and bind your account later if you want synced history.</p><button id="tempLogin" class="chip secondary" type="button">Continue as Guest</button></div>
          </div>
          <div id="loginNotice" class="loginNotice"></div>
        </div>
      </div>
    </section>
    <section id="appView" class="appView hidden">
      <header class="topbar glass">
        <div class="brandLockup"><div class="brandIcon"></div><div><p class="eyebrow" style="margin-bottom:4px">PhotoFinder</p><h1 class="brandTitle">Photo Distributor</h1><p class="brandSubtitle">Class-based publishing with async selfie search</p></div></div>
        <div class="row"><div id="topSummary" class="badge">Ready</div><div class="themeSwitch"><button id="appThemeLight" class="themeBtn" type="button" aria-label="Use light mode" data-theme-value="light"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="4.25" stroke="currentColor" stroke-width="1.8"/><path d="M12 2.75v2.5M12 18.75v2.5M21.25 12h-2.5M5.25 12h-2.5M18.54 5.46l-1.77 1.77M7.23 16.77l-1.77 1.77M18.54 18.54l-1.77-1.77M7.23 7.23L5.46 5.46" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button><button id="appThemeDark" class="themeBtn" type="button" aria-label="Use dark mode" data-theme-value="dark"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M19 14.5A7.5 7.5 0 1 1 9.5 5a6 6 0 1 0 9.5 9.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg></button></div><div class="userWrap"><button id="userButton" class="chip secondary" type="button">Account</button><div id="userMenu" class="menu glass hidden"></div></div></div>
      </header>
      <div id="notice" class="notice"></div>
      <div class="layout">
        <section id="adminPanel" class="panel glass hidden">
          <div class="panelHeader"><div><p class="eyebrow">Admin</p><h2 class="sectionTitle">Class Manager</h2><p class="meta">Open or close classes at the class level so search visibility changes stay fast. Thumbnails are grouped by class to keep browsing clear on both desktop and mobile.</p></div></div>
          <div class="adminShell">
            <div class="listPanel">
              <div class="classToolbar"><input id="className" class="field" placeholder="Create a new class" /><button id="createClass" class="chip primary small">Create</button><button id="refreshClasses" class="chip secondary small">Refresh</button></div>
              <div id="classList" class="classList"></div>
            </div>
            <div id="classDetailHost">
              <div id="classDetailEmpty" class="detailEmpty"><div class="stack" style="gap:10px"><h3 style="margin:0;font-size:26px;letter-spacing:-.04em">Choose a class</h3><p class="meta">Select a class to inspect its thumbnails, control search visibility, upload more images, or remove photos and the class itself.</p></div></div>
              <div id="classDetail" class="detailPanel hidden">
                <div class="detailHero">
                  <div><p class="eyebrow">Selected Class</p><h3 id="classTitle" class="sectionTitle" style="font-size:30px"></h3><p id="classMeta" class="meta"></p><div id="classStats" class="statsRow"></div></div>
                  <div class="detailActions"><button id="toggleClass" class="chip secondary small">Toggle</button><button id="deleteClass" class="chip danger small">Delete Class</button><label class="chip primary small" for="adminFiles">Upload Photos</label><input id="adminFiles" type="file" multiple style="display:none" /></div>
                </div>
                <div id="classPhotos" class="gallery"></div>
              </div>
            </div>
          </div>
        </section>
        <section class="panel glass searchPanel">
          <div class="panelHeader"><div><p class="eyebrow">Search</p><h2 class="sectionTitle">Find My Photos</h2><p class="meta">Capture a selfie on mobile or upload one from your device. The search task enters the queue immediately and the gallery updates as soon as processing finishes.</p></div></div>
          <div class="searchGrid">
            <div class="searchControls">
              <div class="searchButtons"><label class="chip primary" for="selfieCapture">Take Selfie</label><input id="selfieCapture" type="file" accept="image/*" capture="user" style="display:none" /><label class="chip secondary" for="selfieUpload">Upload Image</label><input id="selfieUpload" type="file" accept="image/*" style="display:none" /><button id="startSearch" class="chip secondary">Start Face Scan</button><button id="toggleHistory" class="chip ghost hidden">History</button></div>
              <div class="stack" style="gap:8px"><div class="badge">Queue-driven search</div><p class="meta">Bound users and admins can reopen previous searches, inspect matched thumbnails, and download everything again without repeating the upload.</p></div>
              <div id="historyPanel" class="historyPanel hidden"><div id="historyList" class="historyList"></div></div>
            </div>
            <div class="scanStage">
              <div class="scanBox" id="scanBox"><img id="scanImage" class="hidden" alt="Selfie preview" /><div id="scanEmpty" class="scanEmpty"><div class="stack" style="gap:8px"><strong style="font-size:20px">No selfie selected</strong><div class="meta" style="color:#bfc7d1">Choose a file or open the camera to begin the face scan.</div></div></div><div class="scanReticle"></div><div class="scanPulse"></div><div class="scanLine"></div></div>
              <div id="scanStatus" class="scanStatus">Waiting for your selfie.</div>
              <div class="scanHints"><div class="hintTile"><strong>1. Frame</strong>Keep one clear face in view.</div><div class="hintTile"><strong>2. Upload</strong>Send the image to the queue.</div><div class="hintTile"><strong>3. Reveal</strong>Open and download matched photos.</div></div>
            </div>
          </div>
        </section>
        <section class="panel glass resultsPanel">
          <div class="panelHeader"><div><p class="eyebrow">Results</p><h2 class="sectionTitle">Matched Photos</h2><p class="meta">Browse grouped thumbnails by class, open the original image in the previewer, then select individual photos or everything at once for direct or ZIP download.</p><div id="resultsSummary" class="resultsSummary"></div></div><div class="resultsActions"><button id="selectAll" class="chip secondary small">Select All</button><button id="downloadDirect" class="chip secondary small">Download Selected</button><button id="downloadZip" class="chip primary small">Download ZIP</button></div></div>
          <div id="results"></div>
        </section>
      </div>
    </section>
  </div>
  <div id="uploadStatus" class="uploadStatus glass hidden"><div class="stack" style="gap:6px"><div id="uploadStatusName" class="photoName">Preparing upload...</div><div id="uploadStatusStep" class="meta">Waiting</div></div><div class="progressRail"><div id="uploadStatusBar" class="progressFill"></div></div><div id="uploadStatusSummary" class="meta" style="margin-top:10px">0 / 0</div></div>
  <div id="modal" class="modal"><div class="modalViewport"><button id="closeModal" class="closeBtn" aria-label="Close preview"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"/></svg></button><button id="prevModal" class="modalBtn modalPrev" aria-label="Previous image"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14.75 5.75L8.5 12l6.25 6.25" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button><img id="modalImage" alt="Full-size preview" /><button id="nextModal" class="modalBtn modalNext" aria-label="Next image"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9.25 5.75L15.5 12l-6.25 6.25" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div></div>
  <script>
    const $ = (id) => document.getElementById(id);
    let me = null;
    let classes = [];
    let activeClassId = '';
    let classPhotos = [];
    let results = [];
    let historyItems = [];
    let selected = new Set();
    let modalPhotos = [];
    let modalIndex = 0;
    let selfieFile = null;
    let currentTheme = 'light';
    const checkSvg = '<svg class="checkGlyph" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6.8 12.6l3.2 3.2 7.3-7.5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const trashSvg = '<svg class="checkGlyph" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 9.5v6M15 9.5v6M5.5 7.5h13M10 4.75h4l.75 1.5h3v1.25l-.7 9.2a2 2 0 0 1-2 1.85H8.95a2 2 0 0 1-2-1.85l-.7-9.2V6.25h3z" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const api = async (url, options = {}) => {
      const response = await fetch(url, options);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Request failed');
      return payload;
    };
    const showNotice = (message) => {
      const node = $('notice');
      node.textContent = message || '';
      node.style.display = message ? 'block' : 'none';
    };
    const showLoginNotice = (message) => {
      const node = $('loginNotice');
      if (!node) return;
      node.textContent = message || '';
      node.style.display = message ? 'block' : 'none';
    };
    function applyTheme(theme, persist = true) {
      currentTheme = theme === 'dark' ? 'dark' : 'light';
      document.body.classList.remove('theme-light', 'theme-dark');
      document.body.classList.add('theme-' + currentTheme);
      document.documentElement.setAttribute('data-theme', currentTheme);
      if (persist) {
        try { localStorage.setItem('pd-theme', currentTheme); } catch {}
      }
      document.querySelectorAll('[data-theme-value]').forEach((button) => {
        button.classList.toggle('active', button.getAttribute('data-theme-value') === currentTheme);
      });
    }
    function detectInitialTheme() {
      try {
        const saved = localStorage.getItem('pd-theme');
        if (saved === 'light' || saved === 'dark') return saved;
      } catch {}
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    async function init() {
      bindTopLevelEvents();
      applyTheme(detectInitialTheme(), false);
      try {
        const session = await api('/api/me');
        me = session.user || null;
      } catch {
        me = null;
      }
      renderShell();
      if (me) await loadClasses();
    }
    function bindTopLevelEvents() {
      $('adminLogin').onclick = async () => {
        showLoginNotice('');
        const button = $('adminLogin');
        const original = button.textContent;
        try {
          button.disabled = true;
          button.textContent = 'Opening...';
          const data = await api('/api/auth/login-url?mode=admin');
          location.href = data.url;
        } catch (error) {
          showLoginNotice(error.message || 'Admin login is unavailable right now.');
          button.disabled = false;
          button.textContent = original;
        }
      };
      $('tempLogin').onclick = async () => {
        showLoginNotice('');
        const button = $('tempLogin');
        const original = button.textContent;
        try {
          button.disabled = true;
          button.textContent = 'Creating guest...';
          const data = await api('/api/auth/temp', { method: 'POST' });
          me = data.user;
          renderShell();
          await loadClasses();
        } catch (error) {
          showLoginNotice(error.message || 'Temporary login failed. Please try again.');
          button.disabled = false;
          button.textContent = original;
        }
      };
      $('userButton').onclick = () => $('userMenu').classList.toggle('hidden');
      $('createClass').onclick = createClass;
      $('refreshClasses').onclick = loadClasses;
      $('toggleClass').onclick = toggleClassVisibility;
      $('deleteClass').onclick = deleteCurrentClass;
      $('adminFiles').onchange = uploadAdminPhotos;
      $('selfieCapture').onchange = (event) => setSelfieFile((event.target.files || [])[0] || null);
      $('selfieUpload').onchange = (event) => setSelfieFile((event.target.files || [])[0] || null);
      $('startSearch').onclick = startSearch;
      $('toggleHistory').onclick = toggleHistory;
      $('selectAll').onclick = toggleSelectAll;
      $('downloadDirect').onclick = downloadSelectedDirect;
      $('downloadZip').onclick = downloadSelectedZip;
      $('closeModal').onclick = closeModal;
      $('prevModal').onclick = () => stepModal(-1);
      $('nextModal').onclick = () => stepModal(1);
      $('modal').onclick = (event) => { if (event.target === $('modal')) closeModal(); };
      document.querySelectorAll('[data-theme-value]').forEach((button) => {
        button.onclick = () => applyTheme(button.getAttribute('data-theme-value'));
      });
      document.addEventListener('click', (event) => {
        const wrap = document.querySelector('.userWrap');
        if (wrap && !wrap.contains(event.target)) $('userMenu').classList.add('hidden');
      });
      document.addEventListener('keydown', (event) => {
        if (!$('modal').classList.contains('show')) return;
        if (event.key === 'Escape') closeModal();
        if (event.key === 'ArrowLeft') stepModal(-1);
        if (event.key === 'ArrowRight') stepModal(1);
      });
    }
    function renderShell() {
      const loggedIn = !!me;
      $('loginView').classList.toggle('hidden', loggedIn);
      $('appView').classList.toggle('hidden', !loggedIn);
      if (!loggedIn) return;
      $('adminPanel').classList.toggle('hidden', me.role !== 'admin');
      $('toggleHistory').classList.toggle('hidden', !me.authUuid);
      $('userButton').textContent = me.role === 'admin' ? 'Admin Account' : (me.name || 'Account');
      $('topSummary').textContent = me.role === 'admin' ? 'Admin online' : (me.authUuid ? 'Bound account' : 'Temporary guest');
      renderUserMenu();
      renderResults();
    }
    function renderUserMenu() {
      const pieces = ['<div class="menuHead"><div class="photoName">' + esc(me.name || 'User') + '</div><div class="meta">' + esc(me.username || me.kind || '') + '</div><div class="meta">Role: ' + esc(me.role || 'user') + '</div></div><div class="stack">'];
      if (me.kind === 'temp') pieces.push('<button class="chip primary small" onclick="bindAuth()">Bind With Aryuki Auth Center</button>');
      if (me.authCenterUrl) pieces.push('<a class="chip secondary small" style="text-align:center" href="' + esc(me.authCenterUrl) + '" target="_blank" rel="noreferrer">Open User Center</a>');
      pieces.push('<button class="chip secondary small" onclick="logoutUser()">Logout</button></div>');
      $('userMenu').innerHTML = pieces.join('');
    }
    window.bindAuth = async () => {
      const data = await api('/api/auth/login-url?mode=bind');
      location.href = data.url;
    };
    window.logoutUser = async () => {
      const authLogout = 'https://accounts.aryuki.com/logout?redirect=' + encodeURIComponent(location.origin + '/login');
      const useSsoLogout = me && me.kind !== 'temp';
      await api('/api/logout', { method: 'POST' }).catch(() => {});
      location.href = useSsoLogout ? authLogout : '/login';
    };
    async function loadClasses() {
      if (!me) return;
      const data = await api('/api/classes');
      classes = data.classes || [];
      if (activeClassId && !classes.some((item) => item.id === activeClassId)) activeClassId = '';
      renderClasses();
      if (activeClassId) await loadClassPhotos(activeClassId);
    }
    function renderClasses() {
      const host = $('classList');
      if (!classes.length) {
        host.innerHTML = '<div class="emptyState">No classes yet. Create one to start uploading photos.</div>';
        renderClassDetail();
        return;
      }
      host.innerHTML = classes.map((item) => {
        const previews = Array.isArray(item.preview_urls) ? item.preview_urls : [];
        const thumbs = previews.slice(0, 3).map((url, index) => '<div class="classMiniThumb"><img src="' + esc(thumbUrl(url, 120)) + '" alt="' + esc(item.name + ' preview ' + (index + 1)) + '" loading="lazy" decoding="async" onerror="this.onerror=null;this.src=' + "'" + esc(url) + "'" + '" /></div>').join('');
        return '<button class="classCard' + (item.id === activeClassId ? ' active' : '') + '" onclick="selectClass(\\'' + item.id + '\\')"><div class="classCardHead"><div><div class="photoName">' + esc(item.name) + '</div><div class="photoSub">' + esc(item.id) + '</div></div><span class="badge ' + (item.is_open ? 'open' : 'closed') + '">' + (item.is_open ? 'Open' : 'Closed') + '</span></div><div class="photoSub" style="margin-top:10px">' + Number(item.photo_count || 0) + ' photos available</div>' + (thumbs ? '<div class="classMiniGrid">' + thumbs + '</div>' : '') + '</button>';
      }).join('');
      renderClassDetail();
    }
    window.selectClass = async (classId) => {
      activeClassId = classId;
      renderClasses();
      await loadClassPhotos(classId);
    };
    async function createClass() {
      const input = $('className');
      const name = (input.value || '').trim() || 'Untitled Class';
      await api('/api/classes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }) });
      input.value = '';
      await loadClasses();
    }
    function renderClassDetail() {
      const item = classes.find((entry) => entry.id === activeClassId);
      $('classDetailEmpty').classList.toggle('hidden', !!item);
      $('classDetail').classList.toggle('hidden', !item);
      if (!item) return;
      $('classTitle').textContent = item.name;
      $('classMeta').textContent = item.id + ' /?' + Number(item.photo_count || 0) + ' photos /?' + (item.is_open ? 'Visible in search' : 'Hidden from search');
      $('toggleClass').textContent = item.is_open ? 'Close Query' : 'Open Query';
      $('classStats').innerHTML = ['<span class="badge">' + esc(item.id) + '</span>','<span class="badge ' + (item.is_open ? 'open' : 'closed') + '">' + (item.is_open ? 'Search Enabled' : 'Search Disabled') + '</span>','<span class="badge">' + Number(item.photo_count || 0) + ' images</span>'].join('');
    }
    async function loadClassPhotos(classId) {
      const data = await api('/api/classes/' + classId + '/photos');
      classPhotos = data.photos || [];
      renderClassPhotos();
    }
    function renderClassPhotos() {
      $('classPhotos').innerHTML = classPhotos.length ? classPhotos.map((photo) => renderPhotoCard(photo, false)).join('') : '<div class="emptyState" style="grid-column:1/-1">No photos in this class yet.</div>';
    }
    async function toggleClassVisibility() {
      const current = classes.find((entry) => entry.id === activeClassId);
      if (!current) return;
      const data = await api('/api/classes/' + current.id, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ isOpen: !current.is_open }) });
      classes = classes.map((entry) => entry.id === current.id ? { ...entry, is_open: data.class.is_open } : entry);
      renderClasses();
      showNotice(data.class.is_open ? 'This class is now searchable.' : 'This class is now hidden from search.');
    }
    async function deleteCurrentClass() {
      const current = classes.find((entry) => entry.id === activeClassId);
      if (!current) return;
      if (!confirm('Delete class "' + current.name + '" and all photos inside it? This cannot be undone.')) return;
      await api('/api/classes/' + current.id, { method: 'DELETE' });
      activeClassId = '';
      classPhotos = [];
      showNotice('Class "' + current.name + '" was deleted.');
      await loadClasses();
    }
    async function uploadAdminPhotos(event) {
      const files = [...(event.target.files || [])];
      if (!activeClassId) {
        showNotice('Choose a class before uploading photos.');
        return;
      }
      if (!files.length) {
        showNotice('Please choose at least one image to upload.');
        return;
      }
      const total = files.length;
      let completed = 0;
      try {
        for (const file of files) {
          await uploadSinglePhoto(file, activeClassId, completed, total);
          completed += 1;
          setUploadStatus({ name: file.name, step: 'Queued for indexing', progress: 100, summary: completed + ' / ' + total + ' completed /?' + (total - completed) + ' remaining' });
        }
        showNotice('Photos uploaded and queued for indexing.');
        await loadClasses();
        if (activeClassId) await loadClassPhotos(activeClassId);
      } catch (error) {
        showNotice(error.message || 'Upload failed.');
      } finally {
        event.target.value = '';
        setTimeout(() => $('uploadStatus').classList.add('hidden'), 2200);
      }
    }
    function uploadSinglePhoto(file, classId, completed, total) {
      return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('class_id', classId);
        formData.append('photos', file);
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/admin/photos');
        xhr.responseType = 'json';
        xhr.onloadstart = () => setUploadStatus({ name: file.name, step: 'Preparing request', progress: 4, summary: completed + ' / ' + total + ' completed /?' + (total - completed) + ' remaining' });
        xhr.upload.onprogress = (event) => {
          const progress = event.lengthComputable ? Math.round((event.loaded / event.total) * 92) : 35;
          setUploadStatus({ name: file.name, step: 'Uploading to Worker', progress, summary: completed + ' / ' + total + ' completed /?' + (total - completed) + ' remaining' });
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setUploadStatus({ name: file.name, step: 'Writing to R2 and queueing ingest task', progress: 100, summary: completed + ' / ' + total + ' completed /?' + (total - completed) + ' remaining' });
            resolve(xhr.response);
            return;
          }
          const response = xhr.response || {};
          reject(new Error(response.error || 'Upload failed'));
        };
        xhr.onerror = () => reject(new Error('Upload failed'));
        xhr.send(formData);
      });
    }
    function setUploadStatus(info) {
      $('uploadStatus').classList.remove('hidden');
      $('uploadStatusName').textContent = info.name;
      $('uploadStatusStep').textContent = info.step;
      $('uploadStatusBar').style.width = Math.max(0, Math.min(100, info.progress)) + '%';
      $('uploadStatusSummary').textContent = info.summary;
    }
    function setSelfieFile(file) {
      selfieFile = file || null;
      const image = $('scanImage');
      const empty = $('scanEmpty');
      if (!selfieFile) {
        image.src = '';
        image.classList.add('hidden');
        empty.classList.remove('hidden');
        $('scanStatus').textContent = 'Waiting for your selfie.';
        return;
      }
      image.src = URL.createObjectURL(selfieFile);
      image.classList.remove('hidden');
      empty.classList.add('hidden');
      $('scanStatus').textContent = selfieFile.name;
    }
    async function startSearch() {
      if (!selfieFile) {
        showNotice('Please choose a selfie first.');
        return;
      }
      showNotice('');
      $('scanBox').classList.add('scanning');
      $('scanStatus').textContent = 'Scanning in queue...';
      const formData = new FormData();
      formData.append('selfie', selfieFile);
      const data = await api('/api/search', { method: 'POST', body: formData });
      pollTask(data.taskId);
    }
    function pollTask(taskId) {
      const timer = setInterval(async () => {
        try {
          const data = await api('/api/status/' + taskId);
          if (data.status === 'pending' || data.status === 'processing') {
            $('scanStatus').textContent = data.status === 'processing' ? 'Searching open classes...' : 'Waiting in queue...';
            return;
          }
          clearInterval(timer);
          $('scanBox').classList.remove('scanning');
          if (data.status === 'failed') {
            showNotice(data.error || 'Search failed.');
            $('scanStatus').textContent = 'Search failed.';
            return;
          }
          results = data.results || [];
          selected = new Set();
          renderResults();
          if (me && me.authUuid && !$('historyPanel').classList.contains('hidden')) await loadHistory();
          $('scanStatus').textContent = results.length ? 'Search complete.' : 'No matching photos found.';
        } catch (error) {
          clearInterval(timer);
          $('scanBox').classList.remove('scanning');
          showNotice(error.message || 'Search failed.');
          $('scanStatus').textContent = 'Search interrupted.';
        }
      }, 2000);
    }
    function renderResults() {
      $('resultsSummary').innerHTML = results.length ? ['<span class="badge">' + results.length + ' matches</span>','<span class="badge">' + selected.size + ' selected</span>'].join('') : '<span class="badge">No matches yet</span>';
      if (!results.length) {
        $('results').innerHTML = '<div class="emptyState">No search results yet. Upload a selfie to begin.</div>';
        return;
      }
      const grouped = {};
      results.forEach((photo) => {
        const key = photo.className || 'Ungrouped';
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(photo);
      });
      $('results').innerHTML = Object.entries(grouped).map(([name, items]) => '<section class="resultGroup"><h3>' + esc(name) + '</h3><div class="gallery">' + items.map((photo) => renderPhotoCard(photo, true)).join('') + '</div></section>').join('');
    }
    async function toggleHistory() {
      const panel = $('historyPanel');
      const opening = panel.classList.contains('hidden');
      panel.classList.toggle('hidden', !opening);
      $('toggleHistory').textContent = opening ? 'Hide History' : 'History';
      if (opening) await loadHistory();
    }
    async function loadHistory() {
      const data = await api('/api/history');
      historyItems = data.tasks || [];
      renderHistory();
    }
    function renderHistory() {
      const host = $('historyList');
      if (!historyItems.length) {
        host.innerHTML = '<div class="emptyState" style="color:#d8dde5;border-color:rgba(255,255,255,.12);background:rgba(255,255,255,.04)">No history yet for this bound account.</div>';
        return;
      }
      host.innerHTML = historyItems.map((task) => {
        const resultHtml = task.results.length ? task.results.map((photo) => '<a class="historyThumb" href="' + esc(photo.url) + '" target="_blank" rel="noreferrer"><img src="' + esc(thumbUrl(photo.url, 220)) + '" alt="' + esc(photo.name || photo.id) + '" loading="lazy" decoding="async" onerror="this.onerror=null;this.src=' + "'" + esc(photo.url) + "'" + '" /><div>' + esc(photo.name || photo.id) + '</div></a>').join('') : '<div class="meta" style="color:#d8dde5">No matched photos in this task.</div>';
        return '<article class="historyCard"><div class="historyHead"><div style="display:flex;gap:12px;align-items:center"><div class="historySelfie"><img src="' + esc(thumbUrl(task.selfie.url, 220)) + '" alt="' + esc(task.selfie.name) + '" loading="lazy" decoding="async" onerror="this.onerror=null;this.src=' + "'" + esc(task.selfie.url) + "'" + '" /></div><div><div class="photoName">' + esc(task.selfie.name) + '</div><div class="meta" style="color:#d8dde5">' + esc(task.createdAt || '') + '</div><div class="meta" style="color:#d8dde5">Status: ' + esc(task.status) + ' /?Matches: ' + Number(task.matchCount || 0) + '</div></div></div><div class="resultsActions"><button class="chip secondary small" onclick="downloadHistoryDirect(\\'' + task.taskId + '\\')">Download All</button><button class="chip primary small" onclick="downloadHistoryZip(\\'' + task.taskId + '\\')">ZIP</button></div></div><div class="historyResults">' + resultHtml + '</div></article>';
      }).join('');
    }
    function renderPhotoCard(photo, selectable) {
      const deleteButton = !selectable && me && me.role === 'admin' ? '<button class="deleteBtn" onclick="event.stopPropagation();deletePhotoFromClass(\\'' + photo.id + '\\',\\'' + escJs(photo.name || photo.original_name || photo.id) + '\\')">' + trashSvg + '</button>' : '';
      const selectButton = selectable ? '<button class="selectBtn ' + (selected.has(photo.id) ? 'active' : '') + '" onclick="event.stopPropagation();toggleSelect(\\'' + photo.id + '\\')">' + (selected.has(photo.id) ? checkSvg : '') + '</button>' : '';
      return '<article class="photoCard">' + deleteButton + '<button class="thumbButton" onclick="openPreview(\\'' + photo.id + '\\')"><div class="thumbFrame"><img src="' + esc(thumbUrl(photo.url, 360)) + '" alt="' + esc(photo.name || photo.original_name || photo.id) + '" loading="lazy" decoding="async" onerror="this.onerror=null;this.src=' + "'" + esc(photo.url) + "'" + '" /></div><div class="photoMeta"><div class="photoName">' + esc(photo.name || photo.original_name || photo.id) + '</div><div class="photoSub">' + esc(photo.className || photo.status || photo.contentType || 'image') + '</div></div></button>' + selectButton + '</article>';
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
        const anchor = document.createElement('a');
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
      const archive = await zip.generateAsync({ type: 'blob' });
      const anchor = document.createElement('a');
      anchor.href = URL.createObjectURL(archive);
      anchor.download = filename;
      anchor.click();
    }
    function downloadSelectedDirect() {
      const items = getSelectedPhotos();
      if (!items.length) {
        showNotice('Select at least one photo first.');
        return;
      }
      downloadPhotosDirect(items);
    }
    async function downloadSelectedZip() {
      const items = getSelectedPhotos();
      if (!items.length) {
        showNotice('Select at least one photo first.');
        return;
      }
      await downloadPhotosZip(items, 'photofinder.zip');
    }
    window.downloadHistoryDirect = (taskId) => {
      const task = historyItems.find((item) => item.taskId === taskId);
      if (!task || !task.results.length) {
        showNotice('This history entry does not have downloadable results.');
        return;
      }
      downloadPhotosDirect(task.results);
    };
    window.downloadHistoryZip = async (taskId) => {
      const task = historyItems.find((item) => item.taskId === taskId);
      if (!task || !task.results.length) {
        showNotice('This history entry does not have downloadable results.');
        return;
      }
      await downloadPhotosZip(task.results, 'photofinder-history-' + taskId + '.zip');
    };
    window.deletePhotoFromClass = async (photoId, photoName) => {
      if (!confirm('Delete photo "' + photoName + '"? This cannot be undone.')) return;
      await api('/api/photos/' + photoId, { method: 'DELETE' });
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
      $('modalImage').src = modalPhotos[modalIndex].url;
      $('modal').classList.add('show');
    }
    function closeModal() {
      $('modal').classList.remove('show');
    }
    function stepModal(step) {
      if (!modalPhotos.length) return;
      modalIndex = (modalIndex + step + modalPhotos.length) % modalPhotos.length;
      showModal();
    }
    function thumbUrl(url, size) {
      const absolute = url.startsWith('http') ? url : location.origin + url;
      return '/cdn-cgi/image/width=' + size + ',height=' + size + ',fit=cover,quality=72,format=auto/' + encodeURI(absolute);
    }
    function esc(value) {
      return String(value || '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));
    }
    function escJs(value) {
      return String(value || '').split('\\\\').join('\\\\\\\\').split("'").join("\\\\'");
    }
    init();
  </script>
</body>
</html>`;
}

