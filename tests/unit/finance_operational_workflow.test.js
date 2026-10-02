import { describe, it, expect, vi } from 'vitest';
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ({ can: () => true }) }));
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { interpretationDraft, changeCategory, classificationInput, ruleExample, emptyFilters, filterMovements, reviewSummary } from '../../src/modules/extractos/workflow';
import AllocationFields from '../../src/modules/extractos/AllocationFields';
import ExtractosResumen from '../../src/modules/extractos/ExtractosResumen';
const catalogs = { categories: [{ id: 'food', name: 'Food', type: 'GASTO' }, { id: 'sales', name: 'Sales', type: 'INGRESO' }], subcategories: [{ id: 'fresh', name: 'Fresh', category_id: 'food' }, { id: 'online', name: 'Online', category_id: 'sales' }], counterparties: [] };
const movement = (amount, allocation = {}) => ({ id: String(amount), monto: amount, fecha: '2026-01-05', currency: 'EUR', source_account_id: 'account', source_account: { id: 'account', name: 'Synthetic' }, descripcion: 'Synthetic delivery', allocations: [{ id: 'allocation' + amount, monto: amount, economic_type: 'UNCLASSIFIED', classification_status: 'PENDING', ...allocation }] });
describe('WP-FIN-003 operational interpretation', () => {
    it.each([-18.5, 18.5])('opens %s unclassified without economic sign inference', amount => {
        const m = movement(amount), draft = interpretationDraft(m.allocations[0]);
        expect(draft.economic_type).toBe('UNCLASSIFIED');
        expect(classificationInput('org', draft.id, draft).status).toBe('PENDING');
        expect(ruleExample(m)).toBeNull();
        expect(interpretationDraft({ ...m.allocations[0], economic_type: undefined }).economic_type).toBe('UNCLASSIFIED');
    });
    it('keeps a persisted suggestion distinct and confirms only an explicit save', () => {
        const m = movement(-10, { economic_type: 'FINANCING_OUTFLOW', classification_status: 'SUGGESTED' }), d = interpretationDraft(m.allocations[0]);
        expect(d.classification_status).toBe('SUGGESTED');
        expect(ruleExample(m)).toBeNull();
        expect(classificationInput('org', d.id, d)).toMatchObject({ economicType: 'FINANCING_OUTFLOW', status: 'CONFIRMED' });
    });
    it('requires a single meaningful confirmed generic classification for rule examples', () => {
        expect(ruleExample(movement(-10, { classification_status: 'CONFIRMED' }))).toBeNull();
        expect(ruleExample(movement(-10, { classification_status: 'CONFIRMED', economic_type: 'INTERNAL_TRANSFER' }))).toBeNull();
        expect(ruleExample(movement(-10, { classification_status: 'CONFIRMED', economic_type: 'OPERATING_EXPENSE' }))?.economic_type).toBe('OPERATING_EXPENSE');
    });
    it('clears incompatible subcategories and preserves all other draft fields', () => {
        const draft = { ...interpretationDraft(), category_id: 'food', subcategory_id: 'fresh', notes: 'keep', counterparty_id: 'party', economic_type: 'OTHER_NON_OPERATING' };
        expect(changeCategory(draft, 'sales')).toEqual({ ...draft, category_id: 'sales', subcategory_id: '' });
        expect(changeCategory(draft, 'food')).toEqual(draft);
    });
    it('renders category dependency and category-first order without hiding quick creation', () => {
        const html = renderToStaticMarkup(createElement(AllocationFields, { value: interpretationDraft(), onChange: () => { }, catalogs, orgId: 'org', quickCreate: true }));
        expect(html).toMatch(/Subcategoría<select[^>]*disabled/);
        expect(html).not.toContain('value="fresh"');
        expect(html.indexOf('Categoría<select')).toBeLessThan(html.indexOf('Tipo económico<select'));
        expect(html).toContain('+ Categoría');
        const selected = renderToStaticMarkup(createElement(AllocationFields, { value: { ...interpretationDraft(), category_id: 'food' }, onChange: () => { }, catalogs, orgId: 'org' }));
        expect(selected).toContain('value="fresh"');
        expect(selected).not.toContain('value="online"');
        expect(selected).not.toContain('value="INTERNAL_TRANSFER"');
    });
    it('prioritizes one real attention state and omits empty economic cards', () => {
        const rows = [movement(-20), movement(50)];
        const summary = reviewSummary(rows);
        expect(summary.attention).toBe(2);
        expect(summary.metrics.banking).toEqual({ inflows: 5000, outflows: 2000, net: 3000, count: 2 });
        expect(summary.hasOperating).toBe(false);
        const html = renderToStaticMarkup(createElement(ExtractosResumen, { movements: rows, onReview: () => { } }));
        expect(html).toContain('2 movimientos pendientes de interpretación económica');
        expect(html).not.toContain('aria-label="Interpretación operativa"');
        expect(html).not.toContain('Otros flujos confirmados');
    });
    it('counts partial confirmed splits once and excludes suggested operating values', () => {
        const m = movement(-20);
        m.allocations = [{ ...m.allocations[0], monto: -5, economic_type: 'OPERATING_EXPENSE', classification_status: 'CONFIRMED' }, { ...m.allocations[0], id: 'second', monto: -15, economic_type: 'OPERATING_EXPENSE', classification_status: 'SUGGESTED' }];
        const s = reviewSummary([m]);
        expect(s.metrics.banking.outflows).toBe(2000);
        expect(s.metrics.operatingExpense).toBe(500);
        expect(s.metrics.unclassifiedAmount).toBe(1500);
        expect(s.confirmed).toBe(1);
        expect(s.hasOperating).toBe(true);
    });
    it.each([['account', 'account'], ['status', 'SUGGESTED'], ['economicType', 'OPERATING_EXPENSE'], ['category', 'food'], ['counterparty', 'party'], ['month', '2026-01'], ['query', 'DELIVERY']])('filters by %s', (key, value) => {
        const rows = [movement(-10, { classification_status: 'SUGGESTED', economic_type: 'OPERATING_EXPENSE', category_id: 'food', counterparty_id: 'party' })];
        expect(filterMovements(rows, { ...emptyFilters(), [key]: value })).toHaveLength(1);
        expect(filterMovements(rows, { ...emptyFilters(), [key]: 'absent' })).toHaveLength(0);
    });
    it('combines interpretation filters on the same allocation and isolates currencies', () => {
        const m = movement(-10, { category_id: 'food', counterparty_id: 'one' });
        m.allocations.push({ ...m.allocations[0], id: 'two', category_id: 'sales', counterparty_id: 'two' });
        expect(filterMovements([m], { ...emptyFilters(), category: 'food', counterparty: 'two' })).toHaveLength(0);
        expect(filterMovements([{ ...m, currency: 'USD' }], emptyFilters())).toHaveLength(0);
    });
});
