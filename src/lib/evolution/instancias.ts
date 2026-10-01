import type { IntegrationSettings } from "../settings/schema";
import { parseFollowup } from "../followups/schema";

type Instancias = Pick<IntegrationSettings, "EVOLUTION_INSTANCE_NAME" | "EVOLUTION_SECOND_INSTANCE_NAME">;

export function instanciasConfiguradas(settings: Instancias): string[] {
  return [...new Set([settings.EVOLUTION_INSTANCE_NAME, settings.EVOLUTION_SECOND_INSTANCE_NAME]
    .filter((nome): nome is string => Boolean(nome)))];
}

export function campoFollowup(settings: Instancias, instancia: string) {
  if (instancia && instancia === settings.EVOLUTION_INSTANCE_NAME) return "FOLLOW_UP_CONFIG";
  if (instancia && instancia === settings.EVOLUTION_SECOND_INSTANCE_NAME) return "FOLLOW_UP_SECOND_CONFIG";
  return null;
}

export function followupDaInstancia(settings: IntegrationSettings, instancia: string) {
  const campo = campoFollowup(settings, instancia);
  const config = parseFollowup(campo ? settings[campo] : undefined);
  // Renomear um chip nunca reaproveita os envios habilitados do número anterior.
  if (!campo || (config.instance && config.instance !== instancia)) {
    return { ...parseFollowup(), instance: instancia };
  }
  return { ...config, instance: instancia };
}

export function settingsDaInstancia(settings: IntegrationSettings, instancia: string): IntegrationSettings | null {
  if (!instanciasConfiguradas(settings).includes(instancia)) return null;
  // Configurações de follow-up não mudam o prompt nem o diário de resposta da IA.
  const { FOLLOW_UP_CONFIG: _principal, FOLLOW_UP_SECOND_CONFIG: _segundo,
    EVOLUTION_SECOND_INSTANCE_NAME: _instancia, ...base } = settings;
  void _principal; void _segundo; void _instancia;
  return { ...base, EVOLUTION_INSTANCE_NAME: instancia };
}
