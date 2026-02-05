# SMART on FHIR Chat (MERN + Socket.IO)

This project is a full MERN chat app that uses SMART on FHIR login for providers, real‑time messaging over Socket.IO, and MongoDB for chat persistence. Providers authenticate via SMART, select a patient, and open a dedicated conversation with a join code that the patient can use to enter the chat.

## What you get
- SMART on FHIR OAuth2 + PKCE login for providers
- Patient list from FHIR
- Real‑time chat using Socket.IO
- Messages stored in MongoDB
- Patient join code flow (simple patient portal)
- Optional patient snapshot (vitals, labs, conditions, medications, reports)

## Project structure
- `server/` Express + Socket.IO + MongoDB + SMART on FHIR
- `client/` Vite + React UI

## Setup

### 1) Server
```bash
cd server
cp .env.example .env
npm install
npm run dev
```

Update `.env` with your SMART on FHIR client info and FHIR endpoints.

### 2) Client
```bash
cd client
cp .env.example .env
npm install
npm run dev
```

### 3) MongoDB
Make sure MongoDB is running locally, or update `MONGODB_URI` to point to your instance.

## Usage
1. Open the client at `http://localhost:3000`.
2. Click **Login with SMART on FHIR** and complete the SMART login.
3. Select a patient and open a chat.
4. Share the join code with the patient.
5. Patient goes to `/patient`, enters the code, and joins the chat.

## Notes
- This is a local‑dev oriented build. For production, add a session store, HTTPS cookies, and a stronger patient auth flow.
- The patient join code is intentionally lightweight for a quick demo.

## API Highlights
- `GET /launch` returns the SMART authorization URL
- `GET /redirect` handles SMART redirect
- `GET /api/patients` lists patients
- `POST /api/conversations` creates or loads a conversation
- `GET /api/conversations/by-code/:code` loads the patient portal view
- `POST /api/messages` sends messages



![HAUm6eza4AEU14h](https://github.com/user-attachments/assets/7ca4fe2d-fa6a-4452-b084-4fa386537558)
![HAUm_IxaoAAJ_6R](https://github.com/user-attachments/assets/c0a97461-bf50-47db-b6ed-79d8a3865a0b)
![HAUnFArbgAAa1iH](https://github.com/user-attachments/assets/13759b4e-b430-4b54-ade8-3a3ed0d4b968)
![HAUnG2gaMAApwgn](https://github.com/user-attachments/assets/5557acc2-e73c-4ebd-a221-bab33b970f86)
![HAUnPnabQAATbze](https://github.com/user-attachments/assets/e4b2d4e0-1185-4820-a305-e8583cf63fd8)





