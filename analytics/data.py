"""Load store data from MongoDB into pandas.

Conventions (match the shop's schemas):
- prices are integers in the smallest unit (paise); never floats.
- every order item snapshots name/category/unitPrice + quantity.
- all timestamps are UTC; createdAt always exists on orders.
"""

from datetime import datetime, timezone

import pandas as pd
from pymongo import MongoClient
from pymongo.collection import Collection

from .config import MONGODB_URI, db_name


def get_client(uri: str = MONGODB_URI) -> MongoClient:
    return MongoClient(uri)


def get_collections(client: MongoClient):
    db = client[db_name()]
    return {
        "users": db["users"],
        "products": db["products"],
        "orders": db["orders"],
        "carts": db["carts"],
        "events": db["events"],
    }


def load_orders(
    orders: Collection,
    *,
    include_synthetic: bool = True,
    statuses: tuple[str, ...] = ("placed",),
) -> pd.DataFrame:
    """One row per order *item* (basket grain): order + item columns flattened."""
    query: dict = {}
    if statuses:
        query["status"] = {"$in": list(statuses)}
    if not include_synthetic:
        query["isSynthetic"] = {"$ne": True}
    docs = list(orders.find(query))
    rows = []
    for o in docs:
        created = o.get("createdAt")
        if isinstance(created, datetime) and created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        for it in o.get("items", []):
            rows.append(
                {
                    "orderId": str(o["_id"]),
                    "userId": str(o.get("userId")),
                    "status": o.get("status"),
                    "isSynthetic": bool(o.get("isSynthetic", False)),
                    "createdAt": created,
                    "productId": str(it.get("productId")),
                    "name": it.get("name"),
                    "category": it.get("category"),
                    "unitPrice": int(it.get("unitPrice", 0)),
                    "quantity": int(it.get("quantity", 0)),
                }
            )
    df = pd.DataFrame(rows)
    if not df.empty:
        df["createdAt"] = pd.to_datetime(df["createdAt"], utc=True)
        df["lineTotal"] = df["unitPrice"] * df["quantity"]
    return df


def load_users(users: Collection, *, include_synthetic: bool = True) -> pd.DataFrame:
    query: dict = {} if include_synthetic else {"isSynthetic": {"$ne": True}}
    docs = list(users.find(query))
    rows = [
        {
            "userId": str(u["_id"]),
            "name": u.get("name"),
            "email": u.get("email"),
            "role": u.get("role", "customer"),
            "isSynthetic": bool(u.get("isSynthetic", False)),
            "persona": u.get("persona"),
            "createdAt": u.get("createdAt"),
        }
        for u in docs
    ]
    df = pd.DataFrame(rows)
    if not df.empty:
        df["createdAt"] = pd.to_datetime(df["createdAt"], utc=True)
    return df


def load_products(products: Collection) -> pd.DataFrame:
    docs = list(products.find({"isActive": True}))
    rows = [
        {
            "productId": str(p["_id"]),
            "_id": p["_id"],
            "name": p.get("name"),
            "category": p.get("category"),
            "price": int(p.get("price", 0)),
        }
        for p in docs
    ]
    return pd.DataFrame(rows)


def load_events(
    events: Collection,
    *,
    include_synthetic: bool = True,
    types: tuple[str, ...] | None = None,
) -> pd.DataFrame:
    """One row per behavioral event. Purchases are NOT events — join orders."""
    query: dict = {}
    if not include_synthetic:
        query["isSynthetic"] = {"$ne": True}
    if types:
        query["type"] = {"$in": list(types)}
    docs = list(events.find(query))
    rows = [
        {
            "eventId": str(e["_id"]),
            "userId": str(e["userId"]) if e.get("userId") else None,
            "sessionId": e.get("sessionId"),
            "type": e.get("type"),
            "productId": str(e["productId"]) if e.get("productId") else None,
            "category": e.get("category"),
            "unitPrice": e.get("unitPrice"),
            "quantity": e.get("quantity"),
            "searchTerm": e.get("searchTerm"),
            "isSynthetic": bool(e.get("isSynthetic", False)),
            "createdAt": e.get("createdAt"),
        }
        for e in docs
    ]
    df = pd.DataFrame(rows)
    if not df.empty:
        df["createdAt"] = pd.to_datetime(df["createdAt"], utc=True)
    return df
