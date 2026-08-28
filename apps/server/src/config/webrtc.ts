import { env } from './env.js';

export function getIceServers(): RTCIceServer[] {
  const stunUrls = env.STUN_SERVERS.split(',').map((s) => s.trim());
  return [
    {
      urls: stunUrls,
    },
  ];
}
