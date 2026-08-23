import type { NextConfig } from "next";

/**
 * Koppen die op elk antwoord horen te staan.
 *
 * Geen van de drie vervangt een controle verderop — ze maken de gevolgen kleiner
 * wanneer er ergens toch iets doorheen glipt. `nosniff` is de belangrijkste:
 * zonder die kop mag de browser zelf raden wat een bestand is, en dan is het
 * `Content-Type` dat `/api/assets/:id` zorgvuldig kiest alsnog een suggestie.
 *
 * Een Content-Security-Policy staat er bewust nog niet bij. Die is het waard,
 * maar Next heeft er een nonce-opzet voor nodig en een CSP die half klopt geeft
 * vooral een vals gevoel van veiligheid; dat hoort een eigen wijziging te zijn
 * met een eigen test.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Geen enkel scherm van Immoreel hoort in een frame van iemand anders.
  { key: "X-Frame-Options", value: "DENY" },
  // Een project-id hoort niet in de logs van een site waar iemand heen klikt.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Media (foto's van panden, rendered video's) komt later van een externe
  // storage-bucket. Voeg hier de hostnames toe zodra die bekend zijn.
  images: {
    remotePatterns: [],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
