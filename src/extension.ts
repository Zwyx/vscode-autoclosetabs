import * as vscode from "vscode";
import { INTERVAL_IN_MINUTES, lg } from "./common";
import { getSettingValue, updateSettingValue } from "./settings";
import {
	archiveTabs,
	createTabTimeCounters,
	incrementTabTimeCounter,
	listArchivedTabs,
	removeTabTimeCounter,
	resetTabTimeCounter,
	storeTabTimeCounters,
} from "./tabarchive";

let interval: ReturnType<typeof setInterval>;

const getWorkspaceUri = (): string | null => {
	const workspaceFileUri = vscode.workspace.workspaceFile?.toString();

	if (workspaceFileUri && !workspaceFileUri.startsWith("untitled:")) {
		lg(`Workspace file URI is ${workspaceFileUri}`);
		return workspaceFileUri;
	}

	const workspaceFolders = vscode.workspace.workspaceFolders;

	if (workspaceFolders?.length === 1) {
		const workspaceFolderUri = workspaceFolders[0].uri.toString();
		lg(`Workspace folder URI is ${workspaceFolderUri}`);
		return workspaceFolderUri;
	}

	lg("No permanent workspace URI");

	return null;
};

const isActiveByDefault = () =>
	getSettingValue("tabarchive.activation") !== "nowhere-except-included";

const activateInWorkspace = () => {
	const workspaceUri = getWorkspaceUri();

	if (!workspaceUri) {
		vscode.window.showInformationMessage(
			"Tab Archive cannot be activated in a temporary workspace.",
		);
		return;
	}

	if (isActiveByDefault()) {
		const settingSection = "tabarchive.excludedWorkspaces";

		const excludedWorkspaces = getSettingValue(settingSection);

		updateSettingValue(
			settingSection,
			excludedWorkspaces.filter(
				(excludedWorkspace) => excludedWorkspace !== workspaceUri,
			),
		);
	} else {
		const settingSection = "tabarchive.includedWorkspaces";

		const includedWorkspaces = getSettingValue(settingSection);

		updateSettingValue(settingSection, [...includedWorkspaces, workspaceUri]);
	}
};

const deactivateInWorkspace = () => {
	const workspaceUri = getWorkspaceUri();

	if (!workspaceUri) {
		vscode.window.showInformationMessage(
			"Tab Archive cannot be deactivated in a temporary workspace.",
		);
		return;
	}

	if (isActiveByDefault()) {
		const settingSection = "tabarchive.excludedWorkspaces";

		const excludedWorkspaces = getSettingValue(settingSection);

		updateSettingValue(settingSection, [...excludedWorkspaces, workspaceUri]);
	} else {
		const settingSection = "tabarchive.includedWorkspaces";

		const includedWorkspaces = getSettingValue(settingSection);

		updateSettingValue(
			settingSection,
			includedWorkspaces.filter(
				(includedWorkspace) => includedWorkspace !== workspaceUri,
			),
		);
	}
};

const registerCommands = (context: vscode.ExtensionContext) => {
	context.subscriptions.push(
		vscode.commands.registerCommand(
			"tabarchive.archiveAsManyTabsAsPossible",
			() => archiveTabs(),
		),
	);

	context.subscriptions.push(
		vscode.commands.registerCommand("tabarchive.activate", () =>
			activateInWorkspace(),
		),
	);

	context.subscriptions.push(
		vscode.commands.registerCommand("tabarchive.deactivate", () =>
			deactivateInWorkspace(),
		),
	);

	context.subscriptions.push(
		vscode.commands.registerCommand(
			"tabarchive.listArchivedTabs",
			() => listArchivedTabs(),
		),
	);
};

const isActiveInWorkspace = (): boolean => {
	const workspaceUri = getWorkspaceUri();

	if (isActiveByDefault()) {
		if (!workspaceUri) {
			return true;
		}

		const excludedWorkspaces = getSettingValue(
			"tabarchive.excludedWorkspaces",
		);

		return !excludedWorkspaces.includes(workspaceUri);
	} else {
		if (!workspaceUri) {
			return false;
		}

		const includedWorkspaces = getSettingValue(
			"tabarchive.includedWorkspaces",
		);

		return includedWorkspaces.includes(workspaceUri);
	}
};

const setActiveInWorkspaceState = () =>
	vscode.commands.executeCommand(
		"setContext",
		"tabarchive.activeInWorkspace",
		isActiveInWorkspace() ? "yes" : "no",
	);

export function activate(context: vscode.ExtensionContext) {
	lg("Activating Tab Archive...");

	registerCommands(context);
	setActiveInWorkspaceState();
	createTabTimeCounters(context);

	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(({ affectsConfiguration }) => {
			if (
				affectsConfiguration("tabarchive.activation") ||
				affectsConfiguration("tabarchive.excludedWorkspaces") ||
				affectsConfiguration("tabarchive.includedWorkspaces")
			) {
				setActiveInWorkspaceState();
			}
		}),
	);

	context.subscriptions.push(
		vscode.window.tabGroups.onDidChangeTabs(({ opened, changed, closed }) => {
			[...opened, ...changed].forEach(resetTabTimeCounter);
			closed.forEach(removeTabTimeCounter);
		}),
	);

	interval = setInterval(
		() => {
			vscode.window.tabGroups.all.forEach((tabGroup) =>
				tabGroup.tabs.forEach(incrementTabTimeCounter),
			);

			storeTabTimeCounters(context);

			if (isActiveInWorkspace()) {
				archiveTabs(getSettingValue("tabarchive.tabAgeForAutomaticArchiving"));
			}
		},
		INTERVAL_IN_MINUTES * 60 * 1000,
	);
}

export function deactivate() {
	lg("Deactivating Tab Archive...");
	lg(interval);
	clearInterval(interval);
}
