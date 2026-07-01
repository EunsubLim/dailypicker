const SITE_CONFIG = {
  smartStoreUrl: "YOUR_SMARTSTORE_URL",
};

window.adsbygoogle = window.adsbygoogle || [];
document.querySelectorAll(".adsbygoogle").forEach(() => {
  try {
    window.adsbygoogle.push({});
  } catch (error) {
    console.warn("AdSense ad could not be initialized yet.", error);
  }
});

document.querySelectorAll("[data-store-link]").forEach((link) => {
  link.href = SITE_CONFIG.smartStoreUrl;
  link.target = "_blank";
  link.rel = "noopener sponsored";
});

if (SITE_CONFIG.smartStoreUrl === "YOUR_SMARTSTORE_URL") {
  document.querySelectorAll("[data-store-link]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      alert("script.js 파일에서 YOUR_SMARTSTORE_URL을 실제 스마트스토어 주소로 바꿔주세요.");
    });
  });
}
