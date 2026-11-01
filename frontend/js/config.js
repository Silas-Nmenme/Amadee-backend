const isLocalDevelopment = ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
const configuredApiUrl = (window.AMADEE_API_URL || (isLocalDevelopment ? "http://localhost:3000/api" : "/api"))
  .replace(/\/+$/, "");

export const API_BASE_URL = configuredApiUrl.endsWith("/api")
  ? configuredApiUrl
  : `${configuredApiUrl}/api`;

let whatsappNumber = "2349034063970";

export function setShopWhatsappNumber(value) {
  if (typeof value === "string" && /^\d{7,20}$/.test(value)) {
    whatsappNumber = value;
  }
}

export function getWhatsappNumber() { return whatsappNumber; }
