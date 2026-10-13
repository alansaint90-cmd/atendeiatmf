import { Marca } from "@/components/marca";
import { FormularioRecuperacao } from "./_components/formulario";
export const dynamic = "force-dynamic";
export default function RecuperarSenha() {
  return <main className="auth-shell"><section className="auth-panel"><Marca grande slogan /><FormularioRecuperacao /></section></main>;
}
