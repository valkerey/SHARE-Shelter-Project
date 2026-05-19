const STATUS_META = {
  'unreviewed':  { label: 'Unreviewed',  color: '#6B7280' },
  'in-progress': { label: 'In Progress', color: '#F59E0B' },
  'promising':   { label: 'Promising',   color: '#22C55E' },
  'not-viable':  { label: 'Not Viable',  color: '#EF4444' },
};

const RESOURCE_ORDER = [
  { key: 'bike',       label: 'Bike Infrastructure'    },
  { key: 'transit',    label: 'Transit'                },
  { key: 'libraries',  label: 'Libraries'              },
  { key: 'healthcare', label: 'Healthcare'             },
  { key: 'foodSocial', label: 'Food & Social Services' },
  { key: 'parks',      label: 'Parks'                  },
];

export function printSiteCard({ name, address, buildingType, status, notes, photos, counts }) {
  const meta  = STATUS_META[status] || STATUS_META.unreviewed;
  const date  = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const addr  = address
    ? address + (address.toLowerCase().includes('seattle') ? '' : ', Seattle, WA')
    : '';

  const resourceRows = RESOURCE_ORDER.map(({ key, label }) => {
    const c = counts?.[key];
    if (!c) return '';
    const q = c.quarter ?? 0;
    const h = c.half   ?? 0;
    const qStyle = q > 0 ? 'color:#16a34a;font-weight:600' : 'color:#bbb';
    const hStyle = h > 0 ? 'color:#d97706'                 : 'color:#bbb';
    return `<tr>
      <td>${label}</td>
      <td class="num" style="${qStyle}">${q}</td>
      <td class="num" style="${hStyle}">${h}</td>
    </tr>`;
  }).join('');

  const photosHtml = photos?.length > 0
    ? photos.map(src =>
        `<img src="${src}" style="width:140px;height:105px;object-fit:cover;border-radius:6px;border:1px solid #ddd">`
      ).join('')
    : '';

  const escape = (s) => (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Site Summary – ${escape(name)}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111;padding:36px;max-width:700px;margin:0 auto;font-size:14px}
    .top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2.5px solid #111;padding-bottom:14px;margin-bottom:22px}
    .site-name{font-size:22px;font-weight:800;line-height:1.2}
    .site-sub{font-size:13px;color:#555;margin-top:4px}
    .status{display:inline-block;margin-top:9px;padding:3px 11px;border-radius:20px;font-size:12px;font-weight:700;letter-spacing:.4px;border:1.5px solid ${meta.color};color:${meta.color};background:${meta.color}18}
    .org{text-align:right;font-size:12px;color:#888;line-height:1.6}
    .org strong{font-size:15px;color:#111;display:block;margin-bottom:2px}
    h3{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.9px;color:#999;border-bottom:1px solid #eee;padding-bottom:5px;margin-bottom:10px}
    section{margin-bottom:22px}
    table{width:100%;border-collapse:collapse;font-size:13px}
    thead th{font-size:10px;text-transform:uppercase;letter-spacing:.6px;color:#999;font-weight:700;padding:4px 8px;text-align:left}
    thead th.num{text-align:center}
    td{padding:6px 8px;border-top:1px solid #f2f2f2}
    td.num{text-align:center;font-variant-numeric:tabular-nums}
    .notes{font-size:13px;line-height:1.75;white-space:pre-wrap;color:#333}
    .photos{display:flex;gap:8px;flex-wrap:wrap}
    .footer{margin-top:30px;padding-top:10px;border-top:1px solid #eee;font-size:11px;color:#bbb;display:flex;justify-content:space-between}
    @media print{body{padding:20px}button{display:none}}
  </style>
</head>
<body>
  <div class="top">
    <div>
      <div class="site-name">${escape(name)}</div>
      ${addr    ? `<div class="site-sub">${escape(addr)}</div>` : ''}
      ${buildingType ? `<div class="site-sub">Type: ${escape(buildingType)}</div>` : ''}
      <div class="status">${meta.label}</div>
    </div>
    <div class="org">
      <strong>SHARE Shelter Map</strong>
      ${date}
    </div>
  </div>

  <section>
    <h3>Nearby Resources</h3>
    <table>
      <thead><tr><th>Resource</th><th class="num">¼ mile</th><th class="num">½ mile</th></tr></thead>
      <tbody>${resourceRows}</tbody>
    </table>
  </section>

  ${notes ? `<section>
    <h3>Notes</h3>
    <div class="notes">${escape(notes)}</div>
  </section>` : ''}

  ${photosHtml ? `<section>
    <h3>Photos</h3>
    <div class="photos">${photosHtml}</div>
  </section>` : ''}

  <div class="footer">
    <span>SHARE Shelter Project</span>
    <span>Printed ${date}</span>
  </div>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=760,height=920');
  if (!win) { alert('Allow pop-ups to print the site card.'); return; }
  win.document.write(html);
  win.document.close();
  win.addEventListener('load', () => win.print());
}
