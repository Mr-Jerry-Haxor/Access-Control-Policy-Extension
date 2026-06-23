# ACP Checkpoints Logic Mapping Report

This report maps the 28 checkpoints from `ACP checkpoints.txt` to their respective rules, data fields, and question IDs (derived from CAIRO API structures). It prioritizes deterministic, RULE-based logic over AI-based logic where possible.

## Summary
- **Rule-Based Checkpoints**: 15 checkpoints can be evaluated purely programmatically using exact matches, data presence checks, and cross-system API lookups (CMDB, ESATS, Risk Profiler).
- **AI-Based Checkpoints**: 10 checkpoints strictly require natural language processing (NLP) to read, comprehend, and evaluate the quality or semantics of documented processes.
- **Hybrid Checkpoints**: 3 checkpoints can use rule-based heuristics but may require AI for fuzzy matching or resolving discrepancies.

---

## Detailed Checkpoint Mapping

| ID | CAIRO Question ID / Scope | Required Fields & Sources | Logic Type | Logic Description / Evaluation Rule |
| :--- | :--- | :--- | :--- | :--- |
| **ACP1** | General Assessment | Assessment approval records | **Rule-Based** | Verify that the assessment contains at least two valid approval timestamps/signatures. |
| **ACP2** | `ACP-AA1` | `ACP-AA1` answer text | **Rule-Based** | Check if the text length of `ACP-AA1` (functionality statement) is greater than zero. |
| **ACP3** | `ACP-AR1` | `ACP-AR1` roles list, `ACP-RAP1`, `ACP-RAP2`, `ACP-RAP3` text | **Hybrid** | **Rule**: Extract role names from `ACP-AR1` and run exact string matching against the text of the RAP sections. **AI** fallback needed for fuzzy role name variations. |
| **ACP4** | `ACP-AR1` | `ACP-AR1` roles, STAR/MARS online request APIs | **Rule-Based** | Compare the roles array in `ACP-AR1` to the roles array returned by the application's STAR/MARS online form. |
| **ACP5** | `ACP-AR1` | `ACP-AR1` roles, CMDB API | **Rule-Based** | If CMDB shows the app has a database (and `is_cloud` != true), verify that a "DBA" role exists in `ACP-AR1`. |
| **ACP6** | `ACP-AR1` | `ACP-AR1` roles, CMDB API | **Rule-Based** | Match the "Person Type" property of the DBA role in `ACP-AR1` with the Person Type of the DBA listed in CMDB. |
| **ACP7** | `ACP-AR1` | `ACP-AR1` roles, ESATS API | **Rule-Based** | If ESATS API returns "Tier 2/3 Technical Support", verify an equivalent application support role is defined in `ACP-AR1`. |
| **ACP8** | `ACP-AR1` | `ACP-AR1` role descriptions | **AI-Based** | Requires AI to comprehend the "responsibilities" text for each role to verify it describes *work tasks performed* rather than generic access. |
| **ACP9** | `ACP-AR1` | `ACP-AR1` roles, Risk Profiler (`CSIR-IPOwner`) | **Rule-Based** | If `CSIR-IPOwner` == "Boeing", assert that a "Developer" role is present in `ACP-AR1`. |
| **ACP10**| `ACP-AR1` | `ACP-AR1` (Authorized Entity field) | **Rule-Based** | Verify that the `Authorized Entity` field is populated for every listed role. |
| **ACP11**| `ACP-AR1` | `ACP-AR1` (Authorized Entity text, Person Status/Type) | **AI-Based** | Requires AI to semantically compare the Authorized Entity definition against the assigned Person Type to identify logical conflicts. |
| **ACP12**| `ACP-AR1` | `ACP-AR1` (Access Levels array) | **Rule-Based** | For every role, assert that `Access Level` for Database, Server, or Application is not "None" across all three. |
| **ACP13**| `ACP-AR1` | `ACP-AR1` (Responsibility text, Access Levels) | **AI-Based** | Requires AI to read the free-form Responsibility text and verify it logically matches the toggled Access Levels. |
| **ACP14**| `ACP-NPI1` | `ACP-NPI1`, Risk Profiler (`CSIR-SvcAcct`) | **Rule-Based** | Assert exact array match between Non-Person Identifiers in `ACP-NPI1` and `CSIR-SvcAcct`. |
| **ACP15**| `ACP-NPI1` | App Type, CMDB, `ACP-NPI1` | **Rule-Based** | If App Type == "internal web application" OR CMDB has database == true, assert `ACP-NPI1` contains ≥ 1 account. |
| **ACP16**| `ACP-NPI1` | `ACP-NPI1` (Function descriptions) | **AI-Based** | Requires AI to verify that the "Function" text for NPIs describes a clear *action* performed by the account. |
| **ACP17**| `ACP-NPI1` | `ACP-NPI1` (Owners), HR/Active Directory | **Rule-Based** | Cross-reference Account Owner IDs with Active Directory to verify `isActive` == true at review time. |
| **ACP18**| Export Access | `Person Status`, Export Data Flags, ICP Data | **Rule-Based** | If non-US persons have access AND data contains EAR LR/ITAR, verify ICP number string is not null. |
| **ACP19**| `ACP-AR1` | `ACP-AR1` (`Person Status`, `Data Type`) | **Rule-Based** | If `Person Status` == "Non-US Person", assert `Data Type` != "US Export - Not Yet Determined". |
| **ACP20**| `ACP-PIIAR1`| `ACP-PIIAR1` boolean, Risk Profiler (`CSIR-Data`) | **Rule-Based** | Assert boolean match between `ACP-PIIAR1` answer and PII presence in `CSIR-Data`. |
| **ACP21**| `ACP-PIIAR2`| `ACP-PIIAR2` boolean, Risk Profiler (`CSIR-Data`) | **Rule-Based** | If `CSIR-Data` includes Highly Sensitive/Sensitive/Regulated PII, assert `ACP-PIIAR2` == "Yes". |
| **ACP22**| `ACP-PIIAR3`| `ACP-PIIAR3` number, GPO System API | **Rule-Based** | Call GPO website API and exact-match the registration number provided in `ACP-PIIAR3`. |
| **ACP23**| `ACP-RAP1` | `ACP-RAP1` (Request process text) | **AI-Based** | Requires AI to parse step-by-step text to ensure Who, What, and How are clearly defined for account requests. |
| **ACP24**| `ACP-RAP1` | `ACP-RAP1` (Modify process text) | **AI-Based** | Requires AI to parse step-by-step text to ensure Who, What, and How are clearly defined for account modifications. |
| **ACP25**| `ACP-RAP1` | `ACP-RAP1` (Removal process text) | **AI-Based** | Requires AI to parse step-by-step text to ensure Who, What, and How are clearly defined for account removal. |
| **ACP26**| `ACP-RAP1` | `ACP-RAP1` (Removal text), `ACP-RAP3` (Validation text)| **AI-Based** | Requires AI to perform a semantic comparison to ensure the removal process does not wrongly embed the validation process. |
| **ACP27**| `ACP-RAP2` | `ACP-RAP2` (Approval process text), `ACP-AR1` | **Hybrid** | **AI** needed to verify that a comprehensible step-by-step process exists for *every* role listed in `ACP-AR1`. |
| **ACP28**| `ACP-RAP3` | `ACP-RAP3` (Validation process text), `ACP-AR1` | **AI-Based** | Requires AI to verify Who, Where, and How for the AS-IS user list generation and reconciliation steps across all roles. |
