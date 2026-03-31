export const DEVICE_SEPARATOR_PATTERN = /^(no|na|em)$/i;

export const OPEN_APP_VERBS_PATTERN = "abrir|abre|iniciar|inicia|executar|executa";
export const NOTIFY_PREFIX_PATTERN =
  "notificar|avisar|enviar\\s+notifica(?:cao|ção)|mandar\\s+notifica(?:cao|ção)";
export const PLAY_MEDIA_VERBS_PATTERN = "tocar|toque|reproduzir|reproduza";
export const SET_VOLUME_VERBS_PATTERN = "definir|ajustar|colocar|setar";

export const normalizeWhitespace = (value: string): string =>
  value
    .trim()
    .replace(/\s+/g, " ");

export const splitByLastDeviceSeparator = (
  value: string
): {
  content: string;
  targetDeviceName: string;
} | null => {
  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return null;
  }

  const tokens = normalized.split(" ");
  for (let index = tokens.length - 2; index >= 1; index -= 1) {
    if (!DEVICE_SEPARATOR_PATTERN.test(tokens[index] ?? "")) {
      continue;
    }

    const content = tokens.slice(0, index).join(" ").trim();
    const targetDeviceName = tokens.slice(index + 1).join(" ").trim();
    if (!content || !targetDeviceName) {
      return null;
    }

    return {
      content,
      targetDeviceName
    };
  }

  return null;
};
