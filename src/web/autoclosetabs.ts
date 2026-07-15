// typescript-eslint's strict type checked rules were added when converting
// the extension to a web extension, but no code change was required;
// since the extension has been extensively tested and works well, there
// is no need to refactor the code now only to activate these rules.
/* eslint-disable @typescript-eslint/no-dynamic-delete */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/strict-boolean-expressions */

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
		[tabId: string]: number;
	};
}

let tabTimeCounters: TabTimeCounters = {};

let closedTabs: {
	date: string;
	group: string;
	label: string;
}[] = [];

let webview: vscode.WebviewPanel | undefined;

/**
 * Webview tab inputs expose no URI, and several webview tabs can share the
 * same view type and label, so an ID cannot be derived from the input alone.
 * However, VS Code keeps the identity of a Tab object stable for the
 * lifetime of the tab, so we can assign our own index to each webview tab.
 * See https://github.com/microsoft/vscode/blob/main/src/vs/workbench/api/common/extHostEditorTabs.ts#L165C1-L165C73
 * These indexes are not persisted: after a window reload, webview tabs
 * simply start aging from zero again (so we do not restore the tab time counters
 * for webviews in `createTabTimeCounters` below).
 */
const webviewTabIndexes = new WeakMap<vscode.Tab, string>();
let nextWebviewTabIndex = 1;

const getWebviewTabIndex = (tab: vscode.Tab): string => {
	const existingIndex = webviewTabIndexes.get(tab);

	if (existingIndex !== undefined) {
		return existingIndex;
	}

	const index = (nextWebviewTabIndex++).toString();

	webviewTabIndexes.set(tab, index);

	return index;
};

const getTabId = (tab: vscode.Tab): string | undefined => {
	const input = tab.input;

	if (input instanceof vscode.TabInputText) {
		return input.uri.toString();
	}

	if (input instanceof vscode.TabInputTextDiff) {
		return `diff:${input.original.toString()}:${input.modified.toString()}`;
	}

	if (input instanceof vscode.TabInputCustom) {
		return `custom:${input.uri.toString()}`;
	}

	if (input instanceof vscode.TabInputNotebook) {
		return `notebook:${input.uri.toString()}`;
	}

	if (input instanceof vscode.TabInputWebview) {
		return `webview:${input.viewType}:${getWebviewTabIndex(tab)}`;
	}

	// Tab might be a terminal, a settings editor, or an unknown kind of tab
	return undefined;
};

export const resetTabTimeCounter = (tab: vscode.Tab) => {
	lg("Resetting tab time counter...");

	const tabId = getTabId(tab);

	if (tabId === undefined) {
		return;
	}

	lg(tabId);

	if (tabId.startsWith("untitled:")) {
		return;
	}

	if (!tabTimeCounters[tab.group.viewColumn]) {
		tabTimeCounters[tab.group.viewColumn] = {};
	}

	tabTimeCounters[tab.group.viewColumn][tabId] = 0;

	lg(tabTimeCounters);
};

export const incrementTabTimeCounter = (tab: vscode.Tab) => {
	lg("Incrementing tab time counter...");

	const tabId = getTabId(tab);

	if (tabId === undefined) {
		return;
	}

	lg(tabId);

	const tabTimeCounter = tabTimeCounters[tab.group.viewColumn]?.[tabId];

	if (typeof tabTimeCounter !== "number") {
		return;
	}

	tabTimeCounters[tab.group.viewColumn][tabId] = tabTimeCounter + 1;

	lg(tabTimeCounters);
};

export const removeTabTimeCounter = (tab: vscode.Tab) => {
	lg("Removing tab time counter...");

	const tabId = getTabId(tab);

	if (tabId === undefined) {
		return;
	}

	lg(tabId);

	if (tabTimeCounters[tab.group.viewColumn]) {
		delete tabTimeCounters[tab.group.viewColumn][tabId];
	}

	lg(tabTimeCounters);
};

