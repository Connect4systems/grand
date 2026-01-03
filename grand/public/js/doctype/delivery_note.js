// grand: Delivery Note customizations

// ====== CONFIG: make sure these fieldnames match your system exactly ======
const PARENT_FIELDS = {
  type: "custom_type",          // Select: Main / Lines
  sector: "custom_sector",      // Link to Sector
  warehouse: "set_warehouse"    // Link to Warehouse (parent field used to filter Sector)
};

const CHILD_FIELDS = {
  table: "items",
  block: "custom_block",        // Link to Block (Block has field 'sector' Link to Sector)
  building: "custom_building"   // Link to Building (Building has 'sector' & 'block')
};

// If Sector’s link to Warehouse is misspelled (e.g. 'warhouse'), change here:
const SECTOR_WAREHOUSE_FIELDNAME = "warehouse"; // or "warhouse"


// ===== Helpers =====
function set_parent_sector_query(frm) {
  frm.set_query(PARENT_FIELDS.sector, () => ({
    filters: {
      [SECTOR_WAREHOUSE_FIELDNAME]: frm.doc[PARENT_FIELDS.warehouse] || ""
    }
  }));
}

// Hide/show BOTH the grid columns and the row dialog fields
// Also toggle "reqd" so save won't fail when hidden
function toggle_item_child_fields(frm) {
  const show = frm.doc[PARENT_FIELDS.type] === "Lines";
  const grid = frm.get_field(CHILD_FIELDS.table).grid;
  const FIELDS = [CHILD_FIELDS.block, CHILD_FIELDS.building];

  // 1) Show/Hide columns in the grid header/list view
  grid.set_column_disp(FIELDS, show);

  // 2) Make them required only when visible
  if (grid.update_docfield_property) {
    grid.update_docfield_property(CHILD_FIELDS.block, "reqd", show);
    grid.update_docfield_property(CHILD_FIELDS.building, "reqd", show);
  }

  // 3) If a row dialog is open, hide/show there too
  if (grid.grid_form && grid.grid_form.fields_dict) {
    FIELDS.forEach(fn => {
      const fld = grid.grid_form.fields_dict[fn];
      if (fld) {
        fld.df.hidden = !show;
        fld.df.reqd = show;
        fld.refresh && fld.refresh();
      }
    });
  }

  // 4) When hiding (Type = Main), clear values so they don't linger
  if (!show && Array.isArray(frm.doc[CHILD_FIELDS.table])) {
    frm.doc[CHILD_FIELDS.table].forEach(r => {
      r[CHILD_FIELDS.block] = null;
      r[CHILD_FIELDS.building] = null;
    });
    frm.refresh_field(CHILD_FIELDS.table);
  }
}

function set_child_queries(frm) {
  const grid = frm.fields_dict[CHILD_FIELDS.table]?.grid;
  if (!grid) return;

  // Block filtered by parent Sector
  grid.get_field(CHILD_FIELDS.block).get_query = function (doc /* parent */, cdt, cdn) {
    if (!doc[PARENT_FIELDS.sector]) {
      return { filters: { name: ["in", []] } };
    }
    return {
      filters: {
        sector: doc[PARENT_FIELDS.sector]
      }
    };
  };

  // Building filtered by parent Sector AND (optionally) row Block
  grid.get_field(CHILD_FIELDS.building).get_query = function (doc /* parent */, cdt, cdn) {
    const row = frappe.get_doc(cdt, cdn);
    if (!doc[PARENT_FIELDS.sector]) {
      return { filters: { name: ["in", []] } };
    }
    const filters = { sector: doc[PARENT_FIELDS.sector] };
    if (row[CHILD_FIELDS.block]) {
      filters.block = row[CHILD_FIELDS.block];
    }
    return { filters };
  };
}

function clear_child_values_on_sector_change(frm) {
  if (!Array.isArray(frm.doc[CHILD_FIELDS.table])) return;
  frm.doc[CHILD_FIELDS.table].forEach(r => {
    r[CHILD_FIELDS.block] = null;
    r[CHILD_FIELDS.building] = null;
  });
  frm.refresh_field(CHILD_FIELDS.table);
}


// ===== Parent Doc Events =====
frappe.ui.form.on("Delivery Note", {
  onload(frm) {
    set_parent_sector_query(frm);
    // ensure correct visibility on first load (Main vs Lines)
    toggle_item_child_fields(frm);
  },

  refresh(frm) {
    set_parent_sector_query(frm);
    set_child_queries(frm);
    toggle_item_child_fields(frm);
  },

  onload_post_render(frm) {
    set_child_queries(frm);
    toggle_item_child_fields(frm);
  },

  // Keep sector filter in sync with warehouse
  [PARENT_FIELDS.warehouse](frm) {
    set_parent_sector_query(frm);

    // Optional: clear sector when warehouse removed
    if (!frm.doc[PARENT_FIELDS.warehouse]) {
      frm.set_value(PARENT_FIELDS.sector, null);
    }
  },

  // Sector affects child filters; clear incompatible values
  [PARENT_FIELDS.sector](frm) {
    set_child_queries(frm);
    clear_child_values_on_sector_change(frm);
  },

  // Show/hide child fields when Type changes (Main vs Lines)
  [PARENT_FIELDS.type](frm) {
    toggle_item_child_fields(frm);
  },

  // Ensure the row dialog respects visibility whenever it opens
  // (Frappe fires <childtable>_on_form_rendered on child form open)
  [`${CHILD_FIELDS.table}_on_form_rendered`](frm) {
    toggle_item_child_fields(frm);
  }
});


// ===== Child Row Events =====
frappe.ui.form.on("Delivery Note Item", {
  // When Block changes, clear Building to force re-pick from filtered list
  [CHILD_FIELDS.block](frm, cdt, cdn) {
    const row = frappe.get_doc(cdt, cdn);
    row[CHILD_FIELDS.building] = null;
    frm.refresh_field(CHILD_FIELDS.table);
  }
});
