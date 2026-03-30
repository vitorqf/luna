import type { Device } from "./types";

export interface DeviceSuggestionContext {
  prefix: string;
  fragment: string;
}

const DEVICE_PREPOSITION_CONTEXT_PATTERN = /^(.*\b(?:no|na|em)\s+)([^]*)$/i;

const normalize = (value: string): string => value.trim().toLocaleLowerCase();

const startsWithNormalized = (value: string, fragment: string): boolean =>
  normalize(value).startsWith(normalize(fragment));

export const extractDeviceSuggestionContext = (
  input: string
): DeviceSuggestionContext | null => {
  const match = input.match(DEVICE_PREPOSITION_CONTEXT_PATTERN);
  if (!match) {
    return null;
  }

  const prefix = match[1] ?? "";
  const fragment = match[2] ?? "";
  if (!prefix.trim()) {
    return null;
  }

  return { prefix, fragment };
};

export const getOnlineDeviceSuggestions = (
  devices: ReadonlyArray<Device>,
  fragment: string
): Device[] => {
  const normalizedFragment = normalize(fragment);

  return devices
    .filter((device) => device.status === "online")
    .filter((device) =>
      normalizedFragment.length === 0
        ? true
        : normalize(device.name).includes(normalizedFragment)
    )
    .slice()
    .sort((left, right) => {
      const leftPrefix = startsWithNormalized(left.name, normalizedFragment);
      const rightPrefix = startsWithNormalized(right.name, normalizedFragment);
      if (leftPrefix !== rightPrefix) {
        return leftPrefix ? -1 : 1;
      }

      return left.name.localeCompare(right.name);
    });
};

export const applyDeviceSuggestion = (
  _input: string,
  context: DeviceSuggestionContext,
  deviceName: string
): string => `${context.prefix}${deviceName}`;
