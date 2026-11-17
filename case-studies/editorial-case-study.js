/**
 * Editorial Case Study Scrollspy & Interactive Features
 * - Smooth section tracking with active TOC indicator
 * - Video viewport playback control
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Table of Contents Scrollspy
  const tocLinks = document.querySelectorAll('.cs-toc-link');
  const sections = document.querySelectorAll('.cs-section[id]');

  if (tocLinks.length && sections.length && window.IntersectionObserver) {
    const observerOptions = {
      root: null,
      rootMargin: '-15% 0px -70% 0px', // Trigger when section is near top of reading viewport
      threshold: 0
    };

    let activeId = null;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          activeId = entry.target.id;
          updateActiveLink(activeId);
        }
      });
    }, observerOptions);

    sections.forEach((section) => observer.observe(section));

    function updateActiveLink(id) {
      if (!id) return;
      tocLinks.forEach((link) => {
        const href = link.getAttribute('href');
        if (href === `#${id}`) {
          link.classList.add('is-active');
        } else {
          link.classList.remove('is-active');
        }
      });
    }

    // Smooth click handler
    tocLinks.forEach((link) => {
      link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        if (href && href.startsWith('#')) {
          e.preventDefault();
          const target = document.querySelector(href);
          if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            updateActiveLink(href.substring(1));
          }
        }
      });
    });
  }

  // 2. Video Viewport Playback Optimization
  const videos = document.querySelectorAll('.cs-media-card video');
  if (videos.length && window.IntersectionObserver) {
    const videoObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const video = entry.target;
        if (entry.isIntersecting) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      });
    }, { threshold: 0.1 });

    videos.forEach((v) => videoObserver.observe(v));
  }
});