export const createTabTimeCounters = (context: vscode.ExtensionContext) => {
	const storedTabTimeCounters: TabTimeCounters =
		context.workspaceState.get(TAB_TIME_COUNTERS_STORAGE_KEY) || {};

	lg("storedTabTimeCounters");
	lg(JSON.stringify(storedTabTimeCounters, undefined, 2));

	// Clear webviews' tab time counters – see `webviewTabIndexes` above
	for (const tabGroup in storedTabTimeCounters) {
		for (const tabTimeCounter in storedTabTimeCounters[tabGroup]) {
			if (tabTimeCounter.startsWith("webview")) {
				delete storedTabTimeCounters[tabGroup][tabTimeCounter];
			}
		}
	}

	lg("storedTabTimeCounters without webviews");
	lg(JSON.stringify(storedTabTimeCounters, undefined, 2));

	tabTimeCounters = {};

	vscode.window.tabGroups.all.forEach((tabGroup) => {
		tabGroup.tabs.forEach((tab) => {
			const tabId = getTabId(tab);

			if (tabId === undefined) {
				return;
			}

			const tabTimeCounter =
				storedTabTimeCounters[tab.group.viewColumn]?.[tabId];

			if (typeof tabTimeCounter === "number") {
				if (!tabTimeCounters[tab.group.viewColumn]) {
					tabTimeCounters[tab.group.viewColumn] = {};
				}

				tabTimeCounters[tab.group.viewColumn][tabId] = tabTimeCounter;
			} else {
				resetTabTimeCounter(tab);
			}
		});
	});

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

		<h3>Tabs closed since this workspace was opened</h3>

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
		lg(`Group ${tabGroup.viewColumn.toString()}`);

		const maxTabsInGroup = getSettingValue("autoclosetabs.numberOfTabsInGroup");

		const numberOfTabsExtra = tabGroup.tabs.length - maxTabsInGroup;

		if (numberOfTabsExtra < 1) {
			lg("No tabs in extra");
			return;
		} else {
			lg(`${numberOfTabsExtra.toLocaleString()} tabs in extra`);
		}

		lg("Group tabs:");
		lg(tabGroup.tabs.map((tab) => ({ ...tab, group: undefined })));

		const closableTabsById = Object.fromEntries(
			tabGroup.tabs
				.filter(
					(tab) =>
						getTabId(tab) !== undefined &&
						!tab.isPinned &&
						!tab.isDirty &&
						!tab.isActive,
				)
				.map((tab) => [getTabId(tab) ?? "", tab]),
		);

		const closableTabIds = Object.keys(closableTabsById);

		const groupTabTimeCounters = tabTimeCounters[tabGroup.viewColumn];

		if (!groupTabTimeCounters) {
			lg("No group tab times");
			return;
		}

		// A bit convoluted for a result that looks a lot like an ISO string, but it's in the user's time zone
		const now = new Date();
		const fullYear = now.getFullYear().toString();
		const month = `0${(now.getMonth() + 1).toString()}`.slice(-2);
		const day = `0${now.getDate().toString()}`.slice(-2);
		const hours = `0${now.getHours().toString()}`.slice(-2);
		const minutes = `0${now.getMinutes().toString()}`.slice(-2);
		const seconds = `0${now.getSeconds().toString()}`.slice(-2);
		const date = `${fullYear}-${month}-${day} ${hours}:${minutes}:${seconds}`;

		Object.entries(groupTabTimeCounters)
			.filter(
				([, timeCounter]) =>
					maxTabAgeInHours === 0 ||
					(timeCounter * INTERVAL_IN_MINUTES) / 60 > maxTabAgeInHours,
			)
			.filter(([tabId]) => closableTabIds.includes(tabId))
			.map(([tabId, timeCounter]) => [timeCounter, tabId])
			.sort()
			.reverse()
			.map(([timeCounter, tabId]) => [tabId, timeCounter])
			.slice(0, numberOfTabsExtra)
			.forEach(([tabId]) => {
				const tab = closableTabsById[tabId];
				const label = tab.label;

				lg(`Group ${tabGroup.viewColumn.toString()} - Closing tab ${label}`);

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
