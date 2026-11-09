console.log("JS loaded");
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
      const increment = (target - count) * 0.1;

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

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {

    if (entry.isIntersecting) {

      // Reveal animation
      if (entry.target.classList.contains("reveal")) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }

      // Metrics section animation
      if (entry.target.classList.contains("metrics-row") && !hasAnimated) {

        const items = entry.target.querySelectorAll('.metrics');

        items.forEach((item, index) => {
          setTimeout(() => {
            item.classList.add('visible');
          }, index * 150);
        });

        animateCounters();
        hasAnimated = true;
      }

    }

  });
}, {
  threshold: 0.18,
});
// Observe reveal elements
document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));

// Observe metrics section
const metricsSection = document.querySelector(".metrics-row");
if (metricsSection) observer.observe(metricsSection);
console.log("metrics found:", document.querySelector(".metrics-row"));

const steps = document.querySelectorAll('.flow-step');
const images = document.querySelectorAll('.flow-image');

const flowObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const steps = document.querySelectorAll('.flow-step');
        const images = document.querySelectorAll('.flow-image');

        const index = [...steps].indexOf(entry.target);

        images.forEach(img => img.classList.remove('active'));

        if (images[index]) {
          images[index].classList.add('active');
        }
      }
    });
  },
  { threshold: 0.5 }
);

document.querySelectorAll('.flow-step').forEach(step => {
  flowObserver.observe(step);
});

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
