
import "dotenv/config";
import { verifyMailConfiguration } from "./services/mailer.js";

try {
  await verifyMailConfiguration();
  console.log("Email configuration is working.");
} catch (error) {
  console.error("Email test failed:", error.message);
  process.exitCode = 1;
}
