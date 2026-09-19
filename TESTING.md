# Testing 0.3.7

Build with `./build.sh`; install `dist/publication-rankings-0.3.7.xpi` using Zotero's Add-ons manager. The owner confirmed successful testing of `0.3.7pre1`; this stable release changes its package version and update metadata while preserving the tested runtime code and datasets. The build contains no code that downloads ranking updates.

## Automated checks

```sh
node --test tests/*.test.cjs
python3 -m unittest discover -s update-scripts/tests -p 'test_*.py'
bash -n build.sh
python3 -m compileall -q update-scripts
./build.sh
```

## Zotero checks

Use temporary items in a test collection. Enable the relevant ranking sources in Preferences. The automated harness uses Zotero/DOM stubs; these checks verify the real application integration.

1. Create a journal article with publication `Nature` and ISSN `0028-0836`. Hover each badge: it should identify its own source record, ISSN and dataset edition. SJR should say 2025; a source without a verified edition should say unknown. The score can differ across sources.
2. Switch off **Use Badges**. Hover each colored text result and verify the same details. Try both main-library and Advanced Search results, scrolling away/back and sorting the column.
3. Select one item and use **Tools → Show Ranking Match Details** or the corresponding context-menu action. Confirm the details are available without a mouse hover, including long publication names and Nova CAPES source evidence.
4. Compare `Journal of Neurology` and `Journal of Neurology.` with no ISSN. Both should match the base journal, not `Journal of Neurology, Neurosurgery and Psychiatry`. `Forum of Mathematics` should not silently choose Pi or Sigma. `Engineering` without ISSN should be ambiguous; ISSN `2095-8099` should select Q1 1.899 and `0013-7782` should select Q4 0.1.
5. Test conference titles: the full `IEEE International Conference on Telecommunications` should keep its own ranking; `IEEE International Conference on Computer Science` should have no CORE result. A real conference title prefixed with proceedings/year/ordinal text should still resolve when its cleaned full title is unique.
6. Test `revista da faculdade de direito`: without ISSN its ambiguous Qualis result should be absent; with `0303-9838` it should be C, and with `0104-0367` it should be A2. These are different publications sharing a title in the source list.
7. A `Science` title with Nature's ISSN `0028-0836` should not produce SJR/JCR badges. A blank publication title with `0028-0836` should resolve those identifier-backed sources. An unknown or malformed ISSN must not permit matching a different identified journal simply by a similar title.
8. `international journal of human computer interaction` with `2180-1347` must not borrow the Q1/MB results belonging to the separate journal with ISSNs `1044-7318` / `1532-7590`.
9. Set and clear a manual override. Its tooltip should say it applies to the publication title, with no invented source match. Test a value containing `|`, `&&`, `<`, and `&`; the literal text should render safely.
10. Edit a publication title or ISSN after the row has been displayed. Revisit/refresh the row and verify its rank and hover update together. Repeat with auto-update disabled: explicit redraw/check should use the new metadata.
11. Disable/re-enable the plugin and reopen windows. The details menu must not duplicate, and its entries must be removed when disabled. Verify column sorting and existing Extra-field export behavior.

## Expected coverage change

Ambiguous or incomplete titles may produce fewer badges than before. This is intentional: broad substring, comma-prefix and word-overlap guesses no longer assign automatic journal rankings. Correct the item's publication title/ISSN or use a manual override for a publication you have verified.

## Reverting the test package

Install the previous stable XPI through the Add-ons manager. Matching results are computed from item metadata; installing this build does not rewrite Zotero publication fields. As in prior versions, writing ranks to Extra requires the explicit menu action. Disabling/uninstalling the plugin retains the existing plugin-owned Extra-line cleanup behavior.
