import asyncio
import json
import sys
from pathlib import Path
from urllib.parse import urljoin

from playwright.async_api import async_playwright, expect


async def run(cdp_endpoint: str, artifact_directory: Path) -> None:
    artifact_directory.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as playwright:
        browser = await playwright.chromium.connect_over_cdp(cdp_endpoint)
        context = browser.contexts[0]
        page = context.pages[0]
        console_errors = []
        page.on(
            "console",
            lambda message: console_errors.append(message.text)
            if message.type == "error"
            else None,
        )

        assert await page.title() == "GeoGestor v1.1.1"
        await page.goto(urljoin(page.url, "/orcamentos"))
        await page.wait_for_load_state("networkidle")
        await expect(page.get_by_role("heading", name="Orçamentos", level=1)).to_be_visible()
        await expect(page.get_by_role("button", name="Novo orçamento").first).to_be_visible()
        await expect(page.get_by_text("v1.1.1", exact=True)).to_be_visible()
        await expect(page.get_by_role("region", name="Propostas comerciais")).to_be_visible()

        screenshot = artifact_directory / "desktop-orcamentos-1.1.1.png"
        await page.screenshot(path=screenshot, full_page=True)
        assert not console_errors, f"Erros no console do desktop: {console_errors}"

        report = {
            "title": await page.title(),
            "url": page.url,
            "heading": await page.get_by_role("heading", name="Orçamentos", level=1).inner_text(),
            "version_visible": True,
            "console_errors": console_errors,
            "screenshot": str(screenshot.resolve()),
        }
        (artifact_directory / "report.json").write_text(
            json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        await browser.close()


if __name__ == "__main__":
    asyncio.run(run(sys.argv[1], Path(sys.argv[2])))
