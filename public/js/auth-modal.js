document.addEventListener("DOMContentLoaded", function () {
  const modal = document.getElementById("auth-modal");
  const panel = document.getElementById("auth-modal-panel");
  const closeBtn = document.getElementById("auth-modal-close");
  const feedback = document.getElementById("auth-feedback");

  const loginView = document.getElementById("login-view");
  const registerView = document.getElementById("register-view");

  const switchToRegister = document.getElementById("switch-to-register");
  const switchToLogin = document.getElementById("switch-to-login");

  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");

  const loginAcademySlug = document.getElementById("login-academy-slug");
  const registerAcademySlug = document.getElementById("register-academy-slug");
  const loginRedirectInput = document.getElementById("login-redirect-after-auth");
  const registerRedirectInput = document.getElementById("register-redirect-after-auth");

  const loginSubmitBtn = document.getElementById("login-submit-btn");
  const registerSubmitBtn = document.getElementById("register-submit-btn");

  const triggerButtons = document.querySelectorAll(".open-auth-modal");

  if (!modal) return;

  let currentAcademySlug = "";
  let currentRedirectAfterAuth = window.location.pathname || "/";

  function lockBody() {
    document.body.classList.add("overflow-hidden");
  }

  function unlockBody() {
    document.body.classList.remove("overflow-hidden");
  }

  function showFeedback(message, type = "error") {
    if (!feedback) return;

    feedback.textContent = message;
    feedback.classList.remove("hidden", "border-red-200", "bg-red-50", "text-red-700", "border-green-200", "bg-green-50", "text-green-700");

    if (type === "success") {
      feedback.classList.add("border-green-200", "bg-green-50", "text-green-700");
    } else {
      feedback.classList.add("border-red-200", "bg-red-50", "text-red-700");
    }
  }

  function clearFeedback() {
    if (!feedback) return;
    feedback.textContent = "";
    feedback.classList.add("hidden");
    feedback.classList.remove("border-red-200", "bg-red-50", "text-red-700", "border-green-200", "bg-green-50", "text-green-700");
  }

  function syncFormContext() {
    if (loginAcademySlug) loginAcademySlug.value = currentAcademySlug;
    if (registerAcademySlug) registerAcademySlug.value = currentAcademySlug;
    if (loginRedirectInput) loginRedirectInput.value = currentRedirectAfterAuth;
    if (registerRedirectInput) registerRedirectInput.value = currentRedirectAfterAuth;
  }

  function showLoginMode() {
    clearFeedback();
    loginView.classList.remove("hidden");
    registerView.classList.add("hidden");
  }

  function showRegisterMode() {
    clearFeedback();
    loginView.classList.add("hidden");
    registerView.classList.remove("hidden");
  }

  function openModal(mode = "login", academySlug = "", redirectAfterAuth = "/") {
    currentAcademySlug = academySlug || "";
    currentRedirectAfterAuth = redirectAfterAuth || "/";
    syncFormContext();

    modal.classList.remove("hidden");
    modal.classList.add("flex");
    lockBody();

    if (mode === "register") {
      showRegisterMode();
    } else {
      showLoginMode();
    }
  }

  function closeModal() {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    unlockBody();
    clearFeedback();

    if (loginForm) loginForm.reset();
    if (registerForm) registerForm.reset();

    syncFormContext();
  }

  async function submitAuthForm(url, form, submitButton, defaultText) {
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    clearFeedback();
    submitButton.disabled = true;
    submitButton.textContent = "Please wait...";

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        showFeedback(data.message || "Something went wrong.");
        submitButton.disabled = false;
        submitButton.textContent = defaultText;
        return;
      }

      showFeedback(data.message || "Success", "success");

      const redirectTo = data.redirectTo || payload.redirectAfterAuth || "/";
      window.location.href = redirectTo;
    } catch (error) {
      console.error("Auth form error:", error);
      showFeedback("Something went wrong. Please try again.");
      submitButton.disabled = false;
      submitButton.textContent = defaultText;
    }
  }

  triggerButtons.forEach((button) => {
    button.addEventListener("click", function (event) {
      event.preventDefault();

      const mode = this.dataset.modalMode || "login";
      const academySlug = this.dataset.academySlug || "";
      const redirectAfterAuth = this.dataset.redirectAfterAuth || window.location.pathname || "/";

      openModal(mode, academySlug, redirectAfterAuth);
    });
  });

  if (closeBtn) {
    closeBtn.addEventListener("click", closeModal);
  }

  if (switchToRegister) {
    switchToRegister.addEventListener("click", function () {
      showRegisterMode();
    });
  }

  if (switchToLogin) {
    switchToLogin.addEventListener("click", function () {
      showLoginMode();
    });
  }

  modal.addEventListener("click", function (event) {
    if (!panel.contains(event.target)) {
      closeModal();
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !modal.classList.contains("hidden")) {
      closeModal();
    }
  });

  if (loginForm) {
    loginForm.addEventListener("submit", function (event) {
      event.preventDefault();
      syncFormContext();
      submitAuthForm("/auth/login", loginForm, loginSubmitBtn, "Sign In");
    });
  }

  if (registerForm) {
    registerForm.addEventListener("submit", function (event) {
      event.preventDefault();
      syncFormContext();
      submitAuthForm("/auth/signup", registerForm, registerSubmitBtn, "Register");
    });
  }
});