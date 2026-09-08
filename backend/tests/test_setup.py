"""
The fresh-machine check. data/ is personal and is not in the repository, so a clone has no
baselines, no identity model and no face models; `uv run python -m agent --setup` is what
tells somebody that, and what to do about it.
"""
from agent import setup as agent_setup


def test_reports_a_bare_machine_and_says_what_to_do(monkeypatch, tmp_path, capsys):
    monkeypatch.setattr(agent_setup, "ROOT", tmp_path)
    monkeypatch.setattr(agent_setup, "_ui_built", lambda: (True, "1 bundle(s)"))
    monkeypatch.setattr(agent_setup, "_face_models", lambda: (True, "sface"))
    monkeypatch.setattr(agent_setup, "_profiles", lambda: (0, []))
    agent_setup.run(fetch=False)
    out = capsys.readouterr().out
    assert "nobody has calibrated yet" in out
    assert "ten sentences" in out
    # one profile is not enough for identity, and the reason is stated rather than implied
    assert "needs two people enrolled" in out


def test_a_ready_machine_just_says_run_it(monkeypatch, tmp_path, capsys):
    (tmp_path / "data" / "models").mkdir(parents=True)
    (tmp_path / "data" / "models" / "identity.joblib").write_bytes(b"x")
    (tmp_path / "data" / "faces" / "someone").mkdir(parents=True)
    (tmp_path / "data" / "faces" / "someone" / "0.jpg").write_bytes(b"x")
    monkeypatch.setattr(agent_setup, "ROOT", tmp_path)
    monkeypatch.setattr(agent_setup, "_ui_built", lambda: (True, "1 bundle(s)"))
    monkeypatch.setattr(agent_setup, "_face_models", lambda: (True, "sface"))
    monkeypatch.setattr(agent_setup, "_profiles", lambda: (2, ["A", "B"]))
    assert agent_setup.run(fetch=False) == 0
    out = capsys.readouterr().out
    assert "uv run python -m agent" in out and "calibrat" not in out.split("Next:")[1]


def test_an_unbuilt_dashboard_is_the_first_thing_to_fix(monkeypatch, tmp_path, capsys):
    monkeypatch.setattr(agent_setup, "ROOT", tmp_path)
    monkeypatch.setattr(agent_setup, "_ui_built", lambda: (False, "run: npm ..."))
    monkeypatch.setattr(agent_setup, "_face_models", lambda: (True, "sface"))
    monkeypatch.setattr(agent_setup, "_profiles", lambda: (0, []))
    assert agent_setup.run(fetch=False) == 1
    assert "npm --prefix ui run build" in capsys.readouterr().out


def test_setup_never_downloads_when_asked_not_to(monkeypatch, tmp_path):
    """It runs on somebody else's machine; it must not reach the network unasked."""
    calls = []
    monkeypatch.setattr(agent_setup, "ROOT", tmp_path)
    monkeypatch.setattr(agent_setup, "_ui_built", lambda: (True, ""))
    monkeypatch.setattr(agent_setup, "_face_models", lambda: (False, "not downloaded"))
    monkeypatch.setattr(agent_setup, "_profiles", lambda: (0, []))
    from backend import faces
    monkeypatch.setattr(faces, "fetch_models", lambda *a, **k: calls.append("fetch"))
    agent_setup.run(fetch=False)
    assert calls == []
