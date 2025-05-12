const express = require('express');
const axios = require('axios');
const fuzz = require('fuzzball');
const fs = require('fs');
const app = express();
app.use(express.json());

const port = 3000;
const {foodCategoryData, loadNutritionData} = require('./loadNutritionDB.js');
const SPOONACULAR_API_KEY =  "98b0e032d6db44c3b83f2782cd866f2b";
const synonymMap = {
  aloo: "potato",
  gobhi: "cauliflower",
  paneer: "cottage cheese",
  chana: "chickpeas"
};

const DEFAULTS = {
  type: "sabzi",
  quantity: "cup",
  servingSize: "katori"
};

const DISH_TYPE_KEYWORDS = {
  "Dry Rice Item": ["fried rice", "pulao", "lemon rice", "tamarind rice"],
  "Wet Rice Item": ["biryani", "khichdi", "curd rice"],
  "Veg Gravy": ["curry", "masala", "korma", "gravy", "kofta"],
  "Veg Fry": ["fry", "tikka", "roast", "stir fry"],
  "Non - Veg Gravy": ["chicken curry", "mutton curry", "fish curry", "egg curry"],
  "Non - Veg Fry": ["chicken fry", "fish fry", "tandoori", "kebab"],
  "Dals": ["dal", "sambar", "rasam", "lentil"],
  "Wet Breakfast Item": ["idli", "dosa", "pongal", "poha", "upma"],
  "Dry Breakfast Item": ["thepla", "paratha", "vada"],
  "Chutneys": ["chutney", "dip"],
  "Plain Flatbreads": ["roti", "chapati", "phulka"],
  "Stuffed Flatbreads": ["paratha", "stuffed", "aloo paratha"],
  "Salads": ["salad", "kosambari", "kachumber"],
  "Raita": ["raita", "curd salad"],
  "Plain Soups": ["soup"],
  "Mixed Soups": ["veg soup", "mixed soup"],
  "Hot Beverages": ["tea", "coffee", "chai"],
  "Beverages": ["juice", "lassi", "sharbat", "milkshake"],
  "Snacks": ["pakoda", "samosa", "cutlet", "bonda", "snack"],
  "Sweets": ["halwa", "kheer", "gulab jamun", "rasgulla", "sweet"]
};



async function fetchIngredientsFromAPI(dishName) {
  const url = `https://api.spoonacular.com/recipes/complexSearch?query=${dishName}&number=1&apiKey=${SPOONACULAR_API_KEY}`;

  const res = await axios.get(url);
  const recipeId = res.data.results[0]?.id;

  if (!recipeId) return [];

  const details = await axios.get(
    `https://api.spoonacular.com/recipes/${recipeId}/ingredientWidget.json?apiKey=${SPOONACULAR_API_KEY}`
  );

  const ingredients = details.data.ingredients.map(item => 
    ({
    name: item.name.toLowerCase(),
    amount: item.amount.metric.value,
    unit: item.amount.metric.unit
    }));
  return ingredients;
}

function matchToNutritionDB(ingredient, nutritionData) {
  const match = fuzz.extract(ingredient.name, nutritionData.map(n => n.food_name), {
    scorer: fuzz.token_set_ratio,
    limit: 1
  })[0];


  const [matchedName, score, index] = match;
  if (score > 80) return nutritionData[index];
  return null;
}

function inferDishType(dishName, ingredients = []) {
  const combinedText = (dishName + ' ' + ingredients.map(i => i.name).join(" ")).toLowerCase();

  for (let [type, keywords] of Object.entries(DISH_TYPE_KEYWORDS)) {
    for (let keyword of keywords) {
      if (combinedText.includes(keyword)) {
        return type;
      }
    }
  }

  return null; 
}

