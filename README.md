# DV Environment Variable Manager

Preview-first Dataverse environment variable value management inside VS Code.

**DV Environment Variable Manager** is a focused utility from **DV ForgeLab** for reviewing, creating, updating, and removing Dataverse environment variable current values without leaving VS Code.

Built around a **preview-first workflow**, all changes are staged locally before being applied to Dataverse, helping administrators review environment configuration changes before execution.

![DV Environment Variable Manager](docs/dvevm-page.png)

---

## Features

### Environment Variable Visibility

* Connect to Dataverse environments using Azure CLI authentication
* Load environment variable definitions
* Load environment variable current values
* View configured and default-backed variables
* Display variable type information
* Display managed value indicators

### Preview-First Administration

* Create current values for environment variables using definition defaults
* Update existing current values
* Remove current values (where permitted by Dataverse)
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

### Operational Awareness

* Configured vs Using Default status indicators
* Environment-aware DEV / TEST / PROD visual cues
* Refresh and reload environment variable state
* Managed solution awareness

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
Create / Edit / Remove Current Values
        ↓
Review Pending Changes
        ↓
Preview Changes
        ↓
Apply to Dataverse
```

---

## Scope

DV Environment Variable Manager focuses on environment variable value administration.

It intentionally does not provide:

* Environment variable definition creation
* Environment variable definition deletion
* Solution management
* Connection reference management
* ALM deployment automation
* Environment promotion workflows

For investigation, operational analysis, comparison, and troubleshooting workflows, see DV Quick Run.

---

## DV ForgeLab Utilities

DV Environment Variable Manager is part of the growing DV ForgeLab utility family:

* DV Choice Editor
* DV Environment Variable Manager
* DV Quick Run

Each utility focuses on a specific Dataverse administration or investigation scenario while maintaining a consistent VS Code experience.

---

Built by **DV ForgeLab**.
