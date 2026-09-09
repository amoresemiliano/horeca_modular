export const Capability = {
  // 1. Platform Administration
  PLATFORM_TENANTS_PROVISION: 'platform.tenants.provision',
  PLATFORM_SYSTEM_MONITOR: 'platform.system.monitor',
  PLATFORM_MIGRATIONS_APPLY: 'platform.migrations.apply',

  // 2. Organizations & Memberships
  ORG_CONFIG_READ: 'org.config.read',
  ORG_CONFIG_WRITE: 'org.config.write',
  MEMBERSHIP_USERS_INVITE: 'membership.users.invite',
  MEMBERSHIP_ROLES_ASSIGN: 'membership.roles.assign',
  MEMBERSHIP_USERS_REMOVE: 'membership.users.remove',

  // 3. Operational Units
  OPUNIT_MANAGE: 'opunit.manage',
  OPUNIT_ASSIGN_SCOPE: 'opunit.assign_scope',

  // 4. Sales & POS
  SALES_VIEW: 'sales.view',
  SALES_TICKETS_READ: 'sales.tickets.read',
  SALES_IMPORT_UPLOAD: 'sales.import.upload',
  SALES_IMPORT_PROCESS: 'sales.import.process',

  // 5. Purchases & Suppliers
  SUPPLIERS_MANAGE: 'suppliers.manage',
  PURCHASES_ORDER_CREATE: 'purchases.order.create',
  PURCHASES_ORDER_APPROVE: 'purchases.order.approve',
  PURCHASES_RECEPTION_CONFIRM: 'purchases.reception.confirm',
  PURCHASES_INVOICES_MANAGE: 'purchases.invoices.manage',

  // 6. Catalog & Products
  CATALOG_PRODUCTS_READ: 'catalog.products.read',
  CATALOG_PRODUCTS_WRITE: 'catalog.products.write',
  CATALOG_PRICING_MANAGE: 'catalog.pricing.manage',

  // 7. Recipes & Cost Sheets
  RECIPES_VIEW: 'recipes.view',
  COSTSHEETS_VIEW: 'costsheets.view',
  COSTSHEETS_EDIT: 'costsheets.edit',

  // 8. Production
  PRODUCTION_BATCH_LOG: 'production.batch.log',
  PRODUCTION_WASTE_LOG: 'production.waste.log',

  // 9. Inventory & Stock
  INVENTORY_STOCK_VIEW: 'inventory.stock.view',
  INVENTORY_COUNT_RUN: 'inventory.count.run',
  INVENTORY_ADJUSTMENT_CONFIRM: 'inventory.adjustment.confirm',

  // 10. Financial & Statements
  STATEMENTS_IMPORT_UPLOAD: 'statements.import.upload',
  STATEMENTS_IMPORT_PROCESS: 'statements.import.process',
  FINANCIAL_RECONCILIATION_REVIEW: 'financial.reconciliation.review',
  FINANCIAL_RECONCILIATION_CONFIRM: 'financial.reconciliation.confirm',
  FINANCIAL_ALLOCATION_EDIT: 'financial.allocation.edit',

  // 11. Documents & OCR
  DOCUMENTS_UPLOAD: 'documents.upload',
  DOCUMENTS_OCR_PROCESS: 'documents.ocr.process',
  DOCUMENTS_OCR_VERIFY: 'documents.ocr.verify',

  // 12. Personnel & HR
  PERSONNEL_EMPLOYEES_MANAGE: 'personnel.employees.manage',
  PERSONNEL_FICHAJES_WRITE: 'personnel.fichajes.write',
  PERSONNEL_FICHAJES_AUDIT: 'personnel.fichajes.audit',
  PERSONNEL_INCIDENCIAS_MANAGE: 'personnel.incidencias.manage',

  // 13. Reporting, P&L & Metrics
  REPORTING_OPERATIONAL_VIEW: 'reporting.operational.view',
  REPORTING_PNL_VIEW: 'reporting.pnl.view',
  REPORTING_TAX_SUMMARY_VIEW: 'reporting.tax_summary.view',

  // 14. Integrations
  INTEGRATIONS_CONFIG_MANAGE: 'integrations.config.manage',
  INTEGRATIONS_SYNC_TRIGGER: 'integrations.sync.trigger',

  // 15. Deletion & Recovery
  DATA_RECORDS_DELETE_SOFT: 'data.records.delete_soft',
  DATA_RECORDS_PURGE_HARD: 'data.records.purge_hard',
  DATA_RECORDS_RESTORE: 'data.records.restore',

  // 16. Sensitive Data
  SENSITIVEDATA_SALARIES_READ: 'sensitivedata.salaries.read',
  SENSITIVEDATA_BANKING_READ: 'sensitivedata.banking.read',
} as const;

export type Capability = (typeof Capability)[keyof typeof Capability];
