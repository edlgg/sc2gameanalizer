"""
Crypto payment module for SC2 Replay Analyzer.
Handles HD wallet derivation and payment verification for EVM chains.
"""
import logging
import os
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional, Tuple, List
from dataclasses import dataclass
from enum import Enum

from eth_account import Account
from web3 import Web3

logger = logging.getLogger(__name__)


def _utc_now() -> datetime:
    """Get current UTC time (timezone-aware)."""
    return datetime.now(timezone.utc)


def _parse_datetime(dt_str: str) -> datetime:
    """Parse ISO datetime string and ensure it's timezone-aware (UTC)."""
    dt = datetime.fromisoformat(dt_str)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt

# Enable HD wallet features
Account.enable_unaudited_hdwallet_features()


class PaymentStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    EXPIRED = "expired"


class TokenType(str, Enum):
    USDC = "usdc"
    USDT = "usdt"


@dataclass
class PaymentInfo:
    id: int
    user_id: int
    address: str
    amount: int  # In smallest unit (6 decimals)
    token: TokenType
    chain: str
    status: PaymentStatus
    created_at: datetime
    expires_at: datetime
    tx_hash: Optional[str] = None


# Chain configurations
CHAINS = {
    "ethereum": {
        "rpc": "https://eth.public-rpc.com",
        "usdc": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        "usdt": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        "chain_id": 1,
        "name": "Ethereum",
        "explorer": "https://etherscan.io",
        "gas_price_gwei": 30,  # Approximate for estimation
    },
    "bsc": {
        "rpc": "https://bsc-dataseed.binance.org",
        "usdc": "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
        "usdt": "0x55d398326f99059fF775485246999027B3197955",
        "chain_id": 56,
        "name": "BNB Chain",
        "explorer": "https://bscscan.com",
        "gas_price_gwei": 3,
    },
    "polygon": {
        "rpc": "https://polygon-rpc.com",
        "usdc": "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
        "usdt": "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
        "chain_id": 137,
        "name": "Polygon",
        "explorer": "https://polygonscan.com",
        "gas_price_gwei": 30,
    },
    "base": {
        "rpc": "https://mainnet.base.org",
        "usdc": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        "usdt": None,  # USDT not widely used on Base
        "chain_id": 8453,
        "name": "Base",
        "explorer": "https://basescan.org",
        "gas_price_gwei": 0.1,
    },
}

