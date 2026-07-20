# User Stories
## SpendSmart — Personal Expense Tracker & Financial Advisor
**Version:** 1.0 | **Sprint Planning Reference**

---

## Epic 1: Authentication & Onboarding

### US-001 — User Registration
**As a** new user  
**I want to** create an account with my name, email, and password  
**So that** my expense data is private and persists across sessions

**Acceptance Criteria:**
- Registration form requires: full name, email, password (min 8 chars, 1 uppercase, 1 number), confirm password
- Email must be unique — duplicate email shows inline error "An account with this email already exists"
- On success, send a verification email and redirect to a "Check your inbox" page
- Unverified accounts cannot log in — show "Please verify your email first"
- Password field has show/hide toggle

**Story Points:** 3

---

### US-002 — User Login
**As a** registered user  
**I want to** log in with my email and password  
**So that** I can access my expense data securely

**Acceptance Criteria:**
- Login form has email, password fields and a "Remember me" checkbox
- Incorrect credentials show "Invalid email or password" (do not specify which is wrong)
- After 5 failed attempts, account locks for 15 minutes with countdown shown
- Successful login redirects to the Dashboard
- "Forgot password?" link initiates OTP-based reset flow

**Story Points:** 3

---

### US-003 — Password Reset
**As a** user who forgot my password  
**I want to** reset it via my registered email  
**So that** I can regain access to my account

**Acceptance Criteria:**
- User enters email on forgot-password page; system sends a 6-digit OTP valid for 10 minutes
- OTP entry screen has a resend button (enabled after 60 seconds)
- After correct OTP, user sets new password (same rules as registration)
- Old password is invalidated immediately after reset
- All active sessions are terminated on password reset

**Story Points:** 2

---

### US-004 — New User Onboarding
**As a** first-time user  
**I want to** be guided through setting up my profile and first expense  
**So that** I understand the app quickly without reading a manual

**Acceptance Criteria:**
- 3-step onboarding wizard shown on first login: (1) Set monthly income, (2) Set category budgets, (3) Add first expense or upload statement
- Each step has a skip option
- Completion shows a "You're all set!" screen with dashboard preview
- Onboarding wizard is not shown on subsequent logins

**Story Points:** 3

---

## Epic 2: Manual Expense Entry

### US-005 — Add Single Expense
**As a** user  
**I want to** log an expense by entering the amount, category, and description  
**So that** it is recorded in my spending history

**Acceptance Criteria:**
- "Add Expense" button is accessible from the header on every page and from the dashboard
- Form fields: Date (default today), Amount (₹ prefix, numeric keyboard on mobile), Description, Category (dropdown), Sub-category (conditional dropdown), Payment Method, Notes
- Amount field rejects zero and negative values with inline validation
- Category dropdown shows icons alongside category names
- Saving shows a toast notification: "Expense of ₹{amount} added to {category}"
- Form resets after save (not closed) so user can add another quickly

**Story Points:** 3

---

### US-006 — Bulk Expense Entry
**As a** user with multiple expenses to record  
**I want to** add several expenses in one session without re-opening the form  
**So that** I can log a full day's spending at once

**Acceptance Criteria:**
- "Add Another" button appends a new expense row below the current one
- Up to 20 rows can be added in one session
- Each row is independently validated before submission
- "Save All" button saves all valid rows and shows count: "5 expenses added"
- Invalid rows are highlighted in red and block the save

**Story Points:** 3

---

### US-007 — Edit an Expense
**As a** user  
**I want to** edit a previously entered expense  
**So that** I can correct mistakes in amount, category, or description

**Acceptance Criteria:**
- Edit icon appears on hover/tap on any expense row in the list
- Edit opens the same form pre-filled with existing data
- Saving shows "Expense updated" toast
- Change is reflected immediately in the list and dashboard without page reload
- Cancel discards changes without saving

**Story Points:** 2

---

### US-008 — Delete an Expense
**As a** user  
**I want to** delete an expense I added by mistake  
**So that** my spending totals are accurate

**Acceptance Criteria:**
- Delete icon on each expense row; clicking shows a confirmation dialog "Delete this ₹{amount} expense?"
- Confirmed delete removes the record and shows "Expense deleted" toast with an Undo option (visible for 5 seconds)
- Undo within 5 seconds restores the expense
- Deleted expense is soft-deleted (recoverable within 90 days via Settings > Data)

**Story Points:** 2

---

### US-009 — Set Up Recurring Expense
**As a** user with fixed monthly costs (EMIs, subscriptions)  
**I want to** mark an expense as recurring  
**So that** it is automatically logged every month without manual entry

**Acceptance Criteria:**
- "Recurring" toggle in the Add/Edit expense form
- When toggled, a frequency selector appears: Weekly / Monthly / Quarterly
- For monthly recurring, user sets the day of month (1–28)
- Recurring expenses appear with a 🔁 icon in the expense list
- System auto-creates the entry on the scheduled date at midnight
- User receives an in-app notification when a recurring expense is auto-created
- Recurring series can be edited or cancelled from Settings > Recurring Expenses

