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

  function fillInstructions() {
    const text = document.getElementById('install-modal-text');
    const steps = document.getElementById('install-modal-steps');
    if (!text || !steps) return;

    let intro = '';
    let items = [];

    if (isIOS()) {
      intro =
        'Tocá <i class="bi bi-arrow-up-square text-secondary"></i> <strong>Compartir</strong> y elegí ' +
        '<strong>Añadir a pantalla de inicio</strong>. Así se instala como una app nativa.';
      items = [
        'Abrí la app desde el menú de <strong>Compartir</strong> de tu navegador (Safari).',
        'Seleccioná <strong>Añadir a pantalla de inicio</strong>.',
        'Confirmá y la app quedará en tu pantalla de inicio.',
      ];
    } else if (isAndroid()) {
      intro =
        'Tocá el menú <i class="bi bi-three-dots text-secondary"></i> <strong>⋮</strong> de Chrome y elegí ' +
        '<strong>Instalar aplicación</strong> (o <strong>Añadir a pantalla de inicio</strong>).';
      items = [
        'Abrí el menú <strong>⋮</strong> de Chrome (esquina superior derecha).',
        'Tocá <strong>Instalar aplicación</strong> / <strong>Añadir a pantalla de inicio</strong>.',
        'Confirmá y la app quedará en tu pantalla de inicio.',
      ];
    } else {
      intro =
        'Usá la opción <strong>Instalar aplicación</strong> del menú del navegador para descargarla ' +
        'y usarla como una app independiente.';
      items = [
        'Abrí el menú del navegador (⋮ o <i class="bi bi-three-dots"></i>).',
        'Elegí <strong>Instalar aplicación</strong> / <strong>Crear acceso directo</strong>.',
        'Confirmá la instalación.',
      ];
    }

    text.innerHTML = intro;
    steps.innerHTML = items.map((t) => '<li class="mb-1">' + t + '</li>').join('');
  }

  function showInstructions() {
    const el = document.getElementById('installModal');
    if (!el) return;
    fillInstructions();
    new bootstrap.Modal(el).show();
  }

  function init() {
    btn = document.getElementById('btn-install');
    if (!btn) return;

    if (isStandalone()) {
      showBtn(false);
      return;
    }
    showBtn(true);

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      showBtn(true);
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
      } else {
        showInstructions();
      }
    });
  }

  return { init, isStandalone, isIOS, isAndroid };
})();
