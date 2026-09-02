<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# PreViral

PreViral is an AI-powered pre-publishing quality and growth audit platform for Instagram Reels, TikTok, and YouTube Shorts. It is a responsive web app: creators can use it from phones, tablets, and desktops in a modern browser.

## Run Locally

**Prerequisites:** Node.js 20+


1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env.local` and set `OPENAI_API_KEY` to an OpenAI API key.
3. Run the app: `npm run dev`

The server uses the OpenAI Responses API with `gpt-5.6-terra` by default. Override the model with `OPENAI_MODEL` when required.

## Deploy

PreViral is a Node/Express service, so deploy it to a host that supports long-running Node processes (for example Railway, Render, or Fly.io). Configure these commands:

- Build: `npm run build`
- Start: `npm start`

Set `OPENAI_API_KEY` as a server-side environment variable in the host dashboard. Optionally set `OPENAI_MODEL`; it defaults to `gpt-5.6-terra`. Never put either value in browser code or a committed `.env` file.

The service respects the host-provided `PORT` automatically and exposes `GET /api/health` for deployment health checks. A portable [Dockerfile](./Dockerfile) is included for any container host. A permanent public URL still requires deployment to an account you control; local tunnels are temporary and stop when the local process stops.
