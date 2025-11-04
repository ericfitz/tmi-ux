tmStatus:
0 - Not Started - The security review has been initiated but no assessment activities have begun.
1 - In Progress - Active assessment is underway, including threat modeling, code review, or testing.
2 - Pending Review - Assessment artifacts (e.g., reports, findings) await formal review by security leads or approvers.
3 - Remediation Required - Vulnerabilities or issues have been identified; development must address them.
4 - Remediation In Progress - Fixes for identified issues are being implemented by the development team.
5 - Verification Pending - Remediation is complete; security team must verify effectiveness.
6 - Approved - All issues are resolved and verified; the application meets security criteria for release or deployment.
7 - Rejected - The review failed critical criteria; significant rework is required before re-submission.
8 - Deferred - The review is paused (e.g., due to resource constraints or application changes); resumption is planned.
9 - Closed - The review is fully completed and archived, with no further action needed.

threatStatus:
0 - Open - The finding has been identified and documented but no action has been initiated.
1 - Confirmed - The threat has been validated as legitimate through analysis or evidence.
2 - Mitigation Planned - A remediation or mitigation strategy has been defined and assigned.
3 - Mitigation In Progress - Implementation of controls, code changes, or countermeasures is underway.
4 - Verification Pending - Mitigation is complete; security team must test or review effectiveness.
5 - Resolved - The threat is fully mitigated and verified; residual risk is acceptable.
6 - Accepted - The threat is acknowledged but intentionally not mitigated (e.g., due to business justification); requires formal risk acceptance.
7 - False Positive - Investigation determined the finding is not a valid threat; no further action required.
8 - Deferred - Action is postponed with approval (e.g., for future sprints); includes rationale and due date.
9 - Closed - The finding is archived after resolution, acceptance, or invalidation, with audit trail.

threatSeverity:
0 - Critical - Exploitable vulnerability enables complete system compromise, data breach, or safety impact; requires immediate action.
1 - High - Significant impact or high likelihood; enables major unauthorized access, privilege escalation, or service disruption.
2 - Medium - Moderate impact or likelihood; limited data exposure, partial functionality impairment, or requires chained exploits.
3 - Low - Minimal impact or low likelihood; negligible business impact, requires specific conditions or user interaction.
4 - Informational - No direct exploitability; recommendation, best practice deviation, or configuration improvement.

threatPriority:
0 - Immediate (P0) - Must be addressed urgently; active exploitation, regulatory violation, or critical business exposure.
1 - High (P1) - Requires prompt resolution; high-risk exposure or upcoming release deadline.
2 - Medium (P2) - Address within standard development cycles; moderate exposure.
3 - Low (P3) - Include in backlog for future cycles; no immediate exposure.
4 - Deferred (P4) - Postponed with documented business approval; tracked but not scheduled.
