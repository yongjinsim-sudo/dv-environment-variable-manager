import * as vscode from 'vscode';
import { openEnvironmentVariableManagerCommand } from './commands/openChoiceEditorCommand';

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.commands.registerCommand('dvEnvironmentVariableManager.open', () => openEnvironmentVariableManagerCommand(context))
	);
}

export function deactivate() {}
