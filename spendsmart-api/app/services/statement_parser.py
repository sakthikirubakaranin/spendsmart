"""
Multi-bank statement parser.

Supported banks / formats
─────────────────────────
• HDFC Bank          — XLS / XLSX (savings & current account)
• HDFC Credit Card   — XLSX / CSV
• SBI                — XLS / XLSX / CSV
• ICICI Bank         — XLS / XLSX / CSV
• Axis Bank          — XLS / XLSX / CSV (two layout variants)
• Kotak Bank         — XLS / XLSX / CSV
• Yes Bank           — CSV / XLSX
• IDFC First Bank    — CSV / XLSX
• Generic fallback   — any CSV/XLSX with recognisable column names

Detection order
───────────────
1. Filename heuristics (e.g. "hdfc_cc" → credit card)
2. First 10-row header text scan (bank name strings)
3. Column-name fingerprinting
4. Generic fallback
"""

from __future__ import annotations

import hashlib
import io
import re
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any

import pandas as pd


# ── Result types ──────────────────────────────────────────────────────────────

@dataclass
class ParsedRow:
    date: date
    description: str
    amount: float            # always positive
    txn_type: str            # "debit" | "credit"
    reference: str = ""
    payment_method: str = "NET_BANKING"
    row_hash: str = ""


@dataclass
class ParseResult:
    bank: str
    rows: list[ParsedRow] = field(default_factory=list)
    skipped: int = 0
    error: str = ""


# ── Date & amount utilities ───────────────────────────────────────────────────

_DATE_FMTS = [
    "%d/%m/%Y", "%d-%m-%Y", "%d/%m/%y", "%d-%m-%y",
    "%Y-%m-%d", "%Y/%m/%d",
    "%d %b %Y", "%d %B %Y",
    "%d-%b-%Y", "%d-%B-%Y",
    "%d %b %y", "%d-%b-%y",
    "%m/%d/%Y",
    "%d.%m.%Y", "%d.%m.%y",
]


def _parse_date(val: Any) -> date | None:
    if isinstance(val, datetime):
        return val.date()
    if isinstance(val, date):
        return val
    s = str(val).strip().rstrip(".")
    # Drop time component if present (e.g. "01/01/2025 00:00:00")
    s = re.split(r"\s+\d{1,2}:", s)[0].strip()
    for fmt in _DATE_FMTS:
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def _clean_amount(val: Any) -> float | None:
    if val is None:
        return None
    if isinstance(val, float) and pd.isna(val):
        return None
    s = re.sub(r"[₹,\s]", "", str(val)).strip()
    if s in ("", "-", "nan", "NaN"):
        return None
    # Handle "(1234.56)" as negative
    if s.startswith("(") and s.endswith(")"):
        try:
            return -float(s[1:-1])
        except ValueError:
            return None
    try:
        return float(s)
    except ValueError:
        return None


def _row_hash(user_id: str, d: date, amount: float, desc: str) -> str:
    raw = f"{user_id}|{d}|{amount:.2f}|{desc[:64]}"
    return hashlib.sha256(raw.encode()).hexdigest()


def _infer_payment_method(desc: str) -> str:
    d = desc.upper()
    if "UPI" in d:
        return "UPI"
    if any(k in d for k in ("ATM", "CASH WDL", "ATM WDL", "CASH WITHDRAWAL")):
        return "CASH"
    if any(k in d for k in ("NEFT", "RTGS", "IMPS", "NET BANKING", "INB", "NETBKG")):
        return "NET_BANKING"
    if "POS" in d or "SWIPE" in d:
        return "DEBIT_CARD"
    if any(k in d for k in ("CC ", "CREDIT CARD", "CCPAY")):
        return "CREDIT_CARD"
    return "NET_BANKING"


# ── Header-row finder ─────────────────────────────────────────────────────────

