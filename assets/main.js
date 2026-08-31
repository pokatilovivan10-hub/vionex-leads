/* ============================================================
   VIONEX LEADS — клиентская логика
   ============================================================ */
(function () {
  'use strict';

  /* ---------- Конфигурация ----------
     Подключение приёмщика заявок: задайте endpoint (CRM / Telegram-бот / webhook).
     Пример: window.VIONEX_FORM_ENDPOINT = 'https://your-crm.ru/api/leads';
     Пока endpoint не задан, формы работают в демо-режиме: заявка сохраняется
     в localStorage браузера и показывается сообщение об успехе. */
  var FORM_ENDPOINT = window.VIONEX_FORM_ENDPOINT || null;
  var MIN_FILL_TIME = 2500;      // мс — антиспам по времени заполнения
  var RESUBMIT_DELAY = 15000;    // мс — защита от повторной отправки

  /* ---------- Аналитика: цели на формы и кнопки ---------- */
  window.dataLayer = window.dataLayer || [];
  function trackGoal(name, params) {
    var payload = Object.assign({ event: 'vnx_goal', goal: name }, params || {});
    window.dataLayer.push(payload);
    if (typeof window.ym === 'function' && window.VIONEX_YM_ID) {
      try { window.ym(window.VIONEX_YM_ID, 'reachGoal', name, params || {}); } catch (e) {}
    }
    if (typeof window.gtag === 'function') {
      try { window.gtag('event', name, params || {}); } catch (e) {}
    }
  }

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-goal]');
    if (el) trackGoal(el.getAttribute('data-goal'), { type: 'click' });
  });

  /* ---------- UTM-метки: захват и хранение ---------- */
  var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  function captureUtm() {
    try {
      var q = new URLSearchParams(window.location.search);
      var stored = JSON.parse(localStorage.getItem('vnx_utm') || '{}');
      var changed = false;
      UTM_KEYS.forEach(function (k) {
        var v = q.get(k);
        if (v) { stored[k] = v; changed = true; }
      });
      if (q.get('gclid')) { stored.gclid = q.get('gclid'); changed = true; }
      if (q.get('yclid')) { stored.yclid = q.get('yclid'); changed = true; }
      if (changed) localStorage.setItem('vnx_utm', JSON.stringify(stored));
      return stored;
    } catch (e) { return {}; }
  }
  var utmData = captureUtm();

  /* ---------- Шапка: состояние при прокрутке ---------- */
  var header = document.getElementById('header');
  function onScrollHeader() {
    header.classList.toggle('scrolled', window.scrollY > 24);
  }
  window.addEventListener('scroll', onScrollHeader, { passive: true });
  onScrollHeader();

  /* ---------- Мобильное меню ---------- */
  var burger = document.getElementById('burger');
  var mobileMenu = document.getElementById('mobileMenu');
  function toggleMenu(force) {
    var open = typeof force === 'boolean' ? force : !mobileMenu.classList.contains('open');
    mobileMenu.classList.toggle('open', open);
    burger.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    mobileMenu.setAttribute('aria-hidden', String(!open));
    document.body.classList.toggle('modal-open', open);
  }
  burger.addEventListener('click', function () { toggleMenu(); trackGoal('menu_toggle'); });
  mobileMenu.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function () { toggleMenu(false); });
  });

  /* ---------- Плавное появление секций ---------- */
  var revealObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  document.querySelectorAll('.reveal').forEach(function (el) { revealObserver.observe(el); });

  /* ---------- Анимация чисел в кейсах ---------- */
  function animateCount(el) {
    var target = parseInt(el.getAttribute('data-count'), 10);
    var suffix = el.getAttribute('data-suffix') || '';
    if (isNaN(target)) return;
    var dur = 1300, t0 = null;
    function tick(ts) {
      if (!t0) t0 = ts;
      var p = Math.min((ts - t0) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  var countObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.querySelectorAll('[data-count]').forEach(animateCount);
      countObserver.unobserve(entry.target);
    });
  }, { threshold: 0.3 });
  document.querySelectorAll('.kcase').forEach(function (el) { countObserver.observe(el); });

  /* ---------- Воронка в кейсах ---------- */
  var funnelObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        funnelObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.4 });
  document.querySelectorAll('[data-funnel]').forEach(function (el) { funnelObserver.observe(el); });

  /* ---------- Подсветка активного пункта навигации ---------- */
  var spySections = ['cases', 'products', 'ai', 'directions', 'about', 'process', 'faq'];
  var navLinks = document.querySelectorAll('.nav a');
  var spyObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      var id = entry.target.id;
      navLinks.forEach(function (a) {
        a.classList.toggle('active', a.getAttribute('href') === '#' + id);
      });
    });
  }, { rootMargin: '-40% 0px -55% 0px' });
  spySections.forEach(function (id) {
    var s = document.getElementById(id);
    if (s) spyObserver.observe(s);
  });

  /* ---------- Подсветка карточек за курсором ---------- */
  document.querySelectorAll('.card').forEach(function (card) {
    card.addEventListener('mousemove', function (e) {
      var r = card.getBoundingClientRect();
      card.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
      card.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
    });
  });

  /* ---------- FAQ-аккордеон ---------- */
  document.querySelectorAll('.faq-item').forEach(function (item) {
    var btn = item.querySelector('.faq-item__q');
    var body = item.querySelector('.faq-item__a');
    btn.addEventListener('click', function () {
      var open = item.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(open));
      body.style.maxHeight = open ? body.scrollHeight + 'px' : '0px';
      if (open) trackGoal('faq_open', { question: btn.textContent.trim().slice(0, 80) });
    });
  });
  window.addEventListener('resize', function () {
    document.querySelectorAll('.faq-item.open .faq-item__a').forEach(function (b) {
      b.style.maxHeight = b.scrollHeight + 'px';
    });
  });

  /* ---------- Модальные окна ---------- */
  var modalLead = document.getElementById('modalLead');
  var modalLegal = document.getElementById('modalLegal');
  var modalProduct = document.getElementById('modalProduct');
  var modalLeadTitle = document.getElementById('modalLeadTitle');
  var modalLeadSub = document.getElementById('modalLeadSub');
  var legalTitle = document.getElementById('modalLegalTitle');
  var legalBody = document.getElementById('modalLegalBody');
  var lastFocus = null;

  var LEGAL_DOCS = {
    policy: { title: 'Политика обработки персональных данных', tpl: 'doc-policy' },
    consentDoc: { title: 'Согласие на обработку персональных данных', tpl: 'doc-consent' },
    cookiesDoc: { title: 'Информация о cookies', tpl: 'doc-cookies' }
  };

  function openModal(modal) {
    lastFocus = document.activeElement;
    modal.classList.add('open');
    document.body.classList.add('modal-open');
    var focusable = modal.querySelector('input:not([type=hidden]), button, select, textarea');
    if (focusable) setTimeout(function () { focusable.focus(); }, 80);
  }
  function closeModal(modal) {
    modal.classList.remove('open');
    if (!document.querySelector('.modal.open') && !mobileMenu.classList.contains('open')) {
      document.body.classList.remove('modal-open');
    }
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function closeAllModals() {
    document.querySelectorAll('.modal.open').forEach(closeModal);
  }

  document.querySelectorAll('[data-modal-open]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      var kind = btn.getAttribute('data-modal-open');
      if (kind === 'lead') {
        var product = btn.getAttribute('data-product');
        modalProduct.value = product || '';
        modalLeadTitle.textContent = product ? 'Узнать условия' : 'Получить лиды';
        modalLeadSub.textContent = product
          ? 'Продукт: «' + product + '». Оставьте контакты — подготовим условия и расчёт пилотного объёма.'
          : 'Оставьте контакты — расскажем об условиях и подготовим расчёт пилотного запуска.';
        openModal(modalLead);
        trackGoal('modal_open', { source: btn.getAttribute('data-goal') || 'unknown', product: product || '' });
      } else if (kind === 'caseDetail') {
        openModal(document.getElementById('modalCase'));
        trackGoal('case_detail_open', { source: btn.getAttribute('data-goal') || 'unknown' });
      } else if (kind === 'caseWip') {
        openModal(document.getElementById('modalCaseWip'));
      } else if (LEGAL_DOCS[kind]) {
        var doc = LEGAL_DOCS[kind];
        legalTitle.textContent = doc.title;
        legalBody.innerHTML = '';
        legalBody.appendChild(document.getElementById(doc.tpl).content.cloneNode(true));
        openModal(modalLegal);
      }
      toggleMenu(false);
    });
  });

  document.querySelectorAll('.modal').forEach(function (modal) {
    modal.addEventListener('click', function (e) {
      if (e.target === modal || e.target.closest('[data-modal-close]')) closeModal(modal);
    });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeAllModals(); toggleMenu(false); }
  });

  /* ---------- Маска телефона +7 (XXX) XXX-XX-XX ---------- */
  function normalizeRuPhone(value) {
    var d = value.replace(/\D/g, '');
    // отделяем код страны: 7 или 8 в начале (включая дублирование при вставке в поле с префиксом)
    if (d[0] === '7' || d[0] === '8') d = d.slice(1);
    if (d.length > 10 && (d[0] === '7' || d[0] === '8')) d = d.slice(1);
    return d.slice(0, 10);
  }
  function maskPhone(input) {
    input.addEventListener('input', function () {
      var d = normalizeRuPhone(input.value);
      if (!d && !input.value) { input.value = ''; return; }
      var out = '+7 (';
      if (d.length > 0) out = '+7 (' + d.slice(0, 3);
      if (d.length >= 3) out += ')';
      if (d.length > 3) out += ' ' + d.slice(3, 6);
      if (d.length > 6) out += '-' + d.slice(6, 8);
      if (d.length > 8) out += '-' + d.slice(8, 10);
      input.value = out;
    });
    input.addEventListener('focus', function () {
      if (!input.value) input.value = '+7 (';
    });
    input.addEventListener('blur', function () {
      if (normalizeRuPhone(input.value).length === 0) input.value = '';
    });
  }
  document.querySelectorAll('[data-phone]').forEach(maskPhone);

  /* ---------- Toast ---------- */
  var toast = document.getElementById('toast');
  var toastTimer = null;
  function showToast(text) {
    toast.textContent = text;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 4200);
  }

  /* ---------- Формы: валидация, антиспам, отправка ---------- */
  function setError(field, on) {
    var wrap = field.closest('.field, .consent');
    if (wrap) wrap.classList.toggle('error', !!on);
  }

  function validateForm(form) {
    var ok = true;
    form.querySelectorAll('[required]').forEach(function (field) {
      var valid = true;
      if (field.type === 'checkbox') {
        valid = field.checked;
      } else if (field.tagName === 'SELECT') {
        valid = !!field.value;
      } else if (field.name === 'phone') {
        valid = normalizeRuPhone(field.value).length === 10;
      } else {
        valid = field.value.trim().length >= 2;
      }
      setError(field, !valid);
      if (!valid) ok = false;
    });
    return ok;
  }

  function collectPayload(form) {
    var data = {};
    new FormData(form).forEach(function (v, k) {
      if (k !== 'website') data[k] = typeof v === 'string' ? v.trim() : v;
    });
    data.form = form.getAttribute('data-form-name') || 'form';
    data.page = window.location.href;
    data.utm = utmData;
    data.ts = new Date().toISOString();
    return data;
  }

  function sendLead(payload) {
    if (!FORM_ENDPOINT) {
      // Демо-режим: endpoint не подключён — сохраняем заявку локально
      try {
        var stash = JSON.parse(localStorage.getItem('vnx_leads') || '[]');
        stash.push(payload);
        localStorage.setItem('vnx_leads', JSON.stringify(stash));
      } catch (e) {}
      return Promise.resolve({ demo: true });
    }
    return fetch(FORM_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json().catch(function () { return {}; });
    });
  }

  document.querySelectorAll('form.lead-form').forEach(function (form) {
    var openedAt = Date.now();
    var lastSubmit = 0;
    var goal = form.getAttribute('data-goal') || 'form';

    form.addEventListener('input', function (e) {
      if (e.target.closest('.field, .consent')) setError(e.target, false);
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      // Антиспам: honeypot
      var hp = form.querySelector('input[name="website"]');
      if (hp && hp.value) return;
      // Антиспам: слишком быстрая отправка
      if (Date.now() - openedAt < MIN_FILL_TIME) return;
      // Антиспам: частые повторные отправки
      if (Date.now() - lastSubmit < RESUBMIT_DELAY) {
        showToast('Заявка уже отправлена. Мы свяжемся с вами в рабочее время.');
        return;
      }

      trackGoal(goal + '_attempt');

      if (!validateForm(form)) {
        showToast('Проверьте выделенные поля формы.');
        trackGoal(goal + '_error');
        return;
      }

      var btn = form.querySelector('button[type="submit"]');
      var btnText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = 'Отправляем…';

      var payload = collectPayload(form);
      lastSubmit = Date.now();

      sendLead(payload)
        .then(function () {
          trackGoal(goal + '_success');
          trackGoal('formwin');
          var wrap = form.closest('.form-wrap');
          if (wrap) {
            wrap.classList.add('sent');
            var success = wrap.querySelector('.form__success');
            if (success) success.classList.add('show');
          }
          form.reset();
        })
        .catch(function () {
          trackGoal(goal + '_fail');
          showToast('Не удалось отправить заявку. Попробуйте ещё раз или напишите нам в Telegram.');
        })
        .finally(function () {
          btn.disabled = false;
          btn.innerHTML = btnText;
        });
    });
  });

  /* ---------- Cookie-уведомление ---------- */
  var cookieBanner = document.getElementById('cookieBanner');
  var cookieState = null;
  try { cookieState = localStorage.getItem('vnx_cookie'); } catch (e) {}
  if (!cookieState) {
    setTimeout(function () { cookieBanner.classList.add('show'); }, 1400);
  }
  function setCookie(state) {
    try { localStorage.setItem('vnx_cookie', state); } catch (e) {}
    cookieBanner.classList.remove('show');
    trackGoal('cookie_' + state);
  }
  document.getElementById('cookieAccept').addEventListener('click', function () { setCookie('accepted'); });
  document.getElementById('cookieClose').addEventListener('click', function () { setCookie('closed'); });

  /* ---------- Текущий год в подвале ---------- */
  document.getElementById('year').textContent = String(new Date().getFullYear());
})();
