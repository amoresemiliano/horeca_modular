/**
 * extractosService.js — Capa de servicio e integración Supabase (Track A)
 * Implementa:
 *  - Persistencia multi-tenant en Supabase Staging
 *  - Duplicados Nivel A (SHA256 File), Nivel B (Row Identity), Nivel C (Economic Overlap)
 *  - Origen inmutable (eco_financial_movements) vs Asignación económica editable (eco_movement_allocations)
 *  - Motor de reglas determinísticas
 *  - Reconciliación (Movimiento <-> Movimiento, Tarjeta <-> Liquidación)
 *  - Soft delete
 */
import { supabase } from './supabase.js';

const DEFAULT_ORG_ID = '59436df3-9f15-4f5e-b17e-37c55482521c';

// ─── Carga catálogos iniciales ────────────────────────────────────────────────
export async function getExtractosCatalogs(orgId = DEFAULT_ORG_ID) {
  try {
    const [accountsRes, categoriesRes, subcategoriesRes, counterpartiesRes, rulesRes] = await Promise.all([
      supabase.from('eco_financial_accounts').select('*').eq('organization_id', orgId),
      supabase.from('eco_tax_categories').select('*').order('name'),
      supabase.from('eco_tax_subcategories').select('*').eq('organization_id', orgId).order('name'),
      supabase.from('eco_counterparties').select('*').eq('organization_id', orgId).order('name'),
      supabase.from('eco_classification_rules').select('*').eq('organization_id', orgId).eq('is_active', true)
    ]);

    return {
      accounts: accountsRes.data || [],
      categories: categoriesRes.data || [],
      subcategories: subcategoriesRes.data || [],
      counterparties: counterpartiesRes.data || [],
      rules: rulesRes.data || []
    };
  } catch (err) {
    console.error('Error fetching catalogs:', err);
    return { accounts: [], categories: [], subcategories: [], counterparties: [], rules: [] };
  }
}

// ─── Verificación de Duplicado Nivel A (File Binary SHA256) ───────────────────
export async function checkFileDuplicate(fileHash, orgId = DEFAULT_ORG_ID) {
  try {
    const { data, error } = await supabase
      .from('eco_source_files')
      .select('id, import_id, original_name, created_at')
      .eq('organization_id', orgId)
      .eq('sha256_hash', fileHash)
      .maybeSingle();

    if (!error && data) {
      return { isDuplicate: true, file: data };
    }
  } catch (_) {}
  return { isDuplicate: false };
}