def _find_header_row(df_raw: pd.DataFrame, keywords: list[str], max_scan: int = 25) -> int | None:
    """
    Scan the first `max_scan` rows for a row whose cells contain all provided
    keywords (case-insensitive). Returns the 0-based row index or None.

    Special case: if the column names themselves match (CSV case), returns -1
    to signal "headers are already the column row — slice from row 0".
    """
    kw_lower = [k.lower() for k in keywords]

    # Check if the DataFrame's own column names satisfy the keywords (CSV)
    col_text = " ".join(str(c).lower() for c in df_raw.columns.tolist())
    if all(k in col_text for k in kw_lower):
        return -1   # sentinel: column names ARE the header

    for i in range(min(max_scan, len(df_raw))):
        row_text = " ".join(str(v).lower() for v in df_raw.iloc[i].tolist())
        if all(k in row_text for k in kw_lower):
            return i
    return None


def _slice_from_header_or_col(df_raw: pd.DataFrame, header_idx: int) -> pd.DataFrame:
    """Wrapper that handles sentinel -1 (columns are already header)."""
    if header_idx == -1:
        # Column names are the actual header; just strip rows that look like account info
        df = df_raw.copy()
        df.columns = [str(c).strip() for c in df.columns]
        return df.reset_index(drop=True)
    return _slice_from_header(df_raw, header_idx)


def _slice_from_header(df_raw: pd.DataFrame, header_idx: int) -> pd.DataFrame:
    """Return a DataFrame with columns set from header_idx row and data below it."""
    headers = [str(c).strip() for c in df_raw.iloc[header_idx].tolist()]
    df = df_raw.iloc[header_idx + 1:].copy()
    df.columns = headers
    return df.reset_index(drop=True)


# ── Column mapper ─────────────────────────────────────────────────────────────

def _map_cols(
    columns: list[str],
    date_aliases: set[str],
    desc_aliases: set[str],
    debit_aliases: set[str],
    credit_aliases: set[str],
    ref_aliases: set[str] | None = None,
    amount_aliases: set[str] | None = None,
    drcr_aliases: set[str] | None = None,
) -> dict[str, str]:
    """Map column aliases → actual column names. Returns {'date': ..., 'narration': ..., ...}"""
    m: dict[str, str] = {}
    for c in columns:
        cl = c.lower().strip()
        if "date" not in m and cl in date_aliases:
            m["date"] = c
        if "narration" not in m and cl in desc_aliases:
            m["narration"] = c
        if "withdrawal" not in m and cl in debit_aliases:
            m["withdrawal"] = c
        if "deposit" not in m and cl in credit_aliases:
            m["deposit"] = c
        if ref_aliases and "ref" not in m and cl in ref_aliases:
            m["ref"] = c
        if amount_aliases and "amount" not in m and cl in amount_aliases:
            m["amount"] = c
        if drcr_aliases and "drcr" not in m and cl in drcr_aliases:
            m["drcr"] = c
    return m


# ── Row builder ───────────────────────────────────────────────────────────────

def _build_rows(df: pd.DataFrame, col_map: dict[str, str], result: ParseResult) -> None:
    """
    Generic row extractor that handles:
    - Separate debit/credit columns
    - Single signed amount column
    - DR/CR indicator column
    """
    for _, row in df.iterrows():
        raw_date = row.get(col_map.get("date", "__MISSING__"), None)
        parsed_date = _parse_date(raw_date)
        if parsed_date is None:
            result.skipped += 1
            continue

        desc = str(row.get(col_map.get("narration", "__MISSING__"), "")).strip()
        if not desc or desc.lower() in ("nan", "none", ""):
            result.skipped += 1
            continue

        withdrawal = None
        deposit    = None

        if "withdrawal" in col_map:
            withdrawal = _clean_amount(row.get(col_map["withdrawal"]))
        if "deposit" in col_map:
            deposit = _clean_amount(row.get(col_map["deposit"]))

        # DR/CR indicator column (e.g. Axis Bank uses "DR"/"CR" in a separate col)
        drcr = None
        if "drcr" in col_map:
            drcr = str(row.get(col_map["drcr"], "")).strip().upper()

        # Single amount column with DR/CR indicator
        if "amount" in col_map and withdrawal is None and deposit is None:
            amt = _clean_amount(row.get(col_map["amount"]))
            if amt is not None:
                if drcr == "CR":
                    deposit = abs(amt)
                elif drcr == "DR":
                    withdrawal = abs(amt)
                elif amt < 0:
                    withdrawal = abs(amt)
                elif amt > 0:
                    deposit = amt

        # Determine direction
        if withdrawal and withdrawal > 0:
            amount, txn_type = withdrawal, "debit"
        elif deposit and deposit > 0:
            amount, txn_type = deposit, "credit"
        else:
            result.skipped += 1
            continue

        ref = str(row.get(col_map.get("ref", "__MISSING__"), "")).strip()
        if ref.lower() == "nan":
            ref = ""

        result.rows.append(ParsedRow(
            date=parsed_date,
            description=desc,
            amount=amount,
            txn_type=txn_type,
            reference=ref,
            payment_method=_infer_payment_method(desc),
        ))


