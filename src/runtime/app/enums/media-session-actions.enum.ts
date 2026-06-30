const MEDIA_SESSION_ACTIONS = [
  "play",
  "pause",
  "seekbackward",
  "seekforward",
  "seekto",
  "previoustrack",
  "nexttrack",
  "skipad",
  "stop",
] as const satisfies readonly MediaSessionAction[];

export { MEDIA_SESSION_ACTIONS };
