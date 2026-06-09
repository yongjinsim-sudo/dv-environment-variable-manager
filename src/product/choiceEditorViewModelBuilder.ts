import { EnvironmentVariableManagerState } from './choiceEditorState';
import { EnvironmentVariableManagerViewModel } from './choiceEditorTypes';

function classifyEnvironment(label?: string, url?: string): { safety: 'None' | 'Grey' | 'Amber' | 'Red'; safetyLabel: string } {
	const text = `${label ?? ''} ${url ?? ''}`.toLowerCase();

	if (!text.trim()) {
		return { safety: 'None', safetyLabel: 'No environment' };
	}

	if (/\b(prod|production|live)\b/.test(text)) {
		return { safety: 'Red', safetyLabel: 'Production environment' };
	}

	if (/\b(sit|uat|test|qa|preprod|pre-prod|staging|stage|perf|nonprod|non-prod|np)\b/.test(text)) {
		return { safety: 'Amber', safetyLabel: 'Non-production controlled environment' };
	}

	return { safety: 'Grey', safetyLabel: 'Development or unclassified environment' };
}

export function buildEnvironmentVariableManagerViewModel(state: EnvironmentVariableManagerState): EnvironmentVariableManagerViewModel {
	const environmentSafety = classifyEnvironment(state.environment?.label, state.environment?.url);
	const configuredCount = state.variables.filter(variable => variable.status === 'Configured').length;
	const defaultOnlyCount = state.variables.filter(variable => variable.status === 'DefaultOnly').length;

	return {
		productName: 'DV Environment Variable Manager',
		subtitle: 'Manage Dataverse environment variable values inside VS Code.',
		environment: state.environment
			? {
				label: state.environment.label,
				url: state.environment.url,
				state: 'Connected',
				safety: environmentSafety.safety,
				safetyLabel: environmentSafety.safetyLabel
			}
			: {
				label: 'No environment connected',
				state: 'NotConnected',
				safety: 'None',
				safetyLabel: 'No environment connected'
			},
		summary: {
			definitionCount: state.variables.length,
			configuredCount,
			defaultOnlyCount,
			pendingChangeCount: state.pendingChanges.length
		},
		variables: state.variables,
		pendingChanges: state.pendingChanges,
		previewOpen: state.previewOpen,
		message: state.message
	};
}

export function buildInitialEnvironmentVariableManagerViewModel(): EnvironmentVariableManagerViewModel {
	return buildEnvironmentVariableManagerViewModel({
		variables: [],
		pendingChanges: [],
		previewOpen: false
	});
}
