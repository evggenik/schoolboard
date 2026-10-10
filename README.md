# schoolboard
Simple self-hosted online whiteboard for small schools: students join by name, no registration. Built with React and tldraw.

<p align="center">
<img width="318" height="297" alt="Screenshot from 2026-10-10 21-59-56" src="https://github.com/user-attachments/assets/d7566484-67ce-4829-b2b3-685b3c56d195" width="48%"/>
<img width="432" height="297" alt="Screenshot from 2026-10-10 22-00-09" src="https://github.com/user-attachments/assets/4a865159-1ba6-46ac-b57d-4ddabbba9623" width="48%"/>
</p>

<img width="865" height="363" alt="Screenshot from 2026-10-10 22-07-26" src="https://github.com/user-attachments/assets/1b7f9c37-18c2-43ae-b95e-ded3df898151" />

<img width="1849" height="884" alt="Screenshot from 2026-10-10 22-04-29" src="https://github.com/user-attachments/assets/4449df44-afd3-47f5-83bc-14df85d3554b" />

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

Coming soon.

## License

The code in this repository is released under the [MIT License](LICENSE).

Note: [tldraw](https://tldraw.dev) is distributed under its own license and requires a license key for production use (a free hobby license is available for non-commercial projects). You need to get your own key and put it in `.env` (see `.env.example`).
  
