import { EnvironmentVariableManagerViewModel, EnvironmentVariableStatus } from '../product/choiceEditorTypes';
import { escapeHtml } from '../shared/escaping';
import { choiceEditorStyles } from './choiceEditorStyles';
import { choiceEditorScript } from './choiceEditorScript';

type RenderOptions = {
	logoUri: string;
	cspSource: string;
};

function getEnvironmentPillClass(viewModel: EnvironmentVariableManagerViewModel): string {
	if (viewModel.environment.safety === 'Red') { return 'danger'; }
	if (viewModel.environment.safety === 'Amber') { return 'warning'; }
	if (viewModel.environment.safety === 'Grey') { return 'grey'; }
	return 'accent';
}

function getApplyButtonClass(viewModel: EnvironmentVariableManagerViewModel): string {
	if (viewModel.environment.safety === 'Red') { return 'danger-primary'; }
	if (viewModel.environment.safety === 'Amber') { return 'warning-primary'; }
	return 'primary';
}

function getPreviewCardClass(viewModel: EnvironmentVariableManagerViewModel): string {
	if (viewModel.environment.safety === 'Red') { return 'danger-preview'; }
	if (viewModel.environment.safety === 'Amber') { return 'warning-preview'; }
	return 'grey-preview';
}

function getApplyWarningText(viewModel: EnvironmentVariableManagerViewModel): string {
	if (viewModel.environment.safety === 'Red') {
		return 'Production-class environment detected. Environment variable updates may affect Power Apps, Power Automate flows, and custom integrations. Review carefully before applying changes.';
	}
	if (viewModel.environment.safety === 'Amber') {
		return 'Controlled non-production environment detected. Review staged changes before applying.';
	}
	return 'These changes are staged locally. Dataverse will only be changed when you choose Apply changes.';
}

function getStatusClass(status: EnvironmentVariableStatus): string {
	if (status === 'Configured') { return 'success'; }
	if (status === 'DefaultOnly') { return 'warning'; }
	if (status === 'Missing') { return 'danger'; }
	if (status === 'Secret') { return 'grey'; }
	return '';
}

function getStatusLabel(status: EnvironmentVariableStatus): string {
	if (status === 'DefaultOnly') { return 'Using Default'; }
	return status;
}

function getTypeLabel(type: string): string {
	if (type === 'Decimal') { return 'Number'; }
	if (type === 'TwoOptions') { return 'Yes / No'; }
	return type;
}

function getPendingLabel(pendingState: string): string {
	if (pendingState === 'Created') { return 'Staged create'; }
	if (pendingState === 'Updated') { return 'Updated'; }
	if (pendingState === 'Deleted') { return 'Deleted'; }
	return pendingState;
}

