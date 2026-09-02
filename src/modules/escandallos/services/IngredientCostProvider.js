/**
 * Interface/Service for fetching ingredient costs.
 * Simulates integration with a "Compras" (Purchasing) module.
 */

export class IngredientCostProvider {
  /**
   * Resolves the current cost of an ingredient based on its configuration.
   * @param {Object} ingredient - The ingredient object.
   * @param {string} ingredient.id - Ingredient ID.
   * @param {string} ingredient.cost_strategy - 'LAST_PURCHASE', 'MANUAL', etc.
   * @param {number} ingredient.manual_cost - Manual cost (if applicable).
   * @param {number} ingredient.current_cost - Current cached cost.
   * @returns {Promise<number>} - The resolved cost per base unit.
   */
  static async resolveCost(ingredient) {
    // In a real implementation, this would call an API or query the database
    // depending on the strategy.

    switch (ingredient.cost_strategy) {
      case 'LAST_PURCHASE':
        // Simulating a fetch to Compras. For now, we return the cached current_cost.
        // If integrating later, this would query the latest purchase order for this ingredient ID.
        return Number(ingredient.current_cost) || 0;

      case 'MANUAL':
        return Number(ingredient.manual_cost) || 0;

      case 'AVERAGE_LAST_N_DAYS':
      case 'WEIGHTED_AVERAGE':
        // Placeholder for future strategies
        return Number(ingredient.current_cost) || 0;

      default:
        console.warn(`Unknown cost strategy: ${ingredient.cost_strategy}`);
        return Number(ingredient.current_cost) || 0;
    }
  }

  /**
   * Updates an ingredient's cost strategy and fetches the new cost.
   * @param {string} _ingredientId
   * @param {string} _newStrategy
   */
  static async updateStrategy(_ingredientId, _newStrategy) {
     // TODO: Update in Supabase, then trigger recalculation
     throw new Error("Not implemented yet");
  }
}
