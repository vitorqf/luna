import type { Command, Device } from "@luna/shared-types";

export interface SubmitCommandAck {
  commandId: string;
  targetDeviceId: string;
  status: "acknowledged";
}

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

const resolveBaseUrl = (): string =>
  trimTrailingSlash(process.env.NEXT_PUBLIC_LUNA_SERVER_URL ?? "http://127.0.0.1:4000");

const readErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as unknown;
    if (
      typeof payload === "object" &&
      payload !== null &&
      "message" in payload &&
      typeof payload.message === "string" &&
      payload.message.trim().length > 0
    ) {
      return payload.message;
    }
  } catch {
    // Ignore JSON parsing errors and fallback to generic status message.
  }

  return `Request failed with status ${response.status}.`;
};

const fetchJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as T;
};

export interface LunaApiClient {
  fetchDevices: () => Promise<Device[]>;
  fetchCommands: () => Promise<Command[]>;
  submitCommand: (rawText: string) => Promise<SubmitCommandAck>;
}

export const createLunaApiClient = (baseUrl = resolveBaseUrl()): LunaApiClient => {
  const normalizedBaseUrl = trimTrailingSlash(baseUrl);

  return {
    fetchDevices: () => fetchJson<Device[]>(`${normalizedBaseUrl}/devices`),
    fetchCommands: () => fetchJson<Command[]>(`${normalizedBaseUrl}/commands`),
    submitCommand: (rawText: string) =>
      fetchJson<SubmitCommandAck>(`${normalizedBaseUrl}/commands`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ rawText })
      })
  };
};