**Story Points:** 5

---

## Epic 3: Bank Statement Upload & Parsing

### US-010 — Upload Bank Statement
**As a** user  
**I want to** upload my bank statement file  
**So that** my transactions are imported automatically without manual entry

**Acceptance Criteria:**
- Upload page accepts PDF, CSV, XLSX, XLS, OFX files up to 25 MB
- Drag-and-drop upload zone with file browser fallback
- Progress bar shows upload and parsing progress (0–100%)
- On success, shows summary: "Found 87 transactions. 79 categorized, 8 need review."
- On failure (unrecognized format), shows "We couldn't read this file. Try exporting as CSV from your bank app." with a help link

**Story Points:** 5

---

### US-011 — Review Auto-Categorized Transactions
**As a** user whose statement has been parsed  
**I want to** review transactions that could not be categorized confidently  
**So that** all my expenses are correctly categorized

**Acceptance Criteria:**
- Review queue lists only transactions with confidence score < 60 or category = Miscellaneous
- Each row shows: date, narration, amount, and a category dropdown (pre-filled with best guess)
- User can accept the guess or pick a different category
- "Accept All" button applies best-guess categories to all uncategorized rows
- After review, pressing "Confirm Import" saves all transactions
- Reviewed transactions cannot be duplicated on re-upload (duplicate detection)

**Story Points:** 5

---

### US-012 — Duplicate Transaction Handling
**As a** user who uploads statements for overlapping date ranges  
**I want to** be warned about duplicate transactions  
**So that** my expense totals are not inflated

**Acceptance Criteria:**
- Before import, system compares new transactions against existing records using date + amount + description hash
- Duplicates are shown in a separate list with a toggle: "Skip duplicates" (default) or "Import anyway"
- Count shown: "12 duplicate transactions found and skipped"
- Non-duplicate transactions proceed to categorization as normal

**Story Points:** 3

---

### US-013 — Correct a Categorization
**As a** user  
**I want to** change the category assigned to an imported transaction  
**So that** my dashboard reflects accurate spending data

**Acceptance Criteria:**
- Any transaction row in the list has a category dropdown that is always editable
- Changing a category saves immediately on selection (no extra save button needed)
- The system records this correction and uses it to improve future categorizations for similar descriptions
- A "recategorize similar" option appears: "We found 4 similar transactions. Apply this category to all?" with a preview list

**Story Points:** 3

---

## Epic 4: Dashboard & Analytics

### US-014 — View Monthly Spending Dashboard
**As a** user  
**I want to** see a summary of all my spending for the current month  
**So that** I instantly know my financial health at a glance

**Acceptance Criteria:**
- Dashboard loads within 1 second after login
- Shows total spend, budget remaining, largest expense, and top category this month
- All numbers are formatted as ₹X,XX,XXX with proper Indian number formatting
- Clicking a category card navigates to the filtered expense list for that category
- Dashboard auto-refreshes when an expense is added or deleted (no page reload)

**Story Points:** 5

---

### US-015 — View Spending by Category (Donut Chart)
**As a** user  
**I want to** see a donut chart of my spending by category  
**So that** I can visually identify where most of my money goes

**Acceptance Criteria:**
- Donut chart shows top 8 categories by spend; rest grouped as "Others"
- Hovering/tapping a segment shows: category name, amount (₹), % of total
- Clicking a segment filters the expense list to that category
- Legend below chart lists all categories with their amounts and percentages
- Chart updates dynamically when date range filter changes

**Story Points:** 3

---

### US-016 — View Monthly Spend Trend (Bar Chart)
**As a** user  
**I want to** see a bar chart of my spending over the last 6 months  
**So that** I can identify if my spending is increasing over time

**Acceptance Criteria:**
- Stacked bar chart showing last 6 calendar months on X-axis
- Each bar stacked by top 5 categories (color-coded with legend)
- Y-axis in ₹ with appropriate scale
- Hovering a segment shows month, category, and amount
- Current month bar is visually distinct (different shade or border)

**Story Points:** 3

---

### US-017 — View Daily Spend Timeline (Line Chart)
**As a** user  
**I want to** see how much I spent each day this month  
**So that** I can identify high-spend days and understand spending patterns

**Acceptance Criteria:**
- Line chart with dates on X-axis (1st to today) and amount on Y-axis
- Two lines: daily spend (blue) and 7-day moving average (dashed grey)
- Points on the line are clickable — opens the list of expenses for that day
- Zero-spend days show as 0 (not gap in chart)
- Future dates (today+1 to month end) shown as grey dotted line with projected spend

**Story Points:** 3

---

### US-018 — Set and Track Category Budgets
**As a** user  
**I want to** set a monthly spending limit per category  
**So that** I know when I am close to or over my budget

**Acceptance Criteria:**
- Budget Settings page allows entering monthly budget for each of the 22 categories
- Dashboard shows progress bars: [category] ₹spent / ₹budget (e.g., Food ₹6,200 / ₹8,000)
- Progress bar colour: green (0–70%), yellow (70–90%), red (>90%)
- Badge "Over Budget" shown in red on any category exceeding 100%
- Email notification triggered when category reaches 80% of budget

