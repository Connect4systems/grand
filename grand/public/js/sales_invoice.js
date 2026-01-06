frappe.ui.form.on("Sales Invoice", {
    refresh: function(frm){
        // compute totals on refresh (also when doc loaded)
        compute_deduction_totals(frm);

        // Show Deduction Entry button after submit when there are deduction rows
        if (frm.doc.docstatus == 1 && ((frm.doc.deductions && frm.doc.deductions.length) || (frm.doc.deduction_table && frm.doc.deduction_table.length))) {
            frm.add_custom_button(__('Deduction Entry'), () => {
                frm.events.create_deduction_entry(frm);
            }, __('Create'));
        }
    },
    create_deduction_entry: function(frm){
        // Default mapping - you can change method to your mapping function
            if (!frm.doc.name) return;
            frappe.confirm(
                __('Create a Draft Journal Entry for deductions for this Sales Invoice?'),
                function() {
                    frm.call({
                        method: 'grand.sales_invoice_events.create_deduction_je',
                        args: { sinv_name: frm.doc.name },
                        callback: function(r) {
                            if(!r.exc && r.message) {
                                frappe.msgprint({
                                    message: __('Draft Journal Entry {0} created. Open it to review and submit as customer credit.', [r.message]),
                                    indicator: 'green'
                                });
                                // open the created JE
                                frappe.set_route('Form', 'Journal Entry', r.message);
                            }
                        }
                    });
                }
            );
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
    ,
    // (refresh handler merged above)
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

// Also listen to Deduction Table child doctype changes
frappe.ui.form.on("Deduction Table", {
    amount: function(frm, cdt, cdn){
        compute_deduction_totals(frm);
    },
    cost_center: function(frm, cdt, cdn){
        // keep UI responsive; no-op but can trigger totals if desired
    },
    // when a row is added/removed, recalc
    refresh: function(frm, cdt, cdn){
        compute_deduction_totals(frm);
    }
});

// When a Deduction row value changes, update totals
frappe.ui.form.on("Deduction", {
    value: function(frm, cdt, cdn){
        compute_deduction_totals(frm);
    },
    account: function(frm, cdt, cdn){
        // recalc just in case
        compute_deduction_totals(frm);
    },
    // detect add/remove
    refresh: function(frm, cdt, cdn){
        compute_deduction_totals(frm);
    }
});

function compute_deduction_totals(frm){
    let total = 0.0;
    let base_total = 0.0;

    (frm.doc.deductions || []).forEach(r => {
        const v = parseFloat(r.value) || 0;
        total += v;
        base_total += v; // assuming same currency; adjust if needed
    });

    (frm.doc.deduction_table || []).forEach(r => {
        const a = parseFloat(r.amount) || 0;
        total += a;
        base_total += a;
    });

    total = Math.round(total * 100) / 100;
    base_total = Math.round(base_total * 100) / 100;
    // Only set fields if they exist on the Sales Invoice doctype.
    const has_total = frappe.meta.get_docfield(frm.doc.doctype, 'total_deductions');
    const has_base_total = frappe.meta.get_docfield(frm.doc.doctype, 'base_total_deductions');

    if (has_total) {
        if (frm.doc.total_deductions !== total) {
            frm.set_value('total_deductions', total);
        }
    }
    if (has_base_total) {
        if (frm.doc.base_total_deductions !== base_total) {
            frm.set_value('base_total_deductions', base_total);
        }
    }
    frm.refresh_field('deduction_table');
    frm.refresh_field('deductions');
}
