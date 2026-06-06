# Women Safety Assistant

> **Your Safety, One Tap Away.**

Women Safety Assistant is a modern, premium, responsive frontend-only web application designed to empower women with quick-access safety tools, educational resources, a community forum, and an interactive safety dashboard.

## 🚀 Key Features

1. **SOS Emergency Button**: A circular glowing pulse button that triggers a simulated distress flow, alerting emergency contacts and logging incident data in the client-side system.
2. **Synthetic Siren**: Uses the browser's native **Web Audio API** to generate a loud, authentic distress siren sound directly through the device speakers. No audio file downloads required!
3. **Fake Call Simulator**: Allows customizable settings (caller name, profile placeholder, timer delay). Rings with physical device vibration (via browser Vibration API) and brings up a full-screen, highly realistic incoming call screen.
4. **Live Location Tracking**: A simulated tracking center displaying real-time coordinate changes, interactive SVG map route visualization, and dynamic location sharing generation.
5. **Trusted Contacts Manager**: A localStorage CRUD dashboard enabling users to add, edit, and delete priority contacts with customized badges (High Priority, Medium, Low).
6. **AI Safety Assistant**: A floating, interactive chatbot widget that provides instant, simulated responses to safety queries (e.g. self-defense steps, travel tips, legal rights).
7. **Safety Check-In Scheduler**: Set a countdown timer for safety checks. If the timer runs out, it triggers a warning status.
8. **Premium User Dashboard**: Custom responsive SVG-based charts, graphs, and stats cards visualizing safety ratings, weekly activity logs, and alert histories.
9. **Safety Awareness Hub**: A knowledge center containing filterable articles (Personal, Workplace, Travel, cyber, self-defense) and search capabilities.
10. **Community Forum**: An interactive space for users to browse community groups, read local safety alerts, and share anonymous stories.

## 🛠️ Technology Stack

- **Markup**: HTML5 (semantic, mobile-first design)
- **Styling**: Tailwind CSS (Utility classes via Play CDN)
- **Icons**: Lucide Icons (Modern SVG vector design)
- **Theme**: Premium startup dark UI (`#0A0A0A` Deep Black, `#1E1E1E` Card Gray, `#FF4D4D` Emergency Red, `#8B5CF6` Purple)
- **Persistence**: Browser `localStorage` (keeps contacts, logs, and dashboards working dynamically after refreshes)

## 💻 Setup & Execution

Since the project is a pure frontend website, **no installation or local server is needed**.
1. Open the project folder.
2. Double-click the **`index.html`** file to open and run the application in any web browser.
