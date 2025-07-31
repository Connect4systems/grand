import frappe
from frappe.utils import nowdate

def create_stock_entry_from_delivery_sheet(doc, method):
    if not doc.get("custom_delivery_sheet"):
        return

    source_warehouse = ""
    if doc.get("items"):
        first_item = doc.items[0]
        source_warehouse = first_item.warehouse or ""

    if not source_warehouse:
        frappe.throw("⚠️ Source warehouse not set in Delivery Note items.")

    stock_entry = frappe.new_doc("Stock Entry")
    stock_entry.stock_entry_type = "Material Issue"
    stock_entry.company = doc.company
    stock_entry.posting_date = nowdate()

    # Fetch from delivery note
    if getattr(doc, "project", None):
        stock_entry.project = doc.project

    if getattr(doc, "project_inventory", None):
        stock_entry.project_inventory = doc.project_inventory

    for row in doc.custom_delivery_sheet:
        if not row.item_code:
            frappe.throw(f"Missing item_code in delivery sheet row {row.idx}")

        stock_uom = frappe.db.get_value("Item", row.item_code, "stock_uom")
        if not stock_uom:
            frappe.throw(f"Stock UOM not found for item {row.item_code}")

        stock_entry.append("items", {
            "item_code": row.item_code,
            "description": row.description,
            "qty": row.qty or row.stock_qty,
            "uom": stock_uom,
            "stock_uom": stock_uom,
            "s_warehouse": source_warehouse,
            "conversion_factor": 1,
            "basic_rate": 0.0,
            "allow_zero_valuation_rate": 1,
            "project_invintory": getattr(doc, "project", None),
            "project_inventory": getattr(doc, "project_inventory", None)  # ✅ added to each item row
        })

    stock_entry.insert(ignore_permissions=True)
    stock_entry.submit()

    stock_entry.add_comment("Comment", f"Auto-created from Delivery Note {doc.name}")
    frappe.msgprint(f"✅ Stock Entry <b>{stock_entry.name}</b> created from Delivery Note.")
