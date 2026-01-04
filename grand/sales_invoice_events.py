import frappe
from frappe.utils import flt


def create_journal_entry_from_deductions(doc, method=None):
    """Create a Journal Entry on Sales Invoice submit from deduction child tables.

    - Reads `deductions` (percent/value) and `deduction_table` (amount) child tables.
    - For each row creates a debit to the deduction `account` and a credit to
      the Sales Invoice `debit_to` (receivable) account, preserving cost_center.
    """
    if not (getattr(doc, "deductions", None) or getattr(doc, "deduction_table", None)):
        return

    company = doc.company
    posting_date = getattr(doc, "posting_date", None) or frappe.utils.nowdate()
    receivable_account = getattr(doc, "debit_to", None)
    if not receivable_account:
        frappe.log_error(message=f"Sales Invoice {doc.name} has no receivable account (debit_to). JE not created.", title=f"Sales Invoice {doc.name}")
        return

    # If receivable/payable account is the Arabic receivables account, require party info
    if receivable_account and ("مدينون - G" in receivable_account or "مدينون" in receivable_account):
        # Auto-fill party fields from standard Sales Invoice `customer` when possible
        if not getattr(doc, "party_type", None) and getattr(doc, "customer", None):
            setattr(doc, "party_type", "Customer")
        if not getattr(doc, "party", None) and getattr(doc, "customer", None):
            setattr(doc, "party", getattr(doc, "customer"))

        if not getattr(doc, "party_type", None) or not getattr(doc, "party", None):
            frappe.throw("Party Type and Party are required when Receivable/Payable account is 'مدينون - G'")

    accounts = []

    # process percent-based deductions (child table `Deduction`)
    for row in getattr(doc, "deductions", []) or []:
        try:
            value = flt(row.value, 2) if row.value else flt((flt(row.percent, 2) * flt(doc.rounded_total, 2) / 100.0), 2)
        except Exception:
            value = 0.0
        if not value:
            continue
        accounts.append({
            # Build deduction credit lines and a single customer receivable debit for the total
            accounts = []
            total_deductions = 0.0

            # process percent-based deductions (child table `Deduction`)
            for row in getattr(doc, "deductions", []) or []:
                try:
                    value = flt(row.value, 2) if row.value else flt((flt(row.percent, 2) * flt(doc.rounded_total, 2) / 100.0), 2)
                except Exception:
                    value = 0.0
                if not value:
                    continue
                total_deductions = flt(total_deductions + value, 2)
                accounts.append({
                    "account": row.account,
                    "debit": 0.0,
                    "credit": value,
                    "cost_center": getattr(row, "cost_center", None) or getattr(doc, "cost_center", None),
                    "project": getattr(row, "project", None) or getattr(doc, "project", None)
                })

            # process free-form deduction table (child table `Deduction Table`)
            for row in getattr(doc, "deduction_table", []) or []:
                try:
                    amt = flt(row.amount, 2)
                except Exception:
                    try:
                        amt = flt(float(row.amount))
                    except Exception:
                        amt = 0.0
                if not amt:
                    continue
                total_deductions = flt(total_deductions + amt, 2)
                accounts.append({
                    "account": row.account,
                    "debit": 0.0,
                    "credit": amt,
                    "cost_center": getattr(row, "cost_center", None) or getattr(doc, "cost_center", None),
                    "project": getattr(row, "project", None) or getattr(doc, "project", None)
                })

            # No deductions => nothing to do
            if not accounts:
                return

            # Add a single receivable (customer) debit for the total of deductions
            accounts.append({
                "account": receivable_account,
                "debit": total_deductions,
                "credit": 0.0,
                "cost_center": getattr(doc, "cost_center", None),
                "project": getattr(doc, "project", None),
                "party_type": getattr(doc, "party_type", None),
                "party": getattr(doc, "party", None)
            })

            # Validate lines: no line can have both debit and credit zero
            for a in accounts:
                if flt(a.get("debit", 0.0), 2) == 0.0 and flt(a.get("credit", 0.0), 2) == 0.0:
                    frappe.throw("Journal Entry lines cannot have both Debit and Credit as zero")

            # Validate totals
            total_debit = flt(sum([flt(a.get("debit", 0.0), 2) for a in accounts]), 2)
            total_credit = flt(sum([flt(a.get("credit", 0.0), 2) for a in accounts]), 2)
            if total_debit == 0.0 or total_credit == 0.0:
                frappe.throw("Both total Debit and Credit must be non-zero for deductions Journal Entry")
            if abs(total_debit - total_credit) > 0.01:
                frappe.throw(f"Total Debit ({total_debit}) and Credit ({total_credit}) do not balance for deductions Journal Entry")

    je = frappe.get_doc({
        "doctype": "Journal Entry",
        "voucher_type": "Journal Entry",
        "company": company,
        "posting_date": posting_date,
        "user_remark": f"Deductions for Sales Invoice {doc.name}",
        "accounts": accounts
    })

    je.insert()
    try:
        je.submit()
    except Exception:
        # if submit fails due to permissions, leave as Draft and log
        frappe.log_error(message=f"Failed to submit JE {je.name} for Sales Invoice {doc.name}")
