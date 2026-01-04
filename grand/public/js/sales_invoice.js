frappe.ui.form.on("Sales Invoice", {
    refresh: function(frm) {
        if (frm.doc.docstatus === 1 && frm.doc.contractor_order && frm.doc.deductions) {
            frm.add_custom_button(__("Deduction Entry"), () => {
                frm.events.create_deduction_entry(frm);
            }, __("Create"));
        }
    },

    create_deduction_entry: function(frm) {
        frappe.model.open_mapped_doc({
            method: "contractor.contractor_app.doctype.clearence.clearence.create_a_payment",
            frm: frm
        });
    },

    selling_deductions_template: function(frm) {
        if (frm.doc.selling_deductions_template) {
            return frm.call({
                method: "contractor.www.api.get_deductions",
                args: {
                    master_doctype: frappe.meta.get_docfield(
                        frm.doc.doctype,
                        "selling_deductions_template",
                        frm.doc.name
                    ).options,
                    master_name: frm.doc.selling_deductions_template
                },
                callback: function(r) {
                    if (!r.exc) {
                        if (frm.doc.deductions && frm.doc.deductions.length) {
                            for (let ded of (r.message || [])) {
                                frm.add_child("deductions", ded);
                            }
                            frm.refresh_field("deductions");
                        } else {
                            frm.set_value("deductions", r.message || []);
                        }
                    }
                }
            });
        }
    }
});

frappe.ui.form.on("Deduction", {
    percent: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];

        const percent = flt(row.percent);
        const total = flt(frm.doc.rounded_total);

        frappe.model.set_value(
            cdt,
            cdn,
            "value",
            (percent * total) / 100
        );
    }
});
