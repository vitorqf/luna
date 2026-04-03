import { hostname as getHostname } from "node:os";
import { parseArgs } from "node:util";
import { z } from "zod";
import type { AgentIdentity } from "./index";

export const DEFAULT_SERVER_URL = "ws://127.0.0.1:4000";
export const DEFAULT_RECONNECT_INITIAL_DELAY_MS = 1_000;
export const DEFAULT_RECONNECT_MAX_DELAY_MS = 30_000;

export type RuntimeEnv = Record<string, string | undefined>;

export interface AgentRuntimeCliArgs {
  serverUrl?: string;
  serverHost?: string;
  serverPort?: number;
  deviceId?: string;
  deviceName?: string;
  deviceHostname?: string;
}

export interface AgentRuntimeConfig {
  serverUrl: string;
  device: AgentIdentity;
}

export interface AgentRuntimeReconnectConfig {
  initialDelayMs: number;
  maxDelayMs: number;
}

export interface ResolvedAgentRuntimeConfig extends AgentRuntimeConfig {
  reconnect: AgentRuntimeReconnectConfig;
}

const SERVER_URL_ERROR_MESSAGE =
  "LUNA_AGENT_SERVER_URL must start with ws:// or wss://.";

const normalizeOptionalString = (value: string | undefined): string | undefined => {
  const normalized = value?.trim();
  if (!normalized) {
    return undefined;
  }

  return normalized;
};

const getFirstZodIssueMessage = (error: z.ZodError): string =>
  error.issues[0]?.message ?? "Invalid runtime configuration.";

const parseWithSchema = <Schema extends z.ZodTypeAny>(
  schema: Schema,
  value: unknown,
): z.output<Schema> => {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error(getFirstZodIssueMessage(result.error));
  }

  return result.data;
};

const createTrimmedNonEmptyStringSchema = (message: string) =>
  z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, { message });

const serverUrlSchema = createTrimmedNonEmptyStringSchema(
  SERVER_URL_ERROR_MESSAGE,
).refine((value) => {
  try {
    const url = new URL(value);
    return url.protocol === "ws:" || url.protocol === "wss:";
  } catch {
    return false;
  }
}, SERVER_URL_ERROR_MESSAGE);

const createPositiveIntegerSchema = (message: string) =>
  z.union([z.number(), z.string()]).transform((value, context) => {
    const rawValue = typeof value === "string" ? value.trim() : String(value);
    const parsed = Number.parseInt(rawValue, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message,
      });
      return z.NEVER;
    }

    return parsed;
  });

const cliPortSchema = z.union([z.number(), z.string()]).transform((value, context) => {
  const rawValue = typeof value === "string" ? value.trim() : String(value);
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65_535) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "--server-port must be an integer between 1 and 65535.",
    });
    return z.NEVER;
  }

  return parsed;
});

const runtimeDeviceSchema = z.object({
  id: createTrimmedNonEmptyStringSchema("Device id is required."),
  name: createTrimmedNonEmptyStringSchema("Device name is required."),
  hostname: createTrimmedNonEmptyStringSchema("Device hostname is required."),
});

const agentRuntimeConfigSchema = z.object({
  serverUrl: serverUrlSchema,
  device: runtimeDeviceSchema,
});

const agentRuntimeReconnectConfigSchema = z
  .object({
    initialDelayMs: createPositiveIntegerSchema(
      "LUNA_AGENT_RECONNECT_INITIAL_DELAY_MS must be a positive integer.",
    ),
    maxDelayMs: createPositiveIntegerSchema(
      "LUNA_AGENT_RECONNECT_MAX_DELAY_MS must be a positive integer.",
    ),
  })
  .superRefine((value, context) => {
    if (value.maxDelayMs < value.initialDelayMs) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "LUNA_AGENT_RECONNECT_MAX_DELAY_MS must be greater than or equal to LUNA_AGENT_RECONNECT_INITIAL_DELAY_MS.",
      });
    }
  });

const resolvedAgentRuntimeConfigSchema = agentRuntimeConfigSchema.extend({
  reconnect: agentRuntimeReconnectConfigSchema,
});

const agentRuntimeCliArgsSchema = z.object({
  serverUrl: createTrimmedNonEmptyStringSchema(
    "--server-url requires a non-empty value.",
  ).optional(),
  serverHost: createTrimmedNonEmptyStringSchema(
    "--server-host requires a non-empty value.",
  ).optional(),
  serverPort: cliPortSchema.optional(),
  deviceId: createTrimmedNonEmptyStringSchema(
    "--device-id requires a non-empty value.",
  ).optional(),
  deviceName: createTrimmedNonEmptyStringSchema(
    "--device-name requires a non-empty value.",
  ).optional(),
  deviceHostname: createTrimmedNonEmptyStringSchema(
    "--device-hostname requires a non-empty value.",
  ).optional(),
});

const normalizeCliParseError = (error: unknown): never => {
  if (error instanceof Error) {
    const unknownOptionMatch = error.message.match(/Unknown option '([^']+)'/);
    if (unknownOptionMatch) {
      throw new Error(`Unknown CLI argument: ${unknownOptionMatch[1]}`);
    }

    const missingValueMatch = error.message.match(
      /Option '([^']+?)(?: <value>)?' argument missing/,
    );
    if (missingValueMatch) {
      throw new Error(`${missingValueMatch[1]} requires a non-empty value.`);
    }

    throw error;
  }

  throw new Error("Unknown CLI argument.");
};

