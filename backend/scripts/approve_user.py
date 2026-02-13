"""Approve a user by email — upgrades them to Pro subscription."""
import argparse
import sys
from pathlib import Path

from backend.api.auth import get_user_by_email, update_subscription, SubscriptionTier

DB_PATH = Path(__file__).parent.parent / "data" / "replays.db"


def main():
    parser = argparse.ArgumentParser(description="Upgrade a user to Pro subscription")
    parser.add_argument("--email", required=True, help="User email to approve")
    args = parser.parse_args()

    if not DB_PATH.exists():
        print(f"Error: database not found at {DB_PATH}")
        sys.exit(1)

    user = get_user_by_email(DB_PATH, args.email)
    if not user:
        print(f"Error: no user found with email '{args.email}'")
        sys.exit(1)

    if user.subscription_tier == SubscriptionTier.PRO:
        print(f"User '{args.email}' is already Pro")
        return

    updated = update_subscription(DB_PATH, user.id, SubscriptionTier.PRO)
    if updated:
        print(f"User '{args.email}' upgraded to Pro")
    else:
        print(f"Error: failed to update user '{args.email}'")
        sys.exit(1)


if __name__ == "__main__":
    main()
