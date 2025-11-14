#!/usr/bin/env python3
"""
Utility to generate short-lived LiveKit JWT access tokens for operational tooling.

Usage:
    LIVEKIT_API_KEY=... LIVEKIT_API_SECRET=... ./scripts/livekit_jwt.py \
        --identity ops-cli --ttl 300
"""
import argparse
import os
import time

import jwt


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate LiveKit JWT access tokens.")
    parser.add_argument(
        "--api-key",
        default=os.getenv("LIVEKIT_API_KEY"),
        required=os.getenv("LIVEKIT_API_KEY") is None,
        help="LiveKit API key (env LIVEKIT_API_KEY).",
    )
    parser.add_argument(
        "--api-secret",
        default=os.getenv("LIVEKIT_API_SECRET"),
        required=os.getenv("LIVEKIT_API_SECRET") is None,
        help="LiveKit API secret (env LIVEKIT_API_SECRET).",
    )
    parser.add_argument(
        "--identity",
        default=os.getenv("LIVEKIT_TOKEN_IDENTITY", "ops-cli"),
        help="Subject/identity for the token.",
    )
    parser.add_argument(
        "--ttl",
        type=int,
        default=int(os.getenv("LIVEKIT_TOKEN_TTL", "300")),
        help="Token lifetime in seconds (default: 300).",
    )
    return parser.parse_args()


def build_claims(api_key: str, identity: str, ttl_seconds: int) -> dict:
    now = int(time.time())
    return {
        "iss": api_key,
        "sub": identity,
        "iat": now,
        "exp": now + ttl_seconds,
        "video": {
            "roomCreate": True,
            "roomAdmin": True,
            "ingressAdmin": True,
            "ingressCreate": True,
        },
    }


def main() -> None:
    args = parse_args()
    claims = build_claims(args.api_key, args.identity, args.ttl)
    token = jwt.encode(claims, args.api_secret, algorithm="HS256")
    print(token)


if __name__ == "__main__":
    main()

