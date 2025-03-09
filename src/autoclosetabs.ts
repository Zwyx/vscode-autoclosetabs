import * as vscode from "vscode";
import { INTERVAL_IN_MINUTES, lg } from "./common";
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

let tabTimeCounters: TabTimeCounters = {};

let closedTabs: {
	date: string;
	group: string;
	label: string;
}[] = [];

let webview: vscode.WebviewPanel | undefined;

export const resetTabTimeCounter = (tab: vscode.Tab) => {
	lg("Resetting tab time counter...");

	if (!(tab.input instanceof vscode.TabInputText)) {
		return;
	}

	const tabUri = tab.input.uri.toString();

	lg(tabUri);

	if (tabUri.startsWith("untitled:")) {
		return;
	}

	if (!tabTimeCounters[tab.group.viewColumn]) {
		tabTimeCounters[tab.group.viewColumn] = {};
	}

	tabTimeCounters[tab.group.viewColumn][tabUri] = 0;

	lg(tabTimeCounters);
};

export const incrementTabTimeCounter = (tab: vscode.Tab) => {
	lg("Incrementing tab time counter...");

	if (!(tab.input instanceof vscode.TabInputText)) {
		return;
	}

	const tabUri = tab.input.uri.toString();

	lg(tabUri);

	const tabTimeCounter = tabTimeCounters[tab.group.viewColumn]?.[tabUri];

	if (typeof tabTimeCounter !== "number") {
		return;
	}

	tabTimeCounters[tab.group.viewColumn][tabUri] = tabTimeCounter + 1;

	lg(tabTimeCounters);
};

export const removeTabTimeCounter = (tab: vscode.Tab) => {
	lg("Removing tab time counter...");

	if (!(tab.input instanceof vscode.TabInputText)) {
		return;
	}

	const tabUri = tab.input.uri.toString();

	lg(tabUri);

	if (tabTimeCounters[tab.group.viewColumn]) {
		delete tabTimeCounters[tab.group.viewColumn][tabUri];
	}

	lg(tabTimeCounters);
};

export const createTabTimeCounters = (context: vscode.ExtensionContext) => {
	const storedTabTimeCounters: TabTimeCounters =
		context.workspaceState.get(TAB_TIME_COUNTERS_STORAGE_KEY) || {};

	lg("storedTabTimeCounters");
	lg(storedTabTimeCounters);

	tabTimeCounters = {};

	vscode.window.tabGroups.all.forEach((tabGroup) =>
		tabGroup.tabs.forEach((tab) => {
			if (!(tab.input instanceof vscode.TabInputText)) {
				return;
			}

			const tabUri = tab.input.uri.toString();

			const tabTimeCounter =
				storedTabTimeCounters[tab.group.viewColumn]?.[tabUri];

			if (typeof tabTimeCounter === "number") {
				if (!tabTimeCounters[tab.group.viewColumn]) {
					tabTimeCounters[tab.group.viewColumn] = {};
				}

				tabTimeCounters[tab.group.viewColumn][tabUri] = tabTimeCounter;
			} else {
				resetTabTimeCounter(tab);
			}
		}),
	);

	lg("tabTimeCounters");
	lg(tabTimeCounters);

	closedTabs = [];
};

export const storeTabTimeCounters = (context: vscode.ExtensionContext) =>
	context.workspaceState.update(TAB_TIME_COUNTERS_STORAGE_KEY, tabTimeCounters);

const updateWebview = () => {
	if (!webview) {
		return;
	}

	webview.webview.html = `
		<style>
			li {
				font-family: monospace;
			}
		</style>

		<h3>Automatically closed tabs since this workspace was opened</h3>

		<ul>
			${
				closedTabs.length
					? closedTabs
							.map(
								({ date: time, group, label }) =>
									`<li>${time} group:${group} <strong>${label}</strong></li>`,
							)
							.join("\n")
					: "[None]"
			}
		</ul>
	`;
};

export const listAutomaticallyClosedTabs = () => {
	if (webview) {
		webview.reveal();
	} else {
		webview = vscode.window.createWebviewPanel(
			"autoclosetabs",
			"Auto Close Tabs",
			vscode.ViewColumn.Active,
		);

		webview.onDidDispose(() => (webview = undefined));
	}

	updateWebview();
};

export const closeTabs = (maxTabAgeInHours = 0) => {
	lg("Closing tabs!");

	vscode.window.tabGroups.all.forEach((tabGroup) => {
		lg(`Group ${tabGroup.viewColumn}`);

		const maxTabsInGroup = getSettingValue("autoclosetabs.numberOfTabsInGroup");

		const numberOfTabsExtra = tabGroup.tabs.length - maxTabsInGroup;

		if (numberOfTabsExtra < 1) {
			lg("No tabs in extra");
			return;
		}

		const closableTabsByUri = new Map<string, vscode.Tab>();
		tabGroup.tabs
			.filter(
				(tab) =>
					tab.input instanceof vscode.TabInputText &&
					!tab.isPinned &&
					!tab.isDirty &&
					!tab.isActive,
			)
			.forEach((tab) => {
				if (tab.input instanceof vscode.TabInputText) {
					closableTabsByUri.set(tab.input.uri.toString(), tab);
				}
			});

		const groupTabTimeCounters = tabTimeCounters[tabGroup.viewColumn];

		if (!groupTabTimeCounters) {
			lg("No group tab times");
			return;
		}

		const now = new Date();

		const fullYear = now.getFullYear();
		const month = `0${(now.getMonth() + 1).toString()}`.slice(-2);
		const day = `0${now.getDate().toString()}`.slice(-2);
		const hours = `0${now.getHours().toString()}`.slice(-2);
		const minutes = `0${now.getMinutes().toString()}`.slice(-2);
		const seconds = `0${now.getSeconds().toString()}`.slice(-2);

		const date = `${fullYear}-${month}-${day} ${hours}:${minutes}:${seconds}`;

		Object.entries(groupTabTimeCounters)
			.filter(
				([, timeCounter]) =>
					(timeCounter * INTERVAL_IN_MINUTES) / 60 > maxTabAgeInHours,
			)
			.filter(([uri]) => closableTabsByUri.has(uri))
			.map(([uri, timeCounter]) => [timeCounter, uri])
			.sort()
			.reverse()
			.map(([timeCounter, uri]) => [uri, timeCounter])
			.slice(0, numberOfTabsExtra)
			.forEach(([uri]) => {
				const tab = closableTabsByUri.get(String(uri));
				if (!tab) return;
				const label = tab.label;

				lg(`Group ${tabGroup.viewColumn} - Closing tab ${label}`);

				closedTabs.push({
					date,
					group: tabGroup.viewColumn.toString(),
					label,
				});

				vscode.window.tabGroups.close(tab);
			});
	});

	updateWebview();
};
