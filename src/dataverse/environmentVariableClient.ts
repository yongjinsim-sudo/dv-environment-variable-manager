import { DataverseHttpClient } from './dataverseHttpClient';
import { EnvironmentVariableType, EnvironmentVariableViewModel, PendingEnvironmentVariableChangeViewModel } from '../product/choiceEditorTypes';

type ODataCollection<T> = {
	value?: T[];
};

type EnvironmentVariableDefinitionRow = {
	environmentvariabledefinitionid?: string;
	displayname?: string;
	schemaname?: string;
	type?: number;
	defaultvalue?: string;
	ismanaged?: boolean;
};

type EnvironmentVariableValueRow = {
	environmentvariablevalueid?: string;
	value?: string;
	_environmentvariabledefinitionid_value?: string;
	ismanaged?: boolean;
};

const typeLabels: Record<number, EnvironmentVariableType> = {
	100000000: 'Text',
	100000001: 'Decimal',
	100000002: 'TwoOptions',
	100000003: 'JSON',
	100000004: 'DataSource',
	100000005: 'Secret'
};

export async function loadEnvironmentVariables(client: DataverseHttpClient): Promise<EnvironmentVariableViewModel[]> {
	const [definitionResponse, valueResponse] = await Promise.all([
		client.get<ODataCollection<EnvironmentVariableDefinitionRow>>('/environmentvariabledefinitions?$select=environmentvariabledefinitionid,displayname,schemaname,type,defaultvalue,ismanaged&$orderby=displayname asc'),
		client.get<ODataCollection<EnvironmentVariableValueRow>>('/environmentvariablevalues?$select=environmentvariablevalueid,value,_environmentvariabledefinitionid_value,ismanaged')
	]);

	const valuesByDefinition = new Map<string, EnvironmentVariableValueRow>();
	for (const value of valueResponse.value ?? []) {
		const definitionId = value._environmentvariabledefinitionid_value;
		if (definitionId && !valuesByDefinition.has(definitionId)) {
			valuesByDefinition.set(definitionId, value);
		}
	}

	return (definitionResponse.value ?? []).map((definition, index) => {
		const id = definition.environmentvariabledefinitionid ?? `${index}`;
		const currentValue = valuesByDefinition.get(id);
		const type = typeof definition.type === 'number' ? typeLabels[definition.type] ?? 'Unknown' : 'Unknown';
		const effectiveValue = currentValue?.value ?? definition.defaultvalue;
		const status = type === 'Secret'
			? 'Secret'
			: currentValue?.value !== undefined
				? 'Configured'
				: definition.defaultvalue !== undefined && definition.defaultvalue !== null
					? 'DefaultOnly'
					: 'Missing';

		return {
			id,
			displayName: definition.displayname?.trim() || definition.schemaname?.trim() || `Environment Variable ${index + 1}`,
			schemaName: definition.schemaname ?? '',
			type,
			defaultValue: definition.defaultvalue,
			currentValue: currentValue?.value,
			currentValueId: currentValue?.environmentvariablevalueid,
			currentValueIsManaged: currentValue?.ismanaged,
			displayValue: effectiveValue ?? '(not set)',
			status,
			isManaged: definition.ismanaged,
			pendingState: 'Unchanged'
		};
	});
}

export async function applyEnvironmentVariableChanges(
	client: DataverseHttpClient,
	changes: PendingEnvironmentVariableChangeViewModel[]
): Promise<void> {
	for (const change of changes) {
		if (change.kind === 'DeleteValue') {
			if (change.valueId) {
				await client.delete(`/environmentvariablevalues(${change.valueId})`);
			}
			continue;
		}

		const nextValue = change.nextValue ?? '';
		if (change.valueId) {
			await client.patch(`/environmentvariablevalues(${change.valueId})`, { value: nextValue });
		} else {
			await client.post('/environmentvariablevalues', {
				value: nextValue,
				'EnvironmentVariableDefinitionId@odata.bind': `/environmentvariabledefinitions(${change.definitionId})`
			});
		}
	}
}
