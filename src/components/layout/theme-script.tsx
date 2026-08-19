/**
 * Zet het thema vóór de eerste paint, zodat er geen witte flits is bij
 * dark mode. Draait als blocking inline script in de <head>.
 */
const script = `(function(){try{var s=localStorage.getItem("immoreel-theme");var d=window.matchMedia("(prefers-color-scheme: dark)").matches;if(s==="dark"||(!s&&d)){document.documentElement.classList.add("dark")}}catch(e){}})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
