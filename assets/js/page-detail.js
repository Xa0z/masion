/* ==========================================================================
   MAISON — detail rendering for the standalone pages

   products.html, ingredients.html and locations.html each ship a complete,
   readable index in the markup. That index is what a crawler — and anyone
   with scripting off — gets, so the page is never blank and never four
   words long.

   When a visitor arrives with ?id=…, the matching record is rendered above
   the index and the title and description are rewritten to match it. The
   record comes from the site CMS (window.MAISON_SITE_DATA) when one is
   attached; with no CMS the index simply stays as it is.
   ========================================================================== */
(function () {
  'use strict';

  var body = document.body;
  var name = body.getAttribute('data-collection');
  var id = new URLSearchParams(location.search).get('id');
  if (!name || !id) return;

  var host = document.getElementById('detail');
  if (!host) return;

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* the CMS keeps ingredient copy in per-language columns (name_en, name_ar…) */
  function lang() {
    var value = (document.documentElement.lang || 'en').toLowerCase();
    return /^ar(?:-|$)/.test(value) ? 'ar' : /^(?:ku|ckb)(?:-|$)/.test(value) ? 'ku' : 'en';
  }
  function field(row, key) {
    var suffix = '_' + lang();
    if (row[key + suffix] != null && row[key + suffix] !== '') return row[key + suffix];
    if (row[key + '_en'] != null) return row[key + '_en'];
    return row[key];
  }

  function describe(row) {
    if (name === 'locations') {
      return [field(row, 'address'), field(row, 'city')].filter(Boolean).join(', ');
    }
    return field(row, 'description') || field(row, 'role') || '';
  }

  function setMeta(title, description) {
    if (title) document.title = title;
    if (!description) return;
    var tag = document.querySelector('meta[name="description"]');
    if (tag) tag.setAttribute('content', description);
    var og = document.querySelector('meta[property="og:description"]');
    if (og) og.setAttribute('content', description);
  }

  function markup(row) {
    var title = esc(field(row, 'name'));
    var kind = field(row, 'role') || field(row, 'city') || '';
    var text = name === 'locations' ? field(row, 'address') : field(row, 'description');
    var image = row.image || row.img;
    var map = row.map_url;
    var html = '<h2 class="detail__name">' + title + '</h2>';
    if (kind) html += '<p class="detail__kind">' + esc(kind) + '</p>';
    if (image) {
      html += '<div class="detail__media"><img src="' + esc(image) + '" alt="' +
        title + '" loading="lazy" decoding="async"></div>';
    }
    if (text) html += '<p class="detail__body">' + esc(text) + '</p>';
    if (row.price) html += '<p class="sci__price">' + esc(row.price) + '</p>';
    if (map) {
      html += '<p class="detail__acts"><a class="btn" href="' + esc(map) +
        '" target="_blank" rel="noopener">Open in Google Maps</a></p>';
    }
    return html;
  }

  var drawn = false;

  function draw() {
    if (drawn || !window.MAISON_SITE_DATA) return;
    var rows = window.MAISON_SITE_DATA.rows(name);
    if (!Array.isArray(rows)) return;

    var row = rows.filter(function (item) { return String(item.id) === String(id); })[0];
    if (!row) return;           /* unknown id — the index below is the answer */

    drawn = true;
    host.innerHTML = markup(row);
    host.removeAttribute('hidden');
    setMeta('Maison — ' + field(row, 'name'), describe(row));
  }

  document.addEventListener('maison:data-ready', draw);
  document.addEventListener('maison:data-' + name, draw);
  document.addEventListener('maison:language', function () { drawn = false; draw(); });

  /* site-data.js only exists where a CMS is attached; load it if the page did
     not already, and let a missing file fail quietly. */
  if (window.MAISON_SITE_DATA) {
    draw();
  } else {
    var script = document.createElement('script');
    script.src = 'assets/js/site-data.js';
    script.onload = draw;
    script.onerror = function () {};
    document.head.appendChild(script);
  }
})();
