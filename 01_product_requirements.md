# Product Requirements Document
## SpendSmart — Personal Expense Tracker & Financial Advisor
**Version:** 1.0  
**Date:** July 2026  
**Author:** Product Team  
**Status:** Final

---

## 1. Executive Summary

SpendSmart is a web-based personal finance application that helps individuals track daily expenses, automatically categorize transactions from bank statement uploads, visualize spending patterns through interactive dashboards, and receive personalized money-saving recommendations at the end of each month.

The core problem it solves: most people do not know where their money goes each month. SpendSmart gives complete visibility into spending habits, highlights unnecessary expenses, and coaches users to make better financial decisions.

---

## 2. Goals and Objectives

**Primary Goals**
- Allow users to log daily expenses manually in under 10 seconds per entry
- Parse uploaded bank statements (PDF, CSV, Excel) and auto-categorize every transaction
- Display a real-time dashboard showing spending by category, trend lines, and budget health
- Generate personalized, actionable money-saving tips on the 25th of every month (ahead of month-end)

**Non-Goals (v1.0)**
- Direct bank integration or open banking APIs
- Investment tracking or portfolio management
- Tax filing assistance
- Multi-currency conversion

---

## 3. Target Users

**Primary Persona — Salaried Professional (25–45 years)**
- Receives salary monthly into a bank account
- Has recurring fixed expenses (loan EMIs, rent, subscriptions)
- Spends on food, groceries, petrol, shopping regularly
- Wants to save money but lacks visibility into where it goes
- Comfortable uploading a PDF or CSV bank statement

**Secondary Persona — Young Adult / Student**
- Manages a budget allowance or part-time income
- Wants to build savings habits early
- Heavy OTT and online shopping spend

---

## 4. Functional Requirements

### FR-01: User Authentication
- Users must register with name, email, and password
- Login with email + password (JWT-based sessions, 30-day expiry)
- Password reset via email OTP
- Optional: Google OAuth sign-in
- Each user's data is strictly isolated (no cross-user data access)

### FR-02: Manual Expense Entry
- User can add an expense with the following fields:
  - **Date** (date picker, defaults to today)
  - **Amount** (numeric, supports decimals, currency ₹)
  - **Description** (free text, max 255 chars)
  - **Category** (dropdown — see Category Taxonomy below)
  - **Sub-category** (optional, context-aware based on category)
  - **Payment method** (Cash / UPI / Credit Card / Debit Card / Net Banking)
  - **Notes** (optional, 500 chars)
- User can edit or delete any manually entered expense
- Bulk entry: add multiple expenses in one form session (add row button)
- Recurring expense toggle: mark an expense as recurring with frequency (weekly / monthly)

### FR-03: Bank Statement Upload & Parsing
- Supported formats: PDF, CSV, Excel (.xlsx, .xls), OFX
- Users can upload statements from major Indian banks: SBI, HDFC, ICICI, Axis, Kotak, Yes Bank, IndusInd, Federal, Canara, PNB
- System extracts the following fields from each transaction row:
  - Date, Description/Narration, Debit amount, Credit amount, Balance
- Duplicate detection: if a transaction already exists (same date + amount + description hash), it is flagged and skipped (with user review option)
- Parsing handles different date formats: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, MM/DD/YYYY
- Failed rows are shown in a review queue with manual correction option
- Upload progress shown with a real-time progress bar
- Maximum file size: 25 MB

### FR-04: Automatic Transaction Categorization
The system uses keyword matching + machine learning to assign a category to each transaction description.

