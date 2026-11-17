import type { CustomerContext } from '../../../../packages/contracts/pilot.js';

const html = (value: string): string => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);

export function renderPortal(context: CustomerContext, tenants: { id: string; name: string }[], csrf: string): string {
  const current = tenants.find(tenant => tenant.id === context.tenantId);
  if (!current) throw new Error('Denied');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${html(current.name)} · MaexSocial</title><style>
:root{color-scheme:dark;font-family:system-ui,sans-serif;background:#0B0F19;color:#F8FAFC}*{box-sizing:border-box}
body{margin:0;line-height:1.6}a{color:#00E5FF}.skip{position:absolute;left:1rem;top:-5rem}.skip:focus{top:1rem}
header,main{max-width:72rem;margin:auto;padding:1.5rem}header{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:1rem;border-bottom:1px solid #334155}
.brand{font-size:1.35rem;font-weight:750;color:#F8FAFC;text-decoration:none}.brand span{color:#00E5FF}
h1{font-size:clamp(1.8rem,4vw,2.8rem);line-height:1.2;margin:.4rem 0 1rem;overflow-wrap:anywhere}h2{font-size:1.2rem;margin-top:0}
.label{color:#00E5FF;font-size:.85rem;letter-spacing:.08em;text-transform:uppercase}.card{background:#161F30;padding:1.5rem;border-radius:.8rem;margin:1.5rem 0;border:1px solid #334155}
label{display:block;font-weight:600;margin-bottom:.4rem}select,button{font:inherit;border-radius:.4rem;padding:.6rem .9rem;min-height:44px}
select{max-width:100%;background:#0B0F19;color:#F8FAFC;border:1px solid #64748B}button{background:#00E5FF;color:#0B0F19;border:0;font-weight:700;cursor:pointer}
button.secondary{background:transparent;color:#F8FAFC;border:1px solid #64748B}:focus-visible{outline:3px solid #FF5E5B;outline-offset:4px}
.switch{display:flex;flex-wrap:wrap;gap:.75rem;align-items:end}.switch>div{min-width:0;flex:1}p{max-width:65ch}
</style></head><body><a class="skip" href="#main">Skip to workspace</a><header><a class="brand" href="/customer">Maex<span>Social</span></a>
<form action="/customer/logout" method="post"><input type="hidden" name="csrf" value="${html(csrf)}"><button class="secondary" type="submit">Sign out</button></form></header>
<main id="main" tabindex="-1"><p class="label">Your workspace</p><h1>${html(current.name)}</h1><p>Your workspace role is <strong>${html(context.role)}</strong>.</p>
<section class="card" aria-labelledby="workspace-heading"><h2 id="workspace-heading">Workspace access</h2><p>Your actions apply to the workspace selected here.</p>
<form class="switch" action="/customer/switch" method="post"><input type="hidden" name="csrf" value="${html(csrf)}"><div><label for="tenant">Active workspace</label><select id="tenant" name="tenantId">${tenants.map(tenant => `<option value="${html(tenant.id)}"${tenant.id === context.tenantId ? ' selected' : ''}>${html(tenant.name)}</option>`).join('')}</select></div><button type="submit">Switch workspace</button></form>
</section></main></body></html>`;
}
