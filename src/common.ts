const LOG_ACTIVE = true;

export const INTERVAL_IN_MINUTES = 10;

export const log = (...args: unknown[]) => LOG_ACTIVE && console.info(...args);
