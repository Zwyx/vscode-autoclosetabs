const LOG_ACTIVE = false;

export const INTERVAL_IN_MINUTES = 10;

export const lg = (...args: unknown[]) => LOG_ACTIVE && console.info(...args);