# ══════════════════════════════════════════════════════════════════════════════
# Bank-specific parsers
# ══════════════════════════════════════════════════════════════════════════════

def _parse_hdfc(df_raw: pd.DataFrame, bank_name: str = "HDFC Bank") -> ParseResult:
    """
    HDFC savings/current statement (XLS / XLSX).
    Looks for header row containing 'Date' and 'Narration'.
    """
    result = ParseResult(bank=bank_name)

    header_idx = _find_header_row(df_raw, ["date", "narration"])
    if header_idx is None:
        header_idx = _find_header_row(df_raw, ["date", "description"])
    if header_idx is None:
        header_idx = _find_header_row(df_raw, ["date", "particulars"])
    if header_idx is None:
        result.error = "Could not find transaction table in HDFC statement"
        return result

    df = _slice_from_header_or_col(df_raw, header_idx)

    col_map = _map_cols(
        df.columns.tolist(),
        date_aliases={"date", "txn date", "transaction date", "posting date"},
        desc_aliases={"narration", "description", "particulars", "transaction details"},
        debit_aliases={"withdrawal amt.(inr )", "withdrawal", "withdrawal amt", "debit", "debit amt", "debit amount", "dr amount"},
        credit_aliases={"deposit amt.(inr )", "deposit", "deposit amt", "credit", "credit amt", "credit amount", "cr amount"},
        ref_aliases={"chq./ref.no.", "ref no.", "ref no", "chq no", "cheque no", "reference no", "reference number"},
    )

    if "date" not in col_map or "narration" not in col_map:
        result.error = "Missing required columns (Date / Description)"
        return result

    _build_rows(df, col_map, result)
    return result


def _parse_hdfc_credit_card(df_raw: pd.DataFrame) -> ParseResult:
    """
    HDFC Credit Card statement.
    Columns: Date | Transaction Details | Amount (INR)
    Credit card: most transactions are debits, payments to card are credits.
    """
    result = ParseResult(bank="HDFC Credit Card")

    # Try to find header row with 'date' and 'amount'
    header_idx = _find_header_row(df_raw, ["date", "amount"])
    if header_idx is None:
        header_idx = _find_header_row(df_raw, ["date", "transaction"])
    if header_idx is None:
        result.error = "Could not find header in HDFC Credit Card statement"
        return result

    df = _slice_from_header_or_col(df_raw, header_idx)

    col_map = _map_cols(
        df.columns.tolist(),
        date_aliases={"date", "txn date", "transaction date"},
        desc_aliases={"transaction details", "description", "narration", "particulars", "details"},
        debit_aliases={"debit", "dr", "debit amount", "withdrawal"},
        credit_aliases={"credit", "cr", "credit amount", "deposit"},
        amount_aliases={"amount (inr)", "amount(inr)", "amount", "transaction amount"},
        drcr_aliases={"type", "cr/dr", "dr/cr"},
    )

    if "date" not in col_map or "narration" not in col_map:
        result.error = "Missing required columns"
        return result

    for _, row in df.iterrows():
        raw_date = row.get(col_map.get("date", "__MISSING__"))
        parsed_date = _parse_date(raw_date)
        if parsed_date is None:
            result.skipped += 1
            continue

        desc = str(row.get(col_map.get("narration", ""), "")).strip()
        if not desc or desc.lower() in ("nan", "none", ""):
            result.skipped += 1
            continue

        # Credit card: check for explicit debit/credit cols first
        withdrawal = _clean_amount(row.get(col_map["withdrawal"])) if "withdrawal" in col_map else None
        deposit    = _clean_amount(row.get(col_map["deposit"]))    if "deposit"    in col_map else None
        amt_single = _clean_amount(row.get(col_map["amount"]))     if "amount"     in col_map else None
        drcr_col   = str(row.get(col_map.get("drcr", ""), "")).upper().strip() if "drcr" in col_map else ""

        if withdrawal and withdrawal > 0:
            amount, txn_type = withdrawal, "debit"
        elif deposit and deposit > 0:
            amount, txn_type = deposit, "credit"
        elif amt_single is not None:
            amt = abs(amt_single)
            if drcr_col in ("CR", "CREDIT"):
                txn_type = "credit"
            elif drcr_col in ("DR", "DEBIT"):
                txn_type = "debit"
            else:
                # Credit card heuristic: payments to card and cashback are credits
                upper_desc = desc.upper()
                if any(k in upper_desc for k in ("PAYMENT", "CASHBACK", "REFUND", "REVERSAL")):
                    txn_type = "credit"
                else:
                    txn_type = "debit"
            if amt <= 0:
                result.skipped += 1
                continue
            amount = amt
        else:
            result.skipped += 1
            continue

        ref = str(row.get(col_map.get("ref", ""), "")).strip()
        result.rows.append(ParsedRow(
            date=parsed_date,
            description=desc,
            amount=amount,
            txn_type=txn_type,
            reference=ref,
            payment_method=_infer_payment_method(desc),
        ))

    return result


