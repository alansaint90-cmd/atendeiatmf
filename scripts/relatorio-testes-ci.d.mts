interface EventoTesteCi {
  type: string;
  data: {
    name: string;
    details?: { error?: { cause?: Error; message?: string; stack?: string } };
  };
}
export default function relatorioTestesCi(eventos: Iterable<EventoTesteCi> | AsyncIterable<EventoTesteCi>): AsyncGenerator<string>;
