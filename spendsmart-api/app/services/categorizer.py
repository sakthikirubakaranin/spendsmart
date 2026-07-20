"""
Rule-based auto-categorizer for Indian bank transactions.
Tuned against real HDFC / UPI statement patterns.
Returns (category_slug, confidence 0-100).
"""

from __future__ import annotations
import re

# ── Income classifier ─────────────────────────────────────────────────────────
INCOME_RULES: list[tuple[str, list[str], int]] = [
    ("salary", [
        "salary", "neft cr.*employee provident fund", "neft cr.*epf",
        "neft cr.*payroll", "neft cr.*salary", "credit.*salary",
        "neft cr.*employer", "salaryhdfc", "salary credit",
    ], 92),
    ("salary", ["neft cr"], 65),
    ("freelance", [
        "razorpay", "cashfree", "paytm.*business", "stripe", "paypal",
        "zoho.*invoice", "freelance", "consultancy",
    ], 75),
    ("refund", [
        "refund", "reversal", "cashback", "return",
        "amazon.*refund", "flipkart.*refund", "swiggy.*refund",
    ], 88),
    ("government", [
        "central council", "rbis0pfms", "pfms", "government", "nrega",
        "pm kisan", "scholarship",
    ], 85),
    ("transfer", ["upi-", "imps-", "neft cr", "rtgs cr"], 40),
]

_INCOME_COMPILED = [
    (itype, re.compile("|".join(k for k in keywords), re.IGNORECASE), conf)
    for itype, keywords, conf in INCOME_RULES
]


def classify_income(narration: str) -> tuple[str, int]:
    n = narration.lower()
    for itype, pattern, conf in _INCOME_COMPILED:
        if pattern.search(n):
            return itype, conf
    return "other", 30


# ── Expense category rules ────────────────────────────────────────────────────
# Order matters — first match wins. Put more specific rules first.