const fallbackIngredients = {
  "chana masala": [
    { name: "chickpeas", amount: 1, unit: "cup" },
    { name: "onions", amount: 1, unit: "medium" },
    { name: "tomatoes", amount: 2, unit: "medium" },
    { name: "garam masala", amount: 1, unit: "teaspoon" },
    { name: "ginger", amount: 1, unit: "inch" },
    { name: "garlic", amount: 3, unit: "clove" }
  ],
  "jeera aloo": [
    { name: "potatoes", amount: 2, unit: "medium" },
    { name: "cumin seeds", amount: 1, unit: "teaspoon" },
    { name: "turmeric", amount: 0.5, unit: "teaspoon" },
    { name: "green chili", amount: 1, unit: "piece" }
  ],
  "gobi sabzi": [
    { name: "cauliflower", amount: 1, unit: "cup" },
    { name: "onion", amount: 1, unit: "medium" },
    { name: "tomato", amount: 1, unit: "medium" },
    { name: "green chili", amount: 1, unit: "piece" },
    { name: "ginger garlic paste", amount: 1, unit: "tablespoon" },
    { name: "turmeric", amount: 0.5, unit: "teaspoon" },
    { name: "red chili powder", amount: 1, unit: "teaspoon" },
    { name: "coriander powder", amount: 1, unit: "teaspoon" },
    { name: "garam masala", amount: 0.5, unit: "teaspoon" },
    { name: "mustard seeds", amount: 0.5, unit: "teaspoon" },
    { name: "oil", amount: 2, unit: "tablespoon" },
    { name: "salt", amount: 1, unit: "teaspoon" }
  ],
  "chicken biryani": [
    { name: "chicken", amount: 300, unit: "grams" },
    { name: "basmati rice", amount: 1, unit: "cup" },
    { name: "onion", amount: 2, unit: "medium" },
    { name: "tomato", amount: 1, unit: "medium" },
    { name: "yogurt", amount: 0.5, unit: "cup" },
    { name: "ginger garlic paste", amount: 1, unit: "tablespoon" },
    { name: "green chili", amount: 2, unit: "piece" },
    { name: "mint leaves", amount: 0.25, unit: "cup" },
    { name: "coriander leaves", amount: 0.25, unit: "cup" },
    { name: "biryani masala", amount: 1, unit: "tablespoon" },
    { name: "turmeric", amount: 0.5, unit: "teaspoon" },
    { name: "red chili powder", amount: 1, unit: "teaspoon" },
    { name: "whole spices (bay leaf, cloves, cardamom)", amount: 1, unit: "tablespoon" },
    { name: "ghee", amount: 1, unit: "tablespoon" },
    { name: "salt", amount: 1, unit: "teaspoon" }
  ]
};


function matchToFallbackDB(originalDish, fallbackIngredients) {
  const match1 = fuzz.extract(originalDish, Object.keys(fallbackIngredients), {
    scorer: fuzz.token_set_ratio,
    limit: 1
  })[0];

  const [matchedName, score, index] = match1;
  if (score > 80) return fallbackIngredients[Object.keys(fallbackIngredients)[index]];
  return [];
}

const ingredientUnitToGrams = {
  oil: { tablespoon: 13, teaspoon: 4.5 },
  sugar: { tablespoon: 12.5, teaspoon: 4 },
  salt: { teaspoon: 6 },
  ghee: { tablespoon: 13 },
  water: { glass: 200, cup: 240 },
  rice: { cup: 200 },
  basmati_rice: { cup: 200 },
  yogurt: { cup: 240 },
  dal: { cup: 180 },
  chickpeas: { cup: 160 },
  garlic: { clove: 5 },
  ginger: { inch: 10 },
  ginger_garlic_paste: { tablespoon: 15 },
  onion: { medium: 100 },
  onions: { medium: 100 },
  tomato: { medium: 75 },
  tomatoes: { medium: 75 },
  potatoes: { medium: 150 },
  green_chili: { piece: 5 },
  cauliflower: { cup: 100 },
  coriander_powder: { teaspoon: 2 },
  red_chili_powder: { teaspoon: 2 },
  turmeric: { teaspoon: 2 },
  cumin_seeds: { teaspoon: 2 },
  garam_masala: { teaspoon: 2 },
  mustard_seeds: { teaspoon: 2 },
  mint_leaves: { cup: 10 },
  coriander_leaves: { cup: 10 },
  biryani_masala: { tablespoon: 8 },
  chicken: { grams: 1 },
  chana_masala: { teaspoon: 2 } 
};


