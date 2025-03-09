# Tab Archive

- **Automatically archives tabs that have not been used for a defined length of time** — 12 hours, by default.

- **Only archives tabs if the group contains more than a defined number of tabs** — 5, by default.

- **Doesn't archive tabs that have changes, tabs that are pinned, and the active tab** of each group.

The age of the opened tabs is persisted when the workspace is closed, and resumes incrementing when the workspace is reopened.

## Commands

In addition to automatically archiving unused tabs, the extension provides the following commands.

### `Tab Archive: Archive as many tabs as possible`

Archive all tabs except the 5 (by default) most recently used ones, in each group. (It also doesn't archive tabs with changes, pinned tabs, and the active one.)

### `Tab Archive: List recently archived tabs`

List the tabs that have been automatically archived since the workspace was opened. Use it to adjust the `tabarchive.numberOfTabsInGroup` and `tabarchive.tabAgeForAutomaticArchiving` settings if you find that tabs are archived more/less often than you wish.

## Settings

### `tabarchive.activation`

Can be one of two values:

- `everywhere-except-excluded`: the extension will automatically archive unused tabs in all workspaces, except the ones present in the `Excluded` list;
- `nowhere-except-included`: the extension will automatically archive unused tabs only in the workspaces present in the `Included` list.

The default value is `everywhere-except-excluded`.

> Note: this way of activating tab auto-archiving allows you to do it on a per project/workspace basis, without relying on a project's `.vscode/settings.json` file, as this file is often committed and shared with collaborators.

### `tabarchive.excludedWorkspaces`

> This setting is only used when `tabarchive.activation` is equal to `everywhere-except-excluded`.

List of workspaces in which the extension will not automatically archive unused tabs.

To add a workspace to this list, use the command `Tab Archive: Deactivate automatic archiving of unused tabs for this workspace`.

### `tabarchive.includedWorkspaces`

> This setting is only used when `tabarchive.activation` is equal to `nowhere-except-included`.

List of workspaces in which the extension will automatically archive unused tabs.

To add a workspace to this list, use the command `Tab Archive: Activate automatic archiving of unused tabs for this workspace`.

### `tabarchive.numberOfTabsInGroup`

Unused tabs will be archived only if the number of tabs in the group is greater than this number; enter `0` to archive all unused tabs.

The default value is `5`.

### `tabarchive.tabAgeForAutomaticArchiving`

Number of hours after which an unused tab is automatically archived.

The default value is `12`.
