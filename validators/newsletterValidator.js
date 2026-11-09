import { z } from "zod";

export const newsletterCampaignSchema = z.object({
  subject: z.string().trim().min(3).max(150).refine(
    value => !/[\r\n]/.test(value),
    "Subject must be a single line."
  ),
  message: z.string().trim().min(10).max(12000),
}).strict();