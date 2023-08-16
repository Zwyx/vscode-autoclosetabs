import * as vscode from "vscode";

const settings = {
	"autoclosetabs.activation": {
		type: "string",
		default: "everywhere-except-excluded",
	},
	"autoclosetabs.excludedWorkspaces": {
		type: "array",
		default: [],
	},
	"autoclosetabs.includedWorkspaces": {
		type: "array",
		default: [],
	},
	"autoclosetabs.numberOfTabsInGroup": {
		type: "number",
		minimum: 0,
		default: 5,
	},
	"autoclosetabs.tabAgeForAutomaticClosing": {
		type: "number",
		minimum: 1,
		default: 12,
	},
};

type SettingKey = keyof typeof settings;

export function getSettingValue(settingKey: "autoclosetabs.activation"): string;
export function getSettingValue(
	settingKey: "autoclosetabs.excludedWorkspaces",
): string[];
export function getSettingValue(
	settingKey: "autoclosetabs.includedWorkspaces",
): string[];
export function getSettingValue(
	settingKey: "autoclosetabs.numberOfTabsInGroup",
): number;
export function getSettingValue(
	settingKey: "autoclosetabs.tabAgeForAutomaticClosing",
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