**Category Taxonomy (exhaustive list):**
| Category | Sub-categories | Example Keywords |
|---|---|---|
| 🍽️ Food & Dining | Restaurants, Fast Food, Cafes, Street Food, Food Delivery | Swiggy, Zomato, McDonald's, Domino's, KFC, Burger King, cafe |
| 🛒 Grocery | Supermarket, Vegetables, Fruits, Dairy | BigBasket, Grofers, Blinkit, DMart, Reliance Fresh, Spencer's, Nature's Basket |
| ⛽ Petrol & Fuel | Petrol, Diesel, CNG, EV Charging | HP Petrol, BPCL, Indian Oil, Shell, Reliance Petro, EV charge |
| 🏠 Housing | Rent, Maintenance, Electricity, Water, Gas | Rent, House maintenance, Society fee, BESCOM, MSEB, Tata Power |
| 🏦 Loan EMI | Home Loan EMI | HDFC Home Loan, SBI Home Loan, LIC HFL |
| 🎓 Education Loan EMI | Education Loan | Avanse, Credila, SBI Education, HDFC Edu |
| 🚗 Car Loan EMI | Car Loan | Car EMI, Maruti Finance, Hyundai Finance, Mahindra Finance |
| 📱 OTT & Subscriptions | Streaming, Music, Gaming | Netflix, Hotstar, Prime Video, Spotify, Apple Music, Disney+, Sony LIV, ZEE5, YouTube Premium |
| 🛍️ Online Shopping | Apparel, Electronics, Home, Beauty | Amazon, Flipkart, Myntra, Meesho, Nykaa, AJIO |
| 🚌 Transport | Metro, Bus, Auto, Cab, Train | Uber, Ola, Rapido, BMTC, Metro, IRCTC, MakeMyTrip |
| 🏥 Health & Medical | Doctor, Pharmacy, Lab Tests, Insurance | Apollo, PharmEasy, 1mg, MedPlus, health insurance |
| 📚 Education | Courses, Books, School Fees, Tuition | Udemy, Coursera, Byju's, Unacademy, school fee |
| 🎬 Entertainment | Movies, Events, Sports | BookMyShow, PVR, INOX, multiplexes |
| 🧴 Personal Care | Salon, Spa, Grooming | Salon, haircut, spa, beauty parlour |
| 💳 Credit Card Bill | Credit Card Payment | Credit card payment, CC bill |
| 📡 Utilities & Bills | Mobile, Broadband, DTH | Airtel, Jio, Vi, Tata Sky, Hathway |
| 💰 Savings & Investment | SIP, PPF, FD, Mutual Fund | SIP, mutual fund, PPF, fixed deposit, RD |
| 🎁 Gifts & Donations | Gifts, Charity, Religious | Gift, donation, temple, church |
| ✈️ Travel | Flights, Hotels, Vacation | MakeMyTrip, Goibibo, OYO, hotel, flight |
| 🏋️ Fitness | Gym, Yoga, Sports | Gym, cult.fit, yoga, sports equipment |
| 🐾 Pet Care | Vet, Pet Food, Grooming | Vet, pet food, dog, cat food |
| ❓ Miscellaneous | Uncategorized | Everything else |

- Categorization confidence score is stored (0–100)
- Transactions with confidence < 60 are flagged for user review
- User can correct a category — the correction is used to improve future predictions (feedback loop)
- Bulk re-categorize: user can select multiple transactions and assign category

### FR-05: Dashboard & Analytics
The dashboard is the primary screen after login, showing:

**Summary Cards (top row)**
- Total spent this month
- Total spent vs. last month (% change, trend arrow)
- Largest single expense this month
- Days remaining in month
- Estimated month-end total (linear projection)

**Charts & Visualizations**
- **Donut chart** — spend by category (current month)
- **Bar chart** — monthly spend trend (last 6 months, stacked by top 5 categories)
- **Line chart** — daily spend timeline (current month, with 7-day moving average)
- **Heat map** — spending by day of week and hour (if timestamps available)
- **Top 10 merchants** — horizontal bar chart
- **Fixed vs. variable expenses** — ratio card (EMIs + rent vs. discretionary spend)

**Budget tracking**
- User can set a monthly budget per category
- Progress bars showing % of budget consumed per category
- Alert banner when any category exceeds 80% of budget

**Date filters**
- Current month (default), last month, custom date range, last 3/6/12 months

### FR-06: Month-End Saving Tips
- System generates personalized tips automatically on the 25th of each month
- Also available on demand via "Generate Tips" button any time
- Tips are based on actual spending data, not generic advice
- Each tip must reference the specific category and amount: e.g., "You spent ₹2,400 on OTT subscriptions this month. You are subscribed to Netflix, Hotstar, and Prime Video simultaneously. Consider pausing one subscription to save ~₹600/month."

