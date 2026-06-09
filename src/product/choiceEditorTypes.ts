export type EnvironmentVariableManagerEnvironmentViewModel = {
	label: string;
	url?: string;
	state: 'NotConnected' | 'Connected';
	safety: 'None' | 'Grey' | 'Amber' | 'Red';
	safetyLabel: string;
};

export type EnvironmentVariableType = 'Text' | 'Decimal' | 'TwoOptions' | 'JSON' | 'DataSource' | 'Secret' | 'Unknown';

export type EnvironmentVariableStatus = 'Configured' | 'DefaultOnly' | 'Missing' | 'Secret' | 'Unknown';

export type EnvironmentVariableViewModel = {
	id: string;
	displayName: string;
	schemaName: string;
	type: EnvironmentVariableType;
	defaultValue?: string;
	currentValue?: string;
	currentValueId?: string;
	currentValueIsManaged?: boolean;
	displayValue: string;
	status: EnvironmentVariableStatus;
	isManaged?: boolean;
	pendingState: 'Unchanged' | 'Updated' | 'Created' | 'Deleted';
};

export type PendingEnvironmentVariableChangeViewModel = {
	kind: 'UpdateValue' | 'CreateValue' | 'DeleteValue';
	definitionId: string;
	valueId?: string;
	variableName: string;
	previousValue?: string;
	nextValue?: string;
};

export type EnvironmentVariableManagerSummaryViewModel = {
	definitionCount: number;
	configuredCount: number;
	defaultOnlyCount: number;
	pendingChangeCount: number;
};

export type EnvironmentVariableManagerViewModel = {
	productName: string;
	subtitle: string;
	environment: EnvironmentVariableManagerEnvironmentViewModel;
	summary: EnvironmentVariableManagerSummaryViewModel;
	variables: EnvironmentVariableViewModel[];
	pendingChanges: PendingEnvironmentVariableChangeViewModel[];
	previewOpen: boolean;
	message?: {
		kind: 'Info' | 'Warning' | 'Error';
		text: string;
	};
};
