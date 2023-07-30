import * as vscode from "vscode";
import { getSettingValue, updateSettingValue } from "./settings";

const LOG_ACTIVE = false;

const tabTimestamps: {
	[tabGroupId: number]: {
		[tabUri: string]: number;
	};
} = {};

let interval: ReturnType<typeof setInterval>;

const log = (...args: unknown[]) => LOG_ACTIVE && console.info(...args);

const closeTabs = (maxTabAgeInHours: number) => {
	log("Closing tabs!");

	const maxTabAge = maxTabAgeInHours * 60 * 60 * 1000;

	vscode.window.tabGroups.all.forEach((tabGroup) => {
		log(`Group ${tabGroup.viewColumn}`);

		const maxTabsInGroup = getSettingValue(
			"autoclosetabs.maximumNumberOfTabsInGroup",
		);

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

		const groupTabTimestamps = tabTimestamps[tabGroup.viewColumn];

		if (!groupTabTimestamps) {
			log("No group tab timestamps");
			return;
		}

		Object.entries(groupTabTimestamps)
			.filter(([, timestamp]) => Date.now() - timestamp > maxTabAge)
			.filter(([uri]) => closableTabUris.includes(uri))
			.map(([uri, timestamp]) => [timestamp, uri])
			.sort()
			.map(([timestamp, uri]) => [uri, timestamp])
			.slice(0, numberOfTabsExtra)
			.forEach(([uri]) => {
				log(`Closing tab ${tabGroup.viewColumn}-${uri}`);
				vscode.window.tabGroups.close(closableTabsByUri[uri]);
			});
	});
};

const getWorkspaceUri = (): string | null => {
	const workspaceFileUri = vscode.workspace.workspaceFile?.toString();

	if (workspaceFileUri && !workspaceFileUri.startsWith("untitled:")) {
		log(`Workspace file URI is ${workspaceFileUri}`);
		return workspaceFileUri;
	}

	const workspaceFolders = vscode.workspace.workspaceFolders;

	if (workspaceFolders?.length === 1) {
		const workspaceFolderUri = workspaceFolders[0].uri.toString();
		log(`Workspace folder URI is ${workspaceFolderUri}`);
		return workspaceFolderUri;
	}

	log("No permanent workspace URI");

	return null;
};

const registerCommands = (context: vscode.ExtensionContext) => {
	context.subscriptions.push(
		vscode.commands.registerCommand("autoclosetabs.closeUnusedTabs", () =>
			closeTabs(
				getSettingValue("autoclosetabs.tabAgeForClosingWithManualCommand"),
			),
		),
	);

	context.subscriptions.push(
		vscode.commands.registerCommand("autoclosetabs.activate", () => {
			const workspaceUri = getWorkspaceUri();

			if (!workspaceUri) {
				vscode.window.showInformationMessage(
					"Auto Close Tabs cannot be activated in a temporary workspace.",
				);
				return;
			}

			const activeByDefault =
				getSettingValue("autoclosetabs.activation") !==
				"nowhere-except-included";

			if (activeByDefault) {
				const settingSection = "autoclosetabs.excludedWorkspaces";

				const excludedWorkspaces = getSettingValue(settingSection);

				updateSettingValue(
					settingSection,
					excludedWorkspaces.filter(
						(excludedWorkspace) => excludedWorkspace !== workspaceUri,
					),
				);
			} else {
				const settingSection = "autoclosetabs.includedWorkspaces";

				const includedWorkspaces = getSettingValue(settingSection);

				updateSettingValue(settingSection, [
					...includedWorkspaces,
					workspaceUri,
				]);
			}
		}),
	);

	context.subscriptions.push(
		vscode.commands.registerCommand("autoclosetabs.deactivate", () => {
			const workspaceUri = getWorkspaceUri();

			if (!workspaceUri) {
				vscode.window.showInformationMessage(
					"Auto Close Tabs cannot be deactivated in a temporary workspace.",
				);
				return;
			}

			const activeByDefault =
				getSettingValue("autoclosetabs.activation") !==
				"nowhere-except-included";

			if (activeByDefault) {
				const settingSection = "autoclosetabs.excludedWorkspaces";

				const excludedWorkspaces = getSettingValue(settingSection);

				updateSettingValue(settingSection, [
					...excludedWorkspaces,
					workspaceUri,
				]);
			} else {
				const settingSection = "autoclosetabs.includedWorkspaces";

				const includedWorkspaces = getSettingValue(settingSection);

				updateSettingValue(
					settingSection,
					includedWorkspaces.filter(
						(includedWorkspace) => includedWorkspace !== workspaceUri,
					),
				);
			}
		}),
	);
};

const isActive = (): boolean => {
	const activeByDefault =
		getSettingValue("autoclosetabs.activation") !== "nowhere-except-included";

	const workspaceUri = getWorkspaceUri();

	if (activeByDefault) {
		if (!workspaceUri) {
			return true;
		}

		const excludedWorkspaces = getSettingValue(
			"autoclosetabs.excludedWorkspaces",
		);

		return !excludedWorkspaces.includes(workspaceUri);
	} else {
		if (!workspaceUri) {
			return false;
		}

		const includedWorkspaces = getSettingValue(
			"autoclosetabs.includedWorkspaces",
		);

		return includedWorkspaces.includes(workspaceUri);
	}
};

const updateTabTimestamp = (tab: vscode.Tab) => {
	log("Trying to update timestamp...");

	if (!(tab.input instanceof vscode.TabInputText)) {
		return;
	}

	const tabUri = tab.input.uri.toString();

	if (tabUri.startsWith("untitled:")) {
		return;
	}

	if (!tabTimestamps[tab.group.viewColumn]) {
		tabTimestamps[tab.group.viewColumn] = {};
	}

	tabTimestamps[tab.group.viewColumn][tabUri] = Date.now();

	log(tabTimestamps);
};

const removeTabTimestamp = (tab: vscode.Tab) => {
	log("Removing timestamp...");

	if (!(tab.input instanceof vscode.TabInputText)) {
		return;
	}

	const tabUri = tab.input.uri.toString();

	if (tabTimestamps[tab.group.viewColumn]) {
		delete tabTimestamps[tab.group.viewColumn]?.[tabUri];
	}

	log(tabTimestamps);
};

const setActiveState = () =>
	vscode.commands.executeCommand(
		"setContext",
		"autoclosetabs.active",
		isActive(),
	);

export function activate(context: vscode.ExtensionContext) {
	registerCommands(context);
	setActiveState();

	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(({ affectsConfiguration }) => {
			if (
				affectsConfiguration("autoclosetabs.activation") ||
				affectsConfiguration("autoclosetabs.excludedWorkspaces") ||
				affectsConfiguration("autoclosetabs.includedWorkspaces")
			) {
				setActiveState();
			}
		}),
	);

	vscode.window.tabGroups.all.forEach((tabGroup) =>
		tabGroup.tabs.forEach(updateTabTimestamp),
	);

	context.subscriptions.push(
		vscode.window.tabGroups.onDidChangeTabs(({ opened, closed, changed }) => {
			[...opened, ...changed].forEach(updateTabTimestamp);
			closed.forEach(removeTabTimestamp);
		}),
	);

	interval = setInterval(
		() =>
			isActive() &&
			closeTabs(getSettingValue("autoclosetabs.tabAgeForAutomaticClosing")),
		20 * 60 * 1000,
	);
}

// This is not called when testing with the .vsix file; I hope it will be with the published extension
export function deactivate() {
	log("Deactivate autoclosetabs");
	log(interval);
	clearInterval(interval);
}
