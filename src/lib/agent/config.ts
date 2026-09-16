import { z } from "zod";
import { settingsSchema } from "../settings/schema";

export const agentConfigSchema = settingsSchema.extend({
  AI_ENABLED: z.literal("true"),
  AI_SYSTEM_PROMPT: z.string().trim().min(1).max(200000),
  OPENAI_API_KEY: settingsSchema.shape.OPENAI_API_KEY.unwrap(),
  OPENAI_MODEL: settingsSchema.shape.OPENAI_MODEL.unwrap(),
  EVOLUTION_API_URL: settingsSchema.shape.EVOLUTION_API_URL.unwrap(),
  EVOLUTION_API_KEY: settingsSchema.shape.EVOLUTION_API_KEY.unwrap(),
  EVOLUTION_INSTANCE_NAME: settingsSchema.shape.EVOLUTION_INSTANCE_NAME.unwrap(),
  REDIS_URL: settingsSchema.shape.REDIS_URL.unwrap(),
});
export type AgentConfig = z.infer<typeof agentConfigSchema>;
