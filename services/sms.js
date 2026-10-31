// SMS provider integration intentionally left behind an adapter boundary.
// Configure a provider and credentials server-side before enabling SMS OTP.
export async function sendSms(){throw new Error("SMS provider is not configured. Use email OTP or configure an SMS provider.");}
