# Change Log

All notable changes to the "DV Environment Variable Manager" extension will be documented in this file.

## [1.2.0] - Native DVEVM Artifacts & DVQR Handoff Compatibility

### Added

- Added native DVEVM Environment Variable Artifact v2.0 support using `artifactType: "dvevm.environmentVariableDefinitions"`.
- Added operation-based import staging for `SetCurrentValue`, `CreateCurrentValue`, and `DeleteCurrentValue`.
- Added workspace-first import/export support under `.dvforgelab/dvevm/exports` when a VS Code workspace is available.
- Added automatic creation of the DVEVM shared workspace export folder before falling back to generic file dialogs.
- Added support for importing both standard `.json` exports and DVQR-generated `.dvevm.json` reconstruction artifacts.

### Changed

- Manual DVEVM exports now use plain `.json` files.
- Exported artifacts now include `generatedBy`, `generatedUtc`, and an `operations` array.
- Export filenames now follow the standard convention: `dvevm-{environmentLabel}-{yyyyMMdd-HHmmss}.json`.
- Import now opens from `.dvforgelab/dvevm/exports` first so DVQR handoff artifacts are easier to locate.
- Import summary now reports staged, skipped, missing, invalid, unsupported, create, update, and delete counts.

### Preserved

- Existing v1.0 DVEVM JSON imports remain supported.
- Preview-first staging remains mandatory before Dataverse mutation.
- DVEVM continues to manage current values only; definition lifecycle changes remain out of scope.


## [1.1.2] - Feedback Integration & Ecosystem Connectivity

### Added

* Added in-product Feedback action.
* Feedback now opens the DV ForgeLab feedback portal directly from DV Environment Variable Manager.
* Feedback links support product-aware routing using the shared DV ForgeLab feedback workflow.
* Feedback submissions automatically identify DV Environment Variable Manager as the source product.
* Feedback submissions now include extension version information to improve support and issue investigation.

## [1.1.1] - Documentation & Branding Refresh

### Changed

- Added DV ForgeLab website links across documentation.
- Updated footer links to point to dvforgelab.com and dvquickrun.com.
- Refreshed README screenshots and workflow documentation.
- Improved product ecosystem references.

## [1.1.0] - 2026-06-10

### Added

- JSON definition artifact export for environment variable definitions and current values.
- JSON definition artifact import for staging environment variable current value changes.
- Import comparison against loaded Dataverse environment variable definitions.
- Import summary covering staged, skipped, missing, and invalid definitions.
- Preview-first imported value workflow aligned with DV ForgeLab utility patterns.

### Changed

- Updated marketplace metadata and documentation for definition artifact support.
- Environment variable import/export now supports controlled configuration reconstruction workflows.

### Boundaries

- Import does not create environment variable definitions.
- Import does not update Dataverse immediately.
- Secret values remain unsupported for import/export mutation workflows.
- Imported changes must still be previewed and explicitly applied.

## [1.0.1] - 2026-06-10

### Added

- Shared DV ForgeLab environment setting support via `dvForgeLab.environments`.
- Legacy `dvEnvironmentVariableManager.environments` fallback remains supported.

### Changed

- New environment profiles are saved to the shared DV ForgeLab utility setting.

## [1.0.0] - 2026-06-10

### Added

* Initial DV ForgeLab utility release.
* Dataverse connection and environment switching.
* Environment variable definition loading.
* Environment variable current value loading.
* Preview-first staged change workflow.
* Create current environment variable values for definitions using default values.
* Edit existing environment variable current values.
* Delete environment variable current values (where permitted by Dataverse).
* Pending change tracking and review experience.
* Environment variable update preview surface.
* Production environment safety warnings.
* Type-aware rendering for Text, Number, and Yes / No variables.
* Managed value detection and protection.
* Validation for Number, Yes / No, and JSON environment variable types.
* Refresh and environment reload workflow.
* DV ForgeLab utility shell and shared utility experience.
* Dataverse connection and environment switching.
* Environment variable definition/value loading.
* Preview-first staged update workflow.

### Changed

* Improved environment variable status presentation with "Configured" and "Using Default" semantics.
* Improved environment variable type presentation for administrative readability.
* Enhanced production environment guidance before applying changes.
* Improved empty-state messaging and onboarding experience.
* Added managed current value badges for managed solution variables.
* Added protection against deletion of managed environment variable values.

### Safety

* Preview-first mutation workflow; changes are staged locally before Dataverse updates are applied.
* Managed environment variable values are protected from deletion attempts.
* Type validation is performed before staging updates.
* Production-class environments display additional operational guidance before applying changes.

