import * as vscode from 'vscode';
import { DataverseConnection, getDataverseConnection } from '../dataverse/dataverseConnection';
import { applyEnvironmentVariableChanges, loadEnvironmentVariables } from '../dataverse/environmentVariableClient';
import { EnvironmentVariableManagerState, createInitialEnvironmentVariableManagerState } from '../product/choiceEditorState';
import { buildEnvironmentVariableManagerViewModel } from '../product/choiceEditorViewModelBuilder';
import { renderEnvironmentVariableManagerHtml } from '../webview/renderChoiceEditorHtml';

const panelTitle = 'DV Environment Variable Manager';

type WebviewMessage = {
	command?: string;
	payload?: Record<string, unknown>;
};


type EnvironmentVariableDefinitionArtifact = {
	artifactType?: string;
	version?: string;
	kind?: string;
	generatedBy?: string;
	generatedUtc?: string;
	sourceEnvironment?: string | null;
	targetEnvironment?: string | null;
	source?: string;
	variables?: EnvironmentVariableDefinitionItem[];
	operations?: EnvironmentVariableArtifactOperation[];
	findingIds?: string[];
	notes?: string[];
};

type EnvironmentVariableDefinitionItem = {
	schemaName?: string;
	displayName?: string;
	type?: string;
	defaultValue?: string;
	currentValue?: unknown;
	isManaged?: boolean;
};

type EnvironmentVariableArtifactOperation = {
	operation?: string;
	schemaName?: string;
	displayName?: string;
	previousValue?: unknown;
	nextValue?: unknown;
};

type ImportStats = {
	staged: number;
	skipped: number;
	missing: number;
	invalid: number;
	unsupported: number;
	creates: number;
	updates: number;
	deletes: number;
};

function getArtifactVariables(raw: unknown): EnvironmentVariableDefinitionItem[] {
	if (!raw || typeof raw !== 'object') {
		return [];
	}

	const candidate = raw as EnvironmentVariableDefinitionArtifact | EnvironmentVariableDefinitionItem;
	if (Array.isArray((candidate as EnvironmentVariableDefinitionArtifact).variables)) {
		return (candidate as EnvironmentVariableDefinitionArtifact).variables ?? [];
	}

	if (typeof (candidate as EnvironmentVariableDefinitionItem).schemaName === 'string') {
		return [candidate as EnvironmentVariableDefinitionItem];
	}

	return [];
}

function getArtifactOperations(raw: unknown): EnvironmentVariableArtifactOperation[] {
	if (!raw || typeof raw !== 'object') {
		return [];
	}

	const candidate = raw as EnvironmentVariableDefinitionArtifact;
	return Array.isArray(candidate.operations) ? candidate.operations : [];
}

async function folderExists(uri: vscode.Uri): Promise<boolean> {
	try {
		const stat = await vscode.workspace.fs.stat(uri);
		return stat.type === vscode.FileType.Directory;
	} catch {
		return false;
	}
}

async function getWorkspaceExportsUri(options?: { create?: boolean }): Promise<vscode.Uri | undefined> {
	const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
	if (!workspaceFolders.length) {
		return undefined;
	}

	const foldersWithDvForgeLab: vscode.WorkspaceFolder[] = [];
	for (const folder of workspaceFolders) {
		const dvForgeLabRoot = vscode.Uri.joinPath(folder.uri, '.dvforgelab');
		if (await folderExists(dvForgeLabRoot)) {
			foldersWithDvForgeLab.push(folder);
		}
	}

	const selectedFolder = foldersWithDvForgeLab[0] ?? workspaceFolders[0];
	const exportsUri = vscode.Uri.joinPath(selectedFolder.uri, '.dvforgelab', 'dvevm', 'exports');
	if (options?.create) {
		await vscode.workspace.fs.createDirectory(exportsUri);
	}

	return exportsUri;
}

