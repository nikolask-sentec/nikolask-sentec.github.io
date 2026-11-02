(function () {
  'use strict';

  var doc = document;
  var main = doc.getElementById('main');
  var text = main ? main.dataset : {};

  function byId(id) { return doc.getElementById(id); }
  function all(sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); }

  /* mobile navigation */
  var nav = byId('nav');
  var menu = doc.querySelector('.menu');
  if (nav && menu) {
    menu.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      menu.setAttribute('aria-expanded', String(open));
    });
    all('a', nav).forEach(function (a) {
      a.addEventListener('click', function () {
        nav.classList.remove('open');
        menu.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* hero video: lazy load, respect reduced motion and data saver.
     The visible play/pause control was removed at Nikolas's request on
     2026-11-02. The video still stops on its own whenever it should: when
     the visitor prefers reduced motion, when the hero scrolls out of view,
     and when the tab is hidden. */
  var video = byId('hero-video');
  var hero = doc.querySelector('.hero');
  if (video && hero) {
    var reduced = matchMedia('(prefers-reduced-motion: reduce)');
    var heroVisible = true;
    var failed = false;

    var saveData = function () { return !!(navigator.connection && navigator.connection.saveData); };
    var load = function () {
      if (!video.getAttribute('src')) {
        video.src = matchMedia('(max-width: 700px)').matches ? video.dataset.srcMobile : video.dataset.srcDesktop;
        video.load();
      }
    };
    var play = function () {
      if (failed) { return; }
      load();
      var p = video.play();
      /* A rejected play() promise is not an error worth acting on: the
         poster stays up, which is the correct fallback. */
      if (p && p.catch) { p.catch(function () {}); }
    };

    video.addEventListener('playing', function () { video.classList.add('ready'); });
    video.addEventListener('error', function () {
      failed = true;
      video.classList.remove('ready');
    });
    reduced.addEventListener('change', function () {
      if (reduced.matches) { video.pause(); } else if (heroVisible) { play(); }
    });
    doc.addEventListener('visibilitychange', function () {
      if (doc.hidden) { video.pause(); }
      else if (heroVisible && !reduced.matches && !saveData()) { play(); }
    });
    new IntersectionObserver(function (entries) {
      heroVisible = entries[0].isIntersecting;
      doc.body.classList.toggle('hero-in-view', heroVisible);
      if (!heroVisible) { video.pause(); }
      else if (!reduced.matches && !saveData()) { play(); }
    }, { threshold: 0.2 }).observe(hero);
  }

  /* apartments: bedroom filter and expand */
  var catalogue = byId('catalogue');
  var expandBtn = byId('expand-rooms');
  var countEl = byId('room-count');
  var filterBar = doc.querySelector('.room-filters');
  var cards = catalogue ? all('.catalogue-card', catalogue) : [];
  var filter = 'all';
  var expanded = false;

  function isDefault(card) { return card.dataset.default === '1'; }

  if (cards.length) {
    cards.forEach(function (c) { c.dataset.default = c.hidden ? '0' : '1'; });
    var hasMore = cards.some(function (c) { return !isDefault(c); });

    var renderCards = function () {
      var shown = 0;
      cards.forEach(function (card) {
        var match;
        if (filter !== 'all') {
          match = card.dataset.beds === filter;
        } else {
          match = expanded || isDefault(card);
        }
        card.hidden = !match;
        if (match) { shown++; }
      });
      if (filterBar) { filterBar.hidden = !expanded; }
      if (countEl) { countEl.textContent = (text.shown || '%d').replace('%d', String(shown)); }
      if (expandBtn) {
        var total = cards.length;
        expandBtn.textContent = (expanded ? text.showFewer : (text.exploreAll || '').replace('%d', String(total))) + (expanded ? ' ↑' : ' ↓');
        expandBtn.setAttribute('aria-expanded', String(expanded));
      }
    };

    if (hasMore && expandBtn) {
      expandBtn.hidden = false;
      expandBtn.addEventListener('click', function () {
        expanded = !expanded;
        if (!expanded) {
          filter = 'all';
          all('[data-filter]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.filter === 'all')); });
        }
        renderCards();
      });
      all('[data-filter]').forEach(function (b) {
        b.addEventListener('click', function () {
          filter = b.dataset.filter;
          expanded = true;
          all('[data-filter]').forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
          renderCards();
        });
      });
      renderCards();
    } else if (countEl) {
      countEl.hidden = true;
    }
  }

  /* detail modal: fetch the real page and lift #detail-body out of it.
     Every card is a real anchor, so this is pure enhancement. If fetch,
     DOMParser or <dialog> is missing, or the fetch fails, the click falls
     through to an ordinary navigation and the visitor gets the page. */
  var dialog = byId('detail-dialog');
  var slot = byId('detail-slot');
  var closeBtn = byId('detail-close');
  var loading = doc.querySelector('.detail-loading');
  var trigger = null;
  var pushed = false;
  /* Incremented on every open. A fetch that resolves after its modal was
     dismissed, or after a newer one was opened, must not touch the page:
     without this a visitor who presses Escape while the spinner is up gets
     the address bar silently rewritten to a page they are not looking at. */
  var openToken = 0;

  function clear(el) { while (el.firstChild) { el.removeChild(el.firstChild); } }

  function openDetail(url, from) {
    var token = ++openToken;
    trigger = from;
    dialog.setAttribute('data-loading', '');
    clear(slot);
    if (!dialog.open) { dialog.showModal(); }
    fetch(url, { credentials: 'same-origin' })
      .then(function (r) {
        if (!r.ok) { throw new Error(String(r.status)); }
        return r.text();
      })
      .then(function (html) {
        if (token !== openToken || !dialog.open) { return; }
        var body = new DOMParser().parseFromString(html, 'text/html').getElementById('detail-body');
        if (!body) { throw new Error('no detail body'); }
        var clone = doc.importNode(body, true);
        /* The page and the modal would otherwise both carry #detail-body
           and #detail-title when a modal is opened from a detail page.
           Strip the wrapper id and move the heading to the id the dialog
           is labelled by. Styling hangs off .detail, not the id. */
        clone.removeAttribute('id');
        var heading = clone.querySelector('#detail-title');
        if (heading) {
          /* The loading line holds this id until now, so the dialog has an
             accessible name for the whole load, not just afterwards. */
          loading.removeAttribute('id');
          heading.id = 'detail-modal-title';
        }
        slot.appendChild(clone);
        dialog.removeAttribute('data-loading');
        /* One history entry per open, pushed only once the content is
           really there, so a failed fetch never leaves a phantom entry. */
        if (!pushed) {
          history.pushState({ detail: url }, '', url);
          pushed = true;
        }
        closeBtn.focus();
      })
      .catch(function () {
        /* Only fall through to the page if this request still owns the
           dialog. If the visitor already dismissed it, yanking them to
           another page is the last thing they asked for. */
        if (token !== openToken || !dialog.open) { return; }
        /* pushed is still false here, so close() pops nothing. */
        dialog.close();
        window.location.href = url;
      });
  }

  if (dialog && slot && closeBtn && window.fetch && window.DOMParser && typeof dialog.showModal === 'function') {
    doc.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[data-modal]');
      if (!a || e.defaultPrevented || e.button !== 0) { return; }
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) { return; }
      e.preventDefault();
      openDetail(a.getAttribute('href'), a);
    });

    closeBtn.addEventListener('click', function () { dialog.close(); });
    dialog.addEventListener('click', function (e) { if (e.target === dialog) { dialog.close(); } });

    /* Every close path lands here: the button, Escape (which <dialog>
       turns into cancel then close) and the backdrop. Popping exactly one
       entry here is what makes the back button and the close button do the
       same thing. popstate zeroes the flag first so a back-driven close
       does not pop a second time. */
    dialog.addEventListener('close', function () {
      if (pushed) { pushed = false; history.back(); }
      if (trigger) { trigger.focus(); trigger = null; }
      clear(slot);
      if (loading && !loading.id) { loading.id = 'detail-modal-title'; }
    });
    /* history.back() above is asynchronous, so this can arrive after the
       visitor has already opened another card. Only close for an entry we
       actually pushed: a modal still loading has pushed === false and must
       survive the late popstate from the previous one. */
    window.addEventListener('popstate', function () {
      if (dialog.open && pushed) { pushed = false; dialog.close(); }
    });
  }

  /* booking form: validate before sending anyone anywhere.
     The inputs carry no name attributes until the real SBE parameter
     names are known (see sbeParams in booking.go), so submitting is a
     plain GET to book_now_url with no query. That fallback holds with
     JavaScript off; this only adds the cross-field check the browser
     cannot do on its own. */
  var bookingForm = doc.querySelector('.booking-form');
  if (bookingForm) {
    var checkIn = bookingForm.querySelector('[data-checkin]');
    var checkOut = bookingForm.querySelector('[data-checkout]');
    var bookingError = bookingForm.querySelector('.booking-error');
    /* Local date, not toISOString(): that returns the UTC day, so in
       Jakarta (UTC+7) the floor would sit a day in the past until 07:00
       local and let someone pick yesterday. */
    var now = new Date();
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    var today = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
    if (checkIn) { checkIn.min = today; }
    if (checkOut) { checkOut.min = today; }

    bookingForm.addEventListener('submit', function (e) {
      var problem = null;
      var focusOn = null;
      if (checkIn && checkIn.value && checkIn.value < today) {
        problem = text.datePast;
        focusOn = checkIn;
      } else if (checkIn && checkOut && checkIn.value && checkOut.value && checkOut.value <= checkIn.value) {
        problem = text.dateOrder;
        focusOn = checkOut;
      }
      if (!problem) {
        bookingError.hidden = true;
        return;
      }
      e.preventDefault();
      bookingError.textContent = problem;
      bookingError.hidden = false;
      if (focusOn) { focusOn.focus(); }
    });
  }

  /* contact form: compose a WhatsApp message and hand it to wa.me.
     The old page did this with an inline script holding a hard-coded
     phone number and Indonesian-only copy. The number now comes from the
     whatsapp_url setting and every label from ui.go, so the Japanese page
     composes a Japanese message. */
  var contactForm = doc.querySelector('.contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var d = contactForm.dataset;
      var value = function (sel) {
        var el = contactForm.querySelector(sel);
        return el ? el.value.trim() : '';
      };
      var body = [
        d.greeting,
        '',
        d.labelName + ': ' + value('[data-name]'),
        d.labelPhone + ': ' + value('[data-phone]'),
        d.labelMessage + ': ' + value('[data-message]')
      ].join('\n');
      /* Set, not append: whatsapp_url may already carry a text parameter,
         and wa.me honours the first one, so concatenating would send the
         setting's canned message instead of what the visitor typed. */
      var url;
      try {
        url = new URL(d.wa, location.href);
        url.searchParams.set('text', body);
        url = url.href;
      } catch (e) {
        url = d.wa + (d.wa.indexOf('?') === -1 ? '?' : '&') + 'text=' + encodeURIComponent(body);
      }
      window.open(url, '_blank', 'noopener');
    });
  }

  /* WhatsApp options popup */
  var waOpen = byId('wa-open');
  var waOverlay = byId('wa-overlay');
  var waClose = byId('wa-close');
  if (waOpen && waOverlay && waClose) {
    var closeWA = function () { waOverlay.removeAttribute('data-open'); waOpen.focus(); };
    waOpen.addEventListener('click', function () { waOverlay.setAttribute('data-open', ''); waClose.focus(); });
    waClose.addEventListener('click', closeWA);
    waOverlay.addEventListener('click', function (e) { if (e.target === waOverlay) { closeWA(); } });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && waOverlay.hasAttribute('data-open')) { closeWA(); } });
  }
}());
