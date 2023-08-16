# Auto Close Tabs

This extension automatically closes tabs that have not been used for a defined length of time — 12 hours, by default.

However, it only closes tabs if the group contains more than a defined number of tabs — 5, by default.

Also, it doesn't close tabs that have changes, tabs that are pinned, and the active tab of each group.

The age of the opened tabs is persisted when the workspace is closed, and resumes incrementing when the workspace is reopened.

The extension also provides the command `Auto Close Tabs: Closed as many tabs as possible` which close all tabs except the 5 (by default) most recently used ones, in each group. (It also doesn't close tabs with changes, pinned tabs, and the active one.)

## Extension Settings

### `autoclosetabs.activation`

Can be one of two values:

- `everywhere-except-excluded`: the extension will automatically close unused tabs in all workspaces, except the ones present in the `Excluded` list;
- `nowhere-except-included`: the extension will automatically close unused tabs only in the workspaces present in the `Included` list.

The default value is `everywhere-except-excluded`.

### `autoclosetabs.excludedWorkspaces`

> This setting is only used when `autoclosetabs.activation` is equal to `everywhere-except-excluded`.

List of workspaces in which the extension will not automatically close unused tabs.

To add a workspace to this list, use the command `Auto Close Tabs: Deactivate automatic closing of unused tabs for this workspace`.

### `autoclosetabs.includedWorkspaces`

> This setting is only used when `autoclosetabs.activation` is equal to `nowhere-except-included`.

List of workspaces in which the extension will automatically close unused tabs.

To add a workspace to this list, use the command `Auto Close Tabs: Activate automatic closing of unused tabs for this workspace`.

### `autoclosetabs.numberOfTabsInGroup`

Unused tabs will be closed only if the number of tabs in the group is greater than this number; enter `0` to close all unused tabs.

The default value is `5`.

### `autoclosetabs.tabAgeForAutomaticClosing`

Number of hours after which an unused tab is automatically closed.

The default value is `12`.

## Release Notes

### 1.0.0

Initial release of Auto Close Tabs.