function fetchGrams(ing, unitMap) {
  const nameKey = ing.name.toLowerCase().replace(/\s+/g, "_");
  const unitKey = ing.unit.toLowerCase();

  if (
    unitMap[nameKey] &&
    unitMap[nameKey][unitKey]
  ) {
    return ing.amount * unitMap[nameKey][unitKey] === 0? 10: ing.amount * unitMap[nameKey][unitKey];
  }

  return 10; 
}
async function processSingleDish(item) {
  const nutritionData = await loadNutritionData();
  const debugLogs = [];


    let { dish, issues } = item;
    const originalDish = dish;
    debugLogs.push(`\n🔍 Processing: ${originalDish}`);
    let ingredients = [];

    
    if (issues.includes("spelling variation")) {
      const words = dish.match(/\b\w+\b/g);
      if (words) {
        dish = words.map(word => {
          const [bestMatch, score] = fuzz.extract(word, nutritionData.map(d => d.food_name), {
            scorer: fuzz.token_set_ratio,
            limit: 1
          })[0];
          return score > 80 ? bestMatch : word;
        }).join(" ");
      }
      debugLogs.push(`✔️ Spelling corrected: ${dish}`);
    }

    
    if (issues.includes("ingredient synonym")) {
      for (let syn in synonymMap) {
        const regex = new RegExp(`\\b${syn}\\b`, 'gi');
        if (regex.test(dish)) {
          dish = dish.replace(regex, synonymMap[syn]);
          debugLogs.push(`🔁 Replaced synonym "${syn}" → "${synonymMap[syn]}"`);
        }
      }
    }

    
    if (issues.includes("ambiguous dish type")) {
      dish += ` ${DEFAULTS.type}`;
      debugLogs.push(`⚠️ Added default dish type: ${DEFAULTS.type}`);
    }
    if (issues.includes("ambiguous quantity")) {
      dish += ` (${DEFAULTS.quantity})`;
      debugLogs.push(`⚠️ Added default quantity: ${DEFAULTS.quantity}`);
    }
    if (issues.includes("ambiguous serving size")) {
      dish += ` ~${DEFAULTS.servingSize}`;
      debugLogs.push(`⚠️ Added default serving size: ${DEFAULTS.servingSize}`);
    }

    

      const apiIngredients = await fetchIngredientsFromAPI(originalDish);
      if (apiIngredients.length > 0) {
        debugLogs.push(`🌐 Ingredients fetched from API: ${apiIngredients.map(i => i.name).join(", ")}`);
        ingredients = apiIngredients;
      } else {
        debugLogs.push(`❌ No ingredients found from API for: "${originalDish} Fetched from my DB"`);
        ingredients =  matchToFallbackDB(originalDish,fallbackIngredients);
        console.log(`Ingredients for ${originalDish}:`, ingredients);
      }


    
    let totalNutrition = { calories: 0,protein: 0, carbs: 0, fat: 0 };
    for (let ing of ingredients) {
      const match = matchToNutritionDB(ing, nutritionData);
      const grams = fetchGrams(ing,ingredientUnitToGrams);
      if (match) {
        totalNutrition.calories += parseFloat(match.energy_kcal) * grams/100;
        totalNutrition.protein += parseFloat(match.protein_g) * grams/100;
        totalNutrition.carbs += parseFloat(match.carb_g) * grams/100;
        totalNutrition.fat += parseFloat(match.fat_g)* grams/100;
        debugLogs.push(`   🧪 ${match.food_name}:  CAL: ${match.energy_kcal}kcal P: ${match.protein_g}g, C: ${match.carb_g}g, F: ${match.fat_g}g`);
      } else {
        debugLogs.push(`   ❓ Ingredient not in DB: ${ing.name}`);
      }
    }
    const servinggramsbytype = await foodCategoryData();
    const dishType = inferDishType(dish, ingredients);
    console.log(totalNutrition)
    const servingGrams = dishType ? parseInt(servinggramsbytype.find(d => d["Food category name"] === dishType)["Weight Cat"]) : 100;
    debugLogs.push(`   🍽️ Serving size: ${servingGrams}g`);
    const totalPer100g = {
      calories: (totalNutrition.calories / servingGrams)*100,
      protein: (totalNutrition.protein / servingGrams)*100,
      carbs: (totalNutrition.carbs / servingGrams)*100,
      fat: (totalNutrition.fat / servingGrams)*100
    };
    const perKatori = {
      calories: (totalNutrition.calories),
      protein: (totalNutrition.protein),
      carbs: (totalNutrition.carbs),
      fat: (totalNutrition.fat)
    };

    debugLogs.push(`   ➕ Nutrition (per 100g avg): ${totalPer100g.calories.toFixed(1)} kcal`);
    debugLogs.push(`   🍽️ Per 1 katori (~${servingGrams}g):`);
    debugLogs.push(`      🥩 P: ${perKatori.protein.toFixed(1)}g`);
    debugLogs.push(`      🍞 C: ${perKatori.carbs.toFixed(1)}g`);
    debugLogs.push(`      🧈 F: ${perKatori.fat.toFixed(1)}g`);

  fs.writeFileSync('debug-log.txt', debugLogs.join('\n'), 'utf-8');
  console.log('✅ debug-log.txt generated.');
}
async function processDishData(dishes) {
  const nutritionData = await loadNutritionData();
  const debugLogs = [];

  for (let item of dishes) {
    let { dish, issues } = item;
    const originalDish = dish;
    debugLogs.push(`\n🔍 Processing: ${originalDish}`);
    let ingredients = [];

    
    if (issues.includes("spelling variation")) {
      const words = dish.match(/\b\w+\b/g);
      if (words) {
        dish = words.map(word => {
          const [bestMatch, score] = fuzz.extract(word, nutritionData.map(d => d.food_name), {
            scorer: fuzz.token_set_ratio,
            limit: 1
          })[0];
          return score > 80 ? bestMatch : word;
        }).join(" ");
      }
      debugLogs.push(`✔️ Spelling corrected: ${dish}`);
    }

    
    if (issues.includes("ingredient synonym")) {
      for (let syn in synonymMap) {
        const regex = new RegExp(`\\b${syn}\\b`, 'gi');
        if (regex.test(dish)) {
          dish = dish.replace(regex, synonymMap[syn]);
          debugLogs.push(`🔁 Replaced synonym "${syn}" → "${synonymMap[syn]}"`);
        }
      }
    }

    
    if (issues.includes("ambiguous dish type")) {
      dish += ` ${DEFAULTS.type}`;
      debugLogs.push(`⚠️ Added default dish type: ${DEFAULTS.type}`);
    }
    if (issues.includes("ambiguous quantity")) {
      dish += ` (${DEFAULTS.quantity})`;
      debugLogs.push(`⚠️ Added default quantity: ${DEFAULTS.quantity}`);
    }
    if (issues.includes("ambiguous serving size")) {
      dish += ` ~${DEFAULTS.servingSize}`;
      debugLogs.push(`⚠️ Added default serving size: ${DEFAULTS.servingSize}`);
    }

    // Step 4: Try DB match or fallback to API

      const apiIngredients = await fetchIngredientsFromAPI(originalDish);
      if (apiIngredients.length > 0) {
        debugLogs.push(`🌐 Ingredients fetched from API: ${apiIngredients.map(i => i.name).join(", ")}`);
        ingredients = apiIngredients;
      } else {
        debugLogs.push(`❌ No ingredients found from API for: "${originalDish} Fetched from my DB"`);
        ingredients =  matchToFallbackDB(originalDish,fallbackIngredients);
        console.log(`Ingredients for ${originalDish}:`, ingredients);
      }


    // Step 5: Map to nutrition DB and calculate total
    let totalNutrition = { calories: 0,protein: 0, carbs: 0, fat: 0 };
    for (let ing of ingredients) {
      const match = matchToNutritionDB(ing, nutritionData);
      const grams = fetchGrams(ing,ingredientUnitToGrams);
      if (match) {
        totalNutrition.calories += parseFloat(match.energy_kcal) * grams/100;
        totalNutrition.protein += parseFloat(match.protein_g) * grams/100;
        totalNutrition.carbs += parseFloat(match.carb_g) * grams/100;
        totalNutrition.fat += parseFloat(match.fat_g)* grams/100;
        debugLogs.push(`   🧪 ${match.food_name}:  CAL: ${match.energy_kcal}kcal P: ${match.protein_g}g, C: ${match.carb_g}g, F: ${match.fat_g}g`);
      } else {
        debugLogs.push(`   ❓ Ingredient not in DB: ${ing.name}`);
      }
    }
    const servinggramsbytype = await foodCategoryData();
    const dishType = inferDishType(dish, ingredients);
    console.log(totalNutrition)
    const servingGrams = dishType ? parseInt(servinggramsbytype.find(d => d["Food category name"] === dishType)["Weight Cat"]) : 100;
    debugLogs.push(`   🍽️ Serving size: ${servingGrams}g`);
    const totalPer100g = {
      calories: (totalNutrition.calories / servingGrams)*100,
      protein: (totalNutrition.protein / servingGrams)*100,
      carbs: (totalNutrition.carbs / servingGrams)*100,
      fat: (totalNutrition.fat / servingGrams)*100
    };
    const perKatori = {
      calories: (totalNutrition.calories),
      protein: (totalNutrition.protein),
      carbs: (totalNutrition.carbs),
      fat: (totalNutrition.fat)
    };

    debugLogs.push(`   ➕ Nutrition (per 100g avg): ${totalPer100g.calories.toFixed(1)} kcal`);
    debugLogs.push(`   🍽️ Per 1 katori (~${servingGrams}g):`);
    debugLogs.push(`      🥩 P: ${perKatori.protein.toFixed(1)}g`);
    debugLogs.push(`      🍞 C: ${perKatori.carbs.toFixed(1)}g`);
    debugLogs.push(`      🧈 F: ${perKatori.fat.toFixed(1)}g`);
  }

  fs.writeFileSync('debug-log.txt', debugLogs.join('\n'), 'utf-8');
  console.log('✅ debug-log.txt generated.');
}


const sampleDishes = [ 
{ "dish": "Jeera Aloo (mild fried)", "issues": ["ingredient synonym", "quantity missing"] }, 
{ "dish": "Gobhi Sabzi", "issues": ["ambiguous dish type"] }, 
{ "dish": "Chana masala", "issues": ["missing ingredient in nutrition DB"] }, 
{ "dish": "Paneer Curry with capsicum", "issues": ["unit in 'glass'", "spelling variation"] }, 
{ "dish": "Mixed veg", "issues": ["no fixed recipe", "ambiguous serving size"] } 
] 


app.get('/process-dishes', async (req, res) => {
  try {
    const result = await processDishData(sampleDishes); // Wait for the async function to complete
    res.send(result); // Send the result back to the client
  } catch (error) {
    res.status(500).send("Error processing dish data");
    console.error(error);
  }
});

app.get('/process-single-dish', async (req, res) => {
  try {
    const body = await req.body;
    console.log(body);
    const result = await processSingleDish(req.body); // Wait for the async function to complete
    res.send(result); // Send the result back to the client
  } catch (error) {
    res.status(500).send("Error processing dish data");
    console.error(error);
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