**Story Points:** 5

---

### US-019 — Filter Dashboard by Date Range
**As a** user  
**I want to** filter all dashboard views to a specific date range  
**So that** I can analyze any time period, not just the current month

**Acceptance Criteria:**
- Date filter in dashboard header: "This Month", "Last Month", "Last 3 Months", "Last 6 Months", "Last Year", "Custom Range"
- Custom range shows a date-range calendar picker
- All charts, cards, and expense list update simultaneously when filter changes
- Selected filter is persisted in the URL so it can be bookmarked/shared
- Filter resets to "This Month" on new login

**Story Points:** 3

---

## Epic 5: Month-End Saving Tips

### US-020 — View Personalized Saving Tips
**As a** user  
**I want to** see tailored tips for reducing my expenses  
**So that** I can make specific, actionable changes to save money

**Acceptance Criteria:**
- Tips page shows up to 8 tips, each with: category icon, headline, 2-3 line detail, potential saving in ₹/month
- Tips are ordered by potential saving (highest first)
- Each tip cites specific data: exact amount spent, exact category, month name
- If user has less than 15 days of data, show 3 generic starter tips with disclaimer
- Tips page is accessible from the main navigation at all times

**Story Points:** 5

---

### US-021 — Generate Tips On Demand
**As a** user mid-month  
**I want to** generate saving tips whenever I want  
**So that** I can course-correct spending before month-end

**Acceptance Criteria:**
- "Generate Tips" button on the Tips page always available
- Button shows a loading spinner for up to 5 seconds while tips are generated
- Tips are regenerated fresh each time (not cached from last run)
- Last generated timestamp shown: "Tips last generated: Today at 3:42 PM"

**Story Points:** 2

---

### US-022 — Dismiss or Rate a Tip
**As a** user  
**I want to** dismiss irrelevant tips and rate useful ones  
**So that** future tips are better calibrated to my lifestyle

**Acceptance Criteria:**
- Each tip has: 👍 Helpful | 👎 Not helpful | ✕ Dismiss buttons
- Dismissed tips collapse with animation and do not return in the next generation
- Ratings are stored and used to de-prioritize tip types the user consistently rates poorly
- Dismissed tips viewable in a "Dismissed Tips" collapsible section at the bottom of the page

**Story Points:** 2

---

### US-023 — Receive Month-End Tips Notification
**As a** user  
**I want to** receive an email on the 25th of each month with my saving tips  
**So that** I am reminded to review my spending before month-end

**Acceptance Criteria:**
- Automated email sent at 9:00 AM on the 25th of every month to users who have opted in
- Email shows top 3 tips with CTA "View all tips →" linking to the app
- Users can opt out from Settings > Notifications
- Email subject: "Your SpendSmart money-saving tips for [Month Year]"

**Story Points:** 3

---

## Epic 6: Reports & Export

### US-024 — Export Expenses as CSV
**As a** user  
**I want to** download my expenses as a CSV file  
**So that** I can analyse them in Excel or share with my accountant

**Acceptance Criteria:**
- Export button on Expenses list page and Reports page
- Date range filter applies to export
- CSV columns: Date, Description, Amount, Category, Sub-category, Payment Method, Notes, Source (Manual/Bank Statement)
- File downloads immediately with name: `spendsmart_export_{from}_{to}.csv`
- Large exports (>10,000 rows) are queued and emailed as a link within 5 minutes

**Story Points:** 3

---

### US-025 — Export Monthly PDF Report
**As a** user  
**I want to** download a formatted PDF report of my monthly spending  
**So that** I have a professional summary I can save or share

**Acceptance Criteria:**
- PDF report includes: cover page with user name and month, summary cards, donut chart, bar chart, category breakdown table, top 10 transactions, and saving tips summary
- Charts render correctly in PDF (not placeholders)
- Report generated and downloaded within 10 seconds
- File name: `SpendSmart_Report_{Month}_{Year}.pdf`

**Story Points:** 5

---

## Epic 7: Settings & Profile

### US-026 — Configure Notification Preferences
**As a** user  
**I want to** choose which notifications I receive  
**So that** I am not overwhelmed with emails

**Acceptance Criteria:**
- Notification settings page has toggles for: Budget Alert (80% threshold), Weekly Summary, Month-End Tips, Large Transaction Alert
- Large Transaction Alert has a configurable threshold (default ₹5,000)
- Changes save immediately on toggle (no save button needed)
- Test button: "Send test email" to verify email delivery

**Story Points:** 2

---

### US-027 — View and Manage Uploaded Statements
**As a** user  
**I want to** see a history of all uploaded bank statements  
**So that** I know which periods are covered by imported data

**Acceptance Criteria:**
- Statement History page shows each upload: filename, upload date, number of transactions imported, date range covered
- Option to delete an uploaded statement (removes all transactions sourced from that upload)
- Delete shows confirmation: "This will delete 87 transactions. This cannot be undone."

**Story Points:** 2

---
