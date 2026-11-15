// Comportamiento del sitio. Todo es mejora progresiva: sin este archivo la página
// se ve completa (el script de <head> retira la clase .js si esto no llega a ejecutarse).
(function () {
  var doc = document;
  var root = doc.documentElement;

  // 1. Recuerda el idioma elegido para que la portada (/) redirija a él la próxima vez.
  doc.querySelectorAll('[data-lang]').forEach(function (a) {
    a.addEventListener('click', function () {
      try { localStorage.setItem('lang', a.getAttribute('data-lang')); } catch (e) {}
    });
  });

  // 2. Movimiento. Solo si <head> activó .js y el usuario no pidió reducir el movimiento.
  if (!root.classList.contains('js')) return;
  window.__motionReady = true;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    root.classList.remove('js');
    return;
  }

  // Elementos que aparecen al entrar en pantalla (deben coincidir con motion.css, sección 6).
  var ITEMS = '.sheets>li,.mo,.story-col,.steps>li,.list>*,' +
    '.ix>*,.more-h,.meta,.block>h2,.block-intro,.prose,.table-wrap,.table-note,.credits p,.pager>*,.foot>div,.fig figcaption';
  // Contenedores cuya regla se traza o cuya figura se descubre.
  var HOSTS = '.ix,.story,.pager,.list,.block,.fig';

  var loadedAt = performance.now();
  var io = new IntersectionObserver(function (entries) {
    var shown = [];
    entries.forEach(function (e) { if (e.isIntersecting) shown.push(e.target); });
    if (!shown.length) return;
    shown.sort(function (a, b) { return a.compareDocumentPosition(b) & 4 ? -1 : 1; });
    // Lo que ya está en pantalla al cargar espera a que termine la cabecera.
    var base = performance.now() - loadedAt < 500 ? 380 : 0;
    var step = 0;
    shown.forEach(function (el) {
      io.unobserve(el);
      var delay = base + (el.matches(ITEMS) ? Math.min(step++, 7) * 70 : 0);
      if (delay) el.style.setProperty('--rd', delay + 'ms');
      el.classList.add('in');
      // El retardo solo vale para la entrada; después no debe frenar otras transiciones.
      setTimeout(function () { el.style.removeProperty('--rd'); }, delay + 1600);
    });
  }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
  doc.querySelectorAll(ITEMS + ',' + HOSTS).forEach(function (el) { io.observe(el); });

  // 3. Cifra protagonista: cuenta desde cero hasta su valor una sola vez.
  //    Los lectores de pantalla reciben siempre el valor final.
  var num = doc.querySelector('.metric .num');
  var textNode = num && num.firstChild;
  if (textNode && textNode.nodeType === 3 && /\d/.test(textNode.nodeValue)) {
    var finalText = textNode.nodeValue;
    var pattern = /\d+(?: \d{3})*(?:[.,]\d+)?/g;
    var parts = [];
    var last = 0;
    finalText.replace(pattern, function (match, index) {
      parts.push(finalText.slice(last, index));
      var sep = match.indexOf(',') >= 0 ? ',' : (match.indexOf('.') >= 0 ? '.' : '');
      var plain = match.replace(/ /g, '');
      var decimals = sep ? plain.length - plain.indexOf(sep) - 1 : 0;
      parts.push({ value: parseFloat(plain.replace(',', '.')), decimals: decimals, sep: sep, grouped: match.indexOf(' ') >= 0 });
      last = index + match.length;
      return match;
    });
    parts.push(finalText.slice(last));

    var render = function (t) {
      return parts.map(function (p) {
        if (typeof p === 'string') return p;
        var s = (p.value * t).toFixed(p.decimals);
        if (p.sep === ',') s = s.replace('.', ',');
        if (p.grouped) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
        return s;
      }).join('');
    };

    var srOnly = doc.createElement('span');
    srOnly.className = 'sr';
    srOnly.textContent = finalText;
    var visual = doc.createElement('span');
    visual.setAttribute('aria-hidden', 'true');
    visual.textContent = render(0);
    num.replaceChild(visual, textNode);
    num.insertBefore(srOnly, visual);

    var DELAY = 500, DURATION = 1300, t0 = null;
    var tick = function (now) {
      if (t0 === null) t0 = now;
      var t = Math.min(1, Math.max(0, (now - t0 - DELAY) / DURATION));
      var eased = 1 - Math.pow(1 - t, 3);
      visual.textContent = t === 1 ? finalText : render(eased);
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    // Red de seguridad: si la pestaña estaba oculta, deja el valor final al volver.
    doc.addEventListener('visibilitychange', function () {
      if (!doc.hidden && t0 !== null && performance.now() - t0 > DELAY + DURATION) visual.textContent = finalText;
    });
  }
})();
