import type { Device } from "@luna/shared-types";
import { normalizeWhitespace } from "./value";

const normalizeDeviceKey = (value: string): string =>
  normalizeWhitespace(value).toLocaleLowerCase();

export const resolveDeviceByTarget = (
  devices: Iterable<Device>,
  targetDeviceName: string,
): Device | null => {
  const registeredDevices = [...devices];
  const normalizedTarget = normalizeDeviceKey(targetDeviceName);
  for (const device of registeredDevices) {
    if (normalizeDeviceKey(device.name) === normalizedTarget) {
      return device;
    }
  }

  for (const device of registeredDevices) {
    if (normalizeDeviceKey(device.hostname) === normalizedTarget) {
      return device;
    }
  }

  return null;
};

export const isDeviceNameTaken = (
  devices: Iterable<Device>,
  candidateName: string,
  excludedDeviceId: string,
): boolean => {
  const normalizedCandidateName = normalizeDeviceKey(candidateName);
  for (const device of devices) {
    if (device.id === excludedDeviceId) {
      continue;
    }

    if (normalizeDeviceKey(device.name) === normalizedCandidateName) {
      return true;
    }
  }

  return false;
};

export const supportsIntent = (device: Device, intent: string): boolean =>
  device.capabilities.some((capability) => capability === intent);
