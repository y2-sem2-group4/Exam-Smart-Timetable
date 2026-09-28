# Exam Smart Timetable — Git & GitHub Rule Book

This is how we work, if something breaks or a PR sits untouched, this doc is the first place we check.

---

## 1. Branches

| Rule | Detail |
|---|---|
| `main` is protected | Nobody pushes directly to it. Ever. GitHub will block it anyway. |
| One branch per person | `edith-branch`, `lenny-branch`, `craig-branch`, `daniel-branch`, `june-branch`, `angel-branch` |
| Don't work on someone else's branch | If you need to touch their code, open a PR against their branch or ask first |

```bash
# one-time setup
git clone https://github.com/y2-sem2-group4/Exam-Smart-Timetable.git
cd Exam-Smart-Timetable
git checkout -b <yourname>-branch
```

---

## 2. Daily habits — non-negotiable

| When | Do this |
|---|---|
| Every morning, before you start working | `git checkout main` → `git pull origin main` → `git checkout <yourname>-branch` → `git merge main` |
| Every evening, even if unfinished | `git add .` → `git commit -m "message"` → `git push origin <yourname>-branch` |

**Why the evening push matters:** if your laptop dies or you lose access, your work isn't gone. "I'll push when it's done" is how people lose two days of work. Push broken, unfinished code to your own branch, nobody sees it but you until you open a PR.

---

## 3. Commit messages

Format: `<PREFIX>-<number>: what you actually did`

| Example | Good or bad |
|---|---|
| `BE-02: add Exam model with clash status field` | Good — specific, tied to an issue |
| `fixed stuff` | Bad — fixed what? |
| `updates` | Bad — meaningless in six months |

Prefixes match your module: `BE-` (backend), `ADM-` (admin interface), `STU-` (student interface).

---

## 4. Issues — every task starts here

No issue = no work. If it's not written down, it doesn't exist and it can't be tracked.

| Field | Rule |
|---|---|
| Title | `<PREFIX>-<number>: short description` |
| Assignee | One person (or the pair, if it's a shared module task) |
| Label | Module prefix (`BE-`, `ADM-`, `STU-`) |
| Milestone | Which phase it belongs to |

New issues auto-land on the project board. You don't add them manually.

---

## 5. Pull Requests

| Step | Rule |
|---|---|
| Before opening | Your code should actually run. Don't open a PR to "see if it works." |
| Title | Reference the issue: `Closes #12` in the description auto-links and auto-closes it on merge |
| Reviewer | At least 1 approval required — GitHub won't let it merge without one |
| Who reviews | Anyone not the author. Backend PRs ideally reviewed by the other backend person; same for frontend pairs |
| Merging | Only after approval. Squash or regular merge, your call — just not a mess of 40 "fix typo" commits |

**Important — merging now auto-closes the linked issue.** That means: **do not merge until your feature actually works.** A green checkmark on a broken feature is worse than an open issue, because it looks done when it isn't.

---

## 6. The board — keep it honest

| Column | Meaning |
|---|---|
| Backlog | Not started, not urgent yet |
| To Do | Next up |
| In Progress | You're actively working on it — drag it yourself when you start |
| In Review | PR is open, waiting for approval — moves automatically |
| Done | Merged — moves automatically |

The only column you have to move manually is **In Progress**. Everything else moves itself. If your card's been sitting in "To Do" for a week, that's visible to everyone — that's the point.

---

## 7. Weekly sync

| What happens | Who |
|---|---|
| Go through open PRs, review and merge what's ready | Whole team |
| Resolve any merge conflicts together, live | Whoever's affected |
| Call out anything blocked | Whoever's blocked — don't wait to be asked |
| Confirm the board actually matches reality | PM (Edith) |

---

## 8. If someone goes quiet

This is the part that actually matters, given how this group's gone so far.

| Situation | What happens |
|---|---|
| No commits, no response for 3+ days on an assigned issue | PM reassigns the issue to someone else — post it in WhatsApp first, not silently |
| A module isn't progressing at all | Raised at the next sync, whole team decides how to redistribute |
| Someone's stuck, not ignoring it | Tag them a `question` label and mention it in the sync — stuck is fine, silent is not |

This isn't about punishing anyone — it's so the project doesn't stall waiting on one person nobody wants to chase.

---

## 9. Definition of "done" for a task

A task is NOT done when the code compiles. It's done when:

- [ ] It runs without errors
- [ ] It does what the issue actually asked for
- [ ] It's been tested manually at least once by the person who wrote it
- [ ] The PR has 1 approval
- [ ] It's merged into `main`

If any of these aren't true, it's still "In Progress" — not Done, no matter what the board says.
