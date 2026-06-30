# DV Environment Variable Manager

Preview-first Dataverse environment variable value management inside VS Code.

**DV Environment Variable Manager** is a focused utility from **DV ForgeLab** for reviewing, creating, updating, removing, importing, and exporting Dataverse environment variable current values without leaving VS Code.

Built around a **preview-first workflow**, all changes are staged locally before being applied to Dataverse, helping administrators review environment configuration changes before execution.

![DV Environment Variable Manager](docs/dvevm-page.png)

---

## v1.2.0 — Native DVEVM Artifacts & DVQR Handoff Compatibility

DVEVM now supports native DVEVM Environment Variable Artifact v2.0 using the DVEVM-owned artifact schema:

```text
artifactType: "dvevm.environmentVariableDefinitions"
```

This prepares DVEVM for DV Quick Run v0.13.5 environment variable drift reconstruction handoffs while preserving the product boundary:

```text
DV Quick Run investigates.
DV Environment Variable Manager reconstructs current values.
```

Manual DVEVM exports use standard `.json` files:

```text
dvevm-{environmentLabel}-{yyyyMMdd-HHmmss}.json
```

DV Quick Run reconstruction handoff files may use `.dvevm.json` with the same DVEVM-owned schema:

```text
DVEVM-{scope}-{yyyyMMdd-HHmmss}.dvevm.json
```

DVEVM is now workspace-first. When a VS Code workspace is available, Import and Export prefer the shared DV ForgeLab handoff folder before showing a generic file prompt:

```text
.dvforgelab/dvevm/exports
```

On export, DVEVM creates the folder when needed and writes the `.json` artifact directly there. On import, the file picker opens in that folder so DVQR-generated `.dvevm.json` files are immediately visible. If no VS Code workspace is open, DVEVM falls back to the standard file picker/save dialog.

---

## Features

### Environment Variable Visibility

* Connect to Dataverse environments using Azure CLI authentication
* Load environment variable definitions
* Load environment variable current values
* View configured and default-backed variables
* Display variable type information
* Display managed value indicators

### Native DVEVM Artifacts

* Export environment variable definitions and current values as native DVEVM `.json` artifacts
* Import native DVEVM `.json` artifacts
* Import DVQR-generated `.dvevm.json` reconstruction artifacts
* Preserve existing v1.0 JSON artifact import compatibility
* Stage imported differences locally before apply
* Skip unchanged values, missing definitions, unsupported operations, and unsupported secret values
* Use JSON artifacts for repeatable configuration reconstruction workflows

### Operation-Based Import

DVEVM v1.2.0 supports operation-based staging for current-value reconstruction:

* `SetCurrentValue`
* `CreateCurrentValue`
* `DeleteCurrentValue`

Unsupported operations are reported as skipped/unsupported rather than silently applied.

DVEVM does not create or delete environment variable definitions.

### Preview-First Administration

* Create current values for environment variables using definition defaults
* Update existing current values
* Remove current values where permitted by Dataverse
* Stage changes locally before execution
* Review pending changes
* Preview mutations before applying

### Validation & Safety

* Production environment visual indicators
* Managed value protection
* Number validation
* Yes / No value validation
* JSON validation
* Preview-before-apply workflow
* Secret value guardrails
* Delete current value warning through preview-first workflow

### Operational Awareness

* Configured vs Using Default status indicators
* Environment-aware DEV / TEST / PROD visual cues
* Refresh and reload environment variable state
* Managed solution awareness
* Direct DV ForgeLab feedback integration

---

## JSON Definition Artifacts

DV Environment Variable Manager supports JSON definition artifacts for controlled environment variable current value reconstruction.

### Native v2.0 Artifact

```json
{
  "artifactType": "dvevm.environmentVariableDefinitions",
  "version": "2.0",
  "generatedBy": "DV Environment Variable Manager",
  "generatedUtc": "2026-06-29T00:00:00.000Z",
  "sourceEnvironment": "DEV",
  "targetEnvironment": null,
  "variables": [
    {
      "schemaName": "new_apiendpoint",
      "displayName": "API Endpoint",
      "type": "Text",
      "defaultValue": "https://api.contoso.com",
      "currentValue": "https://api-dev.contoso.com",
      "isManaged": false
    }
  ],
  "operations": []
}
```

