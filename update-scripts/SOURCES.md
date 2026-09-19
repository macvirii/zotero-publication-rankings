# Ranking dataset provenance

The generated files in this directory preserve source-specific editions rather than treating every bundle refresh as current.

| Dataset | Bundled edition | Source material |
| --- | --- | --- |
| SJR | 2025 | `source-data/scimagojr 2025.csv`, imported unchanged from upstream commit `fd0aa7a` (`update-scripts/scimagojr 2025.csv`, SHA-256 `ead12360e11e9ebc2f4eb7280315540d0bfac69897f9f3b722ebe5039c43d523`) |
| CORE | ICORE 2026 plus historical editions | `source-data/full_CORE.csv`, imported unchanged from upstream commit `fd0aa7a` (`update-scripts/full_CORE.csv`, SHA-256 `4686bdd26e8f079b8ff6edbd06ad8c0fa3fd82c867afe21c3d12addc1f4269fe`) |
| ABS | 2024 | `source-data/ABSRanking2024_Fulllist.csv` |
| Qualis CAPES | 2021-2024 | `source-data/classificações_publicadas_todas_as_areas_avaliacao1768259646562.xlsx` |
| ABDC | 2025 | `source-data/ABDC-JQL-2025-v1-260326.xlsx` |
| JCR | Unknown | An authorized local export was previously bundled into `src/data/data.js`; the generator recovers that committed data when the ignored local `jcr_rankings.json` is unavailable. |
| SPELL | 2024 | Generated snapshot in `spell_rankings.json`. |
| SciELO Brasil | Unknown snapshot date | Generated current-journals snapshot in `scielo_rankings.json`. |
| FT50 | Unknown | `source-data/FT50_FullList.csv`. |

The 2024 SJR CSV remains in `source-data/` as a historical input. `extract_sjr.py` selects the newest year-labelled CSV and binds its edition to the generated JSON checksum in `sjr_rankings.metadata.json`; the bundle generator reports an unknown SJR edition if that sidecar is missing or stale. `extract_full_core.py` selects the newest source edition per conference, preferring ICORE when sources share a year. The bundle generator derives the global CORE edition from the rank suffixes actually present in `core_rankings.json`.

Dataset providers retain their own rights and terms. Importing source files or generating the plugin bundle does not replace or broaden those terms; consult the named provider before redistributing or reusing source data outside this project.
