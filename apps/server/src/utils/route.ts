const decodeRouteParam = (value: string): string | null => {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
};

export const extractDeviceIdFromPatchRoute = (
  requestUrl: string,
): string | null => {
  const match = requestUrl.match(/^\/devices\/([^/]+)$/);
  if (!match || !match[1]) {
    return null;
  }

  return decodeRouteParam(match[1]);
};

export const extractDiscoveredAgentIdFromApproveRoute = (
  requestUrl: string,
): string | null => {
  const match = requestUrl.match(/^\/discovery\/agents\/([^/]+)\/approve$/);
  if (!match || !match[1]) {
    return null;
  }

  return decodeRouteParam(match[1]);
};
