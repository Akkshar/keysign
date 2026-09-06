# KeySign capture data format

Produced by `capture/index.html` (Export JSON). Consumed by `analyze.py` and the
`pipeline/` feature extractor.

## File

A JSON array of **samples**. One sample = one Start → Save recording.

```json
[
  {
    "user": "Akkshar Ranjan",
    "condition": "calm",
    "prompt": "the quick brown fox jumps over the lazy dog",
    "text": "the quick brown fox jumps over the lazy dog",
    "events": [
      {"type": "down", "key": "t", "code": "KeyT", "t": 9787.8},
      {"type": "up",   "key": "t", "code": "KeyT", "t": 9882.8}
    ],

    "id": "m0x1abc4kz9",
    "started_at": "2026-09-06T10:15:31.201Z",
    "duration_ms": 12345.678,
    "n_events": 142,
    "n_keydowns": 71,
    "blur_count": 0,
    "timer_sec": 0,
    "meta": {
      "page_version": "capture-1.0",
      "user_agent": "...",
      "platform": "Win32",
      "time_origin": 1788000000000.5,
      "timer_resolution_ms": 0.1
    }
  }
]
```

## Required fields (the `analyze.py` contract)

| field       | type   | notes |
|-------------|--------|-------|
| `user`      | string | label for the Identity head |
| `condition` | string | `calm`, `stress`, `tired`, `other` |
| `prompt`    | string | empty string for free typing |
| `text`      | string | what ended up in the textarea |
| `events`    | array  | ordered keydown/keyup events, see below |

## Event

| field  | type   | notes |
|--------|--------|-------|
| `type` | string | `down` or `up` |
| `key`  | string | `KeyboardEvent.key` (`"a"`, `"Backspace"`, `"Shift"`, `" "`) |
| `code` | string | `KeyboardEvent.code` (`"KeyA"`, `"Space"`). Pair down/up on `code`, falling back to `key` when `code` is empty (some virtual keyboards). |
| `t`    | number | milliseconds, `DOMHighResTimeStamp` from `event.timeStamp`, rounded to 3 dp |

Notes:

- `t` is relative to the page's `performance.timeOrigin` (stored in `meta`).
  Only differences between `t` values are meaningful. Do not compare `t`
  across samples from different page loads.
- OS auto-repeat keydowns (`event.repeat`) are dropped. Every `down` is a real
  press and should have one matching `up` with the same `code`.
- Modifier keys (Shift, Ctrl, ...) are recorded like any other key.
- A sample is rejected on save if it has fewer than 10 keydowns.
- `blur_count` > 0 means the user clicked away mid-sample. Treat with suspicion.
- `timer_resolution_ms` ≥ 1 means the browser coarsened its clock; hold-time
  features from that sample are noisier.

## Feature definitions (shared by the page's live panel and `analyze.py`)

- hold: `t(up) - t(down)` for the same `code`
- flight: `t(down_i+1) - t(down_i)` for consecutive keydowns
- speed: keydowns / seconds between first and last keydown
- error rate: (Backspace + Delete keydowns) / keydowns

## CSV export

`Export CSV` writes one row per event: `sample_id,user,condition,type,key,code,t`.
Handy for pandas; the JSON is the canonical format.
