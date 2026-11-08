# Lenses

Apply each lens that fits the deliverable. A lens is a question; a finding is a "no" with grounds.

## General lenses

| Lens | Question | Typical problems |
|---|---|---|
| **Support** | Does each cited source say what is attributed to it, at the place cited? | Source says something weaker, different or opposite; quote cut out of context; citation to a source that only mentions the topic; claim with no citation; citation to a secondary source when the primary says otherwise |
| **Counter-evidence** | Is there credible evidence against the main conclusions that was left out? | Contrary studies, newer versions of a standard, official corrections, retractions, known incidents that contradict a "safe" claim |
| **Logic** | Does each conclusion follow from its evidence? | Correlation as causation; generalization from one case; false dilemma; circular reasoning; appeal to authority outside its field; conclusion stronger than its premises; missing alternative explanations |
| **Calibration** | Is the stated confidence the confidence the evidence allows? | *Established* resting on one study or one blog; a forum post presented as fact; hedges missing where the sources disagree; the summary more certain than the body |
| **Bias** | Is the evidence a fair sample? | Only sources from one side, vendor, country or period; sponsored sources not flagged; recency or survivorship bias; cherry-picked quotes; confirmation of what the request expected |
| **Time and context** | Is each claim valid for the date and place in question? | Current text used for a past date; outdated prices or versions; results from another jurisdiction, market or version applied without saying so |
| **Completeness** | Does it answer what was asked, for its purpose and audience? | Key questions unanswered; "always cover" items of the type missing; scope drift; important risks or options absent; gaps not declared |
| **Consistency** | Does the deliverable agree with itself and with its inputs? | Summary contradicts the body; numbers that do not add up; the same item with different values; ids that do not resolve; content not traceable to the input (invented) |
| **Clarity** | Could a reader misunderstand what matters? | Ambiguous wording on a key point; a table that hides the main result; jargon without definition for the stated audience |

## Lens of the deliverable's type

| Deliverable | Extra checks |
|---|---|
| Investigation dossier (`deduction`) | Each bibliography entry is in the source log as used; key findings have an evidence-table row whose excerpt really supports them; confidence follows the kind of claim (normative vs empirical); the stop criterion is stated; divergences and gaps are real, not "none found" by default |
| Requirements review (`requirements-review`) | Questions really expose ambiguity, contradictions and missing rules; nothing assumed as a requirement without source; rule interactions considered |
| Test scenarios and cases (`test-design`) | Every scenario traces to a rule or criterion; negative, boundary and exception flows present where the rules call for them; expected results observable and taken from the source, not invented; no redundant cases; risks from the input covered |
| Failure pre-analysis (`failure-analysis`) | The failure point is supported by the log lines quoted; the timestamp matches; the hypothesis is worded as a hypothesis; the direction follows from the evidence |
| Test evidence (`evidence-collection`) | Each result is backed by a print or recording; statuses were confirmed by the QA; masked data really masked |
| Proposal or decision memo | Options compared on the same criteria; costs and risks of the recommended option stated; what would change the recommendation |
