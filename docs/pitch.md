# The six-minute pitch, and the questions after it

Everything here was re-measured on 2026-09-08 against the code and data on the demo
laptop. Where a number in `docs/demo-runbook.md` disagrees with this file, this file is
right and that one is stale (see **Numbers that changed** at the end).

Rehearse the script. Read the Q&A. Do not read the numbers table out loud.

---

## The script

### 0:00 – 0:40 · The problem

> A password proves who you were at the moment you typed it. It proves nothing a second
> later. Every system in this room authenticates once and then trusts the chair for the
> rest of the day.
>
> We built the thing that keeps checking. Not with a camera watching you, not with a
> fingerprint reader. With the keyboard you are already using.

Do not say "revolutionary", "AI-powered", or "military-grade". Reviewers who have sat
through forty pitches are counting those.

### 0:40 – 1:10 · The idea

> Everyone types with a rhythm. How long you hold each key, the gap before the next one,
> where you pause, how often you correct yourself. It is stable enough to recognise you
> and it moves when you do: when you are tired, when you are rushed, when somebody is
> standing over you.
>
> KeySign takes one signal, that rhythm, and asks four questions of it. Who is typing.
> What state are they in. Is something wrong right now. And is the baseline itself
> drifting over months. One pipeline, four heads.

Hold up four fingers. Drop one per head as you name them. It buys you the structure for
free and the reviewers will follow it for the rest of the pitch.

### 1:10 – 4:10 · The demo, four beats

Say what you are about to do *before* you do it, every time. A reviewer who is still
reading the screen is not listening to you.

**Beat 1, 30 s. It knows me.**
Type a normal sentence. Point at Identity.

> That is not a login. I never told it who I was this minute. It is reading the rhythm
> and matching it against my own baseline, and it re-decides twice a second.

**Beat 2, 40 s. It knows how I am.**
Have someone start a 20-second countdown out loud while you keep typing.

> Same keystrokes, different question. The load meter is my typing compared to *my* calm
> baseline, not to some population average. That matters: my calm is somebody else's
> panic.

**Beat 3, 60 s. Somebody else sits down.**
Teammate slides in mid-sentence and keeps typing steadily. Do not touch the profile
selector.

> Watch the distance climb. Now watch Identity: it says this is not me, and it names who
> it thinks it is instead.

Then the lock. When the screen comes back, show the phone.

> Two things happened. It pushed to my phone with a photo of who was at the keyboard and
> a snapshot of what was on screen. And it locked the machine. It locked because two
> independent factors agreed: the typing said not-me, and the camera said not-me.

**Beat 4, 50 s. The one nobody else does.**
Sit back down. Have someone stand over you barking instructions on a countdown.

> This is the case that makes it a safety tool rather than a lock. It is me at the
> keyboard, the camera confirms it is me, and the typing is far outside my calm baseline
> while my load is pinned. That is not an intruder. That is me under pressure.
>
> So it does not lock, because locking me out helps nobody. It sends a silent alert. No
> popup, no sound, nothing on screen the person standing over me can see.

That beat is the differentiator. Give it room.

### 4:10 – 5:10 · The numbers

Say three, not eight.

> Identity: 95.6 percent across two thousand live-shaped windows, five classes, chance is
> twenty. Trained on our own typing plus a public benchmark of 51 people.
>
> The face check on this laptop: every frame it called me scored 0.42 or higher, every
> frame it called somebody else scored 0.25 or lower. Two populations, no overlap.
>
> And the one I would rather you remember: of a hundred and four real alerts where the
> camera got a look, sixty percent never locked anything. Thirty-nine stayed on the
> machine entirely, twenty-three were downgraded to a silent alert. The typing raises the
> question. The camera decides the consequence.

### 5:10 – 6:00 · Privacy, roadmap, close

> Everything you just watched ran on this laptop. No cloud, no inference API, no network
> call. I can prove that: turn the wifi off and run the demo again.
>
> The recordings keep timings and a coarse key class. Letter, digit, punctuation. Not the
> characters. A session file cannot be read back as what I wrote.
>
> The fourth head is the vision. Published work finds typing rhythm shifts over months
> with fatigue and with some motor conditions. We have days of our own data, so Drift is a
> chart of public longitudinal records and the research behind it. It scores nobody and
> diagnoses nothing. We are not claiming it does.
>
> One pipeline, four questions, on-device. Happy to take questions.

