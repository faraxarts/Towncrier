document.addEventListener("DOMContentLoaded", function () {
  const logoutButtons = document.querySelectorAll(".admin-logout-btn");

  async function handleLogout() {
    try {
      const response = await fetch("/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.message || "Logout failed.");
        return;
      }

      window.location.href = "/";
    } catch (error) {
      console.error("Logout error:", error);
      alert("Something went wrong while logging out.");
    }
  }

  logoutButtons.forEach((button) => {
    button.addEventListener("click", handleLogout);
  });
});
