frappe.ui.form.on("Sales Invoice", {
    refresh: function(frm){
        if (frm.doc.docstatus == 1 && frm.doc.contractor_order && (frm.doc.deductions && frm.doc.deductions.length || frm.doc.deduction_table && frm.doc.deduction_table.length)){
            frm.add_custom_button(__('Deduction Entry'), () => {
                frm.events.create_deduction_entry(frm);
            }, __('Create'))
        }
    },
    create_deduction_entry: function(frm){
        // Default mapping - you can change method to your mapping function
        frappe.model.open_mapped_doc({
            method: "contractor.contractor_app.doctype.clearence.clearence.create_a_payment",
            frm: frm
        })
    },
    selling_deductions_template: function(frm){
        if(frm.doc.selling_deductions_template) {
            frappe.call({
                method: "contractor.www.api.get_deductions",
                args: {
                    "master_doctype": frappe.meta.get_docfield(frm.doc.doctype, "selling_deductions_template").options,
                    "master_name": frm.doc.selling_deductions_template
                },
                callback: function(r) {
                    if(!r.exc) {
                        const rows = r.message || [];
                        if (frm.doc.deductions && frm.doc.deductions.length) {
                            for (let ded of rows) {
                                frm.add_child("deductions", ded);
                            }
                        } else if (rows.length) {
                            frm.set_value("deductions", rows);
                        }
                        frm.refresh_field("deductions");
                    }
                }
            });
        }
    }
});

frappe.ui.form.on("Deduction", {
    percent: function(frm, cdt, cdn){
        let row = locals[cdt][cdn];
        const percent = parseFloat(row.percent) || 0;
        const base = parseFloat(frm.doc.rounded_total) || 0;
        const value = (percent * base / 100);
        const rounded = Math.round(value * 100) / 100;
        frappe.model.set_value(cdt, cdn, "value", rounded);
    }
});