Ending on the limit rather than the boast is what buys you credibility in the Q&A.

---

## The numbers, verified 2026-09-08

Say them, do not read them.

| Claim | Number | Where it comes from |
|---|---|---|
| Identity, cross-validated | **95.6%** on 2074 live-shaped windows, 5 classes, chance 20% | `pipeline.identity eval data/features_windows.csv` |
| Biggest confusion | Akkshar/Akshaj 19 windows each way; Shourya/Utkarsh 17 and 14 | same confusion matrix |
| Face, called the owner | 33 frames, 0.42–0.87, median 0.68 | `data/alert_photos/*.json` |
| Face, called somebody else | 25 frames, 0.11–0.25, median 0.21 | same |
| Face thresholds | match ≥ 0.40, reject < 0.25 | `backend/faces.py` |
| Camera as second factor | 104 alerts with a verdict: 42 stayed intruder, 23 downgraded to duress, 39 kept local | `data/alert_photos/*.json` |
| Chair swap, time to alert | 6–9 s after the chair changes | replay of labelled swaps |
| Chair swap, naming once the window clears | 38/41, 41/41, 41/41 ticks | same |
| Our own corpus | 147 baseline samples, 293 recorded sessions, 154 alerts | `data/` |
| Public benchmark | CMU: 51 people, 20,400 samples | `data/external/cmu_password_features.csv` |
| Longitudinal data behind Drift | Monkeytype: 22 people, 15,003 tests, up to 3 years | `data/external/monkeytype_tests.csv` |
| Datasets converted to one format | 4 public plus ours | `data/external/` |
| Window and cadence | 10 s window, scored every 500 ms, 28 features | `backend/app.py` |
| Tests | 135 unit tests plus a 13-step end-to-end | `pytest`, `ui/tests/e2e.py` |

---

## Questions they will actually ask

### "How is this different from a password or a fingerprint?"

Those authenticate once. This one never stops. The interesting property is not that it is
more secure at the door, it is that it is still checking twenty minutes later when the
person at the keyboard has changed.

### "Isn't this just a keylogger?"

No, and the difference is what is stored. A keylogger keeps characters. We keep the
timing of each key and a coarse class: letter, digit, punctuation, navigation. The
character is dropped before anything is written. You cannot reconstruct a password or a
message from a session file because the letters were never in it.

### "How accurate is it, really?"

95.6 percent across 2074 windows on five classes. Be ready for the follow-up, because it
is the honest one: that is our four teammates plus one known non-user, on one laptop. It
is not a claim about the general population. The public benchmark we scored against for
scale is CMU's 51 subjects.

### "What happens with a stranger who is not enrolled at all?"

The classifier has to pick one of the classes it knows, so we set a deliberately high bar:
the winner must clear 85 percent confidence or the head reports unknown rather than
guessing a teammate. We tested lowering it and every looser bar let a non-teammate through
as one of us, so it stays. We also keep a "Stranger" class trained from a real third party
whose typing sits inside a teammate's spread, and any window that lands on it reports
unknown.

### "Then how do you ever name the person who took the chair?"

By asking an easier question. "Which of five people is this" is hard on a live window.
"Is this the declared user" is not: the declared user's own probability is 0.99 on their
windows and 0.00 on everybody else's. That test drives the swap, and the five-way vote
only supplies the name when it is sure enough to.

### "How fast does it catch a swap?"

Six to nine seconds. Be honest about why: the window holds ten seconds of history, so for
the first few seconds after somebody sits down the classifier is scoring a blend of two
people. It has to wait for the previous typist's keys to fall out of the window. Once they
have, naming is 38 out of 41 ticks and better.

### "What if it is wrong and it locks me out of my own machine?"

