/* ==========================================================================
   MAISON — store
   Cart, product pages and checkout. Entirely client-side: the bag lives in
   localStorage and the order is handed to the customer to send. No payment
   is captured and nothing is transmitted anywhere.
   ========================================================================== */
(function () {
  'use strict';

  var CAT = window.MAISON_CATALOGUE;
  var KEY = 'maison.bag';
  var listeners = [];
  var bag = [];

  /* ---------- persistence ---------- */
  function load() {
    try {
      var raw = JSON.parse(localStorage.getItem(KEY) || '[]');
      bag = Array.isArray(raw) ? raw.filter(function (l) {
        return l && typeof l.id === 'string' && byId(l.id) && +l.qty > 0;
      }).map(function (l) {
        return { id: l.id, qty: Math.min(99, Math.max(1, Math.round(+l.qty))) };
      }) : [];
    } catch (e) { bag = []; }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(bag)); } catch (e) {}
    listeners.forEach(function (fn) { fn(); });
  }

  /* ---------- lookups ---------- */
  function byId(id) {
    for (var i = 0; i < CAT.products.length; i++) if (CAT.products[i].id === id) return CAT.products[i];
    return null;
  }
  function cityById(id) {
    for (var i = 0; i < CAT.delivery.length; i++) if (CAT.delivery[i].id === id) return CAT.delivery[i];
    return CAT.delivery[0];
  }

  /* ---------- money ---------- */
  function money(n) {
    // Latin digits with thin grouping — how the brand posts prices
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /* ---------- bag ops ---------- */
  function add(id, qty) {
    var p = byId(id); if (!p) return 0;
    qty = Math.max(1, Math.round(qty || 1));
    var line = null;
    for (var i = 0; i < bag.length; i++) if (bag[i].id === id) line = bag[i];
    if (line) line.qty = Math.min(99, line.qty + qty);
    else bag.push({ id: id, qty: Math.min(99, qty) });
    save();
    return count();
  }
  function setQty(id, qty) {
    qty = Math.round(qty);
    for (var i = 0; i < bag.length; i++) {
      if (bag[i].id !== id) continue;
      if (qty <= 0) { bag.splice(i, 1); } else { bag[i].qty = Math.min(99, qty); }
      break;
    }
    save();
  }
  function remove(id) { setQty(id, 0); }
  function clear() { bag = []; save(); }
  function count() {
    return bag.reduce(function (n, l) { return n + l.qty; }, 0);
  }
  function lines() {
    return bag.map(function (l) {
      var p = byId(l.id);
      return { id: l.id, qty: l.qty, product: p, line: p.price * l.qty };
    }).filter(function (l) { return !!l.product; });
  }
  function subtotal() {
    return lines().reduce(function (n, l) { return n + l.line; }, 0);
  }
  function deliveryFee(cityId) {
    var sub = subtotal();
    if (sub <= 0) return 0;
    if (sub >= CAT.freeDeliveryOver) return 0;
    return cityById(cityId).fee;
  }
  function total(cityId) { return subtotal() + deliveryFee(cityId); }

  function onChange(fn) { listeners.push(fn); }

  load();

  window.MAISON_STORE = {
    byId: byId, cityById: cityById, money: money,
    add: add, setQty: setQty, remove: remove, clear: clear,
    count: count, lines: lines, subtotal: subtotal,
    deliveryFee: deliveryFee, total: total, onChange: onChange
  };
})();
