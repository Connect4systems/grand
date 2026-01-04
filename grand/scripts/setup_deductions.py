import frappe


def create_doctype_if_missing(name, module, fields, istable=0):
    if frappe.db.exists("DocType", name):
        return

    doctype = frappe.get_doc({
        "doctype": "DocType",
        "name": name,
        "module": module,
        "custom": 1,
        "istable": istable,
        "fields": fields,
    })
    doctype.insert()


def create_custom_field_if_missing(dt, fieldname, label, fieldtype, options=None, insert_after=None):
    cf_name = f"{dt}-{fieldname}"
    if frappe.db.exists("Custom Field", {"dt": dt, "fieldname": fieldname}):
        return

    data = {
        "doctype": "Custom Field",
        "dt": dt,
        "fieldname": fieldname,
        "label": label,
        "fieldtype": fieldtype,
        "insert_after": insert_after or "items",
    }
    if options:
        data["options"] = options

    frappe.get_doc(data).insert()


def create_all():
    """Create Deduction doctypes and Sales Invoice custom fields if missing.

    Run with:
      bench --site <site> execute grand.grand.scripts.setup_deductions.create_all
    """
    # Deduction doctype (child table)
    deduction_fields = [
        {"fieldname": "account", "fieldtype": "Link", "label": "Account", "options": "Account", "reqd": 1},
        {"fieldname": "percent", "fieldtype": "Percent", "label": "Percent"},
        {"fieldname": "value", "fieldtype": "Float", "label": "Value", "read_only": 1},
    ]
    create_doctype_if_missing("Deduction", "Grand", deduction_fields, istable=1)

    # Deduction Table doctype (alternate child table)
    dt_fields = [
        {"fieldname": "account", "fieldtype": "Link", "label": "Account", "options": "Account", "reqd": 1},
        {"fieldname": "description", "fieldtype": "Data", "label": "Description"},
        {"fieldname": "cost_center", "fieldtype": "Link", "label": "Cost Center", "options": "Cost Center"},
        {"fieldname": "amount", "fieldtype": "Float", "label": "Amount", "reqd": 1},
    ]
    create_doctype_if_missing("Deduction Table", "Grand", dt_fields, istable=1)

    # Custom fields on Sales Invoice
    create_custom_field_if_missing("Sales Invoice", "deductions", "Deductions", "Table", options="Deduction", insert_after="items")
    create_custom_field_if_missing("Sales Invoice", "deduction_table", "Deduction Table", "Table", options="Deduction Table", insert_after="deductions")
    # Additional fields to support contractor deductions and templates
    create_custom_field_if_missing("Sales Invoice", "selling_deductions_template", "Selling Deductions Template", "Link", options="Selling Deductions Template", insert_after="deduction_table")
    create_custom_field_if_missing("Sales Invoice", "contractor_order", "A Contractor Order?", "Check", insert_after="selling_deductions_template")
    create_custom_field_if_missing("Sales Invoice", "sect_totals", "", "Section Break", insert_after="contractor_order")
    create_custom_field_if_missing("Sales Invoice", "base_total_deductions", "Base Total Deductions", "Currency", insert_after="sect_totals")
    create_custom_field_if_missing("Sales Invoice", "total_deductions", "Total Deductions", "Currency", insert_after="base_total_deductions")

    frappe.db.commit()
