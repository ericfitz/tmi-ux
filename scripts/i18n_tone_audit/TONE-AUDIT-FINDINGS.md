# Tone audit findings (#678) — recommendations only

**Source rubric:** `src/assets/i18n/STYLE-GUIDE.md` (§ Tone)
**Scope:** all `en-US.json` keys whose inferred surfaces include `error`, `snackbar`, `validation`, or `description` (168 candidates).
**Lint baseline:** `pnpm run lint:i18n` is clean (warnings only on ellipsis convention).
**Status:** no files modified. Decisions below are for review.

Buckets:

- **A — Recommend change** (clear rubric violations). Includes proposed new strings.
- **B — Borderline / your call** (debatable; rationale included).
- **C — Out of scope but found during the pass** (real bugs / proper-noun violations the lint isn't catching). Worth fixing in the same PR or splitting off.
- **D — Pass** (already rubric-correct; not listed individually — everything not in A/B/C passed).

Numbering inside each bucket is for review reference only.

---

## A. Recommend change

### A1. `common.validation.email`

- **Current:** `Please enter a valid email address.`
- **Proposed:** `Email address must be valid.`
- **Why:** "Please enter…" frames a request, not a requirement. Rubric calls for requirement-shaped validation (e.g. `Email address is required`).

### A2. `common.validation.invalidUrl`

- **Current:** `Please enter a valid URL`
- **Proposed:** `URL must be valid.`
- **Why:** Same as A1 — also missing terminal period (sentence: subject + verb).

### A3. `login.sessionExpired`

- **Current:** `Your session has expired. Please sign in again.`
- **Proposed:** `Session expired. Sign in to continue.`
- **Why:** Past-tense action construction is preferred ("Couldn't connect", "Failed to save"). "Please" softens guidance that is not optional — the user must sign in to proceed. "Sign in to continue" gives the next step plainly.

### A4. `documentAccess.copiedEmail`

- **Current:** `Email copied`
- **Proposed:** `Email copied to clipboard.`
- **Why:** Sentence (subject + verb) → needs terminal period. Also matches the existing snackbar pattern `common.copiedToClipboard: "Copied to clipboard."` — the more explicit form here is fine but should align in punctuation.
- **Note:** `common.copiedToClipboard` already exists. Consider deleting this key and reusing the common one — but that's a code change, not a string change. Flagging for your decision.

### A5. `common.deleteWarningTypeConfirmation`

- **Current:** `To confirm, please type "{{confirmvalue}}" in the field below`
- **Proposed:** `To confirm, type "{{confirmvalue}}" in the field below.`
- **Why:** Drop "please" (rubric: plain, direct). Add terminal period (complete instruction).

### A6. `admin.webhooks.hmacSecretDialog.warning`

- **Current:** `This is the only time you will be able to view this secret. Please copy it. If you lose or forget it, you will have to delete and re-create the webhook.`
- **Proposed:** `This is the only time the secret will be shown. Copy it now. If lost, the webhook must be deleted and re-created.`
- **Why:** Drop "please". Tighten passive/future-tense hedging to active, direct phrasing. Same information, less verbose.

### A7. `tos.section1.content` (TOS — second sentence only)

- **Current:** `By accessing and using this web site, you accept and agree to be bound by the terms and provisions of this agreement. If you do not agree to these terms, please do not use this web site.`
- **Proposed:** `By accessing and using this web site, you accept and agree to be bound by the terms and provisions of this agreement. If you do not agree to these terms, do not use this web site.`
- **Why:** "please do not" softens what is meant as a binding condition. Legal copy should be plain.

### A8. `privacy.contactContent.part1` + `tos.contactInfo.part1`

- **Current (privacy):** `If you have any questions about this privacy policy, please feel free to contact the operator of this web site via the contact information on the.`
- **Current (tos):** `If you have any questions about these terms, please feel free to contact the operator of this web site via the contact information on the.`
- **Proposed (privacy):** `For questions about this privacy policy, contact the operator via the information on the.`
- **Proposed (tos):** `For questions about these terms, contact the operator via the information on the.`
- **Why:** "If you have any questions… please feel free to" is the canonical marketing/customer-service register the rubric warns against. The trailing "the." is normal — these strings concatenate with the next `.part2` chunk that contributes "[link to operator info] Page".

### A9. `about.opensource.paragraph1`

- **Current:** `This application is built with the support of exceptional open-source projects. We're grateful to the communities behind these projects for providing the capabilities that bring our interface and functionality to life.`
- **Proposed:** `This application is built on open-source projects. Thanks to the communities maintaining them.`
- **Why:** "exceptional", "grateful", "bring … to life" is the marketing register the rubric explicitly excludes from description surfaces. The shorter form keeps the credit/acknowledgement without the puffery.

### A10. `about.description2`

- **Current:** `The platform features security review organization and state management, interactive data flow diagram creation with real-time collaboration, and comprehensive threat documentation capabilities. Built with modern web technologies, TMI helps teams manage the security review process and identify, analyze, and mitigate security threats through collaborative modeling.`
- **Proposed:** `TMI organizes security reviews, hosts interactive data flow diagrams with real-time collaboration, and documents threats. Teams use it to manage the review process and to identify, analyze, and mitigate security threats.`
- **Why:** "platform features", "comprehensive … capabilities", "built with modern web technologies" is marketing voice. Rephrased to lead with what the tool does, plainly.

### A11. `homeDescription`

- **Current:** `TMI is a tool that streamlines your organization's security review and threat modeling processes. It drives review workflows, organizes key information, and enables teams to collaboratively build data flow diagrams. It also connects to automation, helping reduce manual toil and surface security threats more efficiently.`
- **Proposed:** `TMI manages security reviews and threat modeling. It runs review workflows, organizes the supporting information, lets teams collaborate on data flow diagrams, and connects to automation that surfaces threats.`
- **Why:** "streamlines", "drives", "enables", "manual toil", "more efficiently" — marketing register. The rewrite is the same information stated plainly.

### A12. `login.explanation`

- **Current:** `Sign in with your existing account from a trusted identity provider. This eliminates the need for a separate password, streamlining your experience while keeping you secure. We never store or manage passwords—your credentials stay with your provider and can't be compromised through US.`
- **Proposed:** `Sign in with your existing account from a trusted identity provider. Your password stays with the provider — TMI never stores or manages it.`
- **Why:** Two problems. (1) "streamlining your experience while keeping you secure" is marketing voice. (2) **The trailing "compromised through US." is a real bug** — almost certainly the word "us" was meant (the application doesn't have access to your password, so it can't be compromised "through us"), and a previous pass capitalized it to the `US` acronym from `lists.json`. The current text reads nonsensically.
- **Severity:** treat the second issue as a bug regardless of the tone audit — it's user-visible nonsense on the login page.

---

## B. Borderline / your call

### B1. `addons.invokeDialog.valueTooLong`

- **Current:** `Value exceeds maximum length.`
- **Rubric position:** validation should state the requirement, not the failure mode. Strict reading: should be `Value must be at most N characters.` But the surrounding code doesn't pass a `max` placeholder into this string, so changing to a requirement form would require a code change.
- **Recommendation:** **leave as-is** unless you want to also tighten the dialog code to pass a `{{max}}` value. Same severity as A1/A2 in principle but with implementation cost.

### B2. `common.validation.required`

- **Current:** `This field is required.`
- **Rubric position:** the example in the rubric is `Email address is required`, which names the field. The current string is the generic fallback used when no field name is known. Rewriting to name the field would require touching each call site.
- **Recommendation:** **leave as-is** for the generic key. Audit call sites separately as a follow-up — many already have field-specific keys (e.g. `projects.createDialog.nameRequired`).

### B3. `triage.revisionDialog.description`

- **Current:** `Provide notes explaining what needs to be revised. The submitter will see these notes when they review their response`
- **Issue:** missing terminal period on second sentence.
- **Proposed:** `Provide notes explaining what needs to be revised. The submitter will see these notes when they review their response.`
- **Severity:** punctuation only. Including here rather than A because it's a one-character change and not a tone issue strictly.

### B4. `sessionExpiry.message`

- **Current:** `Your session is about to expire. Would you like to extend your session or log out now?`
- **Rubric position:** "Would you like to…" is softer than rubric tone but in this case it's a genuine choice presented in a dialog with two action buttons, so the question form is natural.
- **Recommendation:** **leave as-is**. The phrasing matches the UI pattern (modal with binary choice).

### B5. `chat.emptyState.description`

- **Current:** `Ask questions about your threat model. Timmy can help analyze threats, review assets, and discuss your security posture.`
- **Rubric position:** "help analyze … review … discuss your security posture" is mildly product-y but appropriate for an empty-state hint describing capability.
- **Recommendation:** **leave as-is** — it's the chat empty state describing what the assistant does. Marketing-voice threshold not crossed.

### B6. `privacy.intro2`

- **Current:** `The operator is committed to protecting your privacy. This privacy policy explains how your information is handled.`
- **Rubric position:** "is committed to protecting your privacy" is borderline marketing. But this is the canonical opening sentence of a privacy policy and replacing it with something more clipped reads oddly in a legal-style document.
- **Recommendation:** **leave as-is**. Legal copy gets a slight pass on register.

### B7. `privacy.dataSecurityContent1` and surrounding privacy/TOS paragraphs

- These contain phrases like "industry-standard security measures", "while no system is entirely impervious to risks", "continuously monitors and updates safeguards". Borderline marketing in a normal product surface; appropriate in a privacy policy.
- **Recommendation:** **leave as-is**. Legal/privacy register.

---

## C. Out of scope but found during the pass

These aren't tone issues per se, but I noticed them while reading. Listing so they don't get lost.

### C1. Proper-noun casing violations (lint gap)

The lint's sentence-case rule allows `google drive` mid-sentence because of how the rule is implemented (it only enforces sentence-start capitalization, not proper-noun preservation everywhere). But `Google Drive` is in `lists.json` `proper_nouns` and should be canonical case wherever it appears.

Found:

- `documentSources.googleDrive` (line 1325): `Pick from google drive` → `Pick from Google Drive`
- `documentSources.empty.description` (line 1354): `…from google drive, and other services…` → `…from Google Drive, and other services…`
- `documentSources.googleDrive.name` (line 1358): `Google drive` → `Google Drive`
- `privacy.dataSharingList1` (line 1662): `…such as AWS, google cloud…` → `…such as AWS, Google Cloud…` (and consider adding `Google Cloud` to `proper_nouns` since it's clearly intended as one).

**Recommendation:** fix these as part of this PR (they're trivially correct) and file a separate follow-up issue to extend the lint to enforce proper-noun preservation mid-sentence.

### C2. `login.explanation` trailing word — bug

Covered in A12. Mentioning here too because it's the most user-visible defect found in this pass.

### C3. Punctuation: missing terminal period

Covered in A4, A2, B3. The lint already enforces the period rule on most surfaces; these three slipped through, likely because of mixed surfaces or because the lint treats them as labels in their other usage context.

---

## Summary counts

- Bucket A (recommend change): **12 keys** (plus the cascading non-English re-translation per acceptance criteria).
- Bucket B (borderline, defer/leave): **7 items, mostly leave-as-is**.
- Bucket C (out-of-scope but found): **4 proper-noun fixes + 1 bug**, plus the lint gap to file separately.

Of the 168 audited candidates, **~91% (152) already pass** the tone rubric. The audit's value here is the 12 marketing/softening fixes (A1–A12), the embedded login-page bug (A12), and the four mid-sentence proper-noun violations (C1).

## Next steps you can choose from

1. **Approve A1–A12 wholesale**, I edit en-US.json + regenerate the 16 non-English locales for those 12 keys, run `pnpm run lint:i18n` + `pnpm run lint:all`, commit.
2. **Approve a subset of A** — point me at specific items to keep, defer, or rephrase differently.
3. **Bundle C1 + A12 (the bug) separately as a quick PR first**, then do the tone changes in a second PR.
4. **Want different rewording on any of A1–A12** — call out which and what direction.

The audit script is at `scripts/i18n_tone_audit/extract_candidates.py`; it's re-runnable and deterministic if you want to regenerate the candidate set later.
