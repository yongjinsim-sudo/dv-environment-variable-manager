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
	version?: string;
	kind?: string;
	variables?: EnvironmentVariableDefinitionItem[];
};

type EnvironmentVariableDefinitionItem = {
	schemaName?: string;
	displayName?: string;
	type?: string;
	defaultValue?: string;
	currentValue?: string;
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


	async function exportJsonDefinition(): Promise<void> {
		if (!state.variables.length) {
			state.message = { kind: 'Warning', text: 'No environment variables are loaded to export.' };
			render();
			return;
		}

		const artifact: EnvironmentVariableDefinitionArtifact = {
			version: '1.0',
			kind: 'dv-forgelab.environment-variable-definitions',
			variables: state.variables
				.filter(variable => variable.type !== 'Secret')
				.map(variable => ({
					schemaName: variable.schemaName,
					displayName: variable.displayName,
					type: variable.type,
					defaultValue: variable.defaultValue,
					currentValue: variable.currentValue
				}))
		};

		const uri = await vscode.window.showSaveDialog({
			defaultUri: vscode.Uri.file('environment-variables.dvevm.json'),
			filters: {
				'DVEVM JSON': ['dvevm.json', 'json'],
				'JSON': ['json']
			},
			saveLabel: 'Export JSON'
		});

		if (!uri) {
			return;
		}

		await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(`${JSON.stringify(artifact, null, 2)}\n`));
		state.message = { kind: 'Info', text: `Exported ${artifact.variables?.length ?? 0} environment variable definition(s) to JSON.` };
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

		const [uri] = await vscode.window.showOpenDialog({
			canSelectFiles: true,
			canSelectFolders: false,
			canSelectMany: false,
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
			const importedVariables = getArtifactVariables(artifact);

			if (!importedVariables.length) {
				state.message = { kind: 'Warning', text: 'The selected JSON file does not contain environment variable definitions.' };
				render();
				return;
			}

			let staged = 0;
			let skipped = 0;
			let missing = 0;
			let invalid = 0;

			for (const imported of importedVariables) {
				const schemaName = imported.schemaName?.trim();
				if (!schemaName) {
					invalid += 1;
					continue;
				}

				const variable = state.variables.find(item => item.schemaName.toLowerCase() === schemaName.toLowerCase());
				if (!variable) {
					missing += 1;
					continue;
				}

				if (variable.type === 'Secret') {
					skipped += 1;
					continue;
				}

				const importedValue = normalizeArtifactValue(variable.type, imported.currentValue);
				if (importedValue === undefined) {
					skipped += 1;
					continue;
				}

				const normalizedValue = normalizeValue(variable, importedValue);
				if (normalizedValue === undefined) {
					invalid += 1;
					continue;
				}

				if ((variable.currentValue ?? '') === normalizedValue) {
					skipped += 1;
					continue;
				}

				const isCreate = !variable.currentValueId;
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
				staged += 1;
			}

			state.previewOpen = false;
			state.message = { kind: 'Info', text: `Imported JSON definition. Staged ${staged}, skipped ${skipped}, missing ${missing}, invalid ${invalid}.` };
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
