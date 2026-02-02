"""
Test UI with Playwright to diagnose white screen issue
"""
from playwright.sync_api import sync_playwright
import time

def test_ui():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Set up console message handler
        console_messages = []
        page.on("console", lambda msg: console_messages.append(f"[{msg.type}] {msg.text}"))

        # Set up error handler
        page_errors = []
        page.on("pageerror", lambda err: page_errors.append(str(err)))

        # Navigate to the app
        print("Navigating to http://localhost:5173...")
        try:
            response = page.goto("http://localhost:5173/", wait_until="networkidle", timeout=10000)
            print(f"Page loaded with status: {response.status}")
        except Exception as e:
            print(f"Error loading page: {e}")
            browser.close()
            return

        # Wait a bit for React to render
        page.wait_for_timeout(2000)

        # Take screenshot
        page.screenshot(path="screenshot.png")
        print("Screenshot saved to screenshot.png")

        # Get page content
        html = page.content()
        print(f"\n=== HTML LENGTH: {len(html)} ===")

        # Check for React root
        root = page.query_selector("#root")
        if root:
            root_html = root.inner_html()
            print(f"\n=== ROOT CONTENT LENGTH: {len(root_html)} ===")
            if len(root_html) < 100:
                print(f"Root content: {root_html}")
        else:
            print("ERROR: #root element not found!")

        # Check for specific elements
        print("\n=== CHECKING FOR KEY ELEMENTS ===")
        header = page.query_selector("header")
        print(f"Header found: {header is not None}")

        nav = page.query_selector("nav")
        print(f"Nav found: {nav is not None}")

        main = page.query_selector("main")
        print(f"Main found: {main is not None}")

        # Get visible text
        body_text = page.locator("body").inner_text()
        print(f"\n=== VISIBLE TEXT (first 500 chars) ===")
        print(body_text[:500])

        # Print console messages
        print(f"\n=== CONSOLE MESSAGES ({len(console_messages)}) ===")
        for msg in console_messages:
            print(msg)

        # Print errors
        print(f"\n=== PAGE ERRORS ({len(page_errors)}) ===")
        for err in page_errors:
            print(err)

        # Check for 404 errors in network
        print("\n=== CHECKING FOR 404 ERRORS ===")

        browser.close()
        print("\nTest complete!")

if __name__ == "__main__":
    test_ui()
