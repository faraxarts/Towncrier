const slides = Array.from(document.querySelectorAll(".hero-slide"));
const dots = Array.from(document.querySelectorAll(".hero-dot"));
let current = 0;
let heroTimer = null;

function showSlide(index) {
  slides.forEach((slide, slideIndex) => {
    slide.classList.toggle("opacity-100", slideIndex === index);
    slide.classList.toggle("opacity-0", slideIndex !== index);
  });

  dots.forEach((dot, dotIndex) => {
    dot.classList.toggle("is-active", dotIndex === index);
  });

  current = index;
}

function nextSlide() {
  showSlide((current + 1) % slides.length);
}

function startHeroRotation() {
  if (!slides.length) return;
  heroTimer = setInterval(nextSlide, 5500);
}

function resetHeroRotation() {
  if (heroTimer) {
    clearInterval(heroTimer);
  }
  startHeroRotation();
}

if (slides.length) {
  dots.forEach((dot, index) => {
    dot.addEventListener("click", () => {
      showSlide(index);
      resetHeroRotation();
    });
  });

  showSlide(0);
  startHeroRotation();
}
