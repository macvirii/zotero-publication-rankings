# Installation Guide

## Publication Rankings for Zotero 9

**Original author:** Ben Stephens  
**Fork maintainer:** macvirii  
**License:** GNU General Public License v3.0 (GPLv3)  
**Repository:** https://github.com/macvirii/zotero-publication-rankings

This fork has been validated only on Zotero 9.

## Quick Start

1. Download the latest `publication-rankings-*.xpi` from https://github.com/macvirii/zotero-publication-rankings/releases/latest.
2. Open Zotero.
3. Go to **Tools → Add-ons**.
4. Click the gear icon and select **Install Add-on From File...**.
5. Select the downloaded `.xpi` file.
6. Restart Zotero if prompted.
7. Right-click the item table column headers and enable the **Ranking** column.

## What Gets Displayed

The plugin displays enabled ranking sources in a custom **Ranking** column.

### Journal Sources

- **SJR 2024**: `Q1 18.288`, `Q2 1.423`, `Q3 0.628`, `Q4 0.145`
- **ABS 2024**: `1`, `2`, `3`, `4`, `4*`
- **ABDC 2025**: `A*`, `A`, `B`, `C`
- **Qualis CAPES 2021-2024**: `A1`, `A2`, `A3`, `A4`, `B1`, `B2`, `B3`, `B4`, `C`
- **Nova CAPES**: `MB`, `B`, `R`, `F`, `I`, calculated locally from available source datasets
- **SPELL 2024**: `Top 10%`, `10-40%`, `40-70%`, `70-100%`
- **FT50**: `FT50`

### Conference Sources

- **CORE 2023 plus historical data**: `A*`, `A`, `B`, `C`, vintage values such as `B [2018]`, Australasian values such as `Au A`, and national values such as `Nat US`

## Common Actions

- **Automatic display**: Rankings appear when you view items if auto-update is enabled.
- **Manual check**: Select items, then use **Tools → Check Publication Rankings** or the right-click context menu.
- **Debug matching**: Enable debug mode in preferences, then right-click selected items and choose **Debug Ranking Match**. Check Zotero Debug Output for lines beginning with `[MATCH DEBUG]`.
- **Manual override**: Right-click selected items and choose **Set Manual Ranking...** or **Clear Manual Ranking**.
- **Extra field export**: Right-click selected items or use the Tools menu and choose **Write Rankings to Extra Field**.

## Preferences

Open **Edit → Settings** or **Zotero → Settings** on macOS, then select **Rankings**.

- Enable or disable CORE, ABS, ABDC, FT50, Qualis CAPES, Nova CAPES, and SPELL.
- SJR is always enabled.
- Toggle badge display instead of colored text.
- Toggle automatic ranking updates.
- Enable debug mode for detailed matching logs.

## Rebuilding from Source

Build output is written to `dist/publication-rankings-<version>.xpi`.

### Windows

```powershell
.\build.ps1
```

### Linux/macOS/WSL

```bash
./build.sh
```

The build scripts copy root plugin files plus modules from `src/` into a temporary directory, flatten the JavaScript modules into the XPI root, and package the result as an `.xpi` file.

## Data Updates

Source CSV/XLSX files live in `update-scripts/source-data/`. Generated intermediate JSON files live in `update-scripts/`. The combined runtime data file is `src/data/data.js`.

To regenerate all data after updating source files:

```bash
cd update-scripts
python extract_sjr.py
python extract_full_core.py
python extract_abs.py source-data/ABSRanking2024_Fulllist.csv
python extract_abdc.py source-data/ABDC-JQL-2025-v1-260326.xlsx
python extract_qualis_capes.py source-data/classificações_publicadas_todas_as_areas_avaliacao1768259646562.xlsx
python extract_spell.py
python extract_scielo.py
python extract_ft_50.py source-data/FT50_FullList.csv
python generate_data_js.py
```

Then rebuild the plugin with `./build.sh` or `.\build.ps1`.

## Troubleshooting

**The Ranking column is not visible**

Right-click the Zotero item table column headers and enable **Ranking**.

**A venue is not found**

Check whether the item has a publication title, proceedings title, conference name, or ISSN. Local journals, workshops, and venues absent from the bundled ranking datasets may not match automatically.

**Menus do not show debug actions**

Enable debug mode in the Rankings preferences. The debug menu item is intentionally hidden when debug mode is off.

## Support

For fork-specific issues, open an issue at https://github.com/macvirii/zotero-publication-rankings/issues.

For generally useful upstream changes, consider whether they should also be proposed to the original project.

---

Copyright (C) 2025 Ben Stephens. This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
