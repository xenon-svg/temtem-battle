import requests
from bs4 import BeautifulSoup
import json
import time

BASE_URL = "https://tem.team/temtem"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}

def get_soup(url):
    try:
        res = requests.get(url, headers=HEADERS, timeout=10)
        res.raise_for_status()
        return BeautifulSoup(res.text, "html.parser")
    except Exception as e:
        print(f"❌ Failed to fetch {url}: {e}")
        return None

def scrape_all_temtems():
    soup = get_soup(BASE_URL)
    if not soup:
        return []

    temtems = []

    for index in range(1,166):
        cards = soup.select("#temtem-%03d"%index)
        print("#temtem-%03d"%index)
        for card in cards:
            try:
                #import pdb; pdb.set_trace()
                name = card.select_one(".name").get_text(strip=True)
                number = card.select_one(".number").get_text(strip=True)
                types = {t['alt']:t['src'] for t in card.select("img")}
                types.pop(name)
                hp = int(card.select_one("td:nth-child(7)").get_text(strip=True))
                techniques = [t.get_text(strip=True) for t in card.select("td.trait")]

                image = card.select_one("img")["src"]

                temtems.append({
                    "name": name,
                    "number": number,
                    "type": types,
                    "hp": hp,
                    "techniques": techniques,
                    "image": image
                })

                print(f"✅ Scraped: {name}")

            except Exception as e:
                print(f"⚠️ Skipped a card due to error: {e}")
                continue

        time.sleep(0.3)  # Be polite to the server

    with open("temtems.json", "w", encoding="utf-8") as f:
        json.dump(temtems, f, indent=2, ensure_ascii=False)

    print(f"\n🎉 Done! Saved {len(temtems)} Temtems to temtems.json")

if __name__ == "__main__":
    scrape_all_temtems()
 

