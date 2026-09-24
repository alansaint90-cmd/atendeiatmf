import { z } from "zod";
import { settingsSchema } from "../settings/schema";
import type { Chatbot } from "../chatbots/schema";
import { montarInstrucoesDoAgente } from "../chatbots/prompt-servidor";

export const agentBaseConfigSchema = settingsSchema.extend({
  AI_ENABLED: z.literal("true"),
  OPENAI_API_KEY: settingsSchema.shape.OPENAI_API_KEY.unwrap(),
  OPENAI_MODEL: settingsSchema.shape.OPENAI_MODEL.unwrap(),
  EVOLUTION_API_URL: settingsSchema.shape.EVOLUTION_API_URL.unwrap(),
  EVOLUTION_API_KEY: settingsSchema.shape.EVOLUTION_API_KEY.unwrap(),
  EVOLUTION_INSTANCE_NAME: settingsSchema.shape.EVOLUTION_INSTANCE_NAME.unwrap(),
  REDIS_URL: settingsSchema.shape.REDIS_URL.unwrap(),
});
export const agentConfigSchema = agentBaseConfigSchema.extend({
  AI_SYSTEM_PROMPT: z.string().trim().min(1).max(200000),
});
export type AgentConfig = z.infer<typeof agentConfigSchema>;

export function configurarAgente(settings: unknown, chatbot: Chatbot | null) {
  const base = agentBaseConfigSchema.safeParse(settings);
  return agentConfigSchema.safeParse(base.success ? { ...base.data,
    AI_SYSTEM_PROMPT: montarInstrucoesDoAgente(chatbot) } : {});
}
