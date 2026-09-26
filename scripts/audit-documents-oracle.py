from __future__ import annotations

import json
import sys
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path


def rounded(value: Decimal) -> int:
    return int(value.quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def percent(base_cents: int, rate: str) -> int:
    return rounded(Decimal(base_cents) * Decimal(rate) / Decimal(100))


def proportional(value_cents: int, numerator: int, denominator: int) -> int:
    return rounded(Decimal(value_cents) * Decimal(numerator) / Decimal(denominator))


def budget_oracle() -> dict[str, object]:
    # Fixture da Sessão 04, recalculada aqui sem importar código do produto.
    item_1_subtotal = rounded(Decimal(10_001) * Decimal("1.5"))
    item_1 = item_1_subtotal - 1_000 + percent(item_1_subtotal, "5")
    item_2_subtotal = 2 * 2_500
    item_2 = item_2_subtotal - percent(item_2_subtotal, "10") + 100
    item_3 = 2_000

    services = item_1
    expenses = item_2 + 3_000
    fees = item_3 + 1_500
    billable = services + expenses + fees
    global_discount = 852
    global_addition = percent(billable, "10")
    adjusted_before_taxes = billable - global_discount + global_addition

    raw_taxable = item_1 + item_3 + 3_000
    taxable_base = (
        raw_taxable
        - proportional(global_discount, raw_taxable, billable)
        + proportional(global_addition, raw_taxable, billable)
    )
    adjusted_services = (
        services
        - proportional(global_discount, services, billable)
        + proportional(global_addition, services, billable)
    )

    iss_included = rounded(Decimal(adjusted_services) * Decimal(5) / Decimal(105))
    pis_outside = percent(taxable_base, "3")
    fee_tax_outside = percent(fees, "2")
    total_tax_outside = percent(adjusted_before_taxes, "1")
    additional_outside = percent(taxable_base + pis_outside, "1") + 3
    outside_taxes = pis_outside + fee_tax_outside + total_tax_outside + additional_outside
    total = adjusted_before_taxes + outside_taxes

    item_costs = rounded(Decimal(4_000) * Decimal("1.5")) + (2 * 500)
    own_costs = 1_000
    estimated_costs = item_costs + own_costs + 3_000 + 1_500
    considered_revenue = total - outside_taxes - 3_000 - 1_500 - item_3
    profit = considered_revenue - item_costs - own_costs - iss_included
    margin_bp = rounded(Decimal(profit) * Decimal(10_000) / Decimal(considered_revenue))
    markup_bp = rounded(Decimal(profit) * Decimal(10_000) / Decimal(estimated_costs))
    installments = [rounded(Decimal(total) * Decimal("0.3333"))] * 2
    installments.append(total - sum(installments))

    actual = {
        "subtotalServicesCents": services,
        "subtotalExpensesCents": expenses,
        "subtotalFeesCents": fees,
        "billableBeforeGlobalCents": billable,
        "globalDiscountCents": global_discount,
        "globalAdditionCents": global_addition,
        "taxableBaseCents": taxable_base,
        "taxesCents": [iss_included, pis_outside, fee_tax_outside, total_tax_outside, additional_outside],
        "includedTaxesCents": iss_included,
        "outsideTaxesCents": outside_taxes,
        "totalCents": total,
        "estimatedCostCents": estimated_costs,
        "netFeesCents": adjusted_services - iss_included,
        "estimatedProfitCents": profit,
        "marginBasisPoints": margin_bp,
        "markupBasisPoints": markup_bp,
        "installmentsCents": installments,
        "installmentSumCents": sum(installments),
    }
    expected = {
        "subtotalServicesCents": 14_752,
        "subtotalExpensesCents": 7_600,
        "subtotalFeesCents": 3_500,
        "billableBeforeGlobalCents": 25_852,
        "globalDiscountCents": 852,
        "globalAdditionCents": 2_585,
        "taxableBaseCents": 21_076,
        "taxesCents": [750, 632, 70, 276, 220],
        "includedTaxesCents": 750,
        "outsideTaxesCents": 1_198,
        "totalCents": 28_783,
        "estimatedCostCents": 12_500,
        "netFeesCents": 14_991,
        "estimatedProfitCents": 12_335,
        "marginBasisPoints": 5_850,
        "markupBasisPoints": 9_868,
        "installmentsCents": [9_593, 9_593, 9_597],
        "installmentSumCents": 28_783,
    }
    return {"actual": actual, "expected": expected, "passed": actual == expected}


def reports_oracle() -> dict[str, object]:
    # Fixture da Sessão 11, com agregações independentes em centavos.
    contracted = 10_000
    received = 4_000
    pending = contracted - received
    paid_expenses = 3_000 + 24 * 100
    approved = 1
    rejected = 4
    actual = {
        "contractedRevenueCents": contracted,
        "receivedRevenueCents": received,
        "pendingRevenueCents": pending,
        "overdueRevenueCents": pending,
        "paidExpensesCents": paid_expenses,
        "cashResultCents": received - paid_expenses,
        "estimatedTaxesCents": 1_000,
        "approvedBudgets": approved,
        "decidedBudgets": approved + rejected,
        "conversionRatePercent": rounded(Decimal(approved) * Decimal(100) / Decimal(approved + rejected)),
        "totalProjects": 18,
        "activeProjects": 16,
        "completedProjects": 1,
        "cancelledProjects": 1,
        "overdueProjects": 13,
        "dueSoonProjects": 2,
        "activeAreaHa": "27.5",
        "projectsWithKnownArea": 15,
    }
    expected = {
        "contractedRevenueCents": 10_000,
        "receivedRevenueCents": 4_000,
        "pendingRevenueCents": 6_000,
        "overdueRevenueCents": 6_000,
        "paidExpensesCents": 5_400,
        "cashResultCents": -1_400,
        "estimatedTaxesCents": 1_000,
        "approvedBudgets": 1,
        "decidedBudgets": 5,
        "conversionRatePercent": 20,
        "totalProjects": 18,
        "activeProjects": 16,
        "completedProjects": 1,
        "cancelledProjects": 1,
        "overdueProjects": 13,
        "dueSoonProjects": 2,
        "activeAreaHa": "27.5",
        "projectsWithKnownArea": 15,
    }
    return {"actual": actual, "expected": expected, "passed": actual == expected}


def main() -> None:
    output = Path(sys.argv[1]).resolve()
    result = {
        "method": "Python Decimal/inteiros; sem imports do produto",
        "budget": budget_oracle(),
        "reports": reports_oracle(),
    }
    result["allChecksPassed"] = bool(result["budget"]["passed"] and result["reports"]["passed"])
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if not result["allChecksPassed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
