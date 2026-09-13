/* Optional enhancements. Every page and table remains available without JS. */
(function () {
  'use strict';
  const rail = document.getElementById('site-navigation');
  const menuButton = document.querySelector('.menu-toggle');
  const backdrop = document.querySelector('.nav-backdrop');
  const mobile = window.matchMedia('(max-width: 850px)');
  const photoDialog = document.getElementById('photo-dialog');
  const status = document.getElementById('navigation-status');
  let photoOpener = null;
  let pendingNavigation = null;
  let navigationNumber = 0;

  function closeMenu(returnFocus) {
    const wasOpen = document.body.classList.contains('nav-open');
    document.body.classList.remove('nav-open');
    menuButton.setAttribute('aria-expanded', 'false');
    backdrop.hidden = true;
    if (wasOpen && returnFocus) menuButton.focus({ preventScroll: true });
  }

  menuButton.addEventListener('click', function () {
    if (document.body.classList.contains('nav-open')) {
      closeMenu(true);
      return;
    }
    document.body.classList.add('nav-open');
    menuButton.setAttribute('aria-expanded', 'true');
    backdrop.hidden = false;
    // Keep the toggle focused; Tab enters the first visible menu item.
  });
  backdrop.addEventListener('click', function () { closeMenu(true); });
  mobile.addEventListener('change', function () { if (!mobile.matches) closeMenu(false); });

  rail.querySelectorAll('.nav-group').forEach(function (group) {
    group.addEventListener('toggle', function () {
      if (!group.open) return;
      rail.querySelectorAll('.nav-group').forEach(function (other) {
        if (other !== group) other.open = false;
      });
    });
  });

  document.addEventListener('keydown', function (event) {
    if (!document.body.classList.contains('nav-open')) return;
    if (event.key === 'Escape') {
      closeMenu(true);
      event.preventDefault();
    }
    if (event.key !== 'Tab') return;
    const focusables = [menuButton].concat(Array.from(rail.querySelectorAll('a[href], summary, button')).filter(function (element) {
      return element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden';
    }));
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      last.focus(); event.preventDefault();
    } else if (!event.shiftKey && document.activeElement === last) {
      first.focus(); event.preventDefault();
    }
  });

  function syncNavigation(pageName) {
    document.body.dataset.page = pageName;
    rail.querySelectorAll('[data-page-link]').forEach(function (link) {
      if (link.dataset.pageLink === pageName) {
        link.setAttribute('aria-current', 'page');
        const category = link.closest('details');
        if (category && !category.open) category.open = true;
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }

  function rememberPosition() {
    const state = Object.assign({}, history.state || {}, { careySample: true, scrollY: window.scrollY });
    history.replaceState(state, '', window.location.href);
  }

  function moveToContent(scrollY, hash) {
    const main = document.getElementById('content');
    main.focus({ preventScroll: true });
    requestAnimationFrame(function () {
      let destination = null;
      if (hash) {
        try { destination = document.getElementById(decodeURIComponent(hash.slice(1))); } catch (_) { /* normal top position */ }
      }
      if (destination) destination.scrollIntoView();
      else window.scrollTo(0, Number.isFinite(scrollY) ? scrollY : 0);
    });
  }

  async function loadPage(url, options) {
    const thisNavigation = ++navigationNumber;
    if (pendingNavigation) pendingNavigation.abort();
    pendingNavigation = new AbortController();
    document.getElementById('content').setAttribute('aria-busy', 'true');
    status.textContent = 'Loading page…';
    closeMenu(false);
    try {
      const response = await fetch(url.href, { signal: pendingNavigation.signal });
      if (!response.ok) throw new Error('Page could not be loaded');
      const page = new DOMParser().parseFromString(await response.text(), 'text/html');
      const replacement = page.querySelector('main[data-document]');
      if (!replacement || !['problems', 'transposing'].includes(replacement.dataset.document)) throw new Error('Unexpected document');
      if (thisNavigation !== navigationNumber) return;
      if (options.push) rememberPosition();
      document.getElementById('content').replaceWith(document.importNode(replacement, true));
      document.title = page.title;
      const description = page.querySelector('meta[name="description"]');
      if (description) document.querySelector('meta[name="description"]').content = description.content;
      syncNavigation(replacement.dataset.document);
      if (options.push) history.pushState({ careySample: true, scrollY: 0 }, '', url.href);
      status.textContent = replacement.querySelector('h1').textContent + ' loaded.';
      moveToContent(options.scrollY, url.hash);
    } catch (error) {
      if (error.name === 'AbortError') return;
      // Ordinary page navigation is the fallback; links never depend on fetch.
      if (thisNavigation === navigationNumber) window.location.assign(url.href);
    } finally {
      if (thisNavigation === navigationNumber) {
        document.getElementById('content').removeAttribute('aria-busy');
        pendingNavigation = null;
      }
    }
  }

  document.addEventListener('click', function (event) {
    const lightboxLink = event.target.closest('a[data-lightbox]');
    if (lightboxLink && typeof photoDialog.showModal === 'function') {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      photoOpener = lightboxLink;
      photoDialog.showModal();
      photoDialog.querySelector('button').focus();
      return;
    }
    const link = event.target.closest('a[data-page-link]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (link.target || link.hasAttribute('download') || !window.fetch || !window.AbortController || !['http:', 'https:'].includes(window.location.protocol)) return;
    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin) return;
    if (url.pathname === window.location.pathname && !url.hash) {
      event.preventDefault(); closeMenu(false); moveToContent(0, ''); return;
    }
    event.preventDefault();
    loadPage(url, { push: true, scrollY: 0 });
  });

  photoDialog.querySelector('.dialog-close').addEventListener('click', function () { photoDialog.close(); });
  photoDialog.addEventListener('click', function (event) {
    if (event.target !== photoDialog) return;
    const box = photoDialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) photoDialog.close();
  });
  photoDialog.addEventListener('close', function () {
    if (photoOpener && photoOpener.isConnected) photoOpener.focus({ preventScroll: true });
    photoOpener = null;
  });

  if (['http:', 'https:'].includes(window.location.protocol) && window.fetch && window.AbortController) {
    history.scrollRestoration = 'manual';
    rememberPosition();
    let scrollSaveTimer;
    window.addEventListener('scroll', function () {
      clearTimeout(scrollSaveTimer);
      scrollSaveTimer = setTimeout(function () { if (!pendingNavigation) rememberPosition(); }, 150);
    }, { passive: true });
    window.addEventListener('popstate', function (event) {
      loadPage(new URL(window.location.href), { push: false, scrollY: event.state && event.state.scrollY });
    });
  }
})();
