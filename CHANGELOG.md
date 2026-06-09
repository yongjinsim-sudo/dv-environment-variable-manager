# Change Log

All notable changes to the "DV Environment Variable Manager" extension will be documented in this file.

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

