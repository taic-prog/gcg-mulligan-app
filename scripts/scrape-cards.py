#!/usr/bin/env python3
"""GCG公式サイトからカード情報を全件スクレイピングして card-db.json を生成する"""

import json
import re
import time
import sys
from urllib.request import urlopen, Request
from urllib.parse import urlencode

BASE_URL = "https://www.gundam-gcg.com/jp/cards"
DELAY = 0.4  # サーバー負荷軽減のためリクエスト間隔(秒)

COLOR_MAP = {
    "Blue": "青", "Green": "緑", "Red": "赤", "Purple": "紫", "White": "白",
}
TYPE_MAP = {
    "UNIT": "ユニット", "PILOT": "パイロット", "COMMAND": "コマンド", "BASE": "ベース",
}

PACK_IDS = [
    ("615101", "GD01"), ("615102", "GD02"), ("615103", "GD03"), ("615104", "GD04"),
    ("615001", "ST01"), ("615002", "ST02"), ("615003", "ST03"), ("615004", "ST04"),
    ("615005", "ST05"), ("615006", "ST06"), ("615007", "ST07"), ("615008", "ST08"),
    ("615009", "ST09"),
    ("615000", "リミテッドBOX"), ("615701", "限定商品"), ("615801", "基本カード"), ("615901", "プロモーション"),
]

def fetch(url, data=None):
    headers = {"User-Agent": "Mozilla/5.0"}
    body = urlencode(data).encode() if data else None
    req = Request(url, data=body, headers=headers)
    with urlopen(req, timeout=15) as r:
        return r.read().decode("utf-8", errors="replace")

def get_card_nos_for_pack(pack_id):
    html = fetch(f"{BASE_URL}/index.php", {"package": pack_id})
    nos = re.findall(r'detailSearch=([^"]+)"', html)
    # _p[数字] のパラレル版を除外、ベースカードのみ
    return [n for n in nos if not re.search(r'_p\d+$', n)]

def parse_detail(html):
    def strip_tags(s):
        return re.sub(r'<[^>]+>', '', s).strip()

    h1 = re.search(r'<h1[^>]*>(.*?)</h1>', html, re.DOTALL)
    name = strip_tags(h1.group(1)) if h1 else ""

    fields = {}
    for dt, dd in re.findall(r'<dt[^>]*class="dataTit"[^>]*>(.*?)</dt>\s*<dd[^>]*>(.*?)</dd>', html, re.DOTALL):
        fields[strip_tags(dt)] = strip_tags(dd)

    if not name or not fields:
        return None

    try:
        level = int(fields.get("Lv.", "0"))
    except ValueError:
        level = 0
    try:
        cost = int(fields.get("COST", "0"))
    except ValueError:
        cost = 0

    color_raw = fields.get("色", "")
    type_raw  = fields.get("タイプ", "")

    return {
        "name":     name,
        "cardType": TYPE_MAP.get(type_raw, "ユニット"),
        "color":    COLOR_MAP.get(color_raw, "青"),
        "level":    level,
        "cost":     cost,
        "terrain":  fields.get("地形", ""),
        "feature":  fields.get("特徴", ""),
        "link":     fields.get("リンク", ""),
    }

def main():
    # 全パックからカードNo収集（重複除去）
    all_nos = []
    seen = set()
    print("=== カードNo収集 ===")
    for pack_id, pack_name in PACK_IDS:
        try:
            nos = get_card_nos_for_pack(pack_id)
            new = [n for n in nos if n not in seen]
            seen.update(new)
            all_nos.extend(new)
            print(f"  {pack_name}: {len(nos)}件 (新規 {len(new)}件)")
        except Exception as e:
            print(f"  {pack_name}: ERROR {e}", file=sys.stderr)
        time.sleep(DELAY)

    print(f"\n合計ユニークカード: {len(all_nos)}件")
    print("\n=== カード詳細取得 ===")

    cards = []
    errors = []
    for i, card_no in enumerate(all_nos, 1):
        try:
            html = fetch(f"{BASE_URL}/detail.php?detailSearch={card_no}")
            info = parse_detail(html)
            if info:
                cards.append({"cardNo": card_no, **info})
                if i % 50 == 0 or i == len(all_nos):
                    print(f"  {i}/{len(all_nos)} 完了")
            else:
                errors.append(card_no)
                print(f"  [{i}] {card_no}: パース失敗", file=sys.stderr)
        except Exception as e:
            errors.append(card_no)
            print(f"  [{i}] {card_no}: ERROR {e}", file=sys.stderr)
        time.sleep(DELAY)

    print(f"\n取得成功: {len(cards)}件 / エラー: {len(errors)}件")
    if errors:
        print(f"エラーカード: {errors[:10]}{'...' if len(errors)>10 else ''}")

    # 既存のバージョンを読んで+1
    import os
    out_path = os.path.join(os.path.dirname(__file__), "../public/card-db.json")
    try:
        with open(out_path) as f:
            existing = json.load(f)
        version = existing.get("version", 0) + 1
    except Exception:
        version = 1

    db = {"version": version, "cards": cards}
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(db, f, ensure_ascii=False, indent=2)
    print(f"\n✓ card-db.json を書き出しました (version={version}, {len(cards)}件)")

if __name__ == "__main__":
    main()
