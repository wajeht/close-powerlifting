import type { FC } from "hono/jsx";

import type { AppState } from "../_layouts/main";

// Runs synchronously before the stylesheet loads so the correct theme
// class is on <html> by the time the browser paints. Reads localStorage
// first, then falls back to the system preference.
const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem('theme');var d=s==='dark'||(!s&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d){document.documentElement.classList.add('dark');}}catch(e){}})();`;

const ANIMATIONS_CSS = `
.fade-in-heading { animation: fadeInDown 0.4s forwards; opacity: 0; }
.fade-in { animation: fadeIn 0.4s forwards; opacity: 0; }
.animation-delay-1 { animation-delay: 50ms; }
.animation-delay-2 { animation-delay: 100ms; }
.animation-delay-3 { animation-delay: 150ms; }
.animation-delay-4 { animation-delay: 200ms; }
.animation-delay-5 { animation-delay: 250ms; }
.animation-delay-6 { animation-delay: 300ms; }
.animation-delay-7 { animation-delay: 350ms; }
.animation-delay-8 { animation-delay: 400ms; }
@keyframes fadeInDown {
  from { opacity: 0; transform: translateY(-20px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
`;

export const Head: FC<{ title?: string; state: AppState }> = ({ title, state }) => (
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <link rel="preconnect" href="https://static.cloudflareinsights.com" crossorigin="anonymous" />
    <link rel="dns-prefetch" href="https://static.cloudflareinsights.com" />
    <link rel="preconnect" href="https://cloudflareinsights.com" crossorigin="anonymous" />
    <link rel="dns-prefetch" href="https://cloudflareinsights.com" />

    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
    />

    <title>{title ? `Close Powerlifting - ${title}` : "Close Powerlifting"}</title>

    <meta name="description" content="An intuitive REST API for the OpenPowerlifting dataset" />
    <meta name="keywords" content="powerlifting, squat, bench, deadlift, open-powerlifting, api" />
    <meta name="author" content="wajeht" />

    <meta property="og:type" content="website" />
    <meta property="og:url" content={`https://${state.domain}`} />
    <meta property="og:title" content="Close Powerlifting" />
    <meta
      property="og:description"
      content="An intuitive REST API for the OpenPowerlifting dataset"
    />
    <meta property="og:image" content={`https://${state.domain}/img/og.png`} />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />

    <meta property="twitter:card" content="summary_large_image" />
    <meta property="twitter:url" content={`https://${state.domain}`} />
    <meta property="twitter:title" content="Close Powerlifting" />
    <meta
      property="twitter:description"
      content="An intuitive REST API for the OpenPowerlifting dataset"
    />
    <meta property="twitter:image" content={`https://${state.domain}/img/og.png`} />

    <link
      rel="icon"
      href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🏋🏻</text></svg>"
    />
    <script>{THEME_INIT_SCRIPT}</script>
    <link rel="stylesheet" href="/css/style.css" />

    <style>{ANIMATIONS_CSS}</style>
  </head>
);
