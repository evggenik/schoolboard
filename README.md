# schoolboard
Simple self-hosted online whiteboard for small schools: students join by name, no registration. Built with React and tldraw.

<p align="center">
<img  alt="Screenshot from 2026-10-24 22-10-32" src="https://github.com/user-attachments/assets/34b551ce-83bf-4ca5-8c26-a2e68ddf8c17" width="49%"/>
<img alt="Screenshot from 2026-10-24 22-10-38" src="https://github.com/user-attachments/assets/5bdcc7b6-a4cc-4a56-b7d8-cdc9e410abc4" width="49%"/>
</p>

<img width="842" height="282" alt="Screenshot from 2026-10-24 22-14-28" src="https://github.com/user-attachments/assets/144dc61a-a99b-4975-9a19-110ee84f7c7e" />

<img width="1851" height="902" alt="Screenshot from 2026-10-24 22-13-33" src="https://github.com/user-attachments/assets/8ecf0bc2-412b-47c2-9e1e-0166ddcaa8b1" />

## Why I built this

As a teacher working remotely at a small village school, I needed an online whiteboard. Students can use VK Board through Sferum educational accounts, but in practice the kids either can’t register and sign in (according to them) or simply don’t want to. On top of that, they use shared laptops during lessons, which makes logging in even more inconvenient. Also, the Sferum board is built into the messenger, so it only takes up half the screen and looks too small to me.

So I switched to Miro. But I soon ran into slow loading and occasional connection failures. I don’t know the cause: the school firewall, Roskomnadzor, servers outside Russia, or something else. Work became slow. And again, students had to register and sign in to be able to edit, which turned out to be too complicated for them. Miro also felt like overkill for school needs.

So I looked for a simpler tool, and in the end decided to build my own board with easy access for students and simple switching between viewer and editor.

I used tldraw as a ready-made library, together with React, and asked my best friend ) Claude AI to help me. A few days later I was already teaching my classes on my own board.

What it looks like

The app is a shared real-time canvas built on tldraw, with a minimal set of roles:

Creating a board. The teacher enters their name, a board title, a login and a password. Every board gets its own unique link (/board/<id>).
Joining as a student. Students open the link, type only their name and they’re in. No registration, no email, no accounts. By default they join as viewers.
Teacher panel. The teacher signs in with login and password and sees the list of participants. One click switches a student between viewer and editor, and a student can also be removed. The teacher can click a name to jump to that person’s cursor, or follow them continuously.
Drawing and media. All the usual tldraw tools: pen, shapes, text, arrows. You can also paste screenshots and textbook pictures onto the board (uploads are stored on your own server, 5 MB limit).
Persistence. Boards are saved in SQLite, so drawings survive a server restart and you can come back to the same link next lesson.
Self-hosted. Everything runs on your own server with no external services, which matters if some of them are blocked in your region.

## Features

- **No registration for students**: open the link, type your name, you're in
- **Simple roles**: the teacher owns the board; students join as viewers
- **Teacher panel**: see who is online, switch each student between viewer and editor with one click, or remove them
- **Follow mode**: click a name to jump to that person's cursor, or follow them
- **Images and screenshots**: paste textbook pages and screenshots right onto the board
- **Real-time sync** between all participants
- **Boards are saved**, so you can return to the same link next lesson
- **Fully self-hosted**: no external services, so nothing breaks if some of them are blocked in your region

## Tech stack

React, TypeScript, tldraw + @tldraw/sync, Node.js, WebSocket, SQLite

## Installation

Requirements: Node.js 20.19+ and npm.

```bash
git clone https://github.com/evggenik/schoolboard.git
cd schoolboard
npm install
npm install --prefix server
```

Run the server and the frontend in two terminals:

```bash
CREATE_CODE=test npm run server
npm run dev
```

`CREATE_CODE` is the secret phrase needed to create a new board; use any word you like. The server is configured through environment variables, see `.env.example`.

Production deployment (nginx + systemd) is not documented yet.

## License

The code in this repository is released under the [MIT License](LICENSE).

Note: [tldraw](https://tldraw.dev) is distributed under its own license and requires a license key for production use (a free hobby license is available for non-commercial projects). You need to get your own key and put it in `.env` (see `.env.example`).
  
