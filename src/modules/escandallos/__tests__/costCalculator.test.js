import { describe, test, expect } from 'vitest';
import { CostCalculator } from '../services/costCalculator.js';

describe('CostCalculator', () => {
    const mockIngredients = [
        { id: 'ing1', name: 'Aguacate', current_cost: 0.0054 }, // 5.4€/kg -> 0.0054€/gr
        { id: 'ing2', name: 'Tomate', current_cost: 0.0015 },
        { id: 'ing3', name: 'Cebolla', current_cost: 0.0010 },
    ];

    const mockRecipesMap = [
        {
            id: 'rec1',
            name: 'Guiso Base',
            type: 'PREPARATION',
            produced_quantity: 1,
            unit_cost: 0.5
        }
    ];

    test('should calculate cost with merma correctly', () => {
        const recipe = {
            id: 'r1',
            type: 'FINAL_PRODUCT',
            produced_quantity: 1,
            pvp_manual: 0,
            packaging_cost: 0,
        };

        const items = [
            { ingredient_id: 'ing1', quantity_net: 90, unit: 'gr', merma_percentage: 20 },
            { ingredient_id: 'ing2', quantity_net: 15, unit: 'gr', merma_percentage: 5 },
        ];

        const result = CostCalculator.calculateRecipeCost(recipe, items, mockIngredients, mockRecipesMap);

        // Expected gross = 90 / (1 - 0.2) = 112.5 gr
        // Expected cost = 112.5 * 0.0054 = 0.6075
        // Expected gross 2 = 15 / (1 - 0.05) = 15.78947... gr
        // Expected cost 2 = 15.78947 * 0.0015 = 0.0236842...
        // Total = 0.6075 + 0.0236842 = 0.6311842

        expect(result.total_cost).toBeCloseTo(0.6311842, 6);
    });

    test('should handle nested recipes correctly', () => {
        const recipe = {
            id: 'r2',
            type: 'FINAL_PRODUCT',
            produced_quantity: 1,
            pvp_manual: 0,
            packaging_cost: 0,
        };

        const items = [
            { child_recipe_id: 'rec1', quantity_net: 2, unit: 'ud', merma_percentage: 0 },
            { ingredient_id: 'ing3', quantity_net: 10, unit: 'gr', merma_percentage: 0 },
        ];

        const result = CostCalculator.calculateRecipeCost(recipe, items, mockIngredients, mockRecipesMap);

        // 2 units of rec1 @ 0.5 = 1.0
        // 10 gr of ing3 @ 0.0010 = 0.01

        expect(result.total_cost).toBeCloseTo(1.01, 6);
    });

    test('detects cycles in nested recipes', () => {
        // rA includes rA
        const items = [{ child_recipe_id: 'rA', quantity_net: 1, merma_percentage: 0 }];

        // Ensure the cycle detection catches this self-reference
        expect(CostCalculator.detectCycle('rA', items, [{id: 'rA', items: items}])).toBe(true);
    });
});