import { EnvironmentVariableViewModel, PendingEnvironmentVariableChangeViewModel } from './choiceEditorTypes';

export type EnvironmentVariableManagerState = {
	environment?: {
		label: string;
		url: string;
	};
	variables: EnvironmentVariableViewModel[];
	pendingChanges: PendingEnvironmentVariableChangeViewModel[];
	previewOpen: boolean;
	message?: {
		kind: 'Info' | 'Warning' | 'Error';
		text: string;
	};
};

export function createInitialEnvironmentVariableManagerState(): EnvironmentVariableManagerState {
	return {
		variables: [],
		pendingChanges: [],
		previewOpen: false
	};
}
