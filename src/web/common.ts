const LOG_ACTIVE = false as boolean;

export const INTERVAL_IN_MINUTES = 10;

export const lg = (...args: unknown[]) => {
	if (LOG_ACTIVE) {
		console.info(...args);
	}
};
