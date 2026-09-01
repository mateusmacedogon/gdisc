/** Stable ordering used to elect exactly one offerer for a pair of users. */
export const shouldInitiateRtcConnection = (localUserId: string, peerUserId: string): boolean =>
  localUserId.localeCompare(peerUserId) < 0;

/**
 * During the first room sync, the newest participant creates the offer. This
 * makes late joiners negotiate against every already-published media track.
 * Stable user ordering remains the fallback for equal or legacy timestamps.
 */
export const shouldInitiateRtcConnectionForJoin = (
  localUserId: string,
  localJoinedAt: number | undefined,
  peerUserId: string,
  peerJoinedAt: number | undefined,
): boolean => {
  if (
    typeof localJoinedAt === 'number'
    && Number.isFinite(localJoinedAt)
    && typeof peerJoinedAt === 'number'
    && Number.isFinite(peerJoinedAt)
    && localJoinedAt !== peerJoinedAt
  ) {
    return localJoinedAt > peerJoinedAt;
  }

  return shouldInitiateRtcConnection(localUserId, peerUserId);
};

/** Legacy signals without an ID remain compatible during rolling upgrades. */
export const matchesRtcConnection = (
  activeConnectionId?: string,
  incomingConnectionId?: string,
): boolean => !activeConnectionId || !incomingConnectionId || activeConnectionId === incomingConnectionId;

/** Bounded exponential backoff prevents a signaling outage from becoming a send loop. */
export const getRtcNegotiationRetryDelay = (attempt: number): number =>
  Math.min(400 * (2 ** Math.max(0, Math.min(attempt, 6) - 1)), 8_000);
