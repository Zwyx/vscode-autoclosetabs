import * as vscode from "vscode";
import { INTERVAL_IN_MINUTES, log } from "./common";
import { getSettingValue } from "./settings";

const TAB_TIME_COUNTERS_STORAGE_KEY = "tabTimeCounters";

interface TabTimeCounters {
	[tabGroupId: number]: {
		/**
		 * This number is:
		 *   - created and set to 0 when a tab is opened;
		 *   - reset to 0 when the tab change;
		 *   - incremented at every interval while the tab is opened;
		 *   - removed when the tab is closed
		 */
		[tabUri: string]: number;
	};
}

const getTabTimeCounters = (
	context: vscode.ExtensionContext,
): TabTimeCounters =>
	context.workspaceState.get(TAB_TIME_COUNTERS_STORAGE_KEY) || {};

const setTabTimeCounters = (
	tabTimeCounters: TabTimeCounters,
	context: vscode.ExtensionContext,
) =>
	context.workspaceState.update(TAB_TIME_COUNTERS_STORAGE_KEY, tabTimeCounters);

export const closeTabs = (
	maxTabAgeInHours: number,
	context: vscode.ExtensionContext,
) => {
	log("Closing tabs!");

	vscode.window.tabGroups.all.forEach((tabGroup) => {
		log(`Group ${tabGroup.viewColumn}`);

		const maxTabsInGroup = getSettingValue("autoclosetabs.numberOfTabsInGroup");

		const numberOfTabsExtra = tabGroup.tabs.length - maxTabsInGroup;

		if (numberOfTabsExtra < 1) {
			log("No tabs in extra");
			return;
		}

		const closableTabsByUri = Object.fromEntries(
			tabGroup.tabs
				.filter(
					(tab) =>
						tab.input instanceof vscode.TabInputText &&
						!tab.isPinned &&
						!tab.isDirty &&
						!tab.isActive,
				)
				.map((tab) => [
					// Bloody TypeScript...
					tab.input instanceof vscode.TabInputText
						? tab.input.uri.toString()
						: "",
					tab,
				]),
		);

		const closableTabUris = Object.keys(closableTabsByUri);

		const groupTabTimeCounters =
			getTabTimeCounters(context)[tabGroup.viewColumn];

		if (!groupTabTimeCounters) {
			log("No group tab times");
			return;
		}

		Object.entries(groupTabTimeCounters)
			.filter(
				([, timeCounter]) =>
					(timeCounter * INTERVAL_IN_MINUTES) / 60 > maxTabAgeInHours,
			)
			.filter(([uri]) => closableTabUris.includes(uri))
			.map(([uri, timeCounter]) => [timeCounter, uri])
			.sort()
			.reverse()
			.map(([timeCounter, uri]) => [uri, timeCounter])
			.slice(0, numberOfTabsExtra)
			.forEach(([uri]) => {
				log(`Group ${tabGroup.viewColumn} - Closing tab ${uri}`);
				vscode.window.tabGroups.close(closableTabsByUri[uri]);
			});
	});
};

export const resetTabTimeCounter = (
	tab: vscode.Tab,
	context: vscode.ExtensionContext,
) => {
	log("Resetting tab time counter...");

	if (!(tab.input instanceof vscode.TabInputText)) {
		return;
	}

	const tabUri = tab.input.uri.toString();

	if (tabUri.startsWith("untitled:")) {
		return;
	}

	const tabTimeCounters = getTabTimeCounters(context);

	if (!tabTimeCounters[tab.group.viewColumn]) {
		tabTimeCounters[tab.group.viewColumn] = {};
	}

	tabTimeCounters[tab.group.viewColumn][tabUri] = 0;

	log(tabTimeCounters);

	setTabTimeCounters(tabTimeCounters, context);
};

export const incrementTabTimeCounter = (
	tab: vscode.Tab,
	context: vscode.ExtensionContext,
) => {
	log("Incrementing tab time counter...");

	if (!(tab.input instanceof vscode.TabInputText)) {
		return;
	}

	const tabUri = tab.input.uri.toString();

	const tabTimeCounters = getTabTimeCounters(context);

	const tabTimeCounter = tabTimeCounters[tab.group.viewColumn]?.[tabUri];

	if (typeof tabTimeCounter !== "number") {
		return;
	}

	tabTimeCounters[tab.group.viewColumn][tabUri] = tabTimeCounter + 1;

	log(tabTimeCounters);

	setTabTimeCounters(tabTimeCounters, context);
};

export const removeTabTimeCounter = (
	tab: vscode.Tab,
	context: vscode.ExtensionContext,
) => {
	log("Removing tab time counter...");

	if (!(tab.input instanceof vscode.TabInputText)) {
		return;
	}

	const tabUri = tab.input.uri.toString();

	const tabTimeCounters = getTabTimeCounters(context);

	if (tabTimeCounters[tab.group.viewColumn]) {
		delete tabTimeCounters[tab.group.viewColumn][tabUri];
	}

	log(tabTimeCounters);

	setTabTimeCounters(tabTimeCounters, context);
};
