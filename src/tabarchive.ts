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
		 *   - removed when the tab is archived
		 */
		[tabUri: string]: number;
	};
}

let tabTimeCounters: TabTimeCounters = {};

interface ArchivedTabInfo {
	date: string;
	group: string;
	label: string;
	uri: string;
}

const archivedTabs = new Map<string, ArchivedTabInfo>();

const createTabKey = (group: string, label: string, uri: string): string => {
	return `${group}:${label}:${uri}`;
};

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

	archivedTabs.clear();
};

export const storeTabTimeCounters = (context: vscode.ExtensionContext) =>
	context.workspaceState.update(TAB_TIME_COUNTERS_STORAGE_KEY, tabTimeCounters);

export const listArchivedTabs = async () => {
	const items = Array.from(archivedTabs.values()).map(({ group, label, uri }) => ({
		description: `Group: ${group}`,
		detail: uri,
		group,
		iconPath: new vscode.ThemeIcon("file"),
		label,
		uri,
	}));

	const selectedItem = await vscode.window.showQuickPick(items, {
		placeHolder: 'Archived tabs since this workspace was opened',
		matchOnDescription: true,
		matchOnDetail: true,
	});

	if (selectedItem && selectedItem.uri) {
		try {
			const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(selectedItem.uri));
			await vscode.window.showTextDocument(document);
		} catch (error) {
			const key = createTabKey(selectedItem.group, selectedItem.label, selectedItem.uri);
			archivedTabs.delete(key);
			vscode.window.showErrorMessage(`Failed to open file: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
};

export const archiveTabs = (maxTabAgeInHours = 0) => {
	lg("Archiving tabs!");

	vscode.window.tabGroups.all.forEach((tabGroup) => {
		lg(`Group ${tabGroup.viewColumn}`);

		const maxTabsInGroup = getSettingValue("tabarchive.numberOfTabsInGroup");

		const numberOfTabsExtra = tabGroup.tabs.length - maxTabsInGroup;

		if (numberOfTabsExtra < 1) {
			lg("No tabs in extra");
			return;
		}

		const archivableTabsByUri = new Map<string, vscode.Tab>();
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
					archivableTabsByUri.set(tab.input.uri.toString(), tab);
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
			.filter(([uri]) => archivableTabsByUri.has(uri))
			.map(([uri, timeCounter]) => [timeCounter, uri])
			.sort()
			.reverse()
			.map(([timeCounter, uri]) => [uri, timeCounter])
			.slice(0, numberOfTabsExtra)
			.forEach(([uri]) => {
				const tabUri = String(uri);
				const tab = archivableTabsByUri.get(String(uri));
				if (!tab) {
					return;
				}
				const label = tab.label;

				lg(`Group ${tabGroup.viewColumn} - Archiving tab ${label}`);

				const tabKey = createTabKey(tabGroup.viewColumn.toString(), label, tabUri);
				archivedTabs.set(tabKey, {
					date,
					group: tabGroup.viewColumn.toString(),
					label,
					uri: tabUri,
				});

				vscode.window.tabGroups.close(tab);
			});
	});
};