export function renderEnvironmentVariableManagerHtml(viewModel: EnvironmentVariableManagerViewModel, options: RenderOptions): string {
	const variableRows = viewModel.variables.length
		? viewModel.variables.map(variable => {
			const pendingClass = variable.pendingState === 'Deleted' ? 'danger' : variable.pendingState === 'Created' ? 'success' : variable.pendingState === 'Updated' ? 'warning' : '';
			const statusClass = getStatusClass(variable.status);
			const editDisabled = variable.status === 'Secret' ? ' disabled title="Secret values cannot be edited in this utility."' : '';
			const actionLabel = variable.currentValueId ? 'Edit' : 'Create current value';
			const managedValueBadge = variable.currentValueIsManaged ? '<span class="dv-pill grey">Managed value</span>' : '';
			const deleteButton = variable.currentValueId && variable.status !== 'Secret'
				? variable.currentValueIsManaged
					? '<button disabled title="Managed current values cannot be deleted from this utility.">Delete current value</button>'
					: `<button data-command="deleteVariable" data-id="${escapeHtml(variable.id)}">Delete current value</button>`
				: '';
			return `
			<tr class="${variable.pendingState !== 'Unchanged' ? 'dv-row-pending' : ''}">
				<td><strong>${escapeHtml(variable.displayName)}</strong><br><span class="dv-muted">${escapeHtml(variable.schemaName)}</span></td>
				<td><span class="dv-pill grey">${escapeHtml(getTypeLabel(variable.type))}</span></td>
				<td><span class="dv-connection-id">${escapeHtml(variable.displayValue)}</span></td>
				<td><span class="dv-pill ${statusClass}">${escapeHtml(getStatusLabel(variable.status))}</span>${managedValueBadge}</td>
				<td><span class="dv-pill ${pendingClass}">${escapeHtml(getPendingLabel(variable.pendingState))}</span></td>
				<td><div class="dv-actions-inline"><button data-command="editVariable" data-id="${escapeHtml(variable.id)}"${editDisabled}>${actionLabel}</button>${deleteButton}</div></td>
			</tr>`;
		}).join('')
		: `<tr><td colspan="6"><div class="dv-empty">Connect to a Dataverse environment to view and manage environment variable values.</div></td></tr>`;

	const pendingText = viewModel.pendingChanges.length
		? `${viewModel.pendingChanges.length} pending change(s)`
		: 'No pending changes.';

	const pendingRows = viewModel.pendingChanges.length
		? `<div class="dv-pending-list">${viewModel.pendingChanges.map(change => `<div class="dv-pending-item"><span class="dv-pill ${change.kind === 'DeleteValue' ? 'danger' : change.kind === 'CreateValue' ? 'success' : 'warning'}">${change.kind === 'DeleteValue' ? 'Delete' : change.kind === 'CreateValue' ? 'Create' : 'Update'}</span><span>${escapeHtml(change.variableName)}: ${escapeHtml(change.previousValue ?? '(not set)')} → ${escapeHtml(change.kind === 'DeleteValue' ? '(using default)' : change.nextValue ?? '')}</span><button data-command="removePendingChange" data-id="${escapeHtml(change.definitionId)}">Remove</button></div>`).join('')}</div>`
		: '';

	const hasPendingChanges = viewModel.pendingChanges.length > 0;
	const environmentPillClass = getEnvironmentPillClass(viewModel);
	const applyButtonClass = getApplyButtonClass(viewModel);
	const previewCardClass = getPreviewCardClass(viewModel);
	const applyWarningText = getApplyWarningText(viewModel);

	const previewHtml = viewModel.previewOpen && hasPendingChanges
		? `<section class="dv-card dv-section dv-preview-card ${previewCardClass}">
			<div class="dv-preview-header">
				<div>
					<div class="dv-kicker">Environment variable update preview</div>
					<h2>Preview changes</h2>
					<p>Review staged environment variable changes before applying them to Dataverse.</p>
				</div>
				<span class="dv-pill warning">Preview-first</span>
			</div>
			<div class="dv-preview-grid">
				<div><span>Environment</span><strong>${escapeHtml(viewModel.environment.label)}</strong><em>${escapeHtml(viewModel.environment.safetyLabel)}</em></div>
				<div><span>Definitions</span><strong>${escapeHtml(viewModel.summary.definitionCount)}</strong></div>
				<div><span>Pending Changes</span><strong>${escapeHtml(viewModel.pendingChanges.length)}</strong></div>
				<div><span>Target Environment</span><strong>${escapeHtml(viewModel.environment.label)}</strong></div>
			</div>
			<h3>Pending operations</h3>
			<div class="dv-preview-operations">${viewModel.pendingChanges.map(change => `<div class="dv-preview-operation"><span class="dv-pill ${change.kind === 'DeleteValue' ? 'danger' : change.kind === 'CreateValue' ? 'success' : 'warning'}">${change.kind === 'DeleteValue' ? 'Delete current value' : change.kind === 'CreateValue' ? 'Create current value' : 'Update'}</span><div><strong>${escapeHtml(change.variableName)}</strong><br><span>${escapeHtml(change.previousValue ?? '(not set)')} → ${escapeHtml(change.kind === 'DeleteValue' ? '(using default)' : change.nextValue ?? '')}</span></div></div>`).join('')}</div>
			<div class="dv-preview-note">${escapeHtml(applyWarningText)}</div>
			<div class="dv-actions">
				<button data-command="cancelPreview">Cancel preview</button>
				<button data-command="applyChanges" class="${applyButtonClass}">Apply changes</button>
			</div>
		</section>`
		: '';

	const messageHtml = viewModel.message
		? `<div class="dv-message ${escapeHtml(viewModel.message.kind)}">${escapeHtml(viewModel.message.text)}</div>`
		: '';

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${options.cspSource} data:; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${escapeHtml(viewModel.productName)}</title>
	<style>${choiceEditorStyles}</style>
</head>
<body>
	<main class="dv-shell">
		<section class="dv-hero">
			<div>
				<div class="dv-kicker">DV ForgeLab Utility</div>
				<h1>${escapeHtml(viewModel.productName)}</h1>
				<p class="dv-subtitle">${escapeHtml(viewModel.subtitle)}</p>
			</div>
			<div class="dv-logo-card" aria-hidden="true"><img src="${options.logoUri}" alt="DV ForgeLab" /></div>
		</section>

		<section class="dv-toolbar">
			<div class="dv-pill-row">
				<span class="dv-pill ${environmentPillClass}">${escapeHtml(viewModel.environment.label)}</span>
				<span class="dv-pill">Preview-first updates</span>
				<span class="dv-pill">Environment variables only</span>
			</div>
			<div class="dv-actions">
				<button data-command="connect">Connect</button>
				<button data-command="changeEnvironment">Change environment</button>
				<button data-command="refresh">Refresh</button>
			</div>
		</section>

		${messageHtml}

		<section class="dv-summary-grid" aria-label="Summary">
			<div class="dv-card highlight"><div class="dv-card-title">Definitions</div><div class="dv-card-value">${escapeHtml(viewModel.summary.definitionCount)}</div><div class="dv-card-caption">Loaded definitions</div></div>
			<div class="dv-card"><div class="dv-card-title">Configured</div><div class="dv-card-value">${escapeHtml(viewModel.summary.configuredCount)}</div><div class="dv-card-caption">Current value present</div></div>
			<div class="dv-card warning"><div class="dv-card-title">Pending changes</div><div class="dv-card-value">${escapeHtml(viewModel.summary.pendingChangeCount)}</div><div class="dv-card-caption">Staged locally before apply</div></div>
			<div class="dv-card"><div class="dv-card-title">Default only</div><div class="dv-card-value">${escapeHtml(viewModel.summary.defaultOnlyCount)}</div><div class="dv-card-caption">Using default</div></div>
		</section>

		<section class="dv-section">
			<div class="dv-section-header">
				<div>
					<h2>Environment variables</h2>
					<p>Load and manage Dataverse environment variable current values for the selected environment.</p>
				</div>
				<div class="dv-actions dv-definition-actions">
					<button data-command="importJson">Import JSON</button>
					<button data-command="exportJson"${viewModel.variables.length ? '' : ' disabled'}>Export JSON</button>
				</div>
			</div>
			<div class="dv-table-wrap"><table><thead><tr><th>Variable</th><th>Type</th><th>Current Value</th><th>Status</th><th>Pending</th><th>Actions</th></tr></thead><tbody>${variableRows}</tbody></table></div>
		</section>

		<section class="dv-card dv-section">
			<h2>Pending changes</h2>
			<p>${escapeHtml(pendingText)}</p>
			${pendingRows}
			<div class="dv-actions"><button data-command="previewChanges"${hasPendingChanges ? '' : ' disabled'}>Preview changes</button><button data-command="clearPendingChanges"${hasPendingChanges ? '' : ' disabled'}>Clear staged changes</button></div>
		</section>

		${previewHtml}

		<div class="dv-footer-note">DV Environment Variable Manager is a DV ForgeLab utility. <a href="https://marketplace.visualstudio.com/items?itemName=dv-forgelab.dv-quick-run">DV Quick Run</a> remains the flagship Dataverse investigation workbench.</div>
	</main>
	<script>${choiceEditorScript}</script>
</body>
</html>`;
}
