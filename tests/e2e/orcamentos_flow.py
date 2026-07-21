import asyncio
import json
import re
import urllib.request
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from playwright.async_api import async_playwright, expect


API_URL = "http://127.0.0.1:3191"
WEB_URL = "http://127.0.0.1:5193"
ARTIFACTS = Path("scratch/e2e-orcamentos")


def api_post(path: str, payload: dict):
    request = urllib.request.Request(
        f"{API_URL}{path}",
        data=json.dumps(payload).encode("utf-8"),
        headers={"content-type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request) as response:
        return json.loads(response.read().decode("utf-8"))


def prepare_data():
    api_post("/api/configuracoes", {
        "empresaNome": "SkyGeo E2E",
        "dadosPasta": str(ARTIFACTS.resolve()),
        "adminNome": "Administrador E2E",
        "adminEmail": "admin.e2e@skygeo.local",
        "adminSenha": "teste-e2e-123",
    })
    api_post("/api/clientes", {
        "tipoPessoa": "PF",
        "nome": "Cliente E2E",
        "cpf": "52998224725",
        "celular": "48999999999",
        "email": "cliente.e2e@teste.local",
        "categoria": "Pessoa Física",
        "situacao": "Ativo",
    })


def budget_id_from_url(url: str) -> str:
    return parse_qs(urlparse(url).query)["budgetId"][0]


async def run():
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    prepare_data()

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(channel="msedge", headless=True)
        context = await browser.new_context(
            accept_downloads=True,
            viewport={"width": 1440, "height": 960},
            color_scheme="dark",
        )
        page = await context.new_page()
        console_errors = []
        stage = {"name": "carregamento"}
        page.on(
            "console",
            lambda message: console_errors.append(
                {
                    "stage": stage["name"],
                    "text": message.text,
                    "location": message.location,
                }
            )
            if message.type == "error"
            else None,
        )

        await page.goto(f"{WEB_URL}/orcamentos")
        await page.wait_for_load_state("networkidle")
        await expect(page.get_by_role("heading", name="Orçamentos")).to_be_visible()

        # Proteção contra perda de alterações.
        stage["name"] = "proteção contra descarte"
        await page.get_by_role("button", name="Novo orçamento").first.click()
        await page.locator("#budget-description").fill("Rascunho que não deve ser perdido")
        await page.get_by_role("button", name="Cancelar").click()
        await expect(page.get_by_role("alert")).to_contain_text("alterações não salvas")
        await page.get_by_role("button", name="Continuar editando").click()
        await expect(page.locator("#budget-description")).to_have_value("Rascunho que não deve ser perdido")
        await page.get_by_role("button", name="Cancelar").click()
        await page.get_by_role("button", name="Descartar alterações").click()

        # Validação orientada e criação do rascunho.
        stage["name"] = "criação"
        await page.get_by_role("button", name="Novo orçamento").first.click()
        await page.get_by_role("button", name="Salvar rascunho").click()
        await expect(page.get_by_role("alert").first).to_contain_text("Revise 3 campos")
        await expect(page.locator("#budget-description")).to_be_focused()
        await page.locator("#budget-description").fill("Proposta E2E de levantamento")

        await page.get_by_role("button", name=re.compile(r"Cliente e imóvel")).first.click()
        await page.locator("#budget-client").select_option(label="Cliente E2E")
        await page.get_by_role("button", name=re.compile(r"Itens do orçamento")).first.click()
        await page.get_by_label("Descrição do item 1").fill("Levantamento planialtimétrico cadastral")
        await page.get_by_label("Preço unitário do item 1").fill("1500,00")
        await page.get_by_label("Item 1 tributável").uncheck()
        await expect(page.get_by_label("Item 1 tributável")).not_to_be_checked()
        await page.get_by_role("button", name="Salvar rascunho").click()
        await expect(page.get_by_role("heading", name=re.compile(r"Rascunho.*versão 1"))).to_be_visible(timeout=15_000)
        original_id = budget_id_from_url(page.url)

        # PDF real no navegador.
        stage["name"] = "pdf"
        async with page.expect_download(timeout=20_000) as download_info:
            await page.get_by_role("button", name="Gerar PDF", exact=True).click()
        download = await download_info.value
        assert download.suggested_filename.endswith(".pdf")
        await download.save_as(ARTIFACTS / download.suggested_filename)

        # Edição pela interface.
        stage["name"] = "edição"
        await page.get_by_role("button", name="Editar rascunho", exact=True).click()
        await page.locator("#budget-description").fill("Proposta E2E revisada")
        await page.get_by_role("button", name="Salvar rascunho").click()
        await expect(
            page.get_by_role("dialog").get_by_role(
                "heading", name="Proposta E2E revisada", level=2
            )
        ).to_be_visible(timeout=15_000)

        # Duplicação e exclusão do novo rascunho pela listagem.
        stage["name"] = "duplicação e exclusão"
        await page.get_by_role("button", name="Duplicar", exact=True).click()
        await page.wait_for_function(
            "originalId => new URL(location.href).searchParams.get('budgetId') !== originalId",
            arg=original_id,
            timeout=15_000,
        )
        duplicated_id = budget_id_from_url(page.url)
        assert duplicated_id != original_id
        await page.get_by_label("Fechar modal").click()
        matching_rows = page.locator("tbody tr").filter(has_text="Proposta E2E revisada")
        await expect(matching_rows).to_have_count(2)
        await matching_rows.first.get_by_role("button", name=re.compile(r"Excluir rascunho")).click()
        await page.get_by_role("button", name="Excluir rascunho", exact=True).click()
        await expect(matching_rows).to_have_count(1, timeout=15_000)

        # Emissão, aprovação e efeitos financeiros.
        stage["name"] = "emissão e aprovação"
        await page.goto(f"{WEB_URL}/orcamentos?budgetId={original_id}")
        await page.wait_for_load_state("networkidle")
        await page.get_by_role("button", name="Emitir").click()
        await expect(page.get_by_text("Emitido", exact=True)).to_be_visible(timeout=15_000)
        await page.get_by_role("button", name="Aprovar").click()
        await expect(page.get_by_role("heading", name="Confirmar aprovação e efeitos financeiros")).to_be_visible()
        await page.get_by_role("button", name="Aprovar e gerar efeitos").click()
        await expect(page.get_by_text("Aprovado", exact=True)).to_be_visible(timeout=15_000)
        await expect(page.get_by_text("Parcela 1")).to_be_visible()
        await expect(
            page.get_by_role("dialog", name="Confirmar aprovação e efeitos financeiros")
        ).to_be_hidden(timeout=15_000)

        await page.screenshot(path=ARTIFACTS / "orcamentos-e2e-final.png", full_page=True)
        assert not console_errors, f"Erros no console: {console_errors}"
        await context.close()
        await browser.close()


if __name__ == "__main__":
    asyncio.run(run())