RULES: list[tuple[str, list[str], int]] = [

    # ── Savings / Gold / SIP ─────────────────────────────────────────────────
    # Gullak = online gold savings, treated as savings
    ("savings", [
        "gullak", "gullakmoney", "gullak money", "gullak-money",
        "autopay.*sip", "mf sip", "sip.*mutual", "nps contribution",
        "ppf transfer", "recurring deposit", "rd instalment",
        "zerodha.*sip", "groww.*sip", "kuvera.*sip",
        "digital gold", "safe gold", "mmtc.*gold",
    ], 95),

    # ── Investments ───────────────────────────────────────────────────────────
    ("savings_investment", [
        "mutual fund", "zerodha", "groww", "upstox", "kuvera",
        "axis mf", "sbi mf", "hdfc mf", "icici pru", "nippon mf",
        "parag parikh", "motilal oswal", "smallcase", "coin by zerodha",
        "navi mf", "nps", "ppf", "dividend",
        "dhan.*invest", "angel broking", "5paisa",
    ], 88),

    # ── Loan EMI ─────────────────────────────────────────────────────────────
    ("loan_emi", [
        "emi ", "nach dr", "ach d-", "nach debit", "ach debit",
        "home loan", "car loan", "personal loan", "auto loan",
        "two wheeler", "vehicle loan",
        "idfc first bank", "eduvanz", "aditya birla finance",
        "bajaj finserv", "fullerton", "credila",
        "hdfc bank loan", "sbi loan", "icici loan",
        "axis bank.*ach", "yes bank.*enach",
        "razorpaysoftwarepriv-eduvanz",
        "loan repayment", "emi payment",
    ], 90),

    # ── Insurance ────────────────────────────────────────────────────────────
    ("insurance", [
        "lic of india", "lic premium", "lic.*insurance",
        "hdfc life", "icici prudential", "max life",
        "star health", "niva bupa", "care health",
        "bajaj allianz", "reliance general", "new india assurance",
        "policybazaar", "insurance premium", "insurance payment",
        "digit insurance", "go digit", "acko",
    ], 90),

    # ── Tax ──────────────────────────────────────────────────────────────────
    ("tax", [
        "cbdt tin", "income tax", "tds payment", "advance tax",
        "gst payment", "tax payment", "e-tax",
    ], 92),

    # ── Credit Card Payment ───────────────────────────────────────────────────
    ("credit_card_bill", [
        "scapia", "credit card bill", "hdfc cc", "icici cc",
        "axis cc", "sbi card", "amex", "citibank cc",
        "onecard", "slice.*payment", "uni.*card",
        "credit card", "cc payment", "card payment",
    ], 88),

    # ── OTT & Subscriptions ──────────────────────────────────────────────────
    ("ott_subscriptions", [
        "netflix", "spotify", "amazon prime", "disney hotstar", "hotstar",
        "jiocinema", "sonyliv", "sony liv", "zee5", "mxplayer", "hungama",
        "apple music", "apple subscription", "youtube premium",
        "apple media services", "apple.com/bill", "applemedia",
        "adobe", "microsoft 365", "office 365", "dropbox", "notion",
        "chatgpt", "openai", "xaillc", "grok",
        "canva", "figma", "github.*subscription", "jetbrains",
        "google one", "google storage",
    ], 88),

    # ── Cloud / Dev Tools ─────────────────────────────────────────────────────
    ("cloud_services", [
        "google cloud", "aws india", "amazonaws", "azure",
        "digitalocean", "hetzner", "render.com", "vercel",
        "cloudflare", "railway.app",
        "google india digital",   # Google Play / Cloud billing
        "goog-", "google.*payment",
    ], 87),

    # ── Utilities ────────────────────────────────────────────────────────────
    ("utilities", [
        "bescom", "tata power", "torrent power", "adani electricity",
        "msedcl", "bses", "electricity bill", "water bill",
        "piped gas", "gas bill", "tneb", "kseb", "tangedco",
        "airtel", "jio recharge", "vodafone", "vi payment", "bsnl",
        "broadband", "fiber", "recharge", "mobile bill",
        "atria convergence", "actcorp", "hathway", "you broadband",
        "dth recharge", "tatasky", "dish tv", "sun direct",
        "airtelcommonpool", "fasttag", "toll payment",
    ], 85),

    # ── Grocery (Instamart first — more specific than "swiggy") ──────────────
    ("grocery", [
        "swiggyinstamart", "swiggy instamart",
        "bigbasket", "grofers", "blinkit", "zepto", "dunzo",
        "dmart", "reliance fresh", "reliance smart", "more supermarket",
        "nilgiris", "nature basket", "star bazaar",
        "safal", "grocery", "kirana",
        "zptmktp", "zepto marketplace",
        "jiomart",
    ], 85),

    # ── Food & Dining ────────────────────────────────────────────────────────
    ("food_dining", [
        # Swiggy (restaurant orders — after instamart above)
        "swiggy", "swiggyupi", "upiswiggy", "swiggy-upi",
        "swiggy ltd", "swiggy-swiggy",
        # Zomato
        "zomato",
        # Chains
        "dominos", "dominospizza", "pizza hut", "kfc", "mcdonald",
        "subway", "burger king", "starbucks",
        "cafe coffee day", "ccd", "costa coffee", "dunkin",
        "haldiram", "barbeque nation",
        "adyar ananda bhavan", "ananda bhavan",
        # Generic keywords in UPI narration
        "restaurant", "biryani", "food court",
        "hotel bfst", "hotel lnch", "canteen",
        # Vendors identified by name pattern
        "rayalaseema spice",
        "rasikas restaurant",
    ], 82),

    # ── Petrol & Fuel ────────────────────────────────────────────────────────
    ("fuel", [
        "hpcl", "bpcl", "iocl", "indian oil", "bharat petroleum",
        "hindustan petroleum", "shell", "nayara", "essar oil",
        "petro agency", "petrol pump", "hp petrol",
        "pms petro", "p m s petro", "fuel servi",
        "five road fuel",
    ], 87),

    # ── Transport ────────────────────────────────────────────────────────────
    ("transport", [
        "ola cabs", "uber", "rapido", "namma yatri",
        "metro card", "dmrc", "bmtc", "best bus",
        "irctc", "railway", "rail ticket", "redbus",
        "yulu", "bounce", "vogo", "zoomcar",
        "fueladream",
    ], 80),

    # ── Online Shopping ───────────────────────────────────────────────────────
    ("online_shopping", [
        "amazon", "amazonupi", "amazon india", "amazon pay",
        "flipkart", "myntra", "ajio",
        "nykaa", "meesho", "snapdeal", "tata cliq",
        "reliance digital", "croma", "vijay sales",
        "h&m", "zara", "max fashion", "westside", "lifestyle",
        "shopsy",
    ], 82),

    # ── Health & Medical ──────────────────────────────────────────────────────
    ("health_medical", [
        "apollo pharmacy", "medplus", "1mg", "pharmeasy", "netmeds",
        "practo", "mfine", "tata health",
        "hospital", "nursing home", "diagnostic", "clinic",
        "pharmacy", "medcare", "healthspring",
        "manipal", "fortis", "max healthcare",
        "gokulam", "sri gokulam",
    ], 82),

    # ── Personal Care ─────────────────────────────────────────────────────────
    ("personal_care", [
        "salon", "saloon", "barbershop", "barber", "haircut",
        "spa", "beauty", "nails", "grooming",
        "restoration centre",
    ], 80),

    # ── Education ────────────────────────────────────────────────────────────
    ("education", [
        "coursera", "udemy", "byju", "unacademy", "vedantu", "upgrad",
        "simplilearn", "great learning", "linkedin learning",
        "school fees", "college fees", "tuition", "coaching",
        "fee payment", "exam fee", "university",
    ], 82),

    # ── Housing ───────────────────────────────────────────────────────────────
    ("housing", [
        "rent payment", "house rent", "flat rent", "apartment rent",
        "society maintenance", "maintenance charges",
        "landlord", "pg rent", "hostel fees",
        "happenstance pg",   # PG accommodation
        "paying guest",
    ], 82),

    # ── Fitness ───────────────────────────────────────────────────────────────
    ("fitness", [
        "cult fit", "cultfit", "gold gym", "anytime fitness",
        "fitness first", "crossfit", "yoga studio", "decathlon",
    ], 80),

    # ── Family / Friends Transfer (low confidence — catch-all for personal UPI)
    ("family_transfer", [
        "upi-mr ", "upi-mrs ", "upi-miss ", "upi-master ",
    ], 50),

    # ── ATM / Cash ───────────────────────────────────────────────────────────
    ("others", [
        "atm wdl", "atw-", "atm withdrawal", "cash withdrawal",
        "cash deposit", "branch cash",
    ], 70),
]

# Use re.escape for literal patterns — keeps it safe with special chars like "(" and "."
_COMPILED: list[tuple[str, re.Pattern[str], int]] = [
    (slug, re.compile("|".join(re.escape(k) for k in keywords), re.IGNORECASE), conf)
    for slug, keywords, conf in RULES
]


def categorize(narration: str) -> tuple[str, int]:
    """Returns (category_slug, confidence 0-100) for a debit transaction."""
    n = narration.lower()
    for slug, pattern, conf in _COMPILED:
        if pattern.search(n):
            return slug, conf
    return "others", 20
