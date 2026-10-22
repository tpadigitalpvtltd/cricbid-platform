# 🏏 CricBid - Multi-Tournament & Cricket Auction Platform

A sports-tech multi-tournament management and player auction platform built with **Next.js (App Router)**, **Tailwind CSS**, and **Lucide React**.

---

## 🌟 What's New in CricBid

### 1. Modern Sports Tech Branding & Universal Navbar
- **CricBid Brand**: High-energy stadium floodlight theme with neon electric green (`#10e87b`) and gold (`#f59e0b`) broadcast accents.
- **Header Navigation**:
  - **CricBid Logo**: Direct link to Home.
  - **"Explore Auctions"**: Browse all active and upcoming cricket tournament drafts.
  - **"+ Host Free Auction"**: Public organizer portal to launch a tournament in under 2 minutes.
  - **"Admin Access" (Lock button)**: Protected Super Admin modal for platform managers.

### 2. Tiered Tournament Model
- **Public User / Club Organizer Tier (`/host`)**:
  - Anyone can host a cricket tournament for **FREE**.
  - Fill Tournament Title, City, Venue, Banner/Thumbnail, Deadlines, and Google Sheet Webhook URL.
  - **Payment option is LOCKED/DISABLED by default** (`Free Registration Mode`). Players register with ₹0 fee.
- **Super Admin Panel (`/admin`)**:
  - Protected by security PIN (Default: `admin123`).
  - View all tournaments and **TOGGLE Razorpay payment ON/OFF** with a single click.
  - Set Entry Fee (₹), configure Razorpay Key ID & Secret, or switch any tournament between Free vs Paid registration.

### 3. Dynamic Player Registration Page (`/tournament/[slug]/register`)
- **🔥 Live Registration Counter**:
  - Animated pulsing widget: `"🔥 [X] Players Already Registered!"`.
  - Dynamically fetches the real-time player count from the connected Google Sheet or backend.
- **Conditional Payment Logic**:
  - **If Tournament is "Free"**: Shows **"Complete Free Registration (₹0)"**. Skips Razorpay checkout and immediately logs player into Google Sheet.
  - **If Tournament is "Paid"**: Enforces Razorpay checkout popup. Only upon verified payment (`razorpay_payment_id`) is data saved with `"PAID"` status.
- **Live Player Preview Card**: Real-time 3D-feel player card with photo, role badge, batting/bowling style, and stats.
- **Celebration Success Pass**: Confetti cannon 🎉, official ticket pass (`CRIC-2026-XXXXX`), one-click **WhatsApp Share** button, and **Print Pass** button.

---

## 🚀 Quick Start & Local Preview

The development server is currently live at:
👉 **`http://localhost:3000`**

### Available Routes:
| Route | Description |
|---|---|
| **`/`** | Explore Auctions & Live Tournaments Showcase |
| **`/host`** | Public Organizer: + Host Free Tournament |
| **`/admin`** | Super Admin Panel (PIN: `admin123`) |
| **`/tournament/mumbai-premier-league-2026/register`** | Paid Registration Demo (₹499) |
| **`/tournament/bangalore-t20-super-sixes/register`** | Free Registration Demo (₹0) |

---

## 📊 Google Sheets Backend Integration (`google_apps_script.js`)

Each tournament organizer can connect their own Google Sheet:
1. Open [Google Sheets](https://sheets.google.com) and create a new blank sheet.
2. Go to **Extensions ➔ Apps Script**.
3. Copy and paste the entire code from [`google_apps_script.js`](file:///c:/Users/LENOVO/OneDrive/Desktop/Cricke%20Auction/player%20Registration/google_apps_script.js).
4. Click **Deploy ➔ New deployment ➔ Web app ➔ Access: Anyone**.
5. Paste the generated Web App URL into the tournament's Google Sheet URL field!
   - Supports **`doPost`** for appending player rows.
   - Supports **`doGet?action=count`** for live registration counter queries!