def _parse_sbi(df_raw: pd.DataFrame) -> ParseResult:
    """
    SBI account statement (XLS / XLSX / CSV).
    Header row: Txn Date | Value Date | Description | Ref No./Cheque No. | Debit | Credit | Balance
    Some SBI exports prefix with account summary rows.
    """
    result = ParseResult(bank="SBI")

    header_idx = _find_header_row(df_raw, ["txn date", "debit"])
    if header_idx is None:
        header_idx = _find_header_row(df_raw, ["date", "debit", "credit"])
    if header_idx is None:
        header_idx = _find_header_row(df_raw, ["date", "description"])
    if header_idx is None:
        result.error = "Could not find transaction table in SBI statement"
        return result

    df = _slice_from_header_or_col(df_raw, header_idx)

    col_map = _map_cols(
        df.columns.tolist(),
        date_aliases={"txn date", "date", "transaction date", "value date", "posting date"},
        desc_aliases={"description", "narration", "particulars", "transaction details", "remarks"},
        debit_aliases={"debit", "dr", "debit(inr)", "withdrawal", "withdrawal amt.(inr )"},
        credit_aliases={"credit", "cr", "credit(inr)", "deposit", "deposit amt.(inr )"},
        ref_aliases={"ref no./cheque no.", "ref no", "chq no", "cheque no", "reference"},
    )

    if "date" not in col_map or "narration" not in col_map:
        result.error = "Missing required columns (Date / Description)"
        return result

    _build_rows(df, col_map, result)
    return result


def _parse_icici(df_raw: pd.DataFrame) -> ParseResult:
    """
    ICICI Bank account statement (XLS / XLSX / CSV).
    Header row: Transaction Date | Value Date | Description | Reference Number | Debit | Credit | Balance
    """
    result = ParseResult(bank="ICICI Bank")

    header_idx = _find_header_row(df_raw, ["transaction date", "debit"])
    if header_idx is None:
        header_idx = _find_header_row(df_raw, ["date", "debit", "credit"])
    if header_idx is None:
        header_idx = _find_header_row(df_raw, ["date", "description"])
    if header_idx is None:
        result.error = "Could not find transaction table in ICICI statement"
        return result

    df = _slice_from_header_or_col(df_raw, header_idx)

    col_map = _map_cols(
        df.columns.tolist(),
        date_aliases={"transaction date", "txn date", "date", "value date"},
        desc_aliases={"description", "narration", "particulars", "transaction details", "remarks"},
        debit_aliases={"debit", "dr", "debit amount", "withdrawal amt.(inr )", "withdrawal"},
        credit_aliases={"credit", "cr", "credit amount", "deposit amt.(inr )", "deposit"},
        ref_aliases={"reference number", "ref no", "reference", "cheque no", "chq no"},
    )

    if "date" not in col_map or "narration" not in col_map:
        result.error = "Missing required columns (Date / Description)"
        return result

    _build_rows(df, col_map, result)
    return result


