// Set footer year
const yearSpan = document.getElementById("year");
if (yearSpan) {
  yearSpan.textContent = new Date().getFullYear().toString();
}

// Counter function
const counters = document.querySelectorAll('.count');

const animateCounters = () => {
  counters.forEach(counter => {
    const target = +counter.getAttribute('data-target');
    let count = 0;

    const update = () => {
      const increment = target / 50;

      if (count < target) {
        count += increment;
        counter.innerText = Math.ceil(count);
        requestAnimationFrame(update);
      } else {
        counter.innerText = target;
      }
    };

    update();
  });
};

// ONE observer for everything
let hasAnimated = false;
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {

      if (entry.isIntersecting) {

        // Reveal animation
        if (entry.target.classList.contains("reveal")) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }

        // Metrics animation
        if (entry.target.classList.contains("metrics-row") && !hasAnimated) {
          animateCounters();
          hasAnimated = true;
        }

      }

    });
  },
  {
    threshold: 0.18,
  }
);

// Observe reveal elements
document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));

// Observe metrics section
const metrics = document.querySelector(".metrics-row");
if (metrics) observer.observe(metrics);

// Selected work stepper sync + jump navigation
const stepperItems = Array.from(document.querySelectorAll(".stepper-item[data-target]"));
const caseCards = Array.from(document.querySelectorAll(".selected-work-card[id]"));

if (stepperItems.length && caseCards.length) {
  const setActiveStep = (activeId) => {
    stepperItems.forEach((item) => {
      const isActive = item.dataset.target === activeId;
      item.classList.toggle("is-active", isActive);
      item.setAttribute("aria-current", isActive ? "true" : "false");
    });
  };

  stepperItems.forEach((item) => {
    item.addEventListener("click", () => {
      const targetId = item.dataset.target;
      const targetCard = document.getElementById(targetId);
      if (!targetCard) return;

      setActiveStep(targetId);
      targetCard.scrollIntoView({ behavior: "auto", block: "start" });
    });
  });

  const caseObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

      if (visible.length) {
        setActiveStep(visible[0].target.id);
      }
    },
    {
      threshold: [0.25, 0.4, 0.6],
      rootMargin: "-18% 0px -45% 0px",
    }
  );

  caseCards.forEach((card) => caseObserver.observe(card));
  setActiveStep(caseCards[0].id);
}

// Mobile Menu Toggle
const mobileMenuBtn = document.querySelector('.mobile-menu-toggle');
const navLinksGroup = document.querySelector('.nav-links');

if (mobileMenuBtn && navLinksGroup) {
  mobileMenuBtn.addEventListener('click', (e) => {
    navLinksGroup.classList.toggle('active');
  });
  
  // Close menu when a link is clicked (e.g. Home, Projects, etc.)
  const links = navLinksGroup.querySelectorAll('.nav-link');
  links.forEach(link => {
    link.addEventListener('click', () => {
      navLinksGroup.classList.remove('active');
    });
  });
}

