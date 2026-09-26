/**
 * Measures the rendered layout over CDP, because a screenshot cannot be
 * eyeballed here. Reports, per page: whether the document scrolls vertically,
 * whether anything overflows horizontally, the nav links, and the CTA count.
 *
 * Usage: node measure.mjs <url> <label>
 * Assumes a headless browser already listening on CDP_PORT (default 9222).
 */
const url = process.argv[2] ?? "http://localhost:3000/";
const label = process.argv[3] ?? url;
const CDP = process.env.CDP_PORT ?? "9222";

const version = await (await fetch(`http://localhost:${CDP}/json/version`)).json();

// Chrome >= 111 requires PUT for /json/new.
let target;
try {
  target = await (
    await fetch(`http://localhost:${CDP}/json/new?${encodeURIComponent(url)}`, { method: "PUT" })
  ).json();
} catch {
  target = await (await fetch(`http://localhost:${CDP}/json/new?about:blank`)).json();
}

const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();

function send(method, params = {}) {
  const msgId = ++id;
  ws.send(JSON.stringify({ id: msgId, method, params }));
  return new Promise((res, rej) => pending.set(msgId, { res, rej }));
}

ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { res, rej } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result);
  }
});

await new Promise((r) => ws.addEventListener("open", r, { once: true }));

await send("Page.enable");
await send("Runtime.enable");
await send("Page.navigate", { url });
// Give client components time to hydrate and fetch.
await new Promise((r) => setTimeout(r, 3500));

const expression = `(() => {
  const de = document.documentElement;
  const all = [...document.querySelectorAll('body *')];
  const maxRight = all.reduce((m, e) => Math.max(m, e.getBoundingClientRect().right), 0);
  const rect = (sel) => {
    const e = document.querySelector(sel);
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return { top: Math.round(r.top), height: Math.round(r.height), bottom: Math.round(r.bottom) };
  };
  return JSON.stringify({
    viewport: window.innerWidth + 'x' + window.innerHeight,
    scrollHeight: de.scrollHeight,
    verticalScroll: de.scrollHeight > window.innerHeight + 1,
    horizontalOverflow: Math.round(maxRight) > window.innerWidth + 1,
    maxRight: Math.round(maxRight),
    landing: rect('.landing'),
    footer: rect('.landing-foot'),
    title: rect('.landing-title'),
    roles: rect('.landing-roles'),
    navLinks: [...document.querySelectorAll('header.top .nav-desktop a')].map(a => a.textContent.trim()).filter(Boolean),
    roleButtons: [...document.querySelectorAll('header.top .role-btn')].map(b => b.textContent.trim()),
    ctas: [...document.querySelectorAll('.landing-role button')].map(b => b.textContent.trim()),
    ctaDescs: [...document.querySelectorAll('.landing-role p')].map(p => p.textContent.trim()),
    h1: document.querySelector('h1') ? document.querySelector('h1').textContent.trim() : null,
    strip: document.querySelector('.landing-strip') ? document.querySelector('.landing-strip').textContent.replace(/\\s+/g,' ').trim() : null,
    banner: document.querySelector('.role-banner') ? document.querySelector('.role-banner').textContent.replace(/\\s+/g,' ').trim() : null,
  });
})()`;

const out = await send("Runtime.evaluate", { expression, returnByValue: true });
const m = JSON.parse(out.result.value);

console.log(`\n=== ${label} ===`);
console.log(`  viewport            ${m.viewport}`);
console.log(`  vertical scroll     ${m.verticalScroll ? "YES (" + m.scrollHeight + "px > " + m.viewport.split('x')[1] + "px)" : "no  (fits one viewport)"}`);
console.log(`  horizontal overflow ${m.horizontalOverflow ? "YES (maxRight " + m.maxRight + "px)" : "no"}`);
console.log(`  h1                  ${JSON.stringify(m.h1)}`);
if (m.landing) console.log(`  .landing            top=${m.landing.top} h=${m.landing.height} bottom=${m.landing.bottom}`);
if (m.title) console.log(`  title block         top=${m.title.top} h=${m.title.height}`);
if (m.roles) console.log(`  role cards          top=${m.roles.top} h=${m.roles.height}`);
if (m.footer) console.log(`  footer              top=${m.footer.top} bottom=${m.footer.bottom}`);
if (m.strip) console.log(`  strip               ${JSON.stringify(m.strip)}`);
if (m.ctas.length) console.log(`  CTAs                ${JSON.stringify(m.ctas)}`);
if (m.ctaDescs.length) m.ctaDescs.forEach((d, i) => console.log(`  desc ${i + 1}             ${JSON.stringify(d)}`));
console.log(`  nav links           ${JSON.stringify(m.navLinks)}`);
if (m.roleButtons.length) console.log(`  role switcher       ${JSON.stringify(m.roleButtons)}`);
if (m.banner) console.log(`  banner              ${JSON.stringify(m.banner)}`);

ws.close();
await fetch(`http://localhost:${CDP}/json/close/${target.id}`);
void version;
process.exit(0);