def _parse_axis(df_raw: pd.DataFrame) -> ParseResult:
    """
    Axis Bank account statement (XLS / XLSX / CSV).
    Two known layouts:
      Layout A (older): Tran Date | CHQNO | PARTICULARS | DR | CR | BAL
      Layout B (newer): Transaction Date | Transaction Remarks | Withdrawal Amount (INR ) | Deposit Amount (INR ) | Balance (INR )
    """
    result = ParseResult(bank="Axis Bank")

    # Try layout B first (newer / more common)
    header_idx = _find_header_row(df_raw, ["transaction date", "withdrawal amount"])
    layout_b = header_idx is not None

    if not layout_b:
        header_idx = _find_header_row(df_raw, ["tran date", "particulars"])
    if header_idx is None:
        header_idx = _find_header_row(df_raw, ["date", "particulars"])
    if header_idx is None:
        header_idx = _find_header_row(df_raw, ["date", "description"])
    if header_idx is None:
        result.error = "Could not find transaction table in Axis statement"
        return result

    df = _slice_from_header_or_col(df_raw, header_idx)

    col_map = _map_cols(
        df.columns.tolist(),
        date_aliases={"transaction date", "tran date", "txn date", "date", "value date"},
        desc_aliases={"transaction remarks", "particulars", "description", "narration", "remarks", "details"},
        debit_aliases={"withdrawal amount (inr )", "withdrawal amount", "dr", "debit", "debit amount"},
        credit_aliases={"deposit amount (inr )", "deposit amount", "cr", "credit", "credit amount"},
        ref_aliases={"chqno", "chq no", "ref no", "reference no"},
        amount_aliases={"amount", "transaction amount"},
        drcr_aliases={"type"},
    )

    if "date" not in col_map or "narration" not in col_map:
        result.error = "Missing required columns (Date / Description)"
        return result

    _build_rows(df, col_map, result)
    return result


def _parse_kotak(df_raw: pd.DataFrame) -> ParseResult:
    """
    Kotak Mahindra Bank account statement (XLS / XLSX / CSV).
    Header: Date | Description | Ref No. | Debit Amount | Credit Amount | Balance
    """
    result = ParseResult(bank="Kotak Bank")

    header_idx = _find_header_row(df_raw, ["date", "debit amount"])
    if header_idx is None:
        header_idx = _find_header_row(df_raw, ["date", "description", "credit"])
    if header_idx is None:
        header_idx = _find_header_row(df_raw, ["date", "debit"])
    if header_idx is None:
        result.error = "Could not find transaction table in Kotak statement"
        return result

    df = _slice_from_header_or_col(df_raw, header_idx)

    col_map = _map_cols(
        df.columns.tolist(),
        date_aliases={"date", "transaction date", "txn date", "value date"},
        desc_aliases={"description", "narration", "particulars", "transaction details", "remarks"},
        debit_aliases={"debit amount", "dr amount", "debit", "dr", "withdrawal"},
        credit_aliases={"credit amount", "cr amount", "credit", "cr", "deposit"},
        ref_aliases={"ref no.", "ref no", "reference", "chq no", "cheque no"},
    )

    if "date" not in col_map or "narration" not in col_map:
        result.error = "Missing required columns (Date / Description)"
        return result

    _build_rows(df, col_map, result)
    return result


def _parse_yesbank(df_raw: pd.DataFrame) -> ParseResult:
    """Yes Bank / IDFC First Bank — similar to generic but with specific column names."""
    result = ParseResult(bank="Yes Bank")

    header_idx = _find_header_row(df_raw, ["date", "debit"])
    if header_idx is None:
        header_idx = _find_header_row(df_raw, ["date", "description"])
    if header_idx is None:
        result.error = "Could not find transaction table in Yes Bank statement"
        return result

    df = _slice_from_header_or_col(df_raw, header_idx)

    col_map = _map_cols(
        df.columns.tolist(),
        date_aliases={"date", "transaction date", "txn date"},
        desc_aliases={"description", "narration", "particulars", "transaction details"},
        debit_aliases={"debit", "dr", "debit amount", "withdrawal"},
        credit_aliases={"credit", "cr", "credit amount", "deposit"},
        ref_aliases={"ref no", "reference", "chq no"},
    )

    if "date" not in col_map or "narration" not in col_map:
        result.error = "Missing required columns"
        return result

    _build_rows(df, col_map, result)
    return result


