const configuredApiUrl = (window.AMADEE_API_URL || "https://amadee-backend.vercel.app")
  .replace(/\/+$/, "");

export const API_BASE_URL = configuredApiUrl.endsWith("/api")
  ? configuredApiUrl
  : `${configuredApiUrl}/api`;

// Public shop contact used by the storefront and WhatsApp checkout.
export function getWhatsappNumber() { return "2349034063970"; }
