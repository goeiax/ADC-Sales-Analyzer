# Building the standalone ADC Dashboard app

Goal: a single **`ADC Dashboard.exe`** that runs on any Windows laptop with **no Python installed**.

## Build it (do this once)

On a Windows PC **that has Python**:

1. Double-click **`build.bat`** (or run it from a terminal).
2. Wait ~1–2 minutes. The exe appears at **`dist\ADC Dashboard.exe`**.

That's it. You only rebuild the exe if you change the dashboard's code — not for new data.

## Distribute it

Copy these to each clinic laptop (a folder or a zip):

```
ADC Dashboard.exe        <- the app
Raw CSVs\                 <- put the monthly Neosoft CSV exports here
```

`Raw CSVs\` is created automatically on first run if it doesn't exist.

## Run it

Double-click **`ADC Dashboard.exe`**. On each launch it:

1. Rebuilds `dashboard-data.json` from whatever CSVs are in `Raw CSVs\`.
2. Starts a local server on `127.0.0.1:8765` (this machine only — never the network).
3. Opens the dashboard in the default browser.
4. Shuts down automatically after 20 minutes idle (or close the small console window).

**To refresh the numbers:** drop new CSV exports into `Raw CSVs\` and relaunch the exe.

## Notes

- **No Python needed on the target laptops** — it's bundled inside the exe.
- **First-run Windows warning:** because the exe is unsigned, Windows SmartScreen may say
  *"Windows protected your PC."* Click **More info → Run anyway**. (Buying a code-signing
  certificate removes this, but it's optional for internal use.)
- **AI "Ask Claude" feature** still works — it's served over `http://127.0.0.1`, so the
  browser can reach the Anthropic API. Patient names/MRNs/phones are tokenized before
  any request leaves the browser (see the pseudonymization in `ADC POS Dashboard.html`).
- **Data stays local:** the CSVs, `dashboard-data.json`, and the server are all on the
  laptop. Nothing is uploaded except the (tokenized) AI questions you choose to ask.
