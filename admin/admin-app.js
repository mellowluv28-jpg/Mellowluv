// Admin PWA: Toast + pull-to-refresh + active tab
(function() {
  // Toast system (replaces alert())
  window.adminToast = function(msg, type) {
    var existing = document.querySelector('.admin-toast');
    if (existing) existing.remove();
    var t = document.createElement('div');
    t.className = 'admin-toast' + (type === 'success' ? ' success' : type === 'error' ? ' error' : '');
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(function() { t.classList.add('show'); });
    setTimeout(function() { t.classList.remove('show'); setTimeout(function() { t.remove(); }, 300); }, 2500);
  };

  // Highlight active bottom tab
  var path = window.location.pathname;
  document.querySelectorAll('.admin-bottom-nav a').forEach(function(a) {
    var href = a.getAttribute('href');
    if (href && path.indexOf(href.replace('.html','')) > -1) a.classList.add('active');
  });

  // Pull-to-refresh hint (touch scroll detection)
  var content = document.querySelector('.admin-app-content');
  if (content) {
    var startY = 0;
    content.addEventListener('touchstart', function(e) { startY = e.touches[0].pageY; });
    content.addEventListener('scroll', function() {
      var hint = document.querySelector('.pull-hint');
      if (!hint) return;
      if (content.scrollTop < -30) { hint.classList.add('show'); hint.textContent = 'Release to refresh'; }
      else if (content.scrollTop < 0) { hint.classList.add('show'); hint.textContent = 'Pull down to refresh'; }
      else { hint.classList.remove('show'); }
    });
  }
})();
