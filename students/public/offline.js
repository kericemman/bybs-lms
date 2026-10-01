const retryButton = document.querySelector("[data-retry]");

retryButton?.addEventListener("click", () => {
  window.location.reload();
});
window.addEventListener("online", () => {
  window.location.reload();
});