# ── Generic fallback ──────────────────────────────────────────────────────────

_GEN_DATE   = {"date", "txn date", "transaction date", "value date", "posting date", "tran date"}
_GEN_DESC   = {"narration", "description", "particulars", "details", "remarks",
               "transaction details", "transaction remarks", "merchant name"}
_GEN_DEBIT  = {"withdrawal amt.(inr )", "withdrawal amount (inr )", "withdrawal", "debit",
               "debit amt", "debit amount", "dr", "dr amount"}
_GEN_CREDIT = {"deposit amt.(inr )", "deposit amount (inr )", "deposit", "credit",
               "credit amt", "credit amount", "cr", "cr amount"}
_GEN_AMT    = {"amount", "transaction amount", "amount (inr)", "amount(inr)"}
_GEN_DRCR   = {"type", "dr/cr", "cr/dr", "txn type", "transaction type"}


def _parse_generic(df: pd.DataFrame, bank: str = "Unknown") -> ParseResult:
    """
    Generic parser — tries to identify columns by matching against alias sets.
    Handles both header-present DataFrames and header-row-search DataFrames.
    """
    result = ParseResult(bank=bank)

    # If first column can't be parsed as dates but a later row can, search for header
    first_col_vals = df.iloc[:5, 0].tolist()
    looks_like_header = any(
        str(v).lower().strip() in _GEN_DATE or str(v).lower().strip() in _GEN_DESC
        for v in first_col_vals
    )
    if looks_like_header:
        # Find the actual header row
        for i in range(min(30, len(df))):
            row_vals = [str(v).lower().strip() for v in df.iloc[i].tolist()]
            if any(v in _GEN_DATE for v in row_vals) and any(v in _GEN_DESC for v in row_vals):
                df = _slice_from_header(df, i)
                break

    df.columns = [str(c).strip() for c in df.columns]

    col_map = _map_cols(
        df.columns.tolist(),
        date_aliases=_GEN_DATE,
        desc_aliases=_GEN_DESC,
        debit_aliases=_GEN_DEBIT,
        credit_aliases=_GEN_CREDIT,
        amount_aliases=_GEN_AMT,
        drcr_aliases=_GEN_DRCR,
    )

    if "date" not in col_map or "narration" not in col_map:
        result.error = "Could not identify Date / Description columns"
        return result

    _build_rows(df, col_map, result)
    return result


# ── Multi-sheet XLSX loader ───────────────────────────────────────────────────

def _load_excel_best_sheet(file_bytes: bytes, ext: str) -> pd.DataFrame | None:
    """
    Load XLSX/XLS, trying each sheet and returning the one with the most rows
    that contains at least one recognisable date-like value.
    """
    engine = "xlrd" if ext == "xls" else "openpyxl"
    try:
        xf = pd.ExcelFile(io.BytesIO(file_bytes), engine=engine)
    except Exception:
        return None

    best: pd.DataFrame | None = None
    best_rows = -1

    for sheet in xf.sheet_names:
        try:
            df = xf.parse(sheet, header=None, dtype=str)
        except Exception:
            continue
        if df.empty:
            continue
        # Quick sanity check: does the sheet have any date-parseable cells in first col?
        has_dates = any(
            _parse_date(v) is not None
            for v in df.iloc[:, 0].tolist()[:30]
            if str(v).lower() not in ("nan", "none", "")
        )
        if has_dates and len(df) > best_rows:
            best = df
            best_rows = len(df)

    return best


# ── Public entry point ────────────────────────────────────────────────────────

