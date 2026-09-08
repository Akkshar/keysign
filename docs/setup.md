# Running KeySign on your own machine

Everything here happens on the machine in front of you. No account is required, nothing is
uploaded, and the only thing that ever leaves is an alert you configure yourself.

## What you need

- **Python 3.10+** with [uv](https://docs.astral.sh/uv/). On Windows the Store's `python`
  is a stub that opens the Microsoft Store; use `uv run` and you can ignore it.
- **Node 18+**, to build the dashboard once.
- A **webcam**, only if you want the camera to be the second factor on an alert. It works
  without one; alerts just lean entirely on the typing.

## Four commands

```bash
git clone https://github.com/Akkshar/keysign && cd keysign
npm --prefix ui install && npm --prefix ui run build
uv run python -m agent --setup
uv run python -m agent
```

`--setup` is the one that tells you where you are. It checks Python, the dashboard build,
the face models and who is enrolled, downloads the two face models if they are missing
(39 MB, once), and prints the next step. It never touches data that already exists.

## The first run

A clone has no profiles. `data/` holds people's typing, which is personal, so it is not in
the repository and yours starts empty. The window therefore opens on calibration rather
than on a dashboard with nothing to show.

**Ten sentences, about two minutes.** Five typed calmly and five typed in a hurry, so
KeySign learns both ends of your range rather than only your best behaviour. Type them the
way you normally type; a first calibration is always a little stiff, and the summary at the
end tells you in sigma how tight your rhythm actually was.

When the wizard finishes:

- **Your baseline exists immediately.** Hold and flight times, where the pauses fall, how
  often you correct yourself. The Threat and State heads start measuring against it at once.
- **Identity waits for company.** Telling two people apart needs two people enrolled, so on
  a machine with one profile KeySign can say "this does not look like your typing" but
  cannot put another name to it. Calibrate a second person and it turns on by itself.
- **Add your face if you want the camera check.** Settings has a button that takes eight
  frames. That is what lets an alert tell "somebody else is typing" from "you, typing
  oddly", and nothing is pushed or locked before it has looked. Enrol the pose you actually
  type in, head down at the keys included: a face turned away from the camera scores like a
  stranger, measured at 0.17 against 0.42-0.79 for a face looking up.

## Getting alerts on your phone

Optional, and off until you set it. KeySign uses [ntfy](https://ntfy.sh): pick a topic
nobody could guess, subscribe to it in the ntfy app, and set it before starting the agent.

```bash
export KEYSIGN_NTFY_TOPIC=something-nobody-would-guess
```

Without it, alerts are still raised and still logged; they just stay on the machine.

## Taking your profile to another machine

You do not have to type the ten sentences twice.

```bash
uv run python -m backend.profile_io export "Your Name" -o you.keysign
uv run python -m backend.profile_io show you.keysign        # what is in it, writes nothing
uv run python -m backend.profile_io import you.keysign      # on the other machine
```

The archive holds your samples, your baseline and, unless you pass `--no-faces`, your
enrolled face frames. Nothing else travels: no settings, no alert history, and nobody
else's data. An import will not overwrite an existing calibration unless you ask it to.

## What it does while it runs

- A tray icon, and a window with no address bar. Quit from the tray, with Ctrl+C, or
  `uv run python -m agent --quit`.
- The keyboard hook reads typing in whatever application has focus, not just the dashboard.
  Recordings keep timings and a coarse key class, letter, digit, punctuation, navigation.
  Not the characters, so a session file cannot be read back as what you wrote.
- On an alert: a webcam burst, a face check, then the decision. Alerts you configured go to
  your phone; the machine locks only when the typing and the camera agree somebody else is
  in the chair.

## When something is wrong

| What you see | What it is |
|---|---|
| The window shows an old dashboard | It caches its page. Tray → Reload the dashboard, or restart the agent. |
| No tray icon | Windows 11 hides new ones. Click the `^` chevron by the clock and drag it out. |
| Everything reads "no baseline" | Nobody has calibrated on this machine. The window should have opened on calibration; if not, Settings → Calibrate. |
| Identity says unknown a lot | Windows with few keys are hard: at 20-29 keys the classifier is right but unsure more than half the time, at 50-69 it is sure. Type in sentences rather than bursts. |
| An alert fired at you | Look at the alert's face score in Threats. Below 0.25 the camera called you a stranger, which usually means it saw the top of your head. Enrol that pose. |
| `python` opens the Microsoft Store | Use `uv run python ...`. |
