"""
Download SC2 replays from spawningtool.com

Hypotheses to test:
1. The replay list page uses pagination with ?page=N parameter
2. Each replay has a download link in the HTML
3. Download URLs are in format: /replays/{id}/download/ or similar
4. Files are named with replay ID or can be extracted from Content-Disposition header
5. The site may have rate limiting, so we'll add delays between requests
"""
import argparse
import time
from pathlib import Path
import requests
from bs4 import BeautifulSoup
import urllib3

# Disable SSL warnings since spawningtool.com has cert issues
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

BASE_URL = "https://lotv.spawningtool.com"
REPLAY_LIST_URL = f"{BASE_URL}/replays/"


def download_replay(replay_url: str, output_dir: Path, session: requests.Session) -> bool:
    """
    Download a single replay file.

    Returns True if downloaded, False if skipped (already exists)
    """
    try:
        # Extract replay ID from URL (e.g., /12345/ -> 12345)
        replay_id = replay_url.strip('/').split('/')[-1]

        # Construct download URL (hypothesis: it's replay_url + 'download/')
        download_url = f"{BASE_URL}{replay_url}download/"

        print(f"  Replay {replay_id}: ", end="")

        # Try to get filename from page first or use ID
        response = session.get(download_url, verify=False, stream=True, timeout=30)
        response.raise_for_status()

        # Extract filename from Content-Disposition header if available
        filename = None
        if 'Content-Disposition' in response.headers:
            content_disp = response.headers['Content-Disposition']
            if 'filename=' in content_disp:
                filename = content_disp.split('filename=')[-1].strip('"\'')

        # Fallback to replay ID
        if not filename:
            filename = f"replay_{replay_id}.SC2Replay"

        # Ensure .SC2Replay extension
        if not filename.endswith('.SC2Replay'):
            filename += '.SC2Replay'

        output_path = output_dir / filename

        # Skip if already exists
        if output_path.exists():
            print(f"⏭️  Already exists ({filename})")
            return False

        # Download the file
        with open(output_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)

        print(f"✓ Downloaded ({filename})")
        return True

    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def get_replay_links_from_page(page_num: int, session: requests.Session) -> list[str]:
    """
    Extract replay links from a single page of the replay list.

    Hypothesis: Links are in format <a href="/12345/">...</a>
    """
    url = f"{REPLAY_LIST_URL}?p={page_num}" if page_num > 1 else REPLAY_LIST_URL

    try:
        response = session.get(url, verify=False, timeout=30)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, 'html.parser')

        # Hypothesis: Replay links are in the main content area
        # Look for links that match pattern /NNNN/ (numeric ID)
        replay_links = []

        # Try to find replay links (they typically link to /NNNN/ format)
        for link in soup.find_all('a', href=True):
            href = link['href']
            # Match pattern: /NNNN/ where NNNN is digits
            if href.startswith('/') and href.count('/') == 2:
                parts = href.strip('/').split('/')
                if len(parts) == 1 and parts[0].isdigit():
                    replay_links.append(href)

        # Remove duplicates while preserving order
        seen = set()
        unique_links = []
        for link in replay_links:
            if link not in seen:
                seen.add(link)
                unique_links.append(link)

        return unique_links

    except Exception as e:
        print(f"❌ Error fetching page {page_num}: {e}")
        return []


def main():
    parser = argparse.ArgumentParser(
        description="Download SC2 replays from spawningtool.com"
    )
    parser.add_argument(
        "--pages",
        type=int,
        default=5,
        help="Number of pages to download (default: 5)"
    )
    parser.add_argument(
        "--output",
        type=str,
        default="data/replays",
        help="Output directory (default: data/replays)"
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=1.0,
        help="Delay between downloads in seconds (default: 1.0)"
    )

    args = parser.parse_args()

    # Create output directory
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 60)
    print("SC2 REPLAY DOWNLOADER - spawningtool.com")
    print("=" * 60)
    print(f"Pages to download: {args.pages}")
    print(f"Output directory: {output_dir}")
    print(f"Delay between downloads: {args.delay}s")
    print()

    # Create session for connection pooling
    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    })

    total_found = 0
    total_downloaded = 0
    total_skipped = 0

    # Process each page
    for page_num in range(1, args.pages + 1):
        print(f"📄 Page {page_num}/{args.pages}")

        replay_links = get_replay_links_from_page(page_num, session)

        if not replay_links:
            print(f"  ⚠️  No replays found on page {page_num}")
            continue

        print(f"  Found {len(replay_links)} replays")
        total_found += len(replay_links)

        # Download each replay
        for replay_url in replay_links:
            downloaded = download_replay(replay_url, output_dir, session)
            if downloaded:
                total_downloaded += 1
                time.sleep(args.delay)  # Rate limiting
            else:
                total_skipped += 1

        print()

        # Delay between pages
        if page_num < args.pages:
            time.sleep(args.delay * 2)

    # Summary
    print("=" * 60)
    print("DOWNLOAD COMPLETE")
    print("=" * 60)
    print(f"Total replays found: {total_found}")
    print(f"Downloaded: {total_downloaded}")
    print(f"Skipped (already exist): {total_skipped}")
    print(f"Output directory: {output_dir}")
    print("=" * 60)


if __name__ == "__main__":
    main()
