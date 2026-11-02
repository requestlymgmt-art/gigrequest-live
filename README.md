# 🎸 GigRequest Live — Song-Request & Tipping Platform for Musicians

A modern, web-based song-request and tipping platform for live musicians, bands, solo acts, DJs, and venue performers.

Fans scan a QR code at your gig, browse your setlist, and pay to request songs via Stripe.
**100% of the song price and tips go directly to the artist** — the Stripe card processing fee is transparently charged to the fan at checkout!

---

## 🌟 Key Features

### 1. 🎤 For Musicians & Bands
- **User Accounts & Profile Management**:
  - Sign up, set your band name, bio, genre, and profile photo.
  - Custom public URL slug (e.g., `/live/your-band-name`).
  - Toggle "Accepting Requests Live" on/off with one click during breaks.
  - Set default minimum tips, allow custom off-setlist requests, and customize your live stage announcement banner.
- **Setlist & Custom Pricing Manager**:
  - Add songs individually or bulk-import setlists via CSV / line paste.
  - Set individual prices per song (e.g. $5 for easy hits, $15 for complex anthems).
  - Quick on-the-fly price adjustments and active/paused toggles.
- **Real-Time Stage Queue Dashboard**:
  - Powered by Supabase Realtime — new requests pop up instantly with an audio chime and celebratory animation!
  - See song title, fan name, dedication/shoutout message, and net earnings.
  - Fast action buttons: *Up Next*, *Play Now*, *Mark Played*, *Decline*.
  - Live KPI stats: Tonight's Net Earnings, Active Queue, Songs Played, Total Requests.
- **Dedicated Stage Teleprompter Mode (`/stage-mode`)**:
  - Ultra high-contrast, huge text layout designed for tablets/phones mounted on mic stands.
  - Shows currently playing song with large fan dedication text so the singer can easily read shoutouts across the stage.
- **Gig QR Code & Printable Flyer Hub**:
  - Instant high-resolution QR code generator pointing directly to your live fan link.
  - One-click "Download PNG" or "Print Stage Sign / Table-Tent" with built-in print stylesheet.

### 2. 📱 For Fans (Mobile-First Web App)
- **Zero App Downloads Required**:
  - Fans simply scan the QR code with their default smartphone camera.
  - Mobile-optimized interface that feels like a native app.
- **Search & Filter Setlist**:
  - Filter songs by genre or search by song title / artist.
- **Custom Song Requests**:
  - Can't find a song? Request custom tracks if enabled by the band.
- **Transparent Stripe Checkout (Fan Covers the Fee)**:
  - Add optional extra tips to boost the request.
  - Add dedication / shoutout messages.
  - Transparent fee breakdown: Band gets 100% net of their set price and tip, fan covers the standard processing fee.
  - Fast payment with Credit/Debit Cards, Apple Pay, and Google Pay.
- **Live Status Tracker**:
  - After payment, fans get a live receipt tracker on their phone:
    *Pending* ➔ *Up Next on Stage* ➔ *Now Playing* ➔ *Played*.

---

## 🛠️ Technology Stack

- **Frontend**: React 19, Vite, React Router v7, Lucide Icons, Canvas Confetti
- **Database & Auth**: Supabase PostgreSQL with Row Level Security (RLS) & Realtime Websockets
- **Payments**: Stripe API with transparent fee calculation
- **QR Code**: qrcode.react

---

## ⚙️ Environment Configuration

Create a `.env` file in the root directory:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://szcsiadugzhlfgoirkfw.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_ACCESS_TOKEN=sbp_...

# GitHub Access Token
GITHUB_TOKEN=ghp_...

# Stripe Configuration
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

---

## 🚀 Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Start development server
npm run dev

# 3. Build for production
npm run build
```

---

## 🗄️ Database Architecture (`supabase_schema.sql`)

- `public.profiles`: Band accounts, slug, bio, pricing rules, Stripe credentials, and live status.
- `public.songs`: Band setlist catalog with individual song prices and active toggles.
- `public.requests`: Incoming fan song requests, shoutout messages, tip amounts, fees, and realtime statuses.
