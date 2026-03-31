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