That was the failure we spent the most time on. Three guards. Low classifier confidence on
its own no longer counts as evidence of another person, because sparse prose windows are
unsure most of the time. The alert waits a couple of seconds for identity to settle before
the lock is decided. And the camera has to agree. Replaying our own alert history, those
changes took locks from 30 of 30 down to 23, and every one they stopped was a case where
the settled read named the owner.

### "So the camera is doing the real work?"

No, and it cannot. The camera never locks anything on its own. We measured the owner
looking straight down at the keys scoring 0.17, which is stranger territory, so a face
alone is not evidence. Both factors have to agree before the machine locks. Either one
alone can only raise a silent alert.

### "What is the false positive rate?"

We do not have a labelled false positive rate and I would not quote one. What we can show
is the effect of the second factor on real alerts: of 104 where the camera got a look, 39
never left the machine and 23 were downgraded. That is the guard working, not a
measurement of how often the first stage is wrong.

### "How does the duress detection know the difference between stress and an intruder?"

It does not, on typing alone, and that is the point of the second factor. Typing far
outside the baseline looks the same either way. The camera resolves it: somebody else in
the chair is an intruder, the owner in the chair with the load gate full is duress. We
also require the load to be above that person's own high-load cut-off on all six ticks,
because without it four of six duress alerts in our recordings were ordinary typing.

### "What model is behind State?"

A trained model exists and the live system is not using it. It scores 0.66 leave-one-user-
out and we gate the model at 0.80, so the backend falls back to a fixed rule on per-person
z-scores. I would rather tell you that than quote you the training accuracy of a model we
do not trust. Per person the rule scores 0.59 to 0.76. It is the weakest of the three live
heads and more data is the fix.

### "Why classical ML and not a neural network?"

Data volume and explainability. We have hundreds of samples, not millions, and a
RandomForest on 28 interpretable timing features lets us tell you exactly which feature
drove a verdict. Every alert on the dashboard names its top two drivers. You cannot do
that as cleanly with a network, and at this data scale it would not win anyway.

### "What happens when a new person wants to use it?"

They type ten sentences, five calm and five hurried, and they have a working baseline
immediately. Threat, the lock and the camera check all work for them from the next key.
What they do not get is a place in the classifier, deliberately: we measured that adding a
ten-sentence class cost the people already enrolled 2.6 points of accuracy. A profile is
personal from one calibration; being told apart from everyone else needs more.

### "Does it work outside your dashboard?"

Yes. Run as a desktop agent it hooks the keyboard system-wide and reads whatever
application has focus. The dashboard is how you watch it; it is not where the sensing
happens.

### "Can you prove it is on-device?"

Turn the wifi off and run it. Nothing is fetched at load: the fonts, the icons and the
face models are all served from the machine. The only thing that ever leaves is an alert
you configured, to a phone you chose.

### "What is the drift head actually doing?"

Today, honestly, it is a chart and a literature review. Drift needs months of one person's
data and we have days. So it plots public longitudinal records, 22 people over up to three
years, next to the research on typing rhythm as a screening signal. It does not score
anybody in this room and we are careful to say so on the page itself.

### "What would you do with another month?"

Free-writing enrolment, because composing prose is measurably different from copy-typing a
prompt and our baselines are built from the latter. Then a longitudinal study to give the
drift head something real to stand on.

---

## Traps

Things that will get you caught. Do not say them.

- **"Zero-knowledge" or "mathematically impossible to reconstruct".** It is neither. The
  hook sees the key and we choose not to store it. Say that instead; it is a better answer.
- **"It screens for Parkinson's."** It does not evaluate anybody for anything. Drift is a
  chart of public data.
- **Any accuracy number above 96 percent.** The live-shaped figure is 95.6.
- **"AUC 0.97" for State.** The model scores 0.66 and is not in use.
- **A sampling rate.** There is no sampling rate. One reading per key press and release.
- **Promising the swap will be caught instantly.** It is six to nine seconds and there is
  a good reason for it.

## Numbers that changed

`docs/demo-runbook.md` still carries an older numbers slide. Three entries are stale:
identity 97.7% (that was whole enrolment samples, not the live-shaped windows the demo
runs), stress AUC 0.97 (unsupported; the model scores 0.66 and is gated off), and 60 tests
(now 135). Use the table above.
