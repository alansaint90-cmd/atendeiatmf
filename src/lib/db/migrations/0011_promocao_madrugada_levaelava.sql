-- Fluxo solicitado pelo proprietário; conserva o prompt e os demais números.
DO $migracao$
DECLARE
  registro record;
  fluxos jsonb;
  novo_id uuid;
  novo_identificador text;
  fluxo jsonb := $fluxo${"name":"Promoção da madrugada — R$ 13,90","description":"Gatilho: quero saber sobre a promoção de 13,90. Acione também para quero saber da promoção de 13,90, quero saber mais sobre a promoção de R$ 13,90 e variações equivalentes de caixa, acentos ou pontuação. Quando o cliente perguntar por essa promoção, faça a recepção da Leva & Lava em Vilas do Atlântico e explique a promoção de lavagem noturna por R$ 13,90, das 00h às 06h. Este é o valor confirmado desta promoção; não use R$ 13,99 nem o preço noturno antigo para este pedido. Envie já nessa resposta o endereço e o link do Google Maps exatamente como cadastrados no prompt de atendimento atual. Não pergunte se o cliente quer receber a localização; ele já solicitou informações da promoção. Não invente link, endereço, dias de validade, benefícios ou regras que não estejam cadastrados. Se alguma informação de localização estiver ausente, envie a informação disponível e não fabrique a que falta. Preserve a persona e o tom do painel. Se o nome ainda não for conhecido e for o início da conversa, pergunte-o uma única vez ao final, sem impedir a explicação da promoção ou o envio da localização. Depois dessa recepção, continue o atendimento normal pelo prompt principal: responda às próximas perguntas sobre funcionamento, serviços e demais assuntos usando as informações já cadastradas, sem repetir automaticamente a recepção ou a promoção. Este fluxo não transfere nem pausa o atendimento por si só."}$fluxo$::jsonb;
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
    IF jsonb_typeof(fluxos) <> 'array' THEN
      RAISE EXCEPTION 'Os fluxos do chatbot levaelava precisam ser revisados antes da migração.';
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(fluxos) f WHERE f->>'name'=fluxo->>'name') THEN
      CONTINUE;
    END IF;
    IF jsonb_array_length(fluxos) >= 50 THEN
      RAISE EXCEPTION 'O chatbot levaelava atingiu o limite de 50 fluxos.';
    END IF;
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
      IF NOT FOUND THEN RAISE EXCEPTION 'O vínculo do chatbot levaelava mudou durante a migração.'; END IF;
      INSERT INTO atendeia_audit_logs(modified_by,action,entity_type,entity_id,changed_fields,details)
      VALUES (registro.canal_autor,'chatbot_vinculado_por_migracao','canal',registro.canal_id,
        '["chatbot_id"]'::jsonb,'{"motivo":"Fluxo promocional exclusivo de levaelava; autor anterior preservado."}'::jsonb);
    ELSE
      novo_id := registro.id;
      UPDATE atendeia_chatbots SET configuration=jsonb_set(configuration,'{flows}',fluxos),updated_at=now(),version=version+1
      WHERE id=registro.id AND version=registro.version AND is_deleted=false;
      IF NOT FOUND THEN RAISE EXCEPTION 'O chatbot levaelava mudou durante a migração.'; END IF;
    END IF;
    INSERT INTO atendeia_audit_logs(modified_by,action,entity_type,entity_id,changed_fields,details)
    VALUES (registro.modified_by,'fluxo_promocional_por_migracao','chatbot',novo_id,
      '["configuration.flows"]'::jsonb,'{"motivo":"Promoção da madrugada solicitada para levaelava; autor anterior preservado."}'::jsonb);
  END LOOP;
END
$migracao$;
