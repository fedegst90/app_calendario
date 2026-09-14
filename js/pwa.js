const PwaInstall = (() => {
  let deferredPrompt = null;
  let btn = null;

  function isStandalone() {
    return (
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      (navigator.standalone === true)
    );
  }

  function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  }

  function isAndroid() {
    return /android/i.test(navigator.userAgent);
  }

  function showBtn(show) {
    if (btn) btn.classList.toggle('d-none', !show);
  }

  function showInstructions() {
    const el = document.getElementById('installModal');
    if (el) new bootstrap.Modal(el).show();
  }

  function init() {
    btn = document.getElementById('btn-install');
    if (!btn || isStandalone()) return;

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      if (!isIOS()) showBtn(true);
    });

    window.addEventListener('appinstalled', () => {
      deferredPrompt = null;
      showBtn(false);
    });

    btn.addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        deferredPrompt = null;
        if (choice && choice.outcome === 'accepted') showBtn(false);
      } else if (isIOS() || isAndroid()) {
        showInstructions();
      }
    });

    // iOS no dispara beforeinstallprompt: mostramos el botón con instrucciones
    if (isIOS()) showBtn(true);
  }

  return { init, isStandalone, isIOS };
})();