def parse_statement(file_bytes: bytes, filename: str, user_id: str) -> ParseResult:
    fn = filename.lower()
    ext = fn.rsplit(".", 1)[-1]

    # ── 1. Load raw DataFrame ────────────────────────────────────────────────
    df_raw: pd.DataFrame | None = None

    if ext == "csv":
        try:
            # Try UTF-8, fall back to latin-1
            try:
                df_raw = pd.read_csv(io.BytesIO(file_bytes), dtype=str, keep_default_na=False)
            except UnicodeDecodeError:
                df_raw = pd.read_csv(
                    io.BytesIO(file_bytes), dtype=str, keep_default_na=False, encoding="latin-1"
                )
        except Exception as exc:
            return ParseResult(bank="Unknown", error=f"Could not read CSV: {exc}")

    elif ext in ("xls", "xlsx", "xlsm"):
        df_raw = _load_excel_best_sheet(file_bytes, ext)
        if df_raw is None:
            return ParseResult(bank="Unknown", error="Could not read Excel file")

    else:
        return ParseResult(bank="Unknown", error=f"Unsupported format: .{ext}")

    # ── 2. Detect bank ────────────────────────────────────────────────────────
    header_text = " ".join(
        str(v).lower()
        for v in df_raw.iloc[:10].values.flatten()
        if str(v).lower() not in ("nan", "none", "")
    )
    col_text = " ".join(str(c).lower() for c in df_raw.columns.tolist())
    full_text = header_text + " " + col_text

    # Filename-based hints (highest priority)
    is_hdfc_cc = any(k in fn for k in ("_cc", "creditcard", "credit_card", "cc_stmt", "hdfc_cc"))
    is_hdfc    = "hdfc" in fn and not is_hdfc_cc
    is_sbi     = any(k in fn for k in ("sbi", "statebank", "state_bank"))
    is_icici   = "icici" in fn
    is_axis    = "axis" in fn
    is_kotak   = "kotak" in fn
    is_yes     = "yesbank" in fn or "yes_bank" in fn
    is_idfc    = "idfc" in fn

    # Content-based detection (fallback)
    if not any([is_hdfc_cc, is_hdfc, is_sbi, is_icici, is_axis, is_kotak, is_yes, is_idfc]):
        if "hdfc" in full_text and any(k in full_text for k in ("credit card", "creditcard")):
            is_hdfc_cc = True
        elif "hdfc" in full_text:
            is_hdfc = True
        elif "state bank" in full_text or " sbi " in full_text:
            is_sbi = True
        elif "icici" in full_text:
            is_icici = True
        elif "axis" in full_text:
            is_axis = True
        elif "kotak" in full_text:
            is_kotak = True
        elif "yes bank" in full_text or "yesbank" in full_text:
            is_yes = True
        elif "idfc" in full_text:
            is_idfc = True

    # ── 3. Parse ──────────────────────────────────────────────────────────────
    result: ParseResult | None = None

    if is_hdfc_cc:
        result = _parse_hdfc_credit_card(df_raw)
    elif is_hdfc:
        result = _parse_hdfc(df_raw, bank_name="HDFC Bank")
        if result.error:
            # May be HDFC credit card in disguise
            result = _parse_hdfc_credit_card(df_raw)
    elif is_sbi:
        result = _parse_sbi(df_raw)
    elif is_icici:
        result = _parse_icici(df_raw)
    elif is_axis:
        result = _parse_axis(df_raw)
    elif is_kotak:
        result = _parse_kotak(df_raw)
    elif is_yes or is_idfc:
        result = _parse_yesbank(df_raw)
        result.bank = "IDFC First Bank" if is_idfc else "Yes Bank"
    else:
        # Unknown bank — try all parsers in order, use best result
        candidates = [
            _parse_hdfc(df_raw),
            _parse_sbi(df_raw),
            _parse_icici(df_raw),
            _parse_axis(df_raw),
            _parse_kotak(df_raw),
        ]
        # Pick the parser that found the most rows without error
        best = max(candidates, key=lambda r: len(r.rows) if not r.error else -1)
        if best.rows:
            result = best
        else:
            result = _parse_generic(df_raw, bank="Unknown")

    # ── 4. Generic fallback if bank-specific parser failed ────────────────────
    if result.error or not result.rows:
        bank_label = result.bank
        fallback = _parse_generic(df_raw, bank=bank_label)
        if not fallback.error and len(fallback.rows) > len(result.rows):
            result = fallback

    # ── 5. Add duplicate-detection hashes ────────────────────────────────────
    for row in result.rows:
        row.row_hash = _row_hash(user_id, row.date, row.amount, row.description)

    return result
