import * as vscode from "vscode";
import {
	closeTabs,
	createTabTimeCounters,
	incrementTabTimeCounter,
	listAutomaticallyClosedTabs,
	removeTabTimeCounter,
	resetTabTimeCounter,
	storeTabTimeCounters,
} from "./autoclosetabs";
import { INTERVAL_IN_MINUTES, lg } from "./common";
import { getSettingValue, updateSettingValue } from "./settings";

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
	getSettingValue("autoclosetabs.activation") !== "nowhere-except-included";

const activateInWorkspace = () => {
	const workspaceUri = getWorkspaceUri();

	if (!workspaceUri) {
		vscode.window.showInformationMessage(
			"Auto Close Tabs cannot be activated in a temporary workspace.",
		);
		return;
	}

	if (isActiveByDefault()) {
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

		updateSettingValue(settingSection, [...includedWorkspaces, workspaceUri]);
	}
};

const deactivateInWorkspace = () => {
	const workspaceUri = getWorkspaceUri();

	if (!workspaceUri) {
		vscode.window.showInformationMessage(
			"Auto Close Tabs cannot be deactivated in a temporary workspace.",
		);
		return;
	}

	if (isActiveByDefault()) {
		const settingSection = "autoclosetabs.excludedWorkspaces";

		const excludedWorkspaces = getSettingValue(settingSection);

		updateSettingValue(settingSection, [...excludedWorkspaces, workspaceUri]);
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
};

const registerCommands = (context: vscode.ExtensionContext) => {
	context.subscriptions.push(
		vscode.commands.registerCommand(
			"autoclosetabs.closeAsManyTabsAsPossible",
			() => closeTabs(),
		),
	);

	context.subscriptions.push(
		vscode.commands.registerCommand("autoclosetabs.activate", () =>
			activateInWorkspace(),
		),
	);

	context.subscriptions.push(
		vscode.commands.registerCommand("autoclosetabs.deactivate", () =>
			deactivateInWorkspace(),
		),
	);

	context.subscriptions.push(
		vscode.commands.registerCommand(
			"autoclosetabs.listAutomaticallyClosedTabs",
			() => listAutomaticallyClosedTabs(),
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

const setActiveInWorkspaceState = () =>
	vscode.commands.executeCommand(
		"setContext",
		"autoclosetabs.activeInWorkspace",
		isActiveInWorkspace() ? "yes" : "no",
	);

export function activate(context: vscode.ExtensionContext) {
	console.info("Activating autoclosetabs...");

	registerCommands(context);
	setActiveInWorkspaceState();
	createTabTimeCounters(context);

	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(({ affectsConfiguration }) => {
			if (
				affectsConfiguration("autoclosetabs.activation") ||
				affectsConfiguration("autoclosetabs.excludedWorkspaces") ||
				affectsConfiguration("autoclosetabs.includedWorkspaces")
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
				closeTabs(getSettingValue("autoclosetabs.tabAgeForAutomaticClosing"));
			}
		},
		INTERVAL_IN_MINUTES * 60 * 1000,
	);
}

export function deactivate() {
	console.info("Deactivating autoclosetabs...");
	lg(interval);
	clearInterval(interval);
}
