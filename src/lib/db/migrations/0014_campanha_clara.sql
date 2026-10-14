-- Acrescenta a campanha, sem substituir prompt, abertura ou fluxos orgânicos.
DO $migracao$
DECLARE
  registro record;
  fluxos jsonb;
  novo_id uuid;
  novo_identificador text;
  fluxo jsonb := $fluxo${
    "name":"Campanha paga — madrugada Clara",
    "triggers":["Olá, posso ter mais informações sobre isso?"],
    "description":"Campanha de tráfego pago: somente a frase exata cadastrada, tolerando caixa, acentos e pontuação. Quatro balões literais, uma vez por cliente nesta instância, sem pedir nome. Usa o Google Maps do prompt atual; sem link único válido, fica pendente de configuração. Após a sequência, segue o atendimento orgânico existente. Perguntas orgânicas sobre a promoção continuam no fluxo original, sem esta recepção.",
    "sequencia":{
      "chave":"campanha-madrugada-clara",
      "instancia":"levaelava",
      "mensagens":[
        "Olá, tudo bem? 😊\n\nSou a Clara, assistente virtual da Leve & Lava Vilas do Atlântico! 💙",
        "Estamos com uma promoção especial para quem prefere lavar suas roupas durante a madrugada! 🌙\n\n🧺 Nossa tarifa noturna é de apenas *R$ 13,90*, válida das *00h às 06h*.\n\nUma ótima oportunidade para cuidar das suas roupas e economizar!",
        "📍 Estamos em Vilas do Atlântico, Lauro de Freitas!\n\nConfira nossa localização no Google Maps e veja como chegar:\n\n👉 {{GOOGLE_MAPS}}",
        "Você gostaria de saber algo mais? 😊\n\nEstou aqui para ajudar!"
      ]
    }
  }$fluxo$::jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('chatbots-instancias',0));
  FOR registro IN
    SELECT b.id,b.identifier,b.configuration,b.version,b.enabled,b.modified_by,
      c.id canal_id,c.version canal_versao,c.modified_by canal_autor
    FROM atendeia_channels c JOIN atendeia_chatbots b ON b.id=c.chatbot_id
    WHERE c.instance_name='levaelava' AND c.provider='evolution'
      AND c.is_deleted=false AND b.is_deleted=false
    FOR UPDATE OF c,b
  LOOP
    fluxos := coalesce(registro.configuration->'flows','[]'::jsonb);
    IF jsonb_typeof(fluxos) <> 'array' THEN RAISE EXCEPTION 'Revise os fluxos de levaelava antes da migração.'; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(fluxos) f WHERE f->'sequencia'->>'chave'='campanha-madrugada-clara') THEN CONTINUE; END IF;
    IF jsonb_array_length(fluxos) >= 50 THEN RAISE EXCEPTION 'O chatbot levaelava atingiu o limite de 50 fluxos.'; END IF;
    fluxos := fluxos || jsonb_build_array(fluxo);
    IF EXISTS (SELECT 1 FROM atendeia_channels outro
      WHERE outro.chatbot_id=registro.id AND outro.is_deleted=false AND outro.instance_name<>'levaelava') THEN
      novo_id := gen_random_uuid();
      novo_identificador := 'levaelava - ' || novo_id::text;
      INSERT INTO atendeia_chatbots(id,identifier,enabled,configuration,modified_by)
      VALUES (novo_id,novo_identificador,registro.enabled,
        registro.configuration || jsonb_build_object('id',novo_id::text,'identifier',novo_identificador,'flows',fluxos),registro.modified_by);
      UPDATE atendeia_channels SET chatbot_id=novo_id,updated_at=now(),version=version+1
      WHERE id=registro.canal_id AND version=registro.canal_versao AND is_deleted=false;
      IF NOT FOUND THEN RAISE EXCEPTION 'O vínculo de levaelava mudou durante a migração.'; END IF;
      INSERT INTO atendeia_audit_logs(modified_by,action,entity_type,entity_id,changed_fields)
      VALUES (registro.canal_autor,'campanha_clara_vinculada','canal',registro.canal_id,'["chatbot_id"]'::jsonb);
    ELSE
      novo_id := registro.id;
      UPDATE atendeia_chatbots SET configuration=jsonb_set(configuration,'{flows}',fluxos),updated_at=now(),version=version+1
      WHERE id=registro.id AND version=registro.version AND is_deleted=false;
      IF NOT FOUND THEN RAISE EXCEPTION 'O chatbot levaelava mudou durante a migração.'; END IF;
    END IF;
    INSERT INTO atendeia_audit_logs(modified_by,action,entity_type,entity_id,changed_fields,details)
    VALUES (registro.modified_by,'campanha_clara_acrescentada','chatbot',novo_id,
      '["configuration.flows"]'::jsonb,'{"motivo":"Campanha solicitada; atendimento orgânico e autor anterior preservados."}'::jsonb);
  END LOOP;
END
$migracao$;