// ─── Importación completa con Persistencia en Supabase ─────────────────────────
export async function importBankStatementData(parsedResult, orgId = DEFAULT_ORG_ID) {
  const { file_name, file_hash, account_code, movements } = parsedResult;

  // 1. Resolve source_account_id
  const { data: accData } = await supabase
    .from('eco_financial_accounts')
    .select('id')
    .eq('organization_id', orgId)
    .eq('code', accountCode)
    .maybeSingle();

  const sourceAccountId = accData?.id || null;

  // 2. Create eco_source_imports entry
  const { data: importEntry, error: importErr } = await supabase
    .from('eco_source_imports')
    .insert({
      organization_id: orgId,
      source_type: 'BANCO',
      operation_type: 'BANCO',
      status: 'PROCESSING',
      total_rows: movements.length,
    })
    .select()
    .single();

  if (importErr || !importEntry) {
    throw new Error('Error al registrar importación: ' + (importErr?.message || ''));
  }

  // 3. Create eco_source_files entry (Level A hash saved)
  const { data: fileEntry } = await supabase
    .from('eco_source_files')
    .insert({
      import_id: importEntry.id,
      organization_id: orgId,
      original_name: file_name,
      storage_path: `bank_statements/${importEntry.id}_${file_name}`,
      size_bytes: 0,
      sha256_hash: file_hash,
      source_type: accountCode,
    })
    .select()
    .single();

  // 4. Fetch existing overlap hashes for Level C Economic Overlap detection
  const overlapHashes = movements.map(m => m.overlap_hash);
  const { data: existingMovements } = await supabase
    .from('eco_financial_movements')
    .select('financial_fingerprint')
    .eq('organization_id', orgId)
    .in('financial_fingerprint', overlapHashes);

  const existingHashSet = new Set((existingMovements || []).map(m => m.financial_fingerprint));

  // 5. Fetch active classification rules for rule engine
  const { data: rules } = await supabase
    .from('eco_classification_rules')
    .select('*')
    .eq('organization_id', orgId)
    .eq('is_active', true);

  let insertedCount = 0;
  let overlapCount = 0;

  for (const m of movements) {
    // Save eco_import_rows (Level B Row Identity)
    const { data: rowEntry } = await supabase
      .from('eco_import_rows')
      .insert({
        file_id: fileEntry?.id,
        organization_id: orgId,
        source_row_number: m.source_row_number,
        raw_payload: m.raw_payload,
        parse_status: 'ACCEPTED',
      })
      .select()
      .single();

    // Check Level C Economic Overlap
    const isOverlap = existingHashSet.has(m.overlap_hash);
    const duplicateStatus = isOverlap ? 'POTENTIAL_OVERLAP' : 'UNIQUE';
    if (isOverlap) overlapCount++;

    // Insert Raw Immutable Movement (eco_financial_movements)
    const { data: movEntry, error: movErr } = await supabase
      .from('eco_financial_movements')
      .insert({
        organization_id: orgId,
        import_id: importEntry.id,
        row_id: rowEntry?.id,
        source_account_id: sourceAccountId,
        source_type: accountCode,
        operation_type: m.monto >= 0 ? 'INGRESO' : 'GASTO',
        status: 'ACTIVE',
        identity_key: m.row_identity_key,
        financial_fingerprint: m.overlap_hash,
        fecha: m.fecha,
        fecha_valor: m.fecha_valor,
        descripcion: m.original_description,
        monto: m.monto,
        duplicate_status: duplicateStatus,
        row_hash: m.row_identity_key,
        normalized_payload: {
          original_description: m.original_description,
          normalized_description: m.normalized_description,
        }
      })
      .select()
      .single();

    if (movErr || !movEntry) continue;
    insertedCount++;

    // Apply Rule Engine to suggest category/counterparty
    let matchedRule = null;
    if (rules && rules.length > 0) {
      matchedRule = rules.find(r => {
        if (r.source_account_id && r.source_account_id !== sourceAccountId) return false;
        if (r.match_sign === 'POSITIVE' && m.monto < 0) return false;
        if (r.match_sign === 'NEGATIVE' && m.monto > 0) return false;
        return m.normalized_description.includes(r.pattern.toUpperCase());
      });
    }

    // Insert Editable Economic Allocation (eco_movement_allocations)
    await supabase.from('eco_movement_allocations').insert({
      organization_id: orgId,
      movement_id: movEntry.id,
      monto: m.monto,
      counterparty_id: matchedRule?.target_counterparty_id || null,
      category_id: matchedRule?.target_category_id || null,
      subcategory_id: matchedRule?.target_subcategory_id || null,
      classification_status: matchedRule ? 'SUGGESTED' : 'PENDING',
      classification_source: matchedRule ? 'RULE' : 'MANUAL',
      reconciliation_status: 'UNMATCHED',
    });
  }

  // Update import summary
  await supabase
    .from('eco_source_imports')
    .update({
      status: 'COMPLETED',
      accepted_rows: insertedCount,
      duplicate_rows: overlapCount,
      completed_at: new Date().toISOString(),
    })
    .eq('id', importEntry.id);

  return {
    import_id: importEntry.id,
    total: movements.length,
    imported: insertedCount,
    overlaps: overlapCount,
  };
}

// ─── Fetch All Financial Movements & Allocations ─────────────────────────────
export async function fetchConsolidatedMovements(orgId = DEFAULT_ORG_ID) {
  try {
    const { data: movements, error } = await supabase
      .from('eco_financial_movements')
      .select(`
        *,
        source_account:eco_financial_accounts(*),
        allocations:eco_movement_allocations(
          *,
          counterparty:eco_counterparties(*),
          category:eco_tax_categories(*),
          subcategory:eco_tax_subcategories(*)
        )
      `)
      .eq('organization_id', orgId)
      .eq('status', 'ACTIVE')
      .order('fecha', { ascending: false });

    if (error) throw error;
    return movements || [];
  } catch (err) {
    console.error('Error fetching consolidated movements:', err);
    return [];
  }
}

