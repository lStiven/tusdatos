// Applies the saved theme before the first paint, so dark mode never flashes
// light. A file and not an inline script: the CSP only allows 'self'. Keep in
// sync with src/lib/theme.ts (same storage key and classes).
;(function () {
  try {
    var saved = localStorage.getItem('theme')
    var dark =
      saved === 'dark' ||
      (saved !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches)
    var root = document.documentElement
    root.classList.add(dark ? 'dark' : 'light')
    root.style.colorScheme = dark ? 'dark' : 'light'
  } catch {
    // Storage blocked: the app applies the system theme when it starts.
  }
})()
