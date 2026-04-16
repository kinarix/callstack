/* CALLSTACK — Website JS */

(function () {
  'use strict';

  /* ── Theme ───────────────────────────────────────────────── */
  const THEME_KEY = 'callstack-theme';
  const ICONS = { dark: '☀️', light: '🌙' };

  function getTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = ICONS[theme] || '🌙';
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  }

  /* ── Copy to clipboard ───────────────────────────────────── */
  function copyText(text, btn) {
    navigator.clipboard.writeText(text).then(() => {
      const original = btn.textContent;
      btn.textContent = 'Copied!';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = original;
        btn.classList.remove('copied');
      }, 2000);
    }).catch(() => {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    });
  }

  function initCopyButtons() {
    document.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const block = btn.closest('.code-block');
        const pre = block ? block.querySelector('pre') : null;
        const text = pre ? pre.textContent.trim() : '';
        copyText(text, btn);
      });
    });
  }

  /* ── Install tabs ────────────────────────────────────────── */
  function initInstallTabs() {
    const tabs = document.querySelectorAll('.install-tab');
    const panels = document.querySelectorAll('.install-panel');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        const target = document.getElementById('panel-' + tab.dataset.tab);
        if (target) target.classList.add('active');
      });
    });
  }

  /* ── TOC generation (docs page) ─────────────────────────── */
  function generateTOC() {
    const tocList = document.getElementById('toc-list');
    if (!tocList) return;

    const sections = document.querySelectorAll('.docs-section[id]');
    if (!sections.length) return;

    sections.forEach(section => {
      const heading = section.querySelector('.docs-h2');
      if (!heading) return;

      const text = heading.textContent.replace(/^\d+\s*/, '').trim();
      const id = section.id;

      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = '#' + id;
      a.textContent = text;
      li.appendChild(a);
      tocList.appendChild(li);
    });

    /* Mobile select */
    const mobileSelect = document.getElementById('toc-mobile-select');
    if (mobileSelect) {
      sections.forEach(section => {
        const heading = section.querySelector('.docs-h2');
        if (!heading) return;
        const text = heading.textContent.replace(/^\d+\s*/, '').trim();
        const opt = document.createElement('option');
        opt.value = '#' + section.id;
        opt.textContent = text;
        mobileSelect.appendChild(opt);
      });

      mobileSelect.addEventListener('change', () => {
        const target = document.querySelector(mobileSelect.value);
        if (target) target.scrollIntoView({ behavior: 'smooth' });
        mobileSelect.value = '';
      });
    }
  }

  /* ── Scroll spy ──────────────────────────────────────────── */
  function initScrollSpy() {
    const tocLinks = document.querySelectorAll('#toc-list a');
    if (!tocLinks.length) return;

    const sections = Array.from(document.querySelectorAll('.docs-section[id]'));

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          tocLinks.forEach(link => link.classList.remove('active'));
          const active = document.querySelector(`#toc-list a[href="#${entry.target.id}"]`);
          if (active) {
            active.classList.add('active');
            active.scrollIntoView({ block: 'nearest' });
          }
        }
      });
    }, {
      rootMargin: '-60px 0px -60% 0px',
      threshold: 0
    });

    sections.forEach(s => observer.observe(s));
  }

  /* ── Smooth scroll for all hash links ─────────────────────── */
  function initSmoothScroll() {
    document.addEventListener('click', e => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const target = document.querySelector(a.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth' });
    });
  }

  /* ── Init ────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    // Theme
    applyTheme(getTheme());
    const toggleBtn = document.getElementById('theme-toggle');
    if (toggleBtn) toggleBtn.addEventListener('click', toggleTheme);

    // Copy buttons
    initCopyButtons();

    // Install tabs
    initInstallTabs();

    // Docs
    generateTOC();
    initScrollSpy();
    initSmoothScroll();
  });

})();
