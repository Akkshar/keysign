"""
Sign-in smoke test against a running dashboard (default http://localhost:5176).

    uv run python ui/tests/signin.py [base_url]

Checks, without creating any account:
  1. the sign-in gate renders (Firebase configured);
  2. a wrong email/password shows the plain-English error;
  3. "Continue with Google" opens Google's account chooser, not a Google error page;
  4. "Continue as operator" reaches the dashboard.
Exit code 1 on the first failure; screenshots go to ui/tests/out/.
"""
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5176"
OUT = Path(__file__).parent / "out"
OUT.mkdir(exist_ok=True)
failures: list[str] = []


def check(cond: bool, msg: str) -> None:
    print(("PASS " if cond else "FAIL ") + msg)
    if not cond:
        failures.append(msg)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 1280, "height": 900})
    page = ctx.new_page()
    console_errors: list[str] = []
    page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)

    # 1. gate
    page.goto(BASE)
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1500)
    google = page.get_by_role("button", name="Continue with Google")
    check(google.count() == 1, "sign-in gate renders with the Google button")
    check(page.get_by_label("Email").count() == 1 and page.get_by_label("Password").count() == 1, "email and password fields present")
    page.screenshot(path=str(OUT / "1-gate.png"))

    # 2. wrong credentials -> plain error, no account created
    page.get_by_label("Email").fill("probe-does-not-exist@example.com")
    page.get_by_label("Password").fill("probe-probe")
    page.get_by_role("button", name="Sign in", exact=True).click()
    try:
        page.get_by_role("alert").wait_for(timeout=15000)
        err = page.get_by_role("alert").inner_text()
    except Exception:
        err = ""
    check("Wrong email or password" in err, f"wrong credentials show the plain error (got: {err!r})")
    page.screenshot(path=str(OUT / "2-wrong-password.png"))

    # 3. Google popup reaches Google's account chooser
    with ctx.expect_page(timeout=20000) as popup_info:
        google.click()
    popup = popup_info.value
    try:
        popup.wait_for_load_state("domcontentloaded", timeout=20000)
        popup.wait_for_timeout(4000)                      # Firebase handler -> accounts.google.com redirect
    except Exception:
        pass
    url, title, body = popup.url, popup.title(), popup.inner_text("body")[:600]
    popup.screenshot(path=str(OUT / "3-google-popup.png"))
    print("   popup url:", url[:160])
    print("   popup title:", title)
    google_error = ("401" in body and "malformed" in body.lower()) or "invalid_client" in body or "deleted_client" in body or "Error 4" in body
    on_google = "accounts.google.com" in url
    check(on_google and not google_error, f"Google popup lands on the account chooser (title {title!r})")
    if google_error or not on_google:
        print("   popup text:", body.replace("\n", " | ")[:400])
    popup.close()

    # 4. operator escape hatch
    page.get_by_role("button", name="Continue as operator").click()
    page.wait_for_timeout(1500)
    check(page.get_by_text("The live lab").count() >= 1, "operator mode reaches the dashboard")
    page.screenshot(path=str(OUT / "4-operator.png"))

    # Expected noise: the deliberate bad sign-in is a 400 from Firebase; Firebase's popup flow
    # polls window.closed, which Chromium's Cross-Origin-Opener-Policy logs as an error.
    benign = ("ERR_CONNECTION_REFUSED", "favicon", "status of 400", "Cross-Origin-Opener-Policy")
    bad = [e for e in console_errors if not any(b in e for b in benign)]
    check(not bad, f"no unexpected console errors ({len(bad)})")
    for e in bad[:5]:
        print("   console:", e[:200])
    browser.close()

print("\n" + ("ALL PASSED" if not failures else f"{len(failures)} FAILED: " + "; ".join(failures)))
sys.exit(1 if failures else 0)
