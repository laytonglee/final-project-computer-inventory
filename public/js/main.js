// ── Auto-dismiss alerts after 5 seconds ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.alert.alert-success').forEach(el => {
    setTimeout(() => {
      const bsAlert = bootstrap.Alert.getOrCreateInstance(el);
      if (bsAlert) bsAlert.close();
    }, 5000);
  });

  // Highlight active sidebar link
  const currentPath = window.location.pathname;
  document.querySelectorAll('.sidebar .nav-link').forEach(link => {
    const href = link.getAttribute('href');
    if (href && href !== '/' && currentPath.startsWith(href)) {
      link.classList.add('active', 'text-white', 'bg-primary', 'bg-opacity-25');
      link.classList.remove('text-white-50');
    }
  });
});