**Tip categories:**
- Identify duplicate/redundant subscriptions
- Flag unusually high spend vs. prior months (> 20% increase)
- Highlight cheapest days to shop (based on historical patterns)
- Suggest budget reallocation (e.g., reduce dining → increase savings)
- Loan payoff suggestions (extra payment reduces interest)
- Grocery consolidation tips (multiple small purchases vs. weekly bulk)
- Petrol saving tips if spend is high (carpooling, metro suggestion)
- Generic tips if data is insufficient (first-month user)

**Tip format**
- Each tip has: icon, category tag, headline (1 line), detail (2–3 lines), potential saving (₹/month)
- Tips are dismissible and can be marked as "helpful" or "not helpful" (feedback)
- Maximum 8 tips per generation cycle

### FR-07: Expense Reports & Export
- Export expenses as:
  - CSV (date, description, amount, category, payment method)
  - PDF report (summary + charts)
  - Excel with pivot table by category
- Date range filter for export
- Share report via email (generated PDF attached)

### FR-08: Budget Management
- Set monthly budgets per category (e.g., Food: ₹8,000 / Grocery: ₹5,000)
- Copy budget from previous month
- Roll-over unused budget to next month (toggle)
- Budget vs. actual comparison report

### FR-09: Notifications & Alerts
- Email alert when a category exceeds its budget
- Weekly spending summary email (sent every Sunday evening)
- Month-end tips notification (sent 25th of every month)
- Large transaction alert (single transaction > configurable threshold)
- All notifications are opt-in and configurable in Settings

### FR-10: Profile & Settings
- Personal info: name, email, currency preference (default ₹ INR)
- Monthly income (optional — used for savings rate calculation)
- Budget settings per category
- Notification preferences
- Connected statement sources (list of uploaded statement date ranges)
- Data export: download all data as JSON
- Account deletion with data wipe

---

## 5. Non-Functional Requirements

### NFR-01: Performance
- Page load time < 2 seconds on 4G connection
- Bank statement parse + categorize < 30 seconds for 500-row statement
- Dashboard renders < 1 second after data load
- API response time < 500ms (p95) for all read operations

### NFR-02: Security
- All passwords hashed with bcrypt (cost factor 12)
- HTTPS only (TLS 1.2+)
- JWT tokens expire in 30 days; refresh token rotation on every use
- Bank statement files deleted from server after successful processing (not stored)
- PII fields encrypted at rest (AES-256)
- Rate limiting: 100 requests/minute per user; 5 login attempts before lockout
- SQL injection prevention via ORM parameterized queries
- XSS prevention via output escaping and Content-Security-Policy headers
- CSRF protection on all state-changing endpoints

### NFR-03: Scalability
- Support up to 10,000 concurrent users
- Database designed to handle 5 million expense records per user without degradation
- Statement processing handled via async task queue (Celery + Redis)

### NFR-04: Availability
- 99.5% uptime SLA
- Graceful degradation: if categorization ML service is unavailable, fall back to keyword matching

### NFR-05: Usability
- Mobile-responsive UI (works on 360px wide screens)
- Dark mode support
- Accessible: WCAG 2.1 AA compliant
- Onboarding flow for new users (< 3 minutes to first expense logged)
- All forms auto-save drafts to prevent data loss

### NFR-06: Data Integrity
- No expense record is permanently deleted — soft delete with 90-day recovery window
- All data changes are audit-logged (user, timestamp, before/after values)
- Daily automated backups of the database

---

## 6. Constraints

- The application must work in Indian regulatory context (INR currency, Indian bank statement formats)
- Must not store raw bank statement files after processing
- Must not require user to share bank credentials or net banking login
- Initial release targets web only (iOS/Android app is roadmap v2)

---

## 7. Success Metrics

- 70% of users log at least one expense within 24 hours of signup
- 50% of users upload a bank statement within their first week
- Average session length > 3 minutes (indicating dashboard engagement)
- Month-end tips "helpful" rating > 65%
- 30-day retention rate > 40%
