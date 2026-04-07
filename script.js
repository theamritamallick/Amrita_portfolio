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