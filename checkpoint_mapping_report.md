# ACP checkpoint implementation map

Authority: `ACP checkpoints.txt`. HAR files establish data availability only.

| Checkpoint | Execution | Primary evidence |
|---|---|---|
| ACP1 | Rule | Current assessment review vote codes |
| ACP2 | Rule | ACP-AA1 |
| ACP3 | AI semantic | Formatted ACP-AR1 JSON, ACP-RAP1, ACP-RAP2 |
| ACP4 | Rule/Review | ACP-RAP1 online-form reference; external role list when available |
| ACP5 | Rule | GSEP databases, hosting classification, ACP-AR1 |
| ACP6 | Rule/Review | GSEP DBA IDs, CED person type, ACP DBA role |
| ACP7 | Rule | ESATS roles, ACP-AR1 |
| ACP8 | AI semantic | Formatted ACP-AR1 JSON, ESATS, GSEP, ACP-AI2 |
| ACP9 | Rule | Risk Profiler-derived Development Channel/IP-owner label, ACP-AR1 |
| ACP10 | Rule | ACP-AR1 role name and access levels |
| ACP11 | AI semantic | Formatted ACP-AR1 JSON, Person Class labels, ACP-AI2 |
| ACP12 | Rule | ACP-AR1 Authorized Entity, Person Status, Person Type |
| ACP13 | Rule | ACP-AR1 access levels |
| ACP14 | Rule | ACP-AR1 Responsibility and access-level synonyms |
| ACP15 | Rule | SIS/CMDB server environments, ACP-AR1 environments |
| ACP16 | Rule/Review | ACP-NPI1 and direct CSIR-SvcAcct when available |
| ACP17 | Rule | ESATS/GSEP applicability and ACP-NPI1 rows |
| ACP18 | Rule | ACP-NPI1 Function values |
| ACP19 | Rule | ACP-NPI1 owners and CED status |
| ACP20 | Rule/Review | ACP-AR1 export access, ACP-EXPORT-1, current ICP when available |
| ACP21 | AI semantic | Formatted ACP-AR1 JSON and ACP-EXPORT-1 |
| ACP22 | AI semantic | Formatted ACP-AR1 JSON and ACP-AI2 authorization evidence |
| ACP23 | Rule | Row-local ACP-AR1 Person Status and Data Type |
| ACP24 | AI semantic | Formatted ACP-AR1 JSON and ACP-RAP1 request process |
| ACP25 | AI semantic | Formatted ACP-AR1 JSON and ACP-RAP1 modify process |
| ACP26 | AI semantic | Formatted ACP-AR1 JSON and ACP-RAP1 removal process |
| ACP27 | AI semantic | ACP-RAP1 and ACP-RAP3 separation |
| ACP28 | AI semantic | Formatted ACP-AR1 JSON, ACP-RAP1, ACP-RAP2 |
| ACP29 | AI semantic | Formatted ACP-AR1/NPI JSON, ACP-RAP3, ESATS roles |

There are 18 deterministic rule checkpoints and 11 semantic AI checkpoints. Rule validators return `REVIEW` rather than guessing when an authoritative external response is absent.