// 3D Starfield Background Animation
const starCanvas = document.getElementById('starfield');
if (starCanvas) {
  const ctx = starCanvas.getContext('2d');
  let w, h;
  let stars = [];
  const numStars = 1200; 
  const speed = 1.5; 

  const resize = () => {
    w = starCanvas.parentElement.offsetWidth;
    h = starCanvas.parentElement.offsetHeight;
    starCanvas.width = w;
    starCanvas.height = h;
  };

  const initStars = () => {
    stars = [];
    for (let i = 0; i < numStars; i++) {
      stars.push({
        x: Math.random() * 2000 - 1000,
        y: Math.random() * 2000 - 1000,
        z: Math.random() * 2000,
        radius: Math.random() * 1.5 + 0.5
      });
    }
  };

  const drawStars = () => {
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h / 2;

    stars.forEach(star => {
      star.z -= speed;
      if (star.z <= 0) {
        star.z = 2000;
        star.x = Math.random() * 2000 - 1000;
        star.y = Math.random() * 2000 - 1000;
      }

      const px = cx + (star.x * 400) / star.z;
      const py = cy + (star.y * 400) / star.z;
      
      const scale = 2000 / star.z;
      const size = star.radius * scale * 0.15;
      const opacity = Math.min(1, 1 - (star.z / 2000));

      if (px > 0 && px < w && py > 0 && py < h) {
        ctx.beginPath();
        ctx.fillStyle = `rgba(10, 15, 30, ${opacity})`;
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    requestAnimationFrame(drawStars);
  };

  window.addEventListener('resize', resize);
  resize();
  initStars();
  drawStars();
}

// Contact Modal Handling
const contactModal = document.getElementById("contactModal");
const contactCloseBtn = document.getElementById("contactModalClose");
const contactTriggers = document.querySelectorAll(".contact-trigger, [href='#contact']");

function openContactModal(e) {
  if (e) e.preventDefault();
  if (!contactModal) return;
  contactModal.classList.add("active");
  contactModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";

  // Close mobile nav menu if open
  if (typeof navLinksGroup !== 'undefined' && navLinksGroup && navLinksGroup.classList.contains("active")) {
    navLinksGroup.classList.remove("active");
  }
}

function closeContactModal() {
  if (!contactModal) return;
  contactModal.classList.remove("active");
  contactModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

contactTriggers.forEach((trigger) => {
  trigger.addEventListener("click", openContactModal);
});

if (contactCloseBtn) {
  contactCloseBtn.addEventListener("click", closeContactModal);
}

if (contactModal) {
  contactModal.addEventListener("click", (e) => {
    if (e.target === contactModal) {
      closeContactModal();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && contactModal.classList.contains("active")) {
      closeContactModal();
    }
  });
}

// Copy to clipboard handling
document.querySelectorAll(".contact-copy-btn").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const textToCopy = btn.getAttribute("data-copy");
    if (!textToCopy) return;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = textToCopy;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      const textSpan = btn.querySelector(".copy-text");
      const originalText = textSpan ? textSpan.textContent : "Copy";
      btn.classList.add("copied");
      if (textSpan) textSpan.textContent = "Copied! ✓";

      setTimeout(() => {
        btn.classList.remove("copied");
        if (textSpan) textSpan.textContent = originalText;
      }, 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  });
});

// Dynamic Project Hover Details in Sidebar Bottom (Mayank Kinger inspired)
(function initProjectHoverPreview() {
  const projectCards = document.querySelectorAll(".feed-project-card[data-preview-desc]");
  const sidebarLinks = document.getElementById("sidebarLinksList");
  const sidebarPreview = document.getElementById("sidebarProjectPreview");
  const previewDesc = document.getElementById("previewDescription");
  const previewTitle = document.getElementById("previewTitle");
  const previewTag = document.getElementById("previewTag");

  if (!projectCards.length || !sidebarLinks || !sidebarPreview) return;

  projectCards.forEach((card) => {
    card.addEventListener("mouseenter", () => {
      const desc = card.getAttribute("data-preview-desc");
      const title = card.getAttribute("data-preview-title");
      const tag = card.getAttribute("data-preview-tag");

      if (desc && title && tag) {
        if (previewDesc) previewDesc.textContent = desc;
        if (previewTitle) previewTitle.textContent = title;
        if (previewTag) previewTag.textContent = tag;

        sidebarLinks.classList.add("is-hidden");
        sidebarPreview.classList.add("is-active");
      }
    });

    card.addEventListener("mouseleave", () => {
      sidebarLinks.classList.remove("is-hidden");
      sidebarPreview.classList.remove("is-active");
    });
  });
})();

// Initialize Lottie Animated Desktop Mockup (Scene-2-FD from Jitter)
(function initLottieMockups() {
  function setupLottie(elemId, jsonPath) {
    const container = document.getElementById(elemId);
    if (!container) return;

    function start() {
      if (typeof lottie === 'undefined') {
        setTimeout(start, 60);
        return;
      }
      try {
        const anim = lottie.loadAnimation({
          container: container,
          renderer: 'svg',
          loop: true,
          autoplay: true,
          path: jsonPath,
          rendererSettings: {
            preserveAspectRatio: 'xMidYMid slice',
            progressiveLoad: true
          }
        });

        anim.addEventListener('DOMLoaded', () => {
          const fallbackImg = container.querySelector('img');
          if (fallbackImg) fallbackImg.style.display = 'none';
        });

        anim.addEventListener('data_failed', () => {
          console.warn('Lottie data failed to load for ' + elemId);
        });
      } catch (err) {
        console.warn('Lottie error for ' + elemId + ':', err);
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start);
    } else {
      start();
    }
  }

  // Homepage card
  setupLottie('lottie-icici-cib', 'assets/videos/Scene-2-FD.json');
  // Case study hero
  setupLottie('lottie-cib-hero', '../../assets/videos/Scene-2-FD.json');
})();
