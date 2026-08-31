/** Stable ordering used to elect exactly one offerer for a pair of users. */
export const shouldInitiateRtcConnection = (localUserId: string, peerUserId: string): boolean =>
  localUserId.localeCompare(peerUserId) < 0;

/** Legacy signals without an ID remain compatible during rolling upgrades. */
export const matchesRtcConnection = (
  activeConnectionId?: string,
  incomingConnectionId?: string,
): boolean => !activeConnectionId || !incomingConnectionId || activeConnectionId === incomingConnectionId;

/** Bounded exponential backoff prevents a signaling outage from becoming a send loop. */
export const getRtcNegotiationRetryDelay = (attempt: number): number =>
  Math.min(400 * (2 ** Math.max(0, Math.min(attempt, 6) - 1)), 8_000);