// ─── Actualiza Asignación Económica / Clasificación ─────────────────────────
export async function updateAllocationClassification({
  allocationId,
  counterpartyId,
  categoryId,
  subcategoryId,
  status = 'CONFIRMED',
  notes,
}) {
  const updates = {
    classification_status: status,
    classification_source: 'MANUAL',
    updated_at: new Date().toISOString(),
  };

  if (counterpartyId !== undefined) updates.counterparty_id = counterpartyId;
  if (categoryId !== undefined) updates.category_id = categoryId;
  if (subcategoryId !== undefined) updates.subcategory_id = subcategoryId;
  if (notes !== undefined) updates.notes = notes;

  const { data, error } = await supabase
    .from('eco_movement_allocations')
    .update(updates)
    .eq('id', allocationId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ─── Creación y aplicación de Regla Determinística ───────────────────────────
export async function createClassificationRule({
  pattern,
  counterpartyId,
  categoryId,
  subcategoryId,
  matchSign = 'ALL',
  orgId = DEFAULT_ORG_ID,
}) {
  const { data, error } = await supabase
    .from('eco_classification_rules')
    .insert({
      organization_id: orgId,
      name: `Regla: ${pattern}`,
      pattern: pattern.trim().toUpperCase(),
      match_sign: matchSign,
      target_counterparty_id: counterpartyId || null,
      target_category_id: categoryId || null,
      target_subcategory_id: subcategoryId || null,
      is_active: true,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ─── Splits: División de movimiento en N asignaciones ─────────────────────────
export async function splitMovementAllocations(movementId, originalAmount, allocationsList, orgId = DEFAULT_ORG_ID) {
  const sum = allocationsList.reduce((acc, curr) => acc + (parseFloat(curr.monto) || 0), 0);
  if (Math.abs(sum - originalAmount) > 0.01) {
    throw new Error(`La suma de las divisiones (${sum.toFixed(2)} €) no coincide con el movimiento original (${originalAmount.toFixed(2)} €)`);
  }

  await supabase
    .from('eco_movement_allocations')
    .delete()
    .eq('movement_id', movementId);

  const toInsert = allocationsList.map(a => ({
    organization_id: orgId,
    movement_id: movementId,
    monto: parseFloat(a.monto),
    counterparty_id: a.counterparty_id || null,
    category_id: a.category_id || null,
    subcategory_id: a.subcategory_id || null,
    classification_status: 'CONFIRMED',
    classification_source: 'MANUAL',
    reconciliation_status: 'UNMATCHED',
    notes: a.notes || 'Split manual',
  }));

  const { data, error } = await supabase
    .from('eco_movement_allocations')
    .insert(toInsert)
    .select();

  if (error) throw error;
  return data;
}

// ─── Reconciliación (Transferencia Interna / Liquidación Tarjeta) ───────────────
export async function reconcileMovements({
  allocationId,
  targetMovementId,
  reconciliationType,
}) {
  const isTransfer = reconciliationType === 'INTERNAL_TRANSFER';
  const isCard = reconciliationType === 'CARD_SETTLEMENT';

  const { data, error } = await supabase
    .from('eco_movement_allocations')
    .update({
      reconciliation_status: 'CONFIRMED',
      reconciled_movement_id: targetMovementId,
      reconciliation_type: reconciliationType,
      is_internal_transfer: isTransfer,
      is_card_settlement: isCard,
      classification_status: 'CONFIRMED',
      updated_at: new Date().toISOString(),
    })
    .eq('id', allocationId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ─── Soft Delete Movimiento Bancario Original ─────────────────────────────────
export async function softDeleteMovement(movementId) {
  const { data, error } = await supabase
    .from('eco_financial_movements')
    .update({
      status: 'SOFT_DELETED',
      deleted_at: new Date().toISOString(),
    })
    .eq('id', movementId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ─── Counterparty Manager (Crear / Buscar Contraparte) ─────────────────────────
export async function findOrCreateCounterparty(name, type = 'PROVEEDOR', orgId = DEFAULT_ORG_ID) {
  if (!name || !name.trim()) return null;
  const cleanName = name.trim();

  const { data: existing } = await supabase
    .from('eco_counterparties')
    .select('id')
    .eq('organization_id', orgId)
    .ilike('name', cleanName)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from('eco_counterparties')
    .insert({
      organization_id: orgId,
      name: cleanName,
      type: type,
    })
    .select('id')
    .single();

  if (error) return null;
  return created.id;
}
