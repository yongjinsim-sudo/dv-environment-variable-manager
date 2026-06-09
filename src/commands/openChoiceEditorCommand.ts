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
