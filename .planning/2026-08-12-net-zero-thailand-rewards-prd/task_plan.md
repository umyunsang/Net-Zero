# Task Plan: Net-Zero Thailand Rewards bilingual PRD

## Goal
Turn the supplied deep-interview record into a complete Korean and Thai PRD, write both versions into the specified existing Google Doc without changing sharing settings, and verify content and presentation.

## Next Step
Run the mandatory trusted read, add the two PRD tabs, and write the verified bilingual content.

## Current Phase
Phase 4

## Phases

### Phase 1: Requirements & Discovery
- [x] Read the complete interview record and extract authoritative requirements
- [x] Inspect relevant `.gjc` authority and current target Google Doc structure/content
- [x] Record scope, unresolved items, and write-safety constraints in findings.md
- **Status:** complete

### Phase 2: PRD Structure & Coverage
- [x] Build a source-to-section coverage map
- [x] Define one canonical PRD structure shared by Korean and Thai versions
- [x] Separate confirmed requirements, assumptions, and post-MVP items
- **Status:** complete

### Phase 3: Bilingual Drafting
- [x] Draft the Korean PRD as the semantic source of truth
- [x] Produce a Thai localization preserving requirements and status labels
- [x] Self-review for omissions, contradictions, placeholders, and translation drift
- **Status:** complete

### Phase 4: Google Docs Write & Verification
- [ ] Perform the required trusted read immediately before the first write
- [ ] Write both versions into the specified existing Google Doc
- [ ] Read back the document and verify section completeness and ordering
- [ ] Export/render if supported and inspect every page for layout defects
- **Status:** in_progress

### Phase 5: Delivery
- [ ] Confirm no sharing or unrelated Drive state was changed
- [ ] Deliver the verified Google Docs link and disclose any remaining uncertainty
- **Status:** pending

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Use the supplied deep-interview file as the primary factual authority | The user explicitly identified it as the completed requirements record and authorized a PRD based on it |
| Preserve existing Google Doc organization and sharing | The request authorizes content authoring only |
| Korean is the semantic source; Thai is a faithful localization | Reduces cross-language requirement drift |
| Use one shared 18-section PRD skeleton | Shared ordering makes cross-language review and drift detection practical |
| Keep adoption KPIs and implementation stack explicitly open | The interview supplies functional acceptance criteria but no validated adoption targets or technology decision |

## Errors Encountered
| Error | Resolution |
|-------|------------|
| `init-session.sh` was not executable when invoked directly | Re-ran it explicitly with `sh`; plan files were created successfully |
| First plan-status patch targeted a decision row in the wrong file | Re-read the live plan and applied a corrected file-scoped patch |
| First streamed PDF base64 decode produced a 0-byte file because PTY Ctrl-D did not flush the payload as expected | Retry with an exact-byte `dd` reader so the decoder exits after the known payload length without relying on EOF |
| Non-PTY exact-byte decoder exited immediately because its stdin was closed before streaming | Use a PTY with echo disabled and exact-byte termination |
| PTY exact-byte decoder still produced 0 bytes because canonical terminal mode buffered the payload pending a newline | Disable canonical input with `stty -icanon` before streaming |
