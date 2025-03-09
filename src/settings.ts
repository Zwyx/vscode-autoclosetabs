import * as vscode from "vscode";

const settings = {
	"tabarchive.activation": {
		type: "string",
		default: "everywhere-except-excluded",
	},
	"tabarchive.excludedWorkspaces": {
		type: "array",
		default: [],
	},
	"tabarchive.includedWorkspaces": {
		type: "array",
		default: [],
	},
	"tabarchive.numberOfTabsInGroup": {
		type: "number",
		minimum: 0,
		default: 5,
	},
	"tabarchive.tabAgeForAutomaticArchiving": {
		type: "number",
		minimum: 1,
		default: 12,
	},
};

type SettingKey = keyof typeof settings;

export function getSettingValue(settingKey: "tabarchive.activation"): string;
export function getSettingValue(
	settingKey: "tabarchive.excludedWorkspaces",
): string[];
export function getSettingValue(
	settingKey: "tabarchive.includedWorkspaces",
): string[];
export function getSettingValue(
	settingKey: "tabarchive.numberOfTabsInGroup",
): number;
export function getSettingValue(
	settingKey: "tabarchive.tabAgeForAutomaticArchiving",
): number;
export function getSettingValue(
	settingKey: SettingKey,
): string | string[] | number | undefined {
	const setting = settings[settingKey];
	const value = vscode.workspace.getConfiguration().get(settingKey);

	if (setting.type === "string") {
		return typeof value === "string" ? value : setting.default;
	}

	if (setting.type === "array") {
		return Array.isArray(value)
			? value.filter((element) => typeof element === "string")
			: setting.default;
	}

	if (setting.type === "number") {
		if (typeof value !== "number") {
			return setting.default;
		}

		if ("minimum" in setting && value < setting.minimum) {
			return setting.minimum;
		}

		return value;
	}
}

export const updateSettingValue = (section: SettingKey, value: unknown) =>
	vscode.workspace
		.getConfiguration()
		.update(section, value, vscode.ConfigurationTarget.Global);
