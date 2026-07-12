# CAIRO Endpoint Mapping for ACP Checkpoints

This file summarizes the CAIRO endpoints observed in `` and how the extension uses them for ACP checkpoint validation.

## Core ACP Data

- `GET /api/asset/4/82/assessment/type/48`
  - Loads the primary ACP assessment list.
- `GET /api/assessment/{assessmentId}/detail`
  - Loads assessment metadata and `surveyTemplateId`.
- `GET /api/assessment/survey/{assessmentId}/answers`
  - Loads normal survey answers by `alternateQuestionId`.
- `GET /api/survey/template/{surveyTemplateId}/questions`
  - Loads question metadata and question IDs.
- `GET /api/surveyTemplate/{surveyTemplateId}`
  - Loads survey template metadata.
- `GET /api/surveyTemplateQuestionGroup?where=surveyTemplateId:=:{surveyTemplateId}`
  - Loads question grouping metadata.

## Collector Table Data

- `GET /api/assessment/survey/{assessmentId}/question/{surveyTemplateQuestionId}`
  - Used for no-answer/table questions.
  - `ACP-AR1` provides access role rows: role, responsibility, person status/type, environment, authorized entity, access levels, and data type.
  - `ACP-RAP4` provides database approver rows.

## Assessment Support Data

- `GET /api/assessmentAssetSummaryVw?where=assetId:=:{assetId},assetTypeId:=:{assetTypeId},assessmentTypeId:=:{assessmentTypeId}`
  - Loads assessment-asset summary.
- `GET /api/asset/{assetTypeId}/{assetId}/assessment/review/summaries?assessmentTypeId=48&reviewTypeId=10`
  - Loads review summary records.
- `GET /api/assessment/{assessmentId}/contacts`
  - Loads display-ready assessment contacts.
- `GET /api/assessmentContact?where=assessmentId:=:{assessmentId}`
  - Loads raw assessment contact identity IDs.
- `GET /api/assessment/{assessmentId}/assets?extra=SERVER_ACP`
  - Loads assessment asset records with ACP-related extra data.
- `GET /api/assessment/{assessmentId}/workflowSteps`
  - Loads workflow status and step history.
- `GET /api/assessment?where=assessmentId:=:{assessmentId}`
  - Loads assessment record array.
- `POST /api/asset/label/search`
  - Body: `{ "assessmentId": number }`
  - Loads data type, person type, compliance, and other asset labels.

## ESATS and Identity Data

- `GET /api/esatsBusappPersonRole01?where=esatsIdentifier:=:{assetId},cairoDeactivatedOn:is null`
  - Loads ESATS business application person-role contacts.
- `GET /api/esatsBusapp?where=baEsatsIdentifier:in:{assetId}&cairoDeactivatedOn:is null`
  - Loads ESATS business application metadata.
- `GET /api/identity?where=identityId:in:{identityIds}`
  - Loads CAIRO identity/person metadata for assessment contacts.
- `GET /api/cedPublic?where=bemsid:=:{bemsId}`
  - Loads CED public employee status for collected BEMS IDs such as database approvers.

## Checkpoint Coverage

- CAIRO-supported rule checks: `ACP1`, `ACP2`, `ACP5`, `ACP7`, `ACP10`, `ACP12`, `ACP15`, `ACP18`, `ACP19`, `ACP20`, `ACP21`.
- CAIRO table data feeds AI checks: `ACP3`, `ACP8`, `ACP11`, `ACP13`, `ACP23`, `ACP24`, `ACP25`, `ACP26`, `ACP27`, `ACP28`.
- External systems not present in ``: STAR/MARS request form APIs, CMDB database inventory and DBA person type APIs, Risk Profiler CSIR APIs, GPO/1PIA lookup APIs, and NPI owner table data.
