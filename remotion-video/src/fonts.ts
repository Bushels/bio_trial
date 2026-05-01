let loaded = false;

export function loadFonts() {
  if (loaded) return;
  if (typeof document === "undefined") return;
  loaded = true;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=Caveat:wght@400;600;700&family=Permanent+Marker&family=Special+Elite&family=Cutive+Mono&family=Inter:wght@400;500;600;700&family=Kalam:wght@400;700&display=swap";
  document.head.appendChild(link);
}
