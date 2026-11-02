import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { ProviderError } from "../agent/providers";

export const maxDuracaoVoz = 45;
export const maxPcm = 24000 * 2 * maxDuracaoVoz;
export const maxOgg = 1024 * 1024;
export async function verificarConversorVoz(executavel = process.env.FFMPEG_PATH || "ffmpeg") {
  try {
    const { stdout } = await promisify(execFile)(executavel, ["-hide_banner", "-encoders"], {
      timeout: 3000, maxBuffer: 256 * 1024, windowsHide: true,
    });
    if (!/\blibopus\b/u.test(stdout)) throw new Error("Codec indisponível");
  } catch { throw new ProviderError("voz_conversor_indisponivel"); }
}

export function validarOggOpus(bytes: Buffer) {
  if (bytes.length < 64 || bytes.length > maxOgg || bytes.toString("ascii", 0, 4) !== "OggS"
    || bytes.indexOf(Buffer.from("OpusHead")) < 0) throw new ProviderError("voz_ogg_invalido");
}

/** PCM 16 bits, mono, 24 kHz -> contêiner Ogg real, codec Opus, mono, 48 kHz. Sem arquivos ou shell. */
export async function converterPcmParaOgg(pcm: Buffer, executavel = process.env.FFMPEG_PATH || "ffmpeg"): Promise<Buffer> {
  if (!pcm.length || pcm.length > maxPcm || pcm.length % 2) throw new ProviderError("voz_duracao_invalida");
  return new Promise((resolve, reject) => {
    const processo = spawn(executavel, ["-hide_banner", "-loglevel", "error", "-f", "s16le", "-ar", "24000", "-ac", "1", "-i", "pipe:0",
      "-vn", "-map_metadata", "-1", "-c:a", "libopus", "-ar", "48000", "-ac", "1", "-b:a", "32k", "-application", "voip", "-f", "ogg", "pipe:1"],
    { stdio: ["pipe", "pipe", "ignore"], windowsHide: true, shell: false });
    let encerrado = false;
    let tamanho = 0;
    const partes: Buffer[] = [];
    const falhar = () => {
      if (encerrado) return;
      encerrado = true; clearTimeout(timer); processo.kill("SIGKILL");
      for (const parte of partes) parte.fill(0);
      reject(new ProviderError("voz_conversao_falhou"));
    };
    const timer = setTimeout(falhar, 10000);
    processo.on("error", falhar);
    processo.stdin.on("error", falhar);
    processo.stdout.on("data", (parte: Buffer) => {
      if (encerrado) return;
      tamanho += parte.length;
      if (tamanho > maxOgg) { falhar(); return; }
      partes.push(parte);
    });
    processo.on("close", codigo => {
      if (encerrado) return;
      if (codigo !== 0) { falhar(); return; }
      clearTimeout(timer); encerrado = true;
      const audio = Buffer.concat(partes);
      for (const parte of partes) parte.fill(0);
      try { validarOggOpus(audio); resolve(audio); }
      catch { audio.fill(0); reject(new ProviderError("voz_ogg_invalido")); }
    });
    processo.stdin.end(pcm);
  });
}
