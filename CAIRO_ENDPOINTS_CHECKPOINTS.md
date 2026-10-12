# CAIRO endpoint evidence for ACP validation

The checkpoint definitions and numbering come only from `ACP checkpoints.txt`. The two HAR files are used only to confirm URLs, request/response shapes, and available evidence.

## Confirmed read endpoints

- `GET /node-api/assets/4/82/assessment/type/48` — ACP assessment list; response wrapper is `{ statusCode, data }`.
- `GET /api/assessment/{assessmentId}/detail` — assessment metadata and survey template ID.
- `GET /api/assessment/survey/{assessmentId}/answers` — ordinary survey answers.
- `GET /node-api/survey/template/{surveyTemplateId}/questions` — question metadata; wrapped response.
- `GET /node-api/survey/collector/{assessmentId}/question/{surveyTemplateQuestionId}` — collector definitions and collected table items; wrapped response.
- `GET /node-api/assets/{assetTypeId}/{assetId}/assessment/review/summaries?assessmentTypeId=48&reviewTypeId=10` — approval/review records; wrapped response.
- `GET /node-api/assessments/{assessmentId}/assets?extra=SERVER_ACP` — assessment asset data; wrapped response.
- `POST /api/asset/label/search` — selected application labels, including Person Type, Data Types, and Development Channel.
- `GET /api/esatsBusappPersonRole01?... ` — ESATS application contacts/roles.
- `GET /api/esatsBusapp?... ` — ESATS application metadata.
- `GET /api/gsepDatabase?limit=4000&where=applicationEsatsId:=:{assetId}` — database inventory and DBA contact IDs.
- `GET /api/sisServerBseId?where=applicationId:=:{assetId},...` — associated server IDs.
- `GET /api/sisAllRecords?where=serverId:in:{ids}` — server inventory and environment.
- `GET /node-api/identity/ced?bemsId={id}` — CED identity/status evidence; wrapped response.

## Confirmed collector tables

- `ACP-AR1`: Role, Responsibility, Person Status, Person Type, Environment, Authorized Entity, Access to DB, Access to Server, Access to Application, and Data Type.
- `ACP-NPI1`: Non-Person Identifier, Function, and Non Person Account Owner.
- `ACP-RAP4`: database approvers.
- `ACP-SoD1`: access-privilege pairs when applicable.

The SND HAR records role-table edits through `POST /node-api/survey/collector/data-collector/upsert/batch`. Its earlier collector GET is an empty pre-save snapshot, while the upsert request/response bodies contain the edited role values. Runtime validation reads the current collector GET after the saved assessment is loaded.

## Evidence boundaries

The HARs do not contain authoritative STAR/MARS form role lists, a direct `CSIR-SvcAcct` answer, current external ICP records, or Insite/BLEAT comparison results. Checkpoints requiring those sources return `REVIEW` unless live context provides the missing authoritative evidence; absence is not treated as proof.
