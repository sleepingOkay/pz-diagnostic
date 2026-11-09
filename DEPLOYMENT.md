# Running PZ Diagnostic locally

PZ Diagnostic is a static, local-first application. It does not require Vercel, a backend, an API key, an account, or a paid service.

## Run it

1. Download the repository ZIP from GitHub.
2. Extract the ZIP.
3. Open `index.html` in Firefox or Chromium.

The analyzer reads the selected `console.txt` in your browser. It does not upload the log.

## Optional local web server

If your browser restricts local files, open a terminal in the extracted project folder and run:

```bash
python -m http.server 8000
```

Then open `http://127.0.0.1:8000`.

Stop the server with Ctrl+C.

## Future hosting

A public static host may be considered only after the project is ready and the repository owner chooses to make it public. No hosting provider is required for local use.

## Privacy

Logs can contain usernames, file paths, hardware details, and server information. Keep the analysis local and review any report before sharing it.

## Project scope

Independent community project. Not affiliated with The Indie Stone, Project Zomboid, or Viewpoint.