function formatTimestamp(date = new Date()): string {
	const pad = (value: number): string => value.toString().padStart(2, '0');
	return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function sanitizeFilePart(value: string | undefined): string {
	const cleaned = (value ?? 'environment').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
	return cleaned || 'environment';
}

function isDvevmArtifact(raw: unknown): boolean {
	if (!raw || typeof raw !== 'object') {
		return false;
	}
	const candidate = raw as EnvironmentVariableDefinitionArtifact;
	return candidate.artifactType === 'dvevm.environmentVariableDefinitions' || candidate.kind === 'dv-forgelab.environment-variable-definitions';
}

function getExtensionVersion(context: vscode.ExtensionContext): string {
	const packageJson = context.extension.packageJSON as { version?: unknown };
	return typeof packageJson.version === 'string' ? packageJson.version : 'unknown';
}

function buildFeedbackUri(context: vscode.ExtensionContext): vscode.Uri {
	const version = encodeURIComponent(getExtensionVersion(context));
	return vscode.Uri.parse(`https://dvforgelab.com/feedback?product=dvevm&version=${version}`);
}

function normalizeArtifactValue(type: string, rawValue: unknown): string | undefined {
	if (rawValue === undefined || rawValue === null) {
		return undefined;
	}

	if (typeof rawValue === 'string') {
		return rawValue;
	}

	if (type === 'JSON') {
		return JSON.stringify(rawValue);
	}

	return String(rawValue);
}

export async function openEnvironmentVariableManagerCommand(context: vscode.ExtensionContext): Promise<void> {
	let connection: DataverseConnection | undefined;
	const state: EnvironmentVariableManagerState = createInitialEnvironmentVariableManagerState();

	const panel = vscode.window.createWebviewPanel(
		'dvEnvironmentVariableManager',
		panelTitle,
		vscode.ViewColumn.One,
		{
			enableScripts: true,
			localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'images')]
		}
	);

	const logoUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'images', 'dv-utilities-icon-128.png'));

	function render(): void {
		panel.webview.html = renderEnvironmentVariableManagerHtml(buildEnvironmentVariableManagerViewModel(state), {
			logoUri: logoUri.toString(),
			cspSource: panel.webview.cspSource
		});
	}

	async function refreshVariables(): Promise<void> {
		if (!connection) {
			await connect(false);
			return;
		}

		state.message = { kind: 'Info', text: 'Loading environment variables...' };
		render();

		state.variables = await loadEnvironmentVariables(connection.client);
		state.pendingChanges = [];
		state.previewOpen = false;
		state.message = {
			kind: 'Info',
			text: state.variables.length
				? `${state.variables.length} environment variable definition(s) loaded.`
				: 'No environment variable definitions found in this environment.'
		};
		render();
	}

	async function connect(forcePick = false): Promise<void> {
		try {
			state.message = { kind: 'Info', text: 'Connecting to Dataverse...' };
			render();

			connection = await getDataverseConnection(context, { forcePick });
			if (!connection) {
				state.message = { kind: 'Warning', text: 'Connection cancelled.' };
				render();
				return;
			}

			state.environment = {
				label: connection.environmentLabel,
				url: connection.environmentUrl
			};
			state.variables = [];
			state.pendingChanges = [];
			state.previewOpen = false;
			await refreshVariables();
		} catch (error) {
			state.message = { kind: 'Error', text: error instanceof Error ? error.message : String(error) };
			render();
		}
	}


	function normalizeValue(variable: { type: string; displayName: string }, rawValue: string): string | undefined {
		const value = rawValue.trim();

		if (variable.type === 'Decimal') {
			if (!/^-?\d+(\.\d+)?$/.test(value)) {
				vscode.window.showWarningMessage(`${variable.displayName} expects a numeric value. Banana is not a number.`);
				return undefined;
			}
			return value;
		}

		if (variable.type === 'TwoOptions') {
			const normalized = value.toLowerCase();
			if (['yes', 'true', '1'].includes(normalized)) {
				return 'yes';
			}
			if (['no', 'false', '0'].includes(normalized)) {
				return 'no';
			}
			vscode.window.showWarningMessage(`${variable.displayName} expects yes/no, true/false, or 1/0.`);
			return undefined;
		}

		if (variable.type === 'JSON') {
			try {
				JSON.parse(value);
				return value;
			} catch {
				vscode.window.showWarningMessage(`${variable.displayName} expects valid JSON.`);
				return undefined;
			}
		}

		return rawValue;
	}

	function stageValue(payload?: Record<string, unknown>): void {
		const id = typeof payload?.id === 'string' ? payload.id : undefined;
		if (!id) {
			return;
		}

		const variable = state.variables.find(item => item.id === id);
		if (!variable) {
			return;
		}

		if (variable.type === 'Secret') {
			state.message = { kind: 'Warning', text: 'Secret environment variables are visible but cannot be edited in this utility.' };
			render();
			return;
		}

		const isCreate = !variable.currentValueId;
		void vscode.window.showInputBox({
			title: `${isCreate ? 'Create current value for' : 'Edit'} ${variable.displayName}`,
			prompt: isCreate
				? 'Enter the new current value. This will create an environment-specific value after preview/apply.'
				: 'Enter the new current value. This is staged locally until preview/apply.',
			value: variable.currentValue ?? variable.defaultValue ?? '',
			ignoreFocusOut: true
		}).then((nextValue: string | undefined) => {
			if (nextValue === undefined) {
				return;
			}

			const normalizedValue = normalizeValue(variable, nextValue);
			if (normalizedValue === undefined) {
				return;
			}

			state.pendingChanges = state.pendingChanges.filter(change => change.definitionId !== variable.id);
			state.pendingChanges.push({
				kind: isCreate ? 'CreateValue' : 'UpdateValue',
				definitionId: variable.id,
				valueId: variable.currentValueId,
				variableName: variable.displayName,
				previousValue: variable.currentValue ?? variable.defaultValue,
				nextValue: normalizedValue
			});
			state.variables = state.variables.map(item => item.id === variable.id ? { ...item, displayValue: normalizedValue, pendingState: isCreate ? 'Created' : 'Updated' } : item);
			state.previewOpen = false;
			state.message = { kind: 'Info', text: `Staged ${isCreate ? 'current value creation' : 'update'} for ${variable.displayName}.` };
			render();
		});
	}


	function stageDeleteValue(payload?: Record<string, unknown>): void {
		const id = typeof payload?.id === 'string' ? payload.id : undefined;
		if (!id) { return; }

		const variable = state.variables.find(item => item.id === id);
		if (!variable || !variable.currentValueId) {
			return;
		}

		if (variable.currentValueIsManaged) {
			state.message = {
				kind: 'Warning',
				text: `${variable.displayName} has a managed current value and cannot be deleted from this utility.`
			};
			render();
			return;
		}

		state.pendingChanges = state.pendingChanges.filter(change => change.definitionId !== variable.id);
		state.pendingChanges.push({
			kind: 'DeleteValue',
			definitionId: variable.id,
			valueId: variable.currentValueId,
			variableName: variable.displayName,
			previousValue: variable.currentValue
		});
		state.variables = state.variables.map(item => item.id === variable.id ? { ...item, displayValue: item.defaultValue ?? '(not set)', pendingState: 'Deleted' } : item);
		state.previewOpen = false;
		state.message = { kind: 'Info', text: `Staged current value deletion for ${variable.displayName}.` };
		render();
	}

	function removePendingChange(payload?: Record<string, unknown>): void {
		const id = typeof payload?.id === 'string' ? payload.id : undefined;
		if (!id) { return; }
		state.pendingChanges = state.pendingChanges.filter(change => change.definitionId !== id);
		state.variables = state.variables.map(variable => {
			if (variable.id !== id) { return variable; }
			return { ...variable, displayValue: variable.currentValue ?? variable.defaultValue ?? '(not set)', pendingState: 'Unchanged' };
		});
		state.previewOpen = false;
		state.message = { kind: 'Info', text: 'Staged change removed.' };
		render();
	}

	function clearPendingChanges(): void {
		state.pendingChanges = [];
		state.previewOpen = false;
		state.variables = state.variables.map(variable => ({ ...variable, displayValue: variable.currentValue ?? variable.defaultValue ?? '(not set)', pendingState: 'Unchanged' }));
		state.message = { kind: 'Info', text: 'Staged environment variable changes cleared.' };
		render();
	}

	function previewChanges(): void {
		if (!state.pendingChanges.length) {
			state.message = { kind: 'Warning', text: 'No staged environment variable changes to preview.' };
			render();
			return;
		}

		state.previewOpen = true;
		state.message = undefined;
		render();
	}

	function cancelPreview(): void {
		state.previewOpen = false;
		render();
	}

	async function applyChanges(): Promise<void> {
		if (!connection || !state.pendingChanges.length) {
			return;
		}

		try {
			state.message = { kind: 'Info', text: 'Applying environment variable changes...' };
			render();
			await applyEnvironmentVariableChanges(connection.client, state.pendingChanges);
			state.message = { kind: 'Info', text: 'Environment variable changes applied.' };
			await refreshVariables();
		} catch (error) {
			state.message = { kind: 'Error', text: error instanceof Error ? error.message : String(error) };
			render();
		}
	}


	function createImportStats(): ImportStats {
		return {
			staged: 0,
			skipped: 0,
			missing: 0,
			invalid: 0,
			unsupported: 0,
			creates: 0,
			updates: 0,
			deletes: 0
		};
	}

	function findVariable(schemaName: string): (typeof state.variables)[number] | undefined {
		return state.variables.find(item => item.schemaName.toLowerCase() === schemaName.toLowerCase());
	}

	function resetVariableDisplay(variableId: string, nextDisplayValue: string, pendingState: 'Created' | 'Updated' | 'Deleted'): void {
		state.variables = state.variables.map(item => item.id === variableId ? { ...item, displayValue: nextDisplayValue, pendingState } : item);
	}

	function stageImportedCurrentValue(variable: (typeof state.variables)[number], rawValue: unknown, stats: ImportStats, explicitKind?: 'CreateValue' | 'UpdateValue'): void {
		if (variable.type === 'Secret') {
			stats.skipped += 1;
			return;
		}

		const importedValue = normalizeArtifactValue(variable.type, rawValue);
		if (importedValue === undefined) {
			stats.skipped += 1;
			return;
		}

		const normalizedValue = normalizeValue(variable, importedValue);
		if (normalizedValue === undefined) {
			stats.invalid += 1;
			return;
		}

		if ((variable.currentValue ?? '') === normalizedValue) {
			stats.skipped += 1;
			return;
		}

		const kind = explicitKind ?? (!variable.currentValueId ? 'CreateValue' : 'UpdateValue');
		if (kind === 'CreateValue' && variable.currentValueId) {
			stats.skipped += 1;
			return;
		}

		state.pendingChanges = state.pendingChanges.filter(change => change.definitionId !== variable.id);
		state.pendingChanges.push({
			kind,
			definitionId: variable.id,
			valueId: variable.currentValueId,
			variableName: variable.displayName,
			previousValue: variable.currentValue ?? variable.defaultValue,
			nextValue: normalizedValue
		});

		resetVariableDisplay(variable.id, normalizedValue, kind === 'CreateValue' ? 'Created' : 'Updated');
		stats.staged += 1;
		if (kind === 'CreateValue') {
			stats.creates += 1;
		} else {
			stats.updates += 1;
		}
	}

	function stageImportedDelete(variable: (typeof state.variables)[number], stats: ImportStats): void {
		if (variable.type === 'Secret') {
			stats.skipped += 1;
			return;
		}
		if (!variable.currentValueId) {
			stats.skipped += 1;
			return;
		}
		if (variable.currentValueIsManaged) {
			stats.skipped += 1;
			return;
		}

		state.pendingChanges = state.pendingChanges.filter(change => change.definitionId !== variable.id);
		state.pendingChanges.push({
			kind: 'DeleteValue',
			definitionId: variable.id,
			valueId: variable.currentValueId,
			variableName: variable.displayName,
			previousValue: variable.currentValue
		});
		resetVariableDisplay(variable.id, variable.defaultValue ?? '(not set)', 'Deleted');
		stats.staged += 1;
		stats.deletes += 1;
	}

	function importLegacyVariables(importedVariables: EnvironmentVariableDefinitionItem[], stats: ImportStats): void {
		for (const imported of importedVariables) {
			const schemaName = imported.schemaName?.trim();
			if (!schemaName) {
				stats.invalid += 1;
				continue;
			}

			const variable = findVariable(schemaName);
			if (!variable) {
				stats.missing += 1;
				continue;
			}

			stageImportedCurrentValue(variable, imported.currentValue, stats);
		}
	}

	function importOperations(operations: EnvironmentVariableArtifactOperation[], stats: ImportStats): void {
		for (const operation of operations) {
			const schemaName = operation.schemaName?.trim();
			if (!schemaName) {
				stats.invalid += 1;
				continue;
			}

			const variable = findVariable(schemaName);
			if (!variable) {
				stats.missing += 1;
				continue;
			}

			switch (operation.operation) {
				case 'SetCurrentValue':
					stageImportedCurrentValue(variable, operation.nextValue, stats, 'UpdateValue');
					break;
				case 'CreateCurrentValue':
					stageImportedCurrentValue(variable, operation.nextValue, stats, 'CreateValue');
					break;
				case 'DeleteCurrentValue':
					stageImportedDelete(variable, stats);
					break;
				default:
					stats.unsupported += 1;
					break;
			}
		}
	}

	async function exportJsonDefinition(): Promise<void> {
		if (!state.variables.length) {
			state.message = { kind: 'Warning', text: 'No environment variables are loaded to export.' };
			render();
			return;
		}

		const artifact: EnvironmentVariableDefinitionArtifact = {
			artifactType: 'dvevm.environmentVariableDefinitions',
			version: '2.0',
			generatedBy: 'DV Environment Variable Manager',
			generatedUtc: new Date().toISOString(),
			sourceEnvironment: state.environment?.label ?? null,
			targetEnvironment: null,
			variables: state.variables
				.filter(variable => variable.type !== 'Secret')
				.map(variable => ({
					schemaName: variable.schemaName,
					displayName: variable.displayName,
					type: variable.type,
					defaultValue: variable.defaultValue,
					currentValue: variable.currentValue,
					isManaged: variable.isManaged
				})),
			operations: []
		};

		const workspaceExportsUri = await getWorkspaceExportsUri({ create: true });
		const filename = `dvevm-${sanitizeFilePart(state.environment?.label)}-${formatTimestamp()}.json`;
		let uri: vscode.Uri | undefined;

		if (workspaceExportsUri) {
			uri = vscode.Uri.joinPath(workspaceExportsUri, filename);
		} else {
			uri = await vscode.window.showSaveDialog({
				defaultUri: vscode.Uri.file(filename),
				filters: {
					'DVEVM JSON': ['json'],
					'JSON': ['json']
				},
				saveLabel: 'Export JSON'
			});
		}

		if (!uri) {
			return;
		}

		await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(`${JSON.stringify(artifact, null, 2)}\n`));
		const workspaceMessage = workspaceExportsUri ? 'Evidence Workspace export' : 'Export';
		state.message = { kind: 'Info', text: `${workspaceMessage} complete: exported ${artifact.variables?.length ?? 0} environment variable definition(s) to ${uri.fsPath}.` };
		void vscode.window.showInformationMessage(`${workspaceMessage} complete: ${uri.fsPath}`);
		render();
	}

	async function importJsonDefinition(): Promise<void> {
		if (!connection) {
			await connect(false);
			if (!connection) {
				return;
			}
		}

		if (!state.variables.length) {
			await refreshVariables();
		}

		const workspaceExportsUri = await getWorkspaceExportsUri({ create: true });
		const defaultUri = workspaceExportsUri ? workspaceExportsUri : undefined;
		const [uri] = await vscode.window.showOpenDialog({
			canSelectFiles: true,
			canSelectFolders: false,
			canSelectMany: false,
			defaultUri,
			filters: {
				'DVEVM JSON': ['dvevm.json', 'json'],
				'JSON': ['json']
			},
			openLabel: 'Import JSON'
		}) ?? [];

		if (!uri) {
			return;
		}

		try {
			const bytes = await vscode.workspace.fs.readFile(uri);
			const text = new TextDecoder().decode(bytes);
			const artifact = JSON.parse(text) as unknown;
			const operations = getArtifactOperations(artifact);
			const importedVariables = getArtifactVariables(artifact);

			if (!isDvevmArtifact(artifact) && !importedVariables.length) {
				state.message = { kind: 'Warning', text: 'The selected JSON file does not contain DVEVM environment variable definitions.' };
				render();
				return;
			}

			const stats = createImportStats();
			if (operations.length) {
				importOperations(operations, stats);
			} else {
				importLegacyVariables(importedVariables, stats);
			}

			state.previewOpen = false;
			const generatedBy = typeof (artifact as EnvironmentVariableDefinitionArtifact).generatedBy === 'string'
				? (artifact as EnvironmentVariableDefinitionArtifact).generatedBy
				: 'JSON artifact';
			state.message = {
				kind: stats.staged ? 'Info' : 'Warning',
				text: `Imported DVEVM artifact from ${generatedBy}. Staged ${stats.staged} (${stats.creates} create, ${stats.updates} update, ${stats.deletes} delete), skipped ${stats.skipped}, missing ${stats.missing}, invalid ${stats.invalid}, unsupported ${stats.unsupported}.`
			};
			render();
		} catch (error) {
			state.message = { kind: 'Error', text: error instanceof Error ? error.message : String(error) };
			render();
		}
	}

	async function handleMessage(message: WebviewMessage): Promise<void> {
		switch (message.command) {
			case 'connect':
				await connect(false);
				break;
			case 'changeEnvironment':
				await connect(true);
				break;
			case 'refresh':
				await refreshVariables();
				break;
			case 'openFeedback':
				await vscode.env.openExternal(buildFeedbackUri(context));
				break;
			case 'importJson':
				await importJsonDefinition();
				break;
			case 'exportJson':
				await exportJsonDefinition();
				break;
			case 'editVariable':
				stageValue(message.payload);
				break;
			case 'deleteVariable':
				stageDeleteValue(message.payload);
				break;
			case 'removePendingChange':
				removePendingChange(message.payload);
				break;
			case 'previewChanges':
				previewChanges();
				break;
			case 'clearPendingChanges':
				clearPendingChanges();
				break;
			case 'cancelPreview':
				cancelPreview();
				break;
			case 'applyChanges':
				await applyChanges();
				break;
			default:
				break;
		}
	}

	panel.webview.onDidReceiveMessage((message: unknown) => {
		void handleMessage(message as WebviewMessage);
	});

	render();
}
