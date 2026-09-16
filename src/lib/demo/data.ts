export interface Conversation { id: string; name: string; phone: string; status: string; tag: string; department: string; assignee: string; channel: string; score: number; last: string; messages: [string, string][]; }
export const metrics = [
  { label: "Conversas abertas", value: 631, tone: "green", icon: "message" },
  { label: "Pendentes", value: 113, tone: "red", icon: "clock" },
  { label: "Leads qualificados", value: 288, tone: "blue", icon: "spark" },
  { label: "Taxa de resposta", value: "94%", tone: "orange", icon: "activity" },
];

export const volume = [86, 104, 92, 130, 146, 118, 172, 164, 188, 210, 196, 232];
export const channels = [
  ["WhatsApp principal", 72, 784],
  ["WhatsApp vendas", 18, 241],
  ["Instagram Direct", 7, 68],
  ["Widget web", 3, 32],
];
export const agents = [
  ["Marina Costa", "Gerente", 86, 4.8],
  ["Rafael Lima", "Atendente", 74, 4.6],
  ["Bianca Rocha", "Atendente", 69, 4.7],
  ["Leo Andrade", "Suporte", 61, 4.5],
];

export const conversations: Conversation[] = [
  {
    id: "c1",
    name: "Alisson Johnatan",
    phone: "+55 (11) 94026-2887",
    status: "aberta",
    tag: "novo lead",
    department: "Comercial",
    assignee: "Marina Costa",
    channel: "WhatsApp principal",
    score: 92,
    last: "Quero conhecer o plano profissional.",
    messages: [
      ["customer", "Olá, vi o anúncio e queria entender os planos."],
      ["bot", "Claro. Você quer automatizar vendas, suporte ou ambos?"],
      ["customer", "Vendas, principalmente recuperação de leads."],
      ["agent", "Perfeito, Alisson. O plano Profissional atende bem esse volume."],
    ],
  },
  {
    id: "c2",
    name: "Thainara Damann",
    phone: "+55 (71) 8241-7351",
    status: "pendente",
    tag: "suporte",
    department: "Suporte",
    assignee: "Rafael Lima",
    channel: "WhatsApp vendas",
    score: 64,
    last: "O QR Code desconectou novamente.",
    messages: [
      ["customer", "Bom dia. Meu WhatsApp caiu."],
      ["bot", "Entendi. Vou verificar a conexão do canal."],
      ["customer", "O QR Code desconectou novamente."],
    ],
  },
  {
    id: "c3",
    name: "Luiza Martins",
    phone: "+55 (85) 9770-6940",
    status: "encerrada",
    tag: "premium",
    department: "Financeiro",
    assignee: "Bianca Rocha",
    channel: "WhatsApp principal",
    score: 81,
    last: "Pagamento confirmado, obrigada.",
    messages: [
      ["customer", "Preciso da segunda via."],
      ["agent", "Enviei o link de pagamento por aqui."],
      ["customer", "Pagamento confirmado, obrigada."],
    ],
  },
  {
    id: "c4",
    name: "Camila Souza",
    phone: "+55 (64) 9228-8957",
    status: "aberta",
    tag: "campanha",
    department: "Atendimento",
    assignee: "Leo Andrade",
    channel: "Instagram Direct",
    score: 77,
    last: "Pode me chamar amanhã?",
    messages: [
      ["customer", "Recebi a campanha."],
      ["bot", "Quer que um especialista fale com você?"],
      ["customer", "Pode me chamar amanhã?"],
    ],
  },
];

export const contacts = [
  ["Alisson Johnatan", "+55 (11) 94026-2887", "alisson@email.com", "Anúncio", "novo lead", "qualificado"],
  ["Thainara Damann", "+55 (71) 8241-7351", "thainara@email.com", "Indicação", "suporte", "ativo"],
  ["Luiza Martins", "+55 (85) 9770-6940", "luiza@email.com", "Site", "premium", "cliente"],
  ["Camila Souza", "+55 (64) 9228-8957", "camila@email.com", "Campanha", "campanha", "nutrição"],
  ["Rodrigo Vieira", "+55 (21) 93318-7712", "rodrigo@email.com", "Landing page", "novo lead", "pendente"],
];

export const campaigns = [
  ["Boas-vindas novos leads", "novo lead", "agendada", "Hoje 17:30", 1290, 1178, 214],
  ["Upgrade Premium", "premium", "enviada", "28/08/2026", 420, 402, 96],
  ["Reativação 30 dias", "nutrição", "rascunho", "Sem agenda", 0, 0, 0],
];

export const team = [
  ["Comercial", "Marina Costa", "Gerente", 18],
  ["Suporte", "Rafael Lima", "Atendente", 12],
  ["Financeiro", "Bianca Rocha", "Atendente", 7],
  ["Atendimento", "Leo Andrade", "Atendente", 9],
];

export const nav = [
  ["dashboard", "Dashboard", "grid"],
  ["inbox", "Caixa de entrada", "inbox"],
  ["chatbot", "Chatbot IA", "spark"],
  ["flows", "Fluxos", "flow"],
  ["contacts", "Contatos e leads", "users"],
  ["campaigns", "Campanhas", "send"],
  ["team", "Equipe", "briefcase"],
  ["settings", "Configurações", "settings"],
  ["plans", "Planos", "card"],
];

