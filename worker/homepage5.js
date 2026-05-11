import { renderHomePage } from "./homepage4.js";

function iconSun() {
  return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="4.2" stroke="currentColor" stroke-width="1.8"/><path d="M12 2.75v2.5M12 18.75v2.5M21.25 12h-2.5M5.25 12h-2.5M18.54 5.46l-1.77 1.77M7.23 16.77l-1.77 1.77M18.54 18.54l-1.77-1.77M7.23 7.23 5.46 5.46" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
}

function iconMoon() {
  return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M19 14.5A7.5 7.5 0 1 1 9.5 5a6 6 0 1 0 9.5 9.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
}

function iconLeft() {
  return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14.75 5.75 8.5 12l6.25 6.25" stroke="currentColor" stroke-width="2.35" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function iconRight() {
  return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m9.25 5.75 6.25 6.25-6.25 6.25" stroke="currentColor" stroke-width="2.35" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function iconClose() {
  return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`;
}

function iconTrash() {
  return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 9.5v6M15 9.5v6M5.5 7.5h13M10 4.75h4l.75 1.5h3v1.25l-.7 9.2a2 2 0 0 1-2 1.85H8.95a2 2 0 0 1-2-1.85l-.7-9.2V6.25h3Z" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function iconCheck() {
  return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6.8 12.6 3.2 3.2 7.3-7.5" stroke="currentColor" stroke-width="2.55" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function themeSwitch(prefix) {
  return `<div class="themeSwitch"><button id="${prefix}ThemeLight" class="themeBtn" type="button" data-theme-value="light" aria-label="Use light mode">${iconSun()}</button><button id="${prefix}ThemeDark" class="themeBtn" type="button" data-theme-value="dark" aria-label="Use dark mode">${iconMoon()}</button></div>`;
}

const baseStyles = `
  :root{color-scheme:light dark;--bg:#f6f2e9;--bg2:#fcfaf5;--panel:rgba(255,255,255,.9);--panelSoft:#fffdf8;--panelAlt:#f3ede2;--ink:#171513;--muted:#6d655c;--line:rgba(23,21,19,.09);--lineStrong:rgba(23,21,19,.16);--accent:#171513;--blue:#8dd4ff;--green:#a5e6bc;--pink:#f2bbd9;--yellow:#ffd84d;--peach:#ffc9a1;--shadow:0 28px 70px rgba(33,27,20,.12);--shadowSoft:0 14px 34px rgba(33,27,20,.08);--grid:linear-gradient(rgba(37,31,24,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(37,31,24,.05) 1px,transparent 1px)}
  @media (prefers-color-scheme:dark){:root{--bg:#111;--bg2:#171716;--panel:rgba(26,26,24,.92);--panelSoft:#1f1f1d;--panelAlt:#262522;--ink:#f8f4ec;--muted:#c0b7ab;--line:rgba(255,255,255,.08);--lineStrong:rgba(255,255,255,.14);--accent:#f8f4ec;--shadow:0 36px 84px rgba(0,0,0,.42);--shadowSoft:0 18px 44px rgba(0,0,0,.28);--grid:linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px)}}
  body.theme-light{--bg:#f6f2e9;--bg2:#fcfaf5;--panel:rgba(255,255,255,.9);--panelSoft:#fffdf8;--panelAlt:#f3ede2;--ink:#171513;--muted:#6d655c;--line:rgba(23,21,19,.09);--lineStrong:rgba(23,21,19,.16);--accent:#171513;--blue:#8dd4ff;--green:#a5e6bc;--pink:#f2bbd9;--yellow:#ffd84d;--peach:#ffc9a1;--shadow:0 28px 70px rgba(33,27,20,.12);--shadowSoft:0 14px 34px rgba(33,27,20,.08);--grid:linear-gradient(rgba(37,31,24,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(37,31,24,.05) 1px,transparent 1px)}
  body.theme-dark{--bg:#111;--bg2:#171716;--panel:rgba(26,26,24,.92);--panelSoft:#1f1f1d;--panelAlt:#262522;--ink:#f8f4ec;--muted:#c0b7ab;--line:rgba(255,255,255,.08);--lineStrong:rgba(255,255,255,.14);--accent:#f8f4ec;--shadow:0 36px 84px rgba(0,0,0,.42);--shadowSoft:0 18px 44px rgba(0,0,0,.28);--grid:linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px)}
  *{box-sizing:border-box}html,body{margin:0;min-height:100%}body{font-family:"SF Pro Display","SF Pro Text","Segoe UI","PingFang SC",sans-serif;color:var(--ink);background:radial-gradient(circle at top left,rgba(141,212,255,.26),transparent 30%),radial-gradient(circle at 78% 18%,rgba(255,216,77,.16),transparent 24%),linear-gradient(180deg,var(--bg2),var(--bg));letter-spacing:-.015em}body.theme-light{background:radial-gradient(circle at top left,rgba(141,212,255,.26),transparent 30%),radial-gradient(circle at 78% 18%,rgba(255,216,77,.16),transparent 24%),linear-gradient(180deg,var(--bg2),var(--bg))}body.theme-dark{background:radial-gradient(circle at top left,rgba(141,212,255,.16),transparent 30%),radial-gradient(circle at 78% 18%,rgba(255,216,77,.1),transparent 24%),linear-gradient(180deg,var(--bg2),var(--bg))}
  button,input{font:inherit}button{appearance:none}a{color:inherit;text-decoration:none}img{display:block}.hidden{display:none!important}
  .shell{width:min(1380px,calc(100vw - 24px));margin:0 auto;padding:14px 0 40px}.topbar{position:sticky;top:12px;z-index:30;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 16px;border-radius:999px;background:color-mix(in srgb,var(--panel) 94%,transparent);border:1px solid var(--line);box-shadow:var(--shadowSoft);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px)}.brand{display:flex;align-items:center;gap:12px;min-width:0}.brandMark{width:48px;height:48px;border-radius:18px;background:linear-gradient(135deg,color-mix(in srgb,var(--blue) 70%,#fff),color-mix(in srgb,var(--green) 70%,#fff) 52%,color-mix(in srgb,var(--pink) 70%,#fff));box-shadow:inset 0 1px 0 rgba(255,255,255,.72),0 12px 28px rgba(33,27,20,.12);position:relative;overflow:hidden}.brandMark:before{content:"";position:absolute;left:10px;top:12px;width:24px;height:20px;border-radius:7px;background:rgba(255,253,248,.86);border:2px solid rgba(23,21,19,.74);transform:rotate(-9deg);box-shadow:7px 5px 0 rgba(255,216,77,.58)}.brandMark:after{content:"";position:absolute;right:9px;bottom:9px;width:17px;height:17px;border-radius:999px;background:var(--accent);box-shadow:0 0 0 5px rgba(255,253,248,.54),inset 0 0 0 5px color-mix(in srgb,var(--blue) 55%,#fff)}body.theme-dark .brandMark:before{background:rgba(248,244,236,.9);border-color:rgba(17,17,17,.82)}body.theme-dark .brandMark:after{background:#171513}.eyebrow{margin:0;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--muted);font-weight:700}.brandTitle{margin:0;font-size:22px;line-height:1;letter-spacing:-.05em}.brandSub,.meta,.photoSub{margin:0;color:var(--muted);line-height:1.55}.brandSub{font-size:13px}.photoSub{font-size:12px}.sectionTitle{margin:0;font-size:clamp(32px,4vw,52px);line-height:.95;letter-spacing:-.06em}.panel{border-radius:36px;border:1px solid var(--line);background:var(--panel);box-shadow:var(--shadow);overflow:hidden}
  .row,.toolbar,.topActions,.statsRow,.resultsSummary{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.stack{display:grid;gap:12px}
  .chip,.pill,.navLink{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:11px 18px;border-radius:999px;border:1px solid transparent;background:var(--panelSoft);color:var(--ink);cursor:pointer;transition:transform .18s ease,background .18s ease,border-color .18s ease;font-weight:650;box-shadow:var(--shadowSoft)}.chip:hover,.pill:hover,.navLink:hover{transform:translateY(-1px)}.chip.dark,.pill.dark,.navLink.active{background:var(--accent);color:#fffaf2}.chip.yellow,.pill.yellow{background:var(--yellow);color:#171513}.chip.soft,.pill.soft,.navLink{background:color-mix(in srgb,var(--panel) 88%,transparent);border-color:var(--line);color:var(--muted)}.chip.small{min-height:38px;padding:9px 14px;font-size:13px}.chip.danger{background:color-mix(in srgb,#ff6d5c 14%,var(--panel));color:#c53a24;border-color:color-mix(in srgb,#ff6d5c 24%,var(--line))}body.theme-dark .chip.dark,body.theme-dark .pill.dark,body.theme-dark .navLink.active{background:#f8f4ec;color:#111}
  .badge{display:inline-flex;align-items:center;justify-content:center;min-height:30px;padding:6px 11px;border-radius:999px;font-size:12px;font-weight:700;background:var(--panelAlt);border:1px solid var(--line);color:var(--muted)}.badge.open{background:color-mix(in srgb,var(--green) 34%,var(--panelAlt));color:#1f7044}.badge.closed{background:color-mix(in srgb,#ff9e8d 26%,var(--panelAlt));color:#a73f29}body.theme-dark .badge.open{color:#b0f4ca}body.theme-dark .badge.closed{color:#ffb6aa}
  .themeSwitch{display:inline-grid;grid-template-columns:1fr 1fr;gap:6px;padding:6px;border-radius:999px;background:color-mix(in srgb,var(--panel) 92%,transparent);border:1px solid var(--line);box-shadow:var(--shadowSoft)}.themeBtn{width:42px;height:42px;border:0;border-radius:999px;background:transparent;color:var(--muted);display:grid;place-items:center;cursor:pointer}.themeBtn svg{width:18px;height:18px}.themeBtn.active{background:var(--accent);color:#fffaf2}body.theme-dark .themeBtn.active{background:#f8f4ec;color:#111}
  .field{width:100%;min-height:48px;padding:12px 16px;border-radius:18px;border:1px solid var(--line);background:var(--panelSoft);color:var(--ink);outline:none}.field:focus{border-color:color-mix(in srgb,var(--blue) 50%,var(--line));box-shadow:0 0 0 4px color-mix(in srgb,var(--blue) 20%,transparent)}.notice{display:none;padding:14px 18px;border-radius:22px;background:color-mix(in srgb,#ff9e8d 16%,var(--panel));border:1px solid color-mix(in srgb,#ff9e8d 26%,var(--line))}
  .menu{position:absolute;right:0;top:calc(100% + 12px);width:min(340px,calc(100vw - 30px));padding:14px;border-radius:28px;background:color-mix(in srgb,var(--panel) 96%,transparent);border:1px solid var(--line);box-shadow:var(--shadow)}.menuHead{padding:4px 4px 12px;margin-bottom:12px;border-bottom:1px solid var(--line)}.userWrap{position:relative}
  .gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:14px}.photoCard{position:relative;border-radius:28px;overflow:hidden;border:1px solid var(--line);background:var(--panelSoft);box-shadow:var(--shadowSoft)}.thumbButton{width:100%;padding:0;border:0;background:none;color:inherit;cursor:pointer;text-align:left}.thumbFrame{aspect-ratio:1/1;background:linear-gradient(180deg,rgba(0,0,0,.04),transparent),var(--panelAlt);overflow:hidden}.thumbFrame img{width:100%;height:100%;object-fit:cover;transition:transform .28s ease}.photoCard:hover .thumbFrame img{transform:scale(1.03)}.photoMeta{display:grid;gap:4px;padding:12px 14px 14px}.photoName{font-size:15px;font-weight:700;line-height:1.38;word-break:break-word}
  .selectBtn,.deleteBtn{position:absolute;top:12px;width:40px;height:40px;border-radius:999px;border:1px solid rgba(255,255,255,.38);background:rgba(255,255,255,.76);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);box-shadow:0 12px 24px rgba(0,0,0,.15);display:grid;place-items:center;cursor:pointer;color:rgba(17,17,17,.82)}.selectBtn{right:12px}.deleteBtn{left:12px;color:#c53a24}.selectBtn svg,.deleteBtn svg{width:20px;height:20px}.selectBtn.active{background:var(--accent);color:#fffaf2}body.theme-dark .selectBtn,body.theme-dark .deleteBtn{background:rgba(30,30,30,.82);border-color:rgba(255,255,255,.12);color:#f8f4ec}body.theme-dark .selectBtn.active{background:#f8f4ec;color:#111}
  .emptyState{padding:28px;border-radius:28px;border:1px dashed var(--lineStrong);text-align:center;color:var(--muted);background:color-mix(in srgb,var(--panelSoft) 82%,transparent)}
  .uploadStatus{position:fixed;right:18px;bottom:18px;z-index:80;width:min(390px,calc(100vw - 24px));padding:16px;border-radius:28px;border:1px solid var(--line);background:color-mix(in srgb,var(--panel) 96%,transparent);box-shadow:var(--shadow)}.progressRail{margin-top:12px;height:10px;border-radius:999px;background:var(--panelAlt);overflow:hidden;border:1px solid var(--line)}.progressFill{height:100%;width:0%;border-radius:inherit;background:linear-gradient(90deg,var(--blue),var(--green));transition:width .18s ease}
  .modal{position:fixed;inset:0;z-index:90;display:none;align-items:center;justify-content:center;padding:20px;background:rgba(10,10,10,.76);backdrop-filter:blur(12px)}.modal.show{display:flex}.modalViewport{position:relative;width:min(92vw,1280px);display:flex;align-items:center;justify-content:center}.modalViewport img{max-width:100%;max-height:88vh;border-radius:32px;box-shadow:0 24px 80px rgba(0,0,0,.42)}.modalBtn,.closeBtn{position:absolute;border:0;background:rgba(255,255,255,.16);color:#fff;cursor:pointer;display:grid;place-items:center;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);box-shadow:0 14px 34px rgba(0,0,0,.24)}.modalBtn{top:50%;width:72px;height:72px;border-radius:999px;transform:translateY(-50%)}.modalBtn svg{width:30px;height:30px}.modalPrev{left:max(12px,1vw)}.modalNext{right:max(12px,1vw)}.closeBtn{top:12px;right:12px;width:54px;height:54px;border-radius:999px}.closeBtn svg{width:22px;height:22px}
  @media (max-width:980px){.topbar{align-items:flex-start;flex-direction:column;border-radius:30px}.topActions{width:100%;justify-content:space-between}}@media (max-width:720px){.shell{width:100%;padding:10px 10px 30px}.panel{border-radius:30px}.gallery{grid-template-columns:repeat(2,minmax(0,1fr))}.chip,.pill{width:100%}.topActions .pill,.topActions .chip,.topActions .navLink{width:auto}.modalBtn{width:58px;height:58px}.modalBtn svg{width:24px;height:24px}}@media (max-width:440px){.gallery{grid-template-columns:1fr}.brandMark{width:42px;height:42px;border-radius:16px}}
`;

function renderLandingPageLegacy() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>PhotoFinder</title><style>${baseStyles}.landing{display:grid;gap:20px}.hero{position:relative;display:grid;grid-template-columns:minmax(0,1.04fr) minmax(320px,.96fr);gap:20px;padding:26px;border-radius:42px;background:radial-gradient(circle at top left,rgba(255,216,77,.22),transparent 26%),linear-gradient(180deg,rgba(255,255,255,.18),transparent 36%),var(--panel);border:1px solid var(--line);box-shadow:var(--shadow);overflow:hidden}.hero:before{content:"";position:absolute;inset:0;background-image:var(--grid);background-size:28px 28px;opacity:.58;pointer-events:none}.heroCol,.phoneStack{position:relative;z-index:1}.heroCol{display:flex;flex-direction:column;justify-content:space-between;gap:22px;padding:8px 4px 4px}.heroTitle{margin:0;font-size:clamp(54px,8vw,102px);line-height:.88;letter-spacing:-.08em;max-width:8ch}.heroText{max-width:58ch;margin:0;color:var(--muted);font-size:17px;line-height:1.7}.heroPills,.heroActions,.rail{display:flex;gap:12px;flex-wrap:wrap}.heroPill{display:inline-flex;align-items:center;padding:9px 13px;border-radius:999px;border:1px solid var(--line);background:color-mix(in srgb,var(--panel) 88%,transparent);color:var(--muted);font-size:13px;font-weight:600;box-shadow:var(--shadowSoft)}.phoneStack{display:grid;gap:14px}.phonePair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.phoneCard,.featureCard,.storyCard{border:1px solid var(--line);box-shadow:var(--shadowSoft)}.phoneCard{min-height:310px;padding:18px;border-radius:34px;background:radial-gradient(circle at top left,rgba(255,255,255,.58),transparent 34%),var(--panelSoft)}.phoneCard.dark{background:#161616;color:#fffaf2}.phoneTop{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:18px}.phoneBubble{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:10px 16px;border-radius:999px;background:rgba(23,21,19,.9);color:#fff8ef;font-weight:650}.phoneCard.dark .phoneBubble{background:var(--yellow);color:#171513}.phoneHeadline{margin:0 0 16px;font-size:clamp(28px,3vw,40px);line-height:1.03;letter-spacing:-.06em}.stampGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.stamp{aspect-ratio:1/1;border-radius:24px;border:1px dashed rgba(23,21,19,.24);background:rgba(255,255,255,.72);display:grid;place-items:center;color:#3a342e;font-size:13px;text-align:center;padding:10px}body.theme-dark .stamp{border-color:rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#f8f4ec}.featureGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.featureCard{padding:16px;border-radius:26px;background:color-mix(in srgb,var(--panel) 90%,transparent)}.featureCard strong{display:block;margin-bottom:6px;font-size:16px;letter-spacing:-.03em}.showcase{padding:22px}.scrollRail{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(260px,320px);gap:14px;overflow-x:auto;scroll-snap-type:x proximity;padding-bottom:6px}.scrollCard{scroll-snap-align:start;padding:22px;border-radius:30px;border:1px solid var(--line);background:var(--panel);box-shadow:var(--shadowSoft)}.sky{background:color-mix(in srgb,var(--blue) 34%,var(--panel))}.green{background:color-mix(in srgb,var(--green) 34%,var(--panel))}.pink{background:color-mix(in srgb,var(--pink) 30%,var(--panel))}.yellow{background:color-mix(in srgb,var(--yellow) 30%,var(--panel))}.storyGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.storyCard{padding:22px;border-radius:34px;background:var(--panel)}.storyVisual{height:220px;margin-top:18px;border-radius:28px;background:radial-gradient(circle at top left,rgba(255,255,255,.5),transparent 30%),linear-gradient(135deg,var(--blue),var(--pink),var(--yellow));position:relative;overflow:hidden}.storyVisual.dark{background:radial-gradient(circle at top left,rgba(255,255,255,.1),transparent 30%),linear-gradient(135deg,#171513,#2c2a28)}.storyVisual:after{content:"";position:absolute;inset:18px;border-radius:24px;border:1px solid rgba(255,255,255,.32);background:rgba(255,255,255,.18)}.storyVisual span{position:absolute;left:32px;right:32px;bottom:30px;z-index:1;font-size:22px;font-weight:700;letter-spacing:-.04em}.info{display:grid;grid-template-columns:1.2fr .8fr;gap:18px}.infoCard{padding:24px;border-radius:34px;border:1px solid var(--line);background:var(--panel);box-shadow:var(--shadowSoft)}.metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:16px}.metric{padding:16px;border-radius:24px;background:var(--panelSoft);border:1px solid var(--line)}.metric strong{display:block;font-size:28px;line-height:1;letter-spacing:-.06em;margin-bottom:6px}.landingNotice{display:none;padding:14px 18px;border-radius:22px;background:color-mix(in srgb,#ff9e8d 16%,var(--panel));border:1px solid color-mix(in srgb,#ff9e8d 26%,var(--line))}@media (max-width:1080px){.hero,.info,.storyGrid{grid-template-columns:1fr}}@media (max-width:720px){.hero{padding:20px;border-radius:34px}.phonePair,.featureGrid,.metrics{grid-template-columns:1fr}.heroActions{flex-direction:column}.scrollRail{grid-auto-columns:minmax(240px,82vw)}}</style></head><body><div class="shell landing"><header class="topbar"><div class="brand"><div class="brandMark"></div><div><p class="eyebrow">PhotoFinder</p><h1 class="brandTitle">Face-first photo distribution</h1><p class="brandSub">Queue-based ingestion, fast search, cleaner delivery.</p></div></div><div class="topActions">${themeSwitch("landing")}<a class="pill soft" href="/user">User Space</a><button id="landingAdminButton" class="pill dark" type="button">Login As Admin</button></div></header><section class="hero"><div class="heroCol"><div class="stack" style="gap:16px"><p class="eyebrow">Async, Curated, Downloadable</p><h2 class="heroTitle">Find your event photos in minutes.</h2><p class="heroText">PhotoFinder turns event uploads into searchable collections. Admins publish by class, visitors scan with one selfie, and bound users keep a reusable download history without losing the original files.</p><div class="heroPills"><span class="heroPill">Cloudflare Workers + Queues</span><span class="heroPill">Alibaba Face Vector Search</span><span class="heroPill">Class-level visibility control</span></div></div><div class="stack" style="gap:14px"><div class="heroActions"><button id="landingGuestButton" class="pill yellow" type="button">Find My Photos</button><button id="landingBoundButton" class="pill soft" type="button">Bind With Aryuki Auth Center</button></div><div id="landingNotice" class="landingNotice"></div></div></div><div class="phoneStack"><div class="phonePair"><article class="phoneCard"><div class="phoneTop"><div class="phoneBubble">Admin studio</div><span class="badge">Desktop</span></div><h3 class="phoneHeadline">Organize classes, open groups, upload in batches.</h3><div class="stampGrid"><div class="stamp">Class cards with thumbnails</div><div class="stamp">Upload progress with queue steps</div><div class="stamp">Open or close search visibility</div><div class="stamp">Delete photos or whole classes</div></div></article><article class="phoneCard dark"><div class="phoneTop"><div class="phoneBubble">User flow</div><span class="badge">Mobile</span></div><h3 class="phoneHeadline">Upload a selfie, watch the scan, reveal the gallery.</h3><div class="stampGrid"><div class="stamp">Camera or image upload</div><div class="stamp">Rounded selection controls</div><div class="stamp">History for bound accounts</div><div class="stamp">Original preview + ZIP</div></div></article></div><div class="featureGrid"><div class="featureCard"><strong>Top bar aligned with the content</strong><p class="meta">One visual language across landing, admin, and user spaces, with the theme switch always in the header.</p></div><div class="featureCard"><strong>Motion in both directions</strong><p class="meta">Vertical story sections plus horizontal feature cards to echo the references you sent.</p></div></div></div></section><section class="panel showcase"><div class="stack" style="gap:14px"><div><p class="eyebrow">Horizontal Showcase</p><h2 class="sectionTitle" style="font-size:40px">Swipe through the product story.</h2></div><div class="scrollRail"><article class="scrollCard sky"><span class="badge">01</span><h3 style="margin:10px 0 8px;font-size:24px;letter-spacing:-.05em">Admin uploads go straight into R2.</h3><p class="meta">Each image becomes a queued ingest task, keeping the UI quick even for large batches.</p></article><article class="scrollCard green"><span class="badge">02</span><h3 style="margin:10px 0 8px;font-size:24px;letter-spacing:-.05em">Vectors land in the face index.</h3><p class="meta">Ingestion produces searchable face data while D1 keeps the metadata and file truth.</p></article><article class="scrollCard pink"><span class="badge">03</span><h3 style="margin:10px 0 8px;font-size:24px;letter-spacing:-.05em">User search stays simple.</h3><p class="meta">One selfie, one queue task, one polling loop, then a grouped gallery that is ready to select or download.</p></article><article class="scrollCard yellow"><span class="badge">04</span><h3 style="margin:10px 0 8px;font-size:24px;letter-spacing:-.05em">History becomes reusable.</h3><p class="meta">Bound accounts reopen old searches, inspect thumbnails, and re-download results without repeating the scan.</p></article></div></div></section><section class="storyGrid"><article class="storyCard"><p class="eyebrow">Admin Experience</p><h3 style="margin:0;font-size:28px;letter-spacing:-.05em">Manage classes like a visual workspace.</h3><p class="meta" style="margin-top:8px">Short IDs stay in the data model, while custom names and thumbnail-led cards keep the UI understandable on desktop and phone.</p><div class="storyVisual"><span>Open the right group, upload, and publish.</span></div></article><article class="storyCard"><p class="eyebrow">Search Experience</p><h3 style="margin:0;font-size:28px;letter-spacing:-.05em">Make scanning feel guided, not technical.</h3><p class="meta" style="margin-top:8px">Rounded scan frames, pulse and line animations, and grouped results make the face-search journey feel clear from start to finish.</p><div class="storyVisual dark"><span>Queue in, scan, reveal, download.</span></div></article><article class="storyCard"><p class="eyebrow">Download Experience</p><h3 style="margin:0;font-size:28px;letter-spacing:-.05em">Select a few or take everything.</h3><p class="meta" style="margin-top:8px">Original files remain accessible while thumbnails keep the grid light. Users can direct-download or package a ZIP on the client.</p><div class="storyVisual"><span>Original preview, direct save, ZIP export.</span></div></article></section><section class="info"><article class="infoCard"><p class="eyebrow">How It Fits</p><h3 style="margin:0;font-size:34px;letter-spacing:-.05em">One landing page, two real workspaces.</h3><p class="meta" style="margin-top:8px">The root path now acts as an introduction layer. Admin tasks live at <strong>/admin</strong>, and photo-search flows live at <strong>/user</strong>, so the navigation map is clearer and easier to reason about.</p><div class="metrics"><div class="metric"><strong>/</strong><span class="meta">Story-driven entry with two calls to action</span></div><div class="metric"><strong>/admin</strong><span class="meta">Class manager, upload queue, gallery control</span></div><div class="metric"><strong>/user</strong><span class="meta">Selfie scan, history, results, download</span></div></div></article><article class="infoCard"><p class="eyebrow">Theme</p><h3 style="margin:0;font-size:34px;letter-spacing:-.05em">Keep light and dark mode close at hand.</h3><p class="meta" style="margin-top:8px">The theme switch remains in the top bar on every page, so users never need to hunt through settings just to change the viewing mode.</p></article></section></div><script>const $=function(id){return document.getElementById(id)};function api(url,options){return fetch(url,options||{}).then(async function(response){const payload=await response.json().catch(function(){return{}});if(!response.ok)throw new Error(payload.error||'Request failed');return payload})}function applyTheme(theme,persist){const next=theme==='dark'?'dark':'light';document.body.classList.remove('theme-light','theme-dark');document.body.classList.add('theme-'+next);document.documentElement.setAttribute('data-theme',next);if(persist!==false){try{localStorage.setItem('pd-theme',next)}catch(error){}}document.querySelectorAll('[data-theme-value]').forEach(function(button){button.classList.toggle('active',button.getAttribute('data-theme-value')===next)})}function detectTheme(){try{const saved=localStorage.getItem('pd-theme');if(saved==='light'||saved==='dark')return saved}catch(error){}return window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}function showLandingNotice(message){const node=$('landingNotice');node.textContent=message||'';node.style.display=message?'block':'none'}async function goAdmin(){showLandingNotice('');const button=$('landingAdminButton');const original=button.textContent;try{button.disabled=true;button.textContent='Opening...';const me=await api('/api/me').catch(function(){return{authenticated:false}});if(me&&me.authenticated&&me.user&&me.user.role==='admin'){location.href='/admin';return}const login=await api('/api/auth/login-url?mode=admin&next=%2Fadmin');location.href=login.url}catch(error){showLandingNotice(error.message||'Admin login is unavailable right now.');button.disabled=false;button.textContent=original}}async function goGuest(){showLandingNotice('');const button=$('landingGuestButton');const original=button.textContent;try{button.disabled=true;button.textContent='Entering...';const me=await api('/api/me').catch(function(){return{authenticated:false}});if(me&&me.authenticated){location.href='/user';return}await api('/api/auth/temp',{method:'POST'});location.href='/user'}catch(error){showLandingNotice(error.message||'Guest entry failed.');button.disabled=false;button.textContent=original}}async function bindOrOpenUser(){showLandingNotice('');const button=$('landingBoundButton');const original=button.textContent;try{button.disabled=true;button.textContent='Opening...';const me=await api('/api/me').catch(function(){return{authenticated:false}});if(me&&me.authenticated&&me.user&&me.user.authUuid){location.href='/user';return}const login=await api('/api/auth/login-url?mode=bind&next=%2Fuser');location.href=login.url}catch(error){showLandingNotice(error.message||'Aryuki Auth Center is unavailable right now.');button.disabled=false;button.textContent=original}}document.querySelectorAll('[data-theme-value]').forEach(function(button){button.addEventListener('click',function(){applyTheme(button.getAttribute('data-theme-value'))})});$('landingAdminButton').addEventListener('click',goAdmin);$('landingGuestButton').addEventListener('click',goGuest);$('landingBoundButton').addEventListener('click',bindOrOpenUser);applyTheme(detectTheme(),false);</script></body></html>`;
}

export function renderLandingPage() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>PhotoFinder</title><style>${baseStyles}
  .landingShell{min-height:100dvh;display:grid;grid-template-rows:auto 1fr;gap:18px}.landingTop{animation:dropIn .54s cubic-bezier(.2,.8,.2,1) both}.landingHero{position:relative;min-height:calc(100dvh - 116px);display:grid;grid-template-columns:minmax(0,1.02fr) minmax(330px,.98fr);gap:20px;align-items:stretch;padding:24px;border-radius:44px;border:1px solid var(--line);background:linear-gradient(135deg,color-mix(in srgb,var(--panel) 94%,transparent),color-mix(in srgb,var(--panelSoft) 84%,transparent)),radial-gradient(circle at 20% 12%,color-mix(in srgb,var(--blue) 38%,transparent),transparent 30%),radial-gradient(circle at 82% 18%,color-mix(in srgb,var(--yellow) 34%,transparent),transparent 24%);box-shadow:var(--shadow);overflow:hidden}.landingHero:before{content:"";position:absolute;inset:0;background-image:var(--grid);background-size:30px 30px;opacity:.52;pointer-events:none}.landingCopy,.entryDeck{position:relative;z-index:1}.landingCopy{display:flex;flex-direction:column;justify-content:space-between;gap:28px;padding:18px 8px}.heroTitle{margin:0;max-width:10ch;font-size:clamp(54px,8vw,104px);line-height:.88;letter-spacing:-.08em}.heroText{max-width:58ch;margin:18px 0 0;color:var(--muted);font-size:17px;line-height:1.72}.heroStats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.heroStat{padding:16px;border-radius:26px;border:1px solid var(--line);background:color-mix(in srgb,var(--panel) 86%,transparent);box-shadow:var(--shadowSoft);animation:riseIn .62s cubic-bezier(.2,.8,.2,1) both}.heroStat:nth-child(2){animation-delay:.06s}.heroStat:nth-child(3){animation-delay:.12s}.heroStat strong{display:block;margin-bottom:6px;font-size:28px;line-height:1;letter-spacing:-.06em}.entryDeck{display:grid;gap:14px;align-content:center}.entryCard{position:relative;display:grid;gap:14px;min-height:178px;padding:22px;border:1px solid var(--line);border-radius:34px;background:color-mix(in srgb,var(--panel) 90%,transparent);box-shadow:var(--shadowSoft);overflow:hidden;animation:slideIn .64s cubic-bezier(.2,.8,.2,1) both;transition:transform .22s ease,border-color .22s ease,box-shadow .22s ease}.entryCard:nth-child(2){animation-delay:.08s}.entryCard:nth-child(3){animation-delay:.16s}.entryCard:hover{transform:translateY(-4px);box-shadow:0 24px 54px rgba(33,27,20,.14)}body.theme-dark .entryCard:hover{box-shadow:0 24px 54px rgba(0,0,0,.38)}.entryCard:after{content:"";position:absolute;right:-38px;top:-52px;width:160px;height:160px;border-radius:48px;transform:rotate(18deg);background:color-mix(in srgb,var(--blue) 28%,transparent)}.entryCard.user:after{background:color-mix(in srgb,var(--green) 32%,transparent)}.entryCard.admin:after{background:color-mix(in srgb,var(--pink) 34%,transparent)}.entryCard h2{position:relative;z-index:1;margin:0;font-size:31px;letter-spacing:-.055em}.entryCard p{position:relative;z-index:1;max-width:46ch;margin:0;color:var(--muted);line-height:1.62}.entryActions{position:relative;z-index:1;display:flex;gap:10px;flex-wrap:wrap}.entryActions .pill{box-shadow:none}.landingNotice{display:none;position:relative;z-index:1;padding:14px 18px;border-radius:24px;background:color-mix(in srgb,#ff9e8d 16%,var(--panel));border:1px solid color-mix(in srgb,#ff9e8d 26%,var(--line))}@keyframes dropIn{from{opacity:0;transform:translateY(-14px) scale(.985)}to{opacity:1;transform:none}}@keyframes riseIn{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}@keyframes slideIn{from{opacity:0;transform:translateX(22px) scale(.98)}to{opacity:1;transform:none}}@media (prefers-reduced-motion:reduce){*,*:before,*:after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important}}@media (max-width:1040px){.landingHero{grid-template-columns:1fr;min-height:auto}.landingCopy{padding:8px 4px}.heroTitle{max-width:12ch}.entryDeck{align-content:start}.heroStats{grid-template-columns:1fr 1fr 1fr}}@media (max-width:720px){.landingShell{gap:12px}.landingHero{padding:18px;border-radius:34px}.topbar{border-radius:30px}.heroStats{grid-template-columns:1fr}.entryCard{min-height:auto;border-radius:30px}.entryActions{flex-direction:column}.entryActions .pill{width:100%}.heroTitle{font-size:clamp(48px,15vw,72px)}} </style></head><body><div class="shell landingShell"><header class="topbar landingTop"><div class="brand"><div class="brandMark"></div><div><p class="eyebrow">PhotoFinder</p><h1 class="brandTitle">Picture Distributor</h1><p class="brandSub">Find, manage, and deliver event photos.</p></div></div><div class="topActions">${themeSwitch("landing")}<button id="landingAdminButton" class="pill dark" type="button">Login As Admin</button></div></header><main class="landingHero"><section class="landingCopy"><div><p class="eyebrow">Face Search For Event Galleries</p><h2 class="heroTitle">Your photos, found fast.</h2><p class="heroText">Enter as a guest for an instant scan, sign in as a user to keep history, or open the admin panel to publish class-based galleries. Rounded surfaces, floating navigation, and a focused workflow keep the whole app calm and quick.</p></div><div class="heroStats"><div class="heroStat"><strong>Guest</strong><span class="meta">Start searching without setup.</span></div><div class="heroStat"><strong>User</strong><span class="meta">Bind account and keep results.</span></div><div class="heroStat"><strong>Admin</strong><span class="meta">Upload, publish, and maintain classes.</span></div></div></section><section class="entryDeck" aria-label="Choose how to enter"><article class="entryCard guest"><p class="eyebrow">Quick Entry</p><h2>Continue as guest</h2><p>Create a temporary visitor profile and jump straight to the photo search page.</p><div class="entryActions"><button id="landingGuestButton" class="pill yellow" type="button">Guest</button></div></article><article class="entryCard user"><p class="eyebrow">Reusable Account</p><h2>Login as user</h2><p>Use Aryuki Auth Center, then open the same search workspace with saved history support.</p><div class="entryActions"><button id="landingUserButton" class="pill soft" type="button">Login As User</button></div></article><article class="entryCard admin"><p class="eyebrow">Management</p><h2>Login as admin</h2><p>Open the admin panel for class management, uploads, visibility, and archive cleanup.</p><div class="entryActions"><button id="landingAdminButtonCard" class="pill dark" type="button">Login As Admin</button></div></article><div id="landingNotice" class="landingNotice"></div></section></main></div><script>const $=function(id){return document.getElementById(id)};function api(url,options){return fetch(url,options||{}).then(async function(response){const payload=await response.json().catch(function(){return{}});if(!response.ok)throw new Error(payload.error||'Request failed');return payload})}function applyTheme(theme,persist){const next=theme==='dark'?'dark':'light';document.body.classList.remove('theme-light','theme-dark');document.body.classList.add('theme-'+next);document.documentElement.setAttribute('data-theme',next);if(persist!==false){try{localStorage.setItem('pd-theme',next)}catch(error){}}document.querySelectorAll('[data-theme-value]').forEach(function(button){button.classList.toggle('active',button.getAttribute('data-theme-value')===next)})}function detectTheme(){try{const saved=localStorage.getItem('pd-theme');if(saved==='light'||saved==='dark')return saved}catch(error){}return window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}function showLandingNotice(message){const node=$('landingNotice');node.textContent=message||'';node.style.display=message?'block':'none'}async function routeWithButton(button,work){showLandingNotice('');const original=button.textContent;try{button.disabled=true;button.textContent='Opening...';await work()}catch(error){showLandingNotice(error.message||'Unable to continue right now.');button.disabled=false;button.textContent=original}}async function goAdmin(button){routeWithButton(button,async function(){const me=await api('/api/me').catch(function(){return{authenticated:false}});if(me&&me.authenticated&&me.user&&me.user.role==='admin'){location.href='/admin';return}const login=await api('/api/auth/login-url?mode=admin&next=%2Fadmin');location.href=login.url})}async function goGuest(button){routeWithButton(button,async function(){const me=await api('/api/me').catch(function(){return{authenticated:false}});if(me&&me.authenticated){location.href='/user';return}await api('/api/auth/temp',{method:'POST'});location.href='/user'})}async function goUser(button){routeWithButton(button,async function(){const me=await api('/api/me').catch(function(){return{authenticated:false}});if(me&&me.authenticated&&me.user&&me.user.authUuid){location.href='/user';return}const login=await api('/api/auth/login-url?mode=bind&next=%2Fuser');location.href=login.url})}document.querySelectorAll('[data-theme-value]').forEach(function(button){button.addEventListener('click',function(){applyTheme(button.getAttribute('data-theme-value'))})});$('landingGuestButton').addEventListener('click',function(){goGuest(this)});$('landingUserButton').addEventListener('click',function(){goUser(this)});$('landingAdminButton').addEventListener('click',function(){goAdmin(this)});$('landingAdminButtonCard').addEventListener('click',function(){goAdmin(this)});applyTheme(detectTheme(),false);</script></body></html>`;
}

export function renderDashboardPage(mode) {
  const routeMode = JSON.stringify(mode);
  const extraHead = `<style>
    body.route-admin.theme-light,body.route-user.theme-light{--bg:#f6f2e9;--bg2:#fcfaf5;--sheet:rgba(255,255,255,.78);--sheetStrong:rgba(255,255,255,.92);--sheetSoft:rgba(255,255,255,.66);--panel:#fffdf8;--panelSoft:#f8f2e8;--panelMute:#eee4d6;--ink:#171513;--muted:#6d655c;--line:rgba(23,21,19,.09);--lineStrong:rgba(23,21,19,.16);--blue:#8dd4ff;--blue2:#62bdf5;--green:#a5e6bc;--red:#d95644;--accent:#171513;--shadow:0 26px 72px rgba(33,27,20,.13);--shadowSoft:0 13px 34px rgba(33,27,20,.08);background:radial-gradient(circle at top left,rgba(141,212,255,.26),transparent 30%),radial-gradient(circle at 78% 18%,rgba(255,216,77,.16),transparent 24%),linear-gradient(180deg,var(--bg2),var(--bg))}
    body.route-admin.theme-dark,body.route-user.theme-dark{--bg:#111;--bg2:#171716;--sheet:rgba(26,26,24,.8);--sheetStrong:rgba(31,31,29,.94);--sheetSoft:rgba(38,37,34,.66);--panel:#1f1f1d;--panelSoft:#262522;--panelMute:#34322d;--ink:#f8f4ec;--muted:#c0b7ab;--line:rgba(255,255,255,.08);--lineStrong:rgba(255,255,255,.14);--blue:#8dd4ff;--blue2:#62bdf5;--green:#a5e6bc;--red:#ff7667;--accent:#f8f4ec;--shadow:0 34px 86px rgba(0,0,0,.44);--shadowSoft:0 16px 42px rgba(0,0,0,.28);background:radial-gradient(circle at top left,rgba(141,212,255,.16),transparent 30%),radial-gradient(circle at 78% 18%,rgba(255,216,77,.1),transparent 24%),linear-gradient(180deg,var(--bg2),var(--bg))}
    body.route-admin .topbar,body.route-user .topbar{z-index:320;isolation:isolate;overflow:visible}
    body.route-admin .userWrap,body.route-user .userWrap{position:relative;z-index:321}
    body.route-admin .menu,body.route-user .menu{z-index:9999!important}
    body.route-admin .layout,body.route-user .layout{grid-template-columns:1fr!important}
    body.route-user #loginView{display:none!important}
    body.route-user.route-login-fallback #loginView{display:grid!important}
    body.route-user #adminPanel{display:none!important}
    body.route-admin .searchPanel,body.route-admin .resultsPanel{display:none!important}
    body.route-admin #adminPanel{padding:28px 30px 34px;min-height:calc(100vh - 142px)}
    body.route-admin #adminPanel .panelHeader{margin-bottom:16px}
    body.route-admin #adminPanel .panelHeader .meta,body.route-user .searchPanel .panelHeader .meta{max-width:64ch}
    body.route-admin #adminPanel .adminShell{grid-template-columns:minmax(320px,360px) minmax(0,1fr);gap:24px}
    body.route-admin #adminPanel .listPanel{position:sticky;top:104px;align-self:start;padding:20px;border-radius:30px}
    body.route-admin #adminPanel .detailPanel{padding:24px;border-radius:32px;min-height:680px}
    body.route-admin #adminPanel .detailEmpty{min-height:620px;border-radius:32px}
    body.route-admin #adminPanel .classList{gap:14px}
    body.route-admin #adminPanel .classCard{padding:18px;border-radius:26px}
    body.route-admin #adminPanel .detailHero{margin-bottom:22px}
    body.route-admin #adminPanel .gallery{grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:16px}
    body.route-user .searchPanel,body.route-user .resultsPanel{grid-column:1/-1;padding:22px;overflow:visible}
    body.route-user .searchPanel .panelHeader,body.route-user .resultsPanel .panelHeader{margin-bottom:14px}
    body.route-user .searchGrid{grid-template-columns:minmax(0,1.08fr) minmax(320px,.92fr);gap:16px}
    body.route-user .searchButtons{gap:12px}
    body.route-user .scanStage{padding:20px;border-radius:32px;background:linear-gradient(180deg,rgba(24,24,24,.92),rgba(14,14,14,.98));border:1px solid rgba(255,255,255,.08)}
    body.route-user .scanBox{border-radius:30px}
    body.route-user .resultsPanel .gallery{grid-template-columns:repeat(auto-fill,minmax(180px,1fr))}
    .internalTiles{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:0 0 18px}
    .internalTile{padding:16px;border-radius:24px;border:1px solid var(--line);box-shadow:var(--shadowSoft);background:var(--panel)}
    .internalTile h3{margin:0 0 6px;font-size:17px;letter-spacing:-.03em}
    .internalTile p{margin:0;color:var(--muted);font-size:13px;line-height:1.55}
    .tileSky{background:color-mix(in srgb,var(--blue) 28%,var(--panel))}
    .tileGreen{background:color-mix(in srgb,var(--green) 28%,var(--panel))}
    .tilePink{background:color-mix(in srgb,var(--pink) 26%,var(--panel))}
    .tileYellow{background:color-mix(in srgb,var(--yellow) 26%,var(--panel))}
    .userLead{display:grid;grid-template-columns:minmax(0,1fr) minmax(260px,.9fr);gap:18px;margin:0 0 22px}
    .userLeadCard{padding:22px;border-radius:30px;border:1px solid var(--line);box-shadow:var(--shadowSoft);background:var(--panel)}
    .userLeadCard h3{margin:0 0 8px;font-size:28px;letter-spacing:-.05em}
    .userLeadCard.dark{background:#171513;color:#fffaf2}
    .userLeadCard.dark p{color:rgba(255,248,239,.76)}
    body.theme-dark .userLeadCard.dark{background:#f8f4ec;color:#111}
    body.theme-dark .userLeadCard.dark p{color:rgba(17,17,17,.74)}
    .userLeadList{display:grid;gap:10px}
    .userLeadList div{padding:14px 16px;border-radius:22px;background:var(--panelSoft);border:1px solid var(--line)}
    .userLeadList strong{display:block;margin-bottom:4px;font-size:15px;letter-spacing:-.02em}
    @media (max-width:1140px){
      body.route-admin #adminPanel .adminShell{grid-template-columns:1fr}
      body.route-admin #adminPanel .listPanel{position:static}
      body.route-user .searchGrid, .userLead{grid-template-columns:1fr}
    }
    @media (max-width:720px){
      .internalTiles{grid-template-columns:repeat(2,minmax(0,1fr))}
      body.route-admin #adminPanel,body.route-user .searchPanel,body.route-user .resultsPanel{padding:18px}
      body.route-admin #adminPanel .detailPanel{min-height:auto}
      body.route-admin #adminPanel .detailEmpty{min-height:300px}
    }
    .topbar{position:sticky;top:14px;border-radius:999px!important;padding:12px 14px!important;background:color-mix(in srgb,var(--sheetStrong) 88%,transparent)!important;box-shadow:0 18px 52px rgba(18,20,29,.13)!important;animation:dropIn .5s cubic-bezier(.2,.8,.2,1) both}
    body.theme-dark .topbar{box-shadow:0 22px 58px rgba(0,0,0,.38)!important}
    .brandIcon{position:relative!important;overflow:hidden!important;border-radius:18px!important;background:linear-gradient(135deg,color-mix(in srgb,var(--blue) 70%,#fff),color-mix(in srgb,var(--green) 70%,#fff) 52%,color-mix(in srgb,var(--pink) 70%,#fff))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.72),0 12px 28px rgba(33,27,20,.12)!important}
    .brandIcon:before{content:"";position:absolute;left:10px;top:12px;width:24px;height:20px;border-radius:7px;background:rgba(255,253,248,.86);border:2px solid rgba(23,21,19,.74);transform:rotate(-9deg);box-shadow:7px 5px 0 rgba(255,216,77,.58)}
    .brandIcon:after{content:"";position:absolute;right:9px;bottom:9px;width:17px;height:17px;border-radius:999px;background:var(--accent);box-shadow:0 0 0 5px rgba(255,253,248,.54),inset 0 0 0 5px color-mix(in srgb,var(--blue) 55%,#fff)}
    body.theme-dark .brandIcon:before{background:rgba(248,244,236,.9);border-color:rgba(17,17,17,.82)}
    body.theme-dark .brandIcon:after{background:#171513}
    .topbar>.row{align-items:center}
    .avatarButton{min-height:48px!important;padding:4px 7px 4px 12px!important;border-radius:999px!important}
    .avatarLabel{max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .avatarBubble{width:38px;height:38px;border-radius:999px;display:grid;place-items:center;overflow:hidden;background:linear-gradient(135deg,var(--blue),var(--pink));color:#111;font-weight:800;border:1px solid rgba(255,255,255,.42);box-shadow:inset 0 1px 0 rgba(255,255,255,.5)}
    .avatarBubble img{width:100%;height:100%;object-fit:cover}
    .menu{right:0!important;top:calc(100% + 12px)!important}
    .menuHead{display:grid;grid-template-columns:48px 1fr;gap:12px;align-items:center}
    .menuAvatar{width:48px;height:48px;border-radius:18px;display:grid;place-items:center;overflow:hidden;background:linear-gradient(135deg,var(--blue),var(--green));font-weight:800;color:#111}
    .menuAvatar img{width:100%;height:100%;object-fit:cover}
    .panel,.listPanel,.detailPanel,.scanStage,.photoCard,.historyCard,.historyThumb,.classCard,.internalTile,.userLeadCard{animation:riseIn .52s cubic-bezier(.2,.8,.2,1) both}
    .layout{gap:14px!important}.panelHeader{margin-bottom:14px!important}.sectionTitle{font-size:clamp(28px,3vw,42px)!important}.panel{box-shadow:0 20px 58px rgba(18,20,29,.12)!important;background:linear-gradient(135deg,color-mix(in srgb,var(--panel) 96%,transparent),color-mix(in srgb,var(--panelSoft) 88%,transparent))!important}
    .listPanel,.detailPanel{background:color-mix(in srgb,var(--panelSoft) 82%,transparent)!important}
    .classCard,.photoCard,.historyCard{background:color-mix(in srgb,var(--panel) 88%,transparent)!important}
    body.route-admin #adminPanel{padding:24px!important;min-height:calc(100vh - 128px)!important}
    body.route-admin #adminPanel .adminShell{gap:18px!important}
    body.route-admin #adminPanel .detailPanel{min-height:500px!important}
    body.route-admin #adminPanel .detailEmpty{min-height:460px!important}
    body.route-user .searchPanel,body.route-user .resultsPanel{padding:20px!important}
    body.route-user .scanStage{background:linear-gradient(135deg,color-mix(in srgb,var(--blue) 16%,var(--panelSoft)),color-mix(in srgb,var(--yellow) 14%,var(--panelSoft)))!important;border-color:var(--line)!important}
    body.route-user .scanHints .hintTile{background:color-mix(in srgb,var(--panel) 18%,rgba(17,17,17,.52))!important;border-color:rgba(255,255,255,.12)!important}
    body.route-user .searchControls{gap:12px!important}
    body.route-user .historyPanel{margin-top:8px!important;padding-top:10px!important}
    body.route-user .resultsPanel{margin-top:0!important}
    body.route-user .userLead{display:none!important}
    body.route-user .scanHints{grid-template-columns:repeat(3,minmax(0,1fr))}
    .backTop{position:fixed;right:18px;bottom:18px;z-index:100;width:52px;height:52px;border:0;border-radius:999px;display:grid;place-items:center;background:var(--accent);color:#fffaf2;box-shadow:0 20px 46px rgba(18,20,29,.24);cursor:pointer;opacity:0;pointer-events:none;transform:translateY(18px) scale(.92);transition:opacity .2s ease,transform .2s ease}
    .backTop.show{opacity:1;pointer-events:auto;transform:none}.backTop svg{width:22px;height:22px}body.theme-dark .backTop{background:#f8f4ec;color:#111}
    @keyframes dropIn{from{opacity:0;transform:translateY(-14px) scale(.985)}to{opacity:1;transform:none}}@keyframes riseIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
    @media (prefers-reduced-motion:reduce){*,*:before,*:after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;scroll-behavior:auto!important}}
    @media (max-width:860px){.topbar{border-radius:30px!important}.avatarLabel{display:none}.topbar>.row{width:100%;justify-content:space-between}.brandSubtitle{display:none}}
    @media (max-width:720px){.internalTiles{grid-template-columns:repeat(2,minmax(0,1fr))}.userLead{gap:12px!important}body.route-admin #adminPanel,body.route-user .searchPanel,body.route-user .resultsPanel{padding:16px!important}.sectionTitle{font-size:30px!important}.scanHints{grid-template-columns:1fr!important}.backTop{right:14px;bottom:14px;width:48px;height:48px}}
    @media (max-width:480px){.internalTiles{grid-template-columns:1fr}.topbar>.row{gap:8px}.topSummary{display:none}}
  </style>`;
  const injectedScript = `<script>
    (function(){
      var MODE=${routeMode};
      document.body.classList.add(MODE==='admin'?'route-admin':'route-user');
      function ready(fn){if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',fn)}else{fn()}}
      ready(function(){
        try{
          var title=document.querySelector('.brandTitle');
          var sub=document.querySelector('.brandSubtitle');
          if(title&&sub){
            title.textContent=MODE==='admin'?'Admin Workspace':'Photo Search';
            sub.textContent=MODE==='admin'?'Class management, upload queues, and searchable publishing':'Selfie scan, grouped results, history, and downloads';
          }
          var topSummary=document.getElementById('topSummary');
          if(topSummary&&MODE==='user'){topSummary.textContent='User route'}
          if(topSummary&&MODE==='admin'){topSummary.textContent='Admin route'}
          var loginTitle=document.querySelector('#loginView .heroTitle');
          var loginText=document.querySelector('#loginView .heroText');
          var adminCard=document.querySelectorAll('#loginView .choiceCard')[0];
          var userCard=document.querySelectorAll('#loginView .choiceCard')[1];
          if(MODE==='admin'){
            if(loginTitle) loginTitle.textContent='Open the admin workspace.';
            if(loginText) loginText.textContent='Use Aryuki Auth Center to enter the class manager, upload batches, and control which classes are searchable.';
            if(adminCard){adminCard.querySelector('h3').textContent='Login As Admin';adminCard.querySelector('p').textContent='Only Aryuki admin accounts can enter the management console.';}
            if(userCard) userCard.style.display='none';
            var tempBtn=document.getElementById('tempLogin');
            if(tempBtn){
              var tempCard=tempBtn.closest('.choiceCard');
              if(tempCard) tempCard.style.display='none';
            }
          } else {
            if(loginTitle) loginTitle.textContent='Open the photo search space.';
            if(loginText) loginText.textContent='Continue as a guest or bind with Aryuki Auth Center, then upload a selfie and reveal your matched photos.';
            if(adminCard) adminCard.style.display='none';
            if(userCard){
              userCard.querySelector('h3').textContent='Find My Photos';
              userCard.querySelector('p').textContent='Create a temporary visitor profile instantly, or bind with Aryuki Auth Center later for synced history.';
            }
          }
          var adminPanel=document.getElementById('adminPanel');
          if(MODE==='user'&&adminPanel){adminPanel.classList.add('hidden')}
          if(MODE==='admin'){
            document.body.classList.add('admin-ready');
          }
          var searchTitle=document.querySelector('.searchPanel .sectionTitle');
          var searchMeta=document.querySelector('.searchPanel .meta');
          if(MODE==='user'&&searchTitle) searchTitle.textContent='Find My Photos';
          if(MODE==='user'&&searchMeta) searchMeta.textContent='Capture a selfie on mobile or upload one from your device. When the task completes, the grouped gallery below is ready for preview and download.';
          if(MODE==='user'){
            if(document.getElementById('toggleHistory')) document.getElementById('toggleHistory').textContent='History';
            var resultsTitle=document.querySelector('.resultsPanel .sectionTitle');
            if(resultsTitle) resultsTitle.textContent='Photo Matches';
            var resultsMeta=document.querySelector('.resultsPanel .meta');
            if(resultsMeta) resultsMeta.textContent='Browse thumbnails by class, tap to open the full image, then select individual photos or all results for direct or ZIP download.';
            var userButton=document.getElementById('userButton');
            if(userButton&&userButton.textContent==='Account') userButton.textContent='Profile';
          }
          enhanceShell();
          ensureUserRouteSession();
        }catch(error){console.error('Route enhancement failed',error)}
      });
      async function ensureUserRouteSession(){
        if(MODE!=='user')return;
        try{
          if(typeof me!=='undefined'&&me)return;
          var session=await api('/api/me').catch(function(){return{authenticated:false}});
          if(session&&session.authenticated&&session.user){
            me=session.user;
          }else{
            var temp=await api('/api/auth/temp',{method:'POST'});
            me=temp.user;
          }
          if(typeof renderShell==='function')renderShell();
          if(typeof loadClasses==='function')await loadClasses();
          enhanceShell();
        }catch(error){
          console.error('Guest auto-entry failed',error);
          document.body.classList.add('route-login-fallback');
          var login=document.getElementById('loginView');
          if(login)login.classList.remove('hidden');
          if(typeof showLoginNotice==='function')showLoginNotice(error.message||'Guest entry failed. Please try again.');
        }
      }
      function initials(value){
        var text=String(value||'User').trim();
        if(!text)return 'U';
        var parts=text.split(/\\s+/).filter(Boolean);
        return ((parts[0]||'U')[0]+(parts[1] ? parts[1][0] : '')).toUpperCase();
      }
      function avatarMarkup(user,small){
        var cls=small?'avatarBubble':'menuAvatar';
        if(user&&user.avatarUrl)return '<span class="'+cls+'"><img src="'+String(user.avatarUrl).replace(/"/g,'&quot;')+'" alt="" /></span>';
        return '<span class="'+cls+'">'+initials(user&&user.name)+'</span>';
      }
      function enhanceUserButton(){
        try{
          var button=document.getElementById('userButton');
          if(!button||typeof me==='undefined'||!me)return;
          var label=me.role==='admin'?'Admin':(me.name||'User');
          button.classList.add('avatarButton');
          button.innerHTML='<span class="avatarLabel">'+label.replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})+'</span>'+avatarMarkup(me,true);
          button.setAttribute('aria-label','Open user menu');
          var menu=document.getElementById('userMenu');
          if(menu&&!button.dataset.avatarClick){
            button.dataset.avatarClick='1';
            button.onclick=null;
            button.addEventListener('click',function(event){
              event.preventDefault();
              event.stopPropagation();
              menu.classList.toggle('hidden');
            });
          }
          if(menu&&!menu.dataset.enhancedObserver){
            menu.dataset.enhancedObserver='1';
            new MutationObserver(function(){
              enhanceMenuHead(menu);
            }).observe(menu,{childList:true,subtree:true});
          }
          if(menu)enhanceMenuHead(menu);
        }catch(error){}
      }
      function enhanceMenuHead(menu){
        if(!me||!menu||!menu.querySelector('.menuHead')||menu.querySelector('.menuAvatar'))return;
        var head=menu.querySelector('.menuHead');
        head.innerHTML=avatarMarkup(me,false)+'<div>'+head.innerHTML+'</div>';
      }
      function addBackTop(){
        if(document.getElementById('backTop'))return;
        var button=document.createElement('button');
        button.id='backTop';
        button.className='backTop';
        button.type='button';
        button.setAttribute('aria-label','Back to top');
        button.innerHTML='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6.5 14.5 5.5-5.5 5.5 5.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        button.addEventListener('click',function(){window.scrollTo({top:0,behavior:'smooth'})});
        document.body.appendChild(button);
        var update=function(){button.classList.toggle('show',window.scrollY>280)};
        window.addEventListener('scroll',update,{passive:true});
        update();
      }
      function enhanceShell(){
        addBackTop();
        enhanceUserButton();
        var tries=0;
        var timer=setInterval(function(){
          enhanceUserButton();
          tries+=1;
          if(tries>30)clearInterval(timer);
        },250);
      }
    })();
  </script>`;
  return renderHomePage().replace("</head>", extraHead + "</head>").replace("</body>", injectedScript + "</body>");
}
