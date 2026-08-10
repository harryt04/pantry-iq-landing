// Inlined into <head> so the theme resolves before first paint — no
// flash of the wrong theme. Kept as a plain string (not JSX) so it can
// be embedded via dangerouslySetInnerHTML without a build step reformatting
// it into something that no longer matches what actually runs.
export const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem('pantryiq-theme');
    var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var dark = stored === 'dark' || (stored !== 'light' && systemDark);
    document.documentElement.classList.toggle('dark', dark);
  } catch (e) {}
})();
`
