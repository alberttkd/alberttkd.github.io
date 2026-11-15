// Recuerda el idioma elegido para que la portada (/) redirija a él la próxima vez.
document.querySelectorAll('[data-lang]').forEach(function (a) {
  a.addEventListener('click', function () {
    try { localStorage.setItem('lang', a.getAttribute('data-lang')); } catch (e) {}
  });
});
