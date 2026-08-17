# CI investigation — 2026-08-16

## Symptom

Pull request CI spent several minutes running browser jobs even when an early
failure would invalidate the run. The E2E import suite also failed in the
second transaction corpus batch.

## Root cause

The workflow fanned out after static checks, so the build and all browser
shards launched before the full smoke surface was known. The E2E failure was a
brittle locator: `#csv-preview-title` is only assigned to the first upload
job; later queue items use dynamic preview heading IDs. A persisted failed
upload could also reuse a queue ID after reload, allowing a late resume
request to overwrite a new upload.

## Fix

- Added `ci:smoke` for static checks plus build and made it the prerequisite
  for tests and browser shards.
- Enabled browser matrix fail-fast and retained the aggregate `CI` check.
- Allocated new upload queue IDs after persisted IDs.
- Targeted the accessible preview heading in E2E tests instead of the
  first-upload-only ID.

## Evidence

- Focused second-transaction E2E: 3 passed in 34.8s.
- Local smoke gate passed.
- Local unit/DOM suite: 100 files, 684 tests passed.
- CI-parity and workflow YAML validation passed.