const toAgentRuntimeCliArgs = (
  input: z.output<typeof agentRuntimeCliArgsSchema>,
): AgentRuntimeCliArgs => {
  const cliArgs: AgentRuntimeCliArgs = {};

  if (input.serverUrl !== undefined) {
    cliArgs.serverUrl = input.serverUrl;
  }

  if (input.serverHost !== undefined) {
    cliArgs.serverHost = input.serverHost;
  }

  if (input.serverPort !== undefined) {
    cliArgs.serverPort = input.serverPort;
  }

  if (input.deviceId !== undefined) {
    cliArgs.deviceId = input.deviceId;
  }

  if (input.deviceName !== undefined) {
    cliArgs.deviceName = input.deviceName;
  }

  if (input.deviceHostname !== undefined) {
    cliArgs.deviceHostname = input.deviceHostname;
  }

  return cliArgs;
};

const parseWsPort = (url: URL): number => {
  if (!url.port) {
    return url.protocol === "wss:" ? 443 : 80;
  }

  return Number.parseInt(url.port, 10);
};

export const parseAgentRuntimeCliArgs = (
  argv: string[] = process.argv.slice(2),
): AgentRuntimeCliArgs => {
  try {
    const { values } = parseArgs({
      args: argv,
      allowPositionals: true,
      strict: true,
      options: {
        "server-url": { type: "string" },
        "server-host": { type: "string" },
        "server-port": { type: "string" },
        "device-id": { type: "string" },
        "device-name": { type: "string" },
        "device-hostname": { type: "string" },
      },
    });

    return toAgentRuntimeCliArgs(
      parseWithSchema(agentRuntimeCliArgsSchema, {
        serverUrl: values["server-url"],
        serverHost: values["server-host"],
        serverPort: values["server-port"],
        deviceId: values["device-id"],
        deviceName: values["device-name"],
        deviceHostname: values["device-hostname"],
      }),
    );
  } catch (error) {
    return normalizeCliParseError(error);
  }
};

export const parseAgentRuntimeConfig = (
  env: RuntimeEnv = process.env,
): AgentRuntimeConfig => {
  const defaultHostname = getHostname();
  const deviceHostname =
    normalizeOptionalString(env.LUNA_AGENT_DEVICE_HOSTNAME) ?? defaultHostname;

  return parseWithSchema(agentRuntimeConfigSchema, {
    serverUrl: normalizeOptionalString(env.LUNA_AGENT_SERVER_URL) ?? DEFAULT_SERVER_URL,
    device: {
      id: normalizeOptionalString(env.LUNA_AGENT_DEVICE_ID) ?? defaultHostname,
      name: normalizeOptionalString(env.LUNA_AGENT_DEVICE_NAME) ?? deviceHostname,
      hostname: deviceHostname,
    },
  });
};

export const parseAgentRuntimeReconnectConfig = (
  env: RuntimeEnv = process.env,
): AgentRuntimeReconnectConfig => {
  return parseWithSchema(
    agentRuntimeReconnectConfigSchema,
    {
      initialDelayMs:
        normalizeOptionalString(env.LUNA_AGENT_RECONNECT_INITIAL_DELAY_MS) ??
        DEFAULT_RECONNECT_INITIAL_DELAY_MS,
      maxDelayMs:
        normalizeOptionalString(env.LUNA_AGENT_RECONNECT_MAX_DELAY_MS) ??
        DEFAULT_RECONNECT_MAX_DELAY_MS,
    },
  );
};

export const resolveAgentRuntimeConfig = (
  env: RuntimeEnv,
  cliArgs: AgentRuntimeCliArgs,
): ResolvedAgentRuntimeConfig => {
  const parsedFromEnv = parseAgentRuntimeConfig(env);
  const reconnectConfig = parseAgentRuntimeReconnectConfig(env);
  const parsedBaseServerUrl = new URL(parsedFromEnv.serverUrl);

  let serverUrl = parsedFromEnv.serverUrl;
  if (cliArgs.serverUrl) {
    serverUrl = parseWithSchema(serverUrlSchema, cliArgs.serverUrl);
  } else if (cliArgs.serverHost || cliArgs.serverPort !== undefined) {
    const protocol = parsedBaseServerUrl.protocol;
    const serverHost = cliArgs.serverHost ?? parsedBaseServerUrl.hostname;
    const serverPort = cliArgs.serverPort ?? parseWsPort(parsedBaseServerUrl);
    serverUrl = `${protocol}//${serverHost}:${serverPort}`;
  }

  const deviceHostname = cliArgs.deviceHostname ?? parsedFromEnv.device.hostname;

  return parseWithSchema(resolvedAgentRuntimeConfigSchema, {
    serverUrl,
    device: {
      id: cliArgs.deviceId ?? parsedFromEnv.device.id,
      name:
        cliArgs.deviceName ??
        (cliArgs.deviceHostname ? deviceHostname : parsedFromEnv.device.name),
      hostname: deviceHostname,
    },
    reconnect: reconnectConfig,
  });
};