### DVQR Reconstruction Handoff Example

```json
{
  "artifactType": "dvevm.environmentVariableDefinitions",
  "version": "2.0",
  "generatedBy": "DV Quick Run",
  "generatedUtc": "2026-06-29T00:00:00.000Z",
  "sourceEnvironment": "DEV · Account source",
  "targetEnvironment": "TEST · Account target",
  "source": "CrossDiff",
  "variables": [
    {
      "schemaName": "new_apiendpoint",
      "displayName": "API Endpoint",
      "type": "Text",
      "defaultValue": "https://api.dev.contoso.com",
      "currentValue": "https://api.dev.contoso.com"
    }
  ],
  "operations": [
    {
      "operation": "SetCurrentValue",
      "schemaName": "new_apiendpoint",
      "displayName": "API Endpoint",
      "previousValue": "https://api.test.contoso.com",
      "nextValue": "https://api.dev.contoso.com"
    }
  ],
  "notes": [
    "Generated by DV Quick Run from Environment Variable Drift.",
    "Source-side reconstruction intent only.",
    "DVEVM owns import, validation, preview and apply."
  ]
}
```

Imported definitions do not update Dataverse immediately. Matching variables are staged as pending changes and must still be reviewed through the preview-first apply workflow.

---

## Shared Workspace

DVEVM follows the shared DV ForgeLab workspace convention.

```text
.dvforgelab/
└─ dvevm/
   └─ exports/
```

When a VS Code workspace is available:

* Export creates `.dvforgelab/dvevm/exports` if required and writes directly to that folder
* Import creates/opens `.dvforgelab/dvevm/exports` as the first file-picker location
* DVQR-generated `.dvevm.json` handoff files can be imported from the same folder

When no workspace is available, DVEVM falls back to the standard file picker or save dialog.

---

## Shared DV ForgeLab Environment Settings

DV Environment Variable Manager supports the shared DV ForgeLab environment setting:

```json
"dvForgeLab.environments": [
  {
    "name": "DEV",
    "url": "https://org.crm6.dynamics.com",
    "tenantId": "optional-tenant-id"
  }
]
```

This setting can be reused by DV ForgeLab utilities. The legacy `dvEnvironmentVariableManager.environments` setting remains supported as a fallback.

---

## Command

```text
DV Environment Variable Manager: Open
```

---

## Typical Workflow

```text
Connect to Dataverse
        ↓
Load Environment Variables
        ↓
Create / Edit / Remove / Import Current Values
        ↓
Review Pending Changes
        ↓
Preview Changes
        ↓
Apply to Dataverse
```

---

## Feedback

DV Environment Variable Manager includes direct integration with the DV ForgeLab feedback portal.

Share:

* Feature requests
* Bug reports
* Environment variable reconstruction scenarios
* Workflow suggestions
* Product feedback

Feedback is routed through the shared DV ForgeLab feedback experience and automatically identifies DV Environment Variable Manager as the source product.

https://www.dvforgelab.com/feedback

---

## Scope

DV Environment Variable Manager focuses on environment variable **current value** administration.

It intentionally does not provide:

* Environment variable definition creation
* Environment variable definition deletion
* Environment variable type mutation
* Default value mutation
* Secret value management
* Solution management
* Connection reference management
* ALM deployment automation
* Environment promotion workflows
* Automatic configuration remediation

For investigation, operational analysis, comparison, and troubleshooting workflows, see DV Quick Run.

---

## Preview-First Philosophy

DV Environment Variable Manager follows the DV ForgeLab preview-first invariant.

Environment variable changes are staged locally, validated, previewed, and explicitly applied by the user. Dataverse configuration is never changed without a preview and confirmation step.

---

## DV ForgeLab Utilities

DV Environment Variable Manager is a focused Dataverse utility from DV ForgeLab.

For operational investigation, execution, runtime analysis, and cross-environment comparison, see [DV Quick Run](https://www.dvquickrun.com).

DV Environment Variable Manager follows the same principles:

* Preview-first
* Environment-aware
* Metadata-backed
* Explicit execution
* Calm operational UX

---

Built by **[DV ForgeLab](https://www.dvforgelab.com)**.
