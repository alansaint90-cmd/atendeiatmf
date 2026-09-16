import type { Metadata } from "next";
import "@/styles/base.css";
import "@/styles/layout.css";
import "@/styles/features.css";
import "@/styles/improvements.css";

export const metadata: Metadata = { title: "AtendeIA TMF", description: "Protótipo de atendimento e configuração de chatbots TMF." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
