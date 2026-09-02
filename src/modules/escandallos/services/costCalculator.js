/**
 * Utility for cascading cost recalculations.
 */

export class CostCalculator {

  /**
   * Recalculates the total and unit cost of a recipe based on its items.
   * Note: This is a client-side calculation for UI preview.
   * In a real production app, this should ideally be an Edge Function or DB trigger for data integrity.
   *
   * @param {Object} recipe - The recipe/elaboration object
   * @param {Array} items - Array of recipe items (BOM)
   * @param {Array} ingredientsMap - Map or list of available ingredients
   * @param {Array} recipesMap - Map or list of available child recipes
   * @returns {Object} - The recalculated metrics
   */
  /**
   * Detects if adding an item creates a circular dependency.
   * @param {string} currentRecipeId
   * @param {Array} currentItems
   * @param {Array} allRecipes
   * @returns {boolean} True if cycle is detected
   */
  static detectCycle(currentRecipeId, currentItems, allRecipes) {
      const visited = new Set();

      const checkCycle = (items) => {
          for (const item of items) {
              if (item.child_recipe_id) {
                  if (item.child_recipe_id === currentRecipeId || visited.has(item.child_recipe_id)) {
                      return true;
                  }
                  visited.add(item.child_recipe_id);
                  const childRecipe = allRecipes.find(r => r.id === item.child_recipe_id);
                  if (childRecipe && childRecipe.items) {
                      if (checkCycle(childRecipe.items)) return true;
                  }
              }
          }
          return false;
      };

      return checkCycle(currentItems);
  }

  static calculateRecipeCost(recipe, items, ingredientsMap, recipesMap) {
    let totalItemsCost = 0;

    const recalculatedItems = items.map(item => {
      let itemUnitCost = 0;

      if (item.ingredient_id) {
        const ingredient = ingredientsMap.find(i => i.id === item.ingredient_id);
        if (ingredient) {
           // For synchronous UI updates, we use current_cost.
           // Real fetching via Provider would be async.
           itemUnitCost = Number(ingredient.current_cost) || 0;
        }
      } else if (item.child_recipe_id) {
        const childRecipe = recipesMap.find(r => r.id === item.child_recipe_id);
        if (childRecipe) {
           itemUnitCost = Number(childRecipe.unit_cost) || 0;
        }
      }

      // Cost calculation with merma
      // Gross quantity = Net Quantity / (1 - (Merma / 100))
      // Computed Cost = Gross Quantity * Unit Cost
      const merma = Number(item.merma_percentage) || 0;
      const netQty = Number(item.quantity_net) || 0;
      const grossQty = merma === 100 ? 0 : netQty / (1 - (merma / 100)); // Handle div by 0 conceptually

      // Basic unit conversion placeholder (assuming units match for MVP, or a conversion function is applied here)
      // cost = grossQty * itemUnitCost
      const computedCost = grossQty * itemUnitCost;
      totalItemsCost += computedCost;

      return {
        ...item,
        computed_cost: computedCost,
        gross_quantity: grossQty
      };
    });

    const packagingCost = Number(recipe.packaging_cost) || 0;
    const totalCost = totalItemsCost + packagingCost;

    const producedQty = Number(recipe.produced_quantity) || 1;
    const unitCost = totalCost / producedQty;

    const pvp = Number(recipe.pvp_manual) || 0;
    let foodCostPct = 0;
    let marginEur = 0;
    let marginPct = 0;

    if (pvp > 0) {
      foodCostPct = (totalCost / pvp) * 100;
      marginEur = pvp - totalCost;
      marginPct = (marginEur / pvp) * 100;
    }

    return {
      total_cost: totalCost,
      unit_cost: unitCost,
      food_cost_pct: foodCostPct,
      margin_eur: marginEur,
      margin_pct: marginPct,
      recalculated_items: recalculatedItems
    };
  }

}