# ERC20 ABI for balance checking and transfers
ERC20_ABI = [
    {
        "constant": True,
        "inputs": [{"name": "_owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "balance", "type": "uint256"}],
        "type": "function",
    },
    {
        "constant": False,
        "inputs": [
            {"name": "_to", "type": "address"},
            {"name": "_value", "type": "uint256"}
        ],
        "name": "transfer",
        "outputs": [{"name": "", "type": "bool"}],
        "type": "function",
    },
    {
        "constant": True,
        "inputs": [],
        "name": "decimals",
        "outputs": [{"name": "", "type": "uint8"}],
        "type": "function",
    },
]

# Pro price (6 decimals for both USDC and USDT)
# Configurable via environment variable
def get_pro_price() -> int:
    """Get pro price from environment variable (in USD, e.g., '19' for $19)."""
    price_str = os.getenv("PRO_PRICE_USD")
    if not price_str:
        raise RuntimeError("PRO_PRICE_USD environment variable is required")
    try:
        price_usd = float(price_str)
        if price_usd <= 0:
            raise RuntimeError(f"PRO_PRICE_USD must be positive, got: {price_usd}")
        return int(price_usd * 1_000_000)  # Convert to 6 decimals
    except ValueError:
        raise RuntimeError(f"PRO_PRICE_USD must be a number, got: {price_str}")


# Load price at module import
PRO_PRICE = get_pro_price()

# Amount increment for unique payment identification ($0.001 in 6 decimals)
AMOUNT_INCREMENT = 1000

# Maximum unique suffix slots (001-999, so max 999 concurrent pending payments)
MAX_SUFFIX_SLOTS = 999


def find_available_suffix(cursor, base_price: int) -> int:
    """
    Find the lowest available suffix slot among pending payments.

    Returns a number 1-999 that isn't currently used by any pending payment.
    This ensures we can scale to millions of total payments while only
    needing unique amounts among concurrent pending payments.
    """
    # Get all suffixes currently in use by pending payments
    cursor.execute("""
        SELECT amount FROM pending_payments
        WHERE status = 'pending'
    """)

    used_suffixes = set()
    for (amount,) in cursor.fetchall():
        # Extract suffix: (amount - base_price) / AMOUNT_INCREMENT
        suffix = (amount - base_price) // AMOUNT_INCREMENT
        if 1 <= suffix <= MAX_SUFFIX_SLOTS:
            used_suffixes.add(suffix)

    # Find lowest available slot (1-999)
    for slot in range(1, MAX_SUFFIX_SLOTS + 1):
        if slot not in used_suffixes:
            return slot

    # Fallback: all 999 slots are in use (extremely unlikely)
    # Use a random slot - collision will require manual resolution
    import random
    return random.randint(1, MAX_SUFFIX_SLOTS)


def calculate_unique_amount(suffix: int, base_price: int) -> int:
    """
    Calculate unique payment amount based on suffix slot.

    suffix=1 -> $19.001, suffix=2 -> $19.002, etc.
    Suffix is 1-999, allowing up to 999 concurrent pending payments.
    """
    return base_price + (suffix * AMOUNT_INCREMENT)

# Payment expiry time
PAYMENT_EXPIRY_HOURS = 24

# Treasury address index (first derived address)
TREASURY_ADDRESS_INDEX = 0

# Support email
SUPPORT_EMAIL = os.getenv("SUPPORT_EMAIL", "support@yourdomain.com")

# Approximate gas for ERC20 transfer
ERC20_TRANSFER_GAS = 65000


def get_seed_phrase() -> str:
    """Get seed phrase from environment variable."""
    seed = os.getenv("WALLET_SEED_PHRASE")
    if not seed:
        raise ValueError("WALLET_SEED_PHRASE environment variable not set")
    return seed


def derive_address(seed_phrase: str, index: int) -> Tuple[str, str]:
    """
    Derive an Ethereum address from seed phrase using BIP-44 path.

    Returns:
        Tuple of (address, private_key)
    """
    # BIP-44 path: m/44'/60'/0'/0/{index}
    account = Account.from_mnemonic(
        seed_phrase,
        account_path=f"m/44'/60'/0'/0/{index}"
    )
    return account.address, account.key.hex()


def get_treasury_address() -> str:
    """Get the treasury address (index 0 of the seed)."""
    seed_phrase = get_seed_phrase()
    address, _ = derive_address(seed_phrase, TREASURY_ADDRESS_INDEX)
    return address


def get_gas_estimate(chain: str) -> dict:
    """
    Get gas estimate for an ERC20 transfer on the specified chain.

    Returns dict with gas_price_gwei, gas_limit, estimated_cost_eth, estimated_cost_usd
    """
    chain_config = CHAINS.get(chain)
    if not chain_config:
        return {"error": "Unknown chain"}

    gas_price_gwei = chain_config["gas_price_gwei"]
    gas_limit = ERC20_TRANSFER_GAS

    # Calculate cost in ETH
    cost_wei = gas_price_gwei * 1e9 * gas_limit
    cost_eth = cost_wei / 1e18

    # Rough ETH price estimate (could fetch from API for accuracy)
    eth_price_usd = 3000  # Approximate

    return {
        "gas_price_gwei": gas_price_gwei,
        "gas_limit": gas_limit,
        "estimated_cost_eth": round(cost_eth, 8),
        "estimated_cost_usd": round(cost_eth * eth_price_usd, 4),
    }


def build_eip681_uri(address: str, chain: str, token: TokenType, amount: int) -> str:
    """
    Build an EIP-681 payment URI for QR code.

    Format: ethereum:<token_address>@<chain_id>/transfer?address=<recipient>&uint256=<amount>
    """
    chain_config = CHAINS.get(chain)
    if not chain_config:
        return f"ethereum:{address}"

    token_address = chain_config.get(token.value)
    if not token_address:
        return f"ethereum:{address}"

    chain_id = chain_config["chain_id"]

    # EIP-681 format for ERC20 transfer
    uri = f"ethereum:{token_address}@{chain_id}/transfer?address={address}&uint256={amount}"
    return uri


def init_payment_tables(db_path: Path) -> None:
    """Initialize payment-related tables with migration support."""
    with sqlite3.connect(db_path) as conn:
        cursor = conn.cursor()

        # Check if table exists and get its schema
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='pending_payments'")
        table_exists = cursor.fetchone() is not None

        if table_exists:
            # Check if we need to migrate (old schema has address_index column)
            cursor.execute("PRAGMA table_info(pending_payments)")
            columns = {row[1] for row in cursor.fetchall()}

            if 'address_index' in columns:
                # Migration needed: old schema -> new schema
                logger.info("Migrating pending_payments table to treasury-direct schema...")

                # Expire all old pending payments (they used unique addresses)
                cursor.execute("""
                    UPDATE pending_payments
                    SET status = 'expired'
                    WHERE status = 'pending'
                """)

                # Create new table with updated schema
                cursor.execute("""
                    CREATE TABLE pending_payments_new (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL REFERENCES users(id),
                        amount INTEGER NOT NULL,
                        token TEXT NOT NULL DEFAULT 'usdc' CHECK (token IN ('usdc', 'usdt')),
                        chain TEXT NOT NULL,
                        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'expired')),
                        tx_hash TEXT,
                        treasury_balance_before INTEGER,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        expires_at TIMESTAMP NOT NULL
                    )
                """)

                # Copy data from old table (preserve history)
                cursor.execute("""
                    INSERT INTO pending_payments_new
                    (id, user_id, amount, token, chain, status, tx_hash, created_at, expires_at)
                    SELECT id, user_id, amount, token, chain,
                           CASE WHEN status = 'swept' THEN 'confirmed' ELSE status END,
                           tx_hash, created_at, expires_at
                    FROM pending_payments
                """)

                # Drop old table and rename new one
                cursor.execute("DROP TABLE pending_payments")
                cursor.execute("ALTER TABLE pending_payments_new RENAME TO pending_payments")

                logger.info("Migration complete.")
        else:
            # Create new table with treasury-direct schema
            cursor.execute("""
                CREATE TABLE pending_payments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL REFERENCES users(id),
                    amount INTEGER NOT NULL,
                    token TEXT NOT NULL DEFAULT 'usdc' CHECK (token IN ('usdc', 'usdt')),
                    chain TEXT NOT NULL,
                    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'expired')),
                    tx_hash TEXT,
                    treasury_balance_before INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP NOT NULL
                )
            """)

        # Create/recreate indexes
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_pending_payments_status
            ON pending_payments(status)
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_pending_payments_user_status
            ON pending_payments(user_id, status)
        """)

        conn.commit()


def create_payment(
    db_path: Path,
    user_id: int,
    chain: str = "base",
    token: TokenType = TokenType.USDC
) -> PaymentInfo:
    """
    Create a new pending payment for a user.

    All payments go to the single treasury address. Payments are differentiated
    by unique amounts: $X.001, $X.002, $X.003, etc.

    Returns payment info with the treasury address and unique amount.
    """
    if chain not in CHAINS:
        raise ValueError(f"Unsupported chain: {chain}")

    chain_config = CHAINS[chain]
    token_address = chain_config.get(token.value)
    if not token_address:
        raise ValueError(f"Token {token.value.upper()} not available on {chain}")

    with sqlite3.connect(db_path) as conn:
        cursor = conn.cursor()

        # Always expire any existing pending payments for this user
        # This ensures "Generate Payment" always creates a fresh payment with current price
        cursor.execute("""
            UPDATE pending_payments
            SET status = 'expired'
            WHERE user_id = ? AND status = 'pending'
        """, (user_id,))

        # Get treasury address and current balance
        treasury_address = get_treasury_address()
        treasury_balance = check_token_balance(treasury_address, chain, token)
        base_price = get_pro_price()

        # Find available suffix slot (1-999) among current pending payments
        suffix = find_available_suffix(cursor, base_price)
        unique_amount = calculate_unique_amount(suffix, base_price)

        # Create payment record
        now = _utc_now()
        expires_at = now + timedelta(hours=PAYMENT_EXPIRY_HOURS)

        cursor.execute("""
            INSERT INTO pending_payments
            (user_id, amount, token, chain, treasury_balance_before, expires_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (user_id, unique_amount, token.value, chain, treasury_balance, expires_at.isoformat()))

        payment_id = cursor.lastrowid
        conn.commit()

    return PaymentInfo(
        id=payment_id,
        user_id=user_id,
        address=treasury_address,
        amount=unique_amount,
        token=token,
        chain=chain,
        status=PaymentStatus.PENDING,
        created_at=now,
        expires_at=expires_at,
    )


def check_token_balance(address: str, chain: str, token: TokenType) -> int:
    """
    Check token balance for an address on specified chain.

    Returns balance in smallest unit (6 decimals).
    """
    chain_config = CHAINS.get(chain)
    if not chain_config:
        raise ValueError(f"Unsupported chain: {chain}")

    token_address = chain_config.get(token.value)
    if not token_address:
        return 0

    try:
        w3 = Web3(Web3.HTTPProvider(chain_config["rpc"]))
        contract = w3.eth.contract(
            address=Web3.to_checksum_address(token_address),
            abi=ERC20_ABI
        )
        balance = contract.functions.balanceOf(
            Web3.to_checksum_address(address)
        ).call()
        return balance
    except Exception as e:
        print(f"Error checking balance: {e}")
        return 0


def verify_payment(db_path: Path, payment_id: int) -> Tuple[bool, str]:
    """
    Verify if a payment has been received at the treasury address.

    Checks if treasury balance increased by the expected unique amount.
    No sweeping needed - funds go directly to treasury.

    Returns:
        Tuple of (is_paid, message)
    """
    with sqlite3.connect(db_path) as conn:
        cursor = conn.cursor()

        cursor.execute("""
            SELECT user_id, amount, token, chain, status, expires_at, treasury_balance_before
            FROM pending_payments
            WHERE id = ?
        """, (payment_id,))

        row = cursor.fetchone()
        if not row:
            return False, "Payment not found"

        user_id, expected_amount, token_str, chain, status, expires_at, balance_before = row
        token = TokenType(token_str)

        if status == "confirmed":
            return True, "Payment already confirmed"

        expires_dt = _parse_datetime(expires_at)
        if status == "expired" or expires_dt < _utc_now():
            cursor.execute("""
                UPDATE pending_payments SET status = 'expired' WHERE id = ?
            """, (payment_id,))
            conn.commit()
            return False, "Payment expired. Contact support for late payments."

        # Check treasury balance
        treasury_address = get_treasury_address()
        current_balance = check_token_balance(treasury_address, chain, token)

        # Check if payment received (balance increased by at least the expected amount)
        balance_before = balance_before or 0
        if current_balance >= balance_before + expected_amount:
            # Payment received! Update status
            cursor.execute("""
                UPDATE pending_payments
                SET status = 'confirmed'
                WHERE id = ?
            """, (payment_id,))
            conn.commit()
            return True, "Payment confirmed"

        # Calculate how much we're still waiting for
        amount_display = expected_amount / 1_000_000
        return False, f"Waiting for ${amount_display:.3f} {token.value.upper()}"


def get_pending_payment(db_path: Path, user_id: int) -> Optional[PaymentInfo]:
    """Get pending payment for a user if exists."""
    with sqlite3.connect(db_path) as conn:
        cursor = conn.cursor()

        cursor.execute("""
            SELECT id, amount, token, chain, status, created_at, expires_at, tx_hash
            FROM pending_payments
            WHERE user_id = ? AND status = 'pending' AND expires_at > ?
            ORDER BY created_at DESC
            LIMIT 1
        """, (user_id, _utc_now().isoformat()))

        row = cursor.fetchone()

    if not row:
        return None

    # Always return treasury address (all payments go to same address)
    treasury_address = get_treasury_address()

    return PaymentInfo(
        id=row[0],
        user_id=user_id,
        address=treasury_address,
        amount=row[1],
        token=TokenType(row[2]),
        chain=row[3],
        status=PaymentStatus(row[4]),
        created_at=_parse_datetime(row[5]),
        expires_at=_parse_datetime(row[6]),
        tx_hash=row[7],
    )


def format_amount_display(amount: int, token: TokenType = TokenType.USDC) -> str:
    """Format token amount for display with 3 decimal places for unique amounts."""
    return f"${amount / 1_000_000:.3f} {token.value.upper()}"


def get_supported_tokens(chain: str) -> List[str]:
    """Get list of supported tokens for a chain."""
    chain_config = CHAINS.get(chain, {})
    tokens = []
    if chain_config.get("usdc"):
        tokens.append("usdc")
    if chain_config.get("usdt"):
        tokens.append("usdt")
    return tokens


def get_price_usd() -> float:
    """Get the pro price in USD for frontend display."""
    return PRO_PRICE / 1_000_000
