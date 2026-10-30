# RouteMate — Smart Route-Based Travel Matching

A mini-project starter with React + Vite frontend, Node.js + Express backend, and MySQL database.
Includes registration/login, dashboard, trip publishing, route search/matching, join requests, chat, profile, ratings, and an OpenStreetMap route preview.

## Requirements
- Node.js 18+
- MySQL 8+
- VS Code

## 1. Database setup
1. Open MySQL Workbench.
2. Run `database/schema.sql`.
3. This creates the `routemate` database and all tables.

## 2. Start backend
```bash
cd server
copy .env.example .env
npm install
```
Edit `.env` with your MySQL username/password and a long JWT secret, then:
```bash
npm run dev
```
Backend runs at http://localhost:5000.

## 3. Start frontend (new terminal)
```bash
cd client
npm install
npm run dev
```
Open the URL shown by Vite (normally http://localhost:5173).

## Demo flow for internal evaluation
1. Register two accounts using two browser sessions (or log out/in).
2. Publish a trip with the first account.
3. Search the same or a nearby route with the second account.
4. Send a join request.
5. Log back into the first account and accept it in Requests.
6. Open Messages to demonstrate communication.
7. Show database rows in MySQL Workbench.

## Notes
- Matching is based on same travel date, compatible transport, and route endpoint similarity. The match percentage is a demo score, not a guaranteed geographic distance calculation.
- Map preview uses OpenStreetMap tiles and Leaflet. It displays the entered start/end points using geocoding; internet access is required. For production, use a commercial routing/geocoding provider and add privacy, moderation, and emergency workflows.
- This is an academic demonstration project. Do not enter sensitive personal information or rely on it for real-world safety decisions.
