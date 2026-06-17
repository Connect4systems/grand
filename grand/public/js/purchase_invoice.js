frappe.ui.form.on("Purchase Invoice", {
    onload: function(frm) {
        set_purchase_invoice_item_query(frm);
    },

    refresh: function(frm) {
        set_purchase_invoice_item_query(frm);
    }
});

function set_purchase_invoice_item_query(frm) {
    frm.set_query("item_code", "items", function() {
        return {
            query: "erpnext.controllers.queries.item_query",
            filters: {
                is_purchase_item: 1,
                disabled: 0,
                has_variants: 0
            }
        };
    });
}
