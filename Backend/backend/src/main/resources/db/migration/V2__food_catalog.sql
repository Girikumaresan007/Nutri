-- V2__food_catalog.sql: Verified Nutrition Catalog with Standard Reference Portions
-- Stage 10: Broad Food Recognition and Verified Nutrition Database

CREATE TABLE IF NOT EXISTS food_catalog (
    id                     uuid PRIMARY KEY,
    code                   varchar(50) NOT NULL UNIQUE,
    canonical_name         varchar(150) NOT NULL,
    regional_aliases       text NOT NULL DEFAULT '',
    category               varchar(50) NOT NULL,
    preparation_method     varchar(100),
    calories_per_100g      numeric(8, 2) NOT NULL CHECK (calories_per_100g >= 0),
    protein_per_100g       numeric(8, 2) NOT NULL CHECK (protein_per_100g >= 0),
    carbohydrates_per_100g numeric(8, 2) NOT NULL CHECK (carbohydrates_per_100g >= 0),
    fat_per_100g           numeric(8, 2) NOT NULL CHECK (fat_per_100g >= 0),
    fiber_per_100g         numeric(8, 2) NOT NULL CHECK (fiber_per_100g >= 0),
    data_source            varchar(100) NOT NULL,
    source_reference_id    varchar(100),
    recipe_type            varchar(30) NOT NULL,
    default_serving_unit   varchar(30) NOT NULL,
    default_serving_grams  numeric(8, 2) NOT NULL CHECK (default_serving_grams > 0),
    serving_conversions    text NOT NULL, -- JSON formatted mapping of unit names to gram weights
    default_warning        varchar(500),
    version                integer NOT NULL DEFAULT 1,
    created_at             timestamptz NOT NULL DEFAULT now(),
    updated_at             timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT catalog_recipe_type_chk CHECK (recipe_type IN ('MEASURED_FOOD', 'STANDARD_RECIPE', 'APPROXIMATE_RECIPE'))
);

CREATE INDEX IF NOT EXISTS idx_food_catalog_canonical ON food_catalog (lower(canonical_name));
CREATE INDEX IF NOT EXISTS idx_food_catalog_category ON food_catalog (category);
CREATE INDEX IF NOT EXISTS idx_food_catalog_code ON food_catalog (code);

-- Seed verified food catalog items idempotently (ON CONFLICT DO UPDATE)
INSERT INTO food_catalog (
    id, code, canonical_name, regional_aliases, category, preparation_method,
    calories_per_100g, protein_per_100g, carbohydrates_per_100g, fat_per_100g, fiber_per_100g,
    data_source, source_reference_id, recipe_type,
    default_serving_unit, default_serving_grams, serving_conversions, default_warning
) VALUES
-- South Indian Staples
('10000000-0000-0000-0000-000000000001', 'IFCT_IDLI', 'Idli', 'idly, steamed rice cake, thatte idli', 'BREAKFAST_GRAINS', 'Steamed fermented rice and urad dal batter', 132.0, 5.2, 26.5, 0.5, 2.1, 'ICMR-NIN IFCT 2017', 'IFCT-2017-B004', 'STANDARD_RECIPE', 'piece', 50.0, '{"piece": 50, "plate (2 pieces)": 100, "plate (3 pieces)": 150, "g": 1}', 'Chutney and sambar calories should be added separately if consumed.'),
('10000000-0000-0000-0000-000000000002', 'IFCT_DOSA_PLAIN', 'Plain Dosa', 'dosa, dosai, sada dosa', 'BREAKFAST_GRAINS', 'Griddled fermented batter with shallow oil', 205.0, 4.8, 33.2, 5.8, 2.0, 'ICMR-NIN IFCT 2017', 'IFCT-2017-B005', 'STANDARD_RECIPE', 'dosa', 100.0, '{"dosa": 100, "large dosa": 150, "g": 1}', 'Oil or ghee used on tawa affects total calories.'),
('10000000-0000-0000-0000-000000000003', 'IFCT_DOSA_MASALA', 'Masala Dosa', 'masala dosai, aloo dosa', 'BREAKFAST_GRAINS', 'Griddled fermented batter filled with spiced potato masala', 220.0, 4.0, 30.0, 9.3, 2.7, 'ICMR-NIN IFCT 2017', 'IFCT-2017-B006', 'STANDARD_RECIPE', 'dosa', 150.0, '{"dosa": 150, "g": 1}', 'Potato filling and roasting fat (butter/ghee) alter total energy density.'),
('10000000-0000-0000-0000-000000000004', 'IFCT_PONGAL', 'Ven Pongal', 'pongal, khara pongal, ghee pongal', 'BREAKFAST_GRAINS', 'Cooked rice and moong dal tempered with ghee, pepper, cashews', 165.0, 4.5, 26.0, 4.8, 2.2, 'ICMR-NIN IFCT 2017', 'IFCT-2017-B012', 'STANDARD_RECIPE', 'bowl (katori)', 200.0, '{"bowl (katori)": 200, "plate": 250, "g": 1}', 'Ghee tempering volume varies widely between home and temple/hotel preparation.'),
('10000000-0000-0000-0000-000000000005', 'IFCT_UPMA', 'Rava Upma', 'upma, uppittu, sooji upma', 'BREAKFAST_GRAINS', 'Roasted semolina cooked with vegetables, curry leaves and mustard seeds', 155.0, 3.5, 25.0, 4.5, 2.0, 'ICMR-NIN IFCT 2017', 'IFCT-2017-B018', 'STANDARD_RECIPE', 'bowl (katori)', 180.0, '{"bowl (katori)": 180, "plate": 220, "g": 1}', 'Oil quantity added during semolina roasting affects calories.'),
('10000000-0000-0000-0000-000000000006', 'IFCT_MEDU_VADA', 'Medu Vada', 'vada, uddina vade, medhu vadai', 'SNACKS_STREETFOOD', 'Deep-fried spiced urad dal doughnut fritter', 275.0, 8.5, 31.0, 13.0, 4.2, 'ICMR-NIN IFCT 2017', 'IFCT-2017-B020', 'STANDARD_RECIPE', 'piece', 45.0, '{"piece": 45, "plate (2 pieces)": 90, "g": 1}', 'Deep-fried item; cooking oil absorption varies with frying temperature.'),
('10000000-0000-0000-0000-000000000007', 'IFCT_SAMBAR', 'Sambar', 'sambhar, lentil vegetable stew', 'CURRIES_GRAVIES', 'Toor dal simmered with vegetables, tamarind and ground spices', 65.0, 2.8, 9.5, 1.8, 2.2, 'ICMR-NIN IFCT 2017', 'IFCT-2017-C008', 'STANDARD_RECIPE', 'bowl (katori)', 150.0, '{"bowl (katori)": 150, "cup": 200, "tbsp": 15, "g": 1}', 'Vegetable ratio and dal thickness can vary portion calories.'),
('10000000-0000-0000-0000-000000000008', 'IFCT_RASAM', 'Rasam', 'charu, saaru, tomato rasam', 'CURRIES_GRAVIES', 'Thin tamarind and tomato broth seasoned with rasam powder', 35.0, 1.0, 6.0, 0.8, 0.6, 'ICMR-NIN IFCT 2017', 'IFCT-2017-C009', 'STANDARD_RECIPE', 'cup', 150.0, '{"cup": 150, "bowl": 150, "g": 1}', 'Low calorie digestive broth; minimal added oil.'),
('10000000-0000-0000-0000-000000000009', 'IFCT_CURD_RICE', 'Curd Rice', 'thayir sadam, daddojanam, bagala bath', 'RICE_DISHES', 'Steamed rice mixed with plain curd and tempered with mustard seeds', 125.0, 3.2, 20.0, 3.5, 0.8, 'ICMR-NIN IFCT 2017', 'IFCT-2017-B025', 'STANDARD_RECIPE', 'bowl (katori)', 200.0, '{"bowl (katori)": 200, "plate": 250, "g": 1}', 'Full-fat vs toned curd and oil tempering impact total fat content.'),

-- Rice & Biryani Dishes
('10000000-0000-0000-0000-000000000010', 'IFCT_WHITE_RICE', 'Steamed White Rice', 'cooked rice, chawal, sadam, bhat', 'RICE_DISHES', 'Boiled milled white rice without added oil or salt', 130.0, 2.7, 28.2, 0.3, 0.4, 'ICMR-NIN IFCT 2017', 'IFCT-2017-A001', 'MEASURED_FOOD', 'bowl (katori)', 150.0, '{"bowl (katori)": 150, "cup": 180, "plate": 250, "g": 1}', 'Plain cooked rice. Add ~45 kcal if 1 tsp ghee is mixed in.'),
('10000000-0000-0000-0000-000000000011', 'IFCT_CHICKEN_BIRYANI', 'Chicken Biryani', 'dum biryani, hyderabadi chicken biryani, murgh biryani', 'RICE_DISHES', 'Layered spiced basmati rice and marinated chicken cooked in dum', 185.0, 8.5, 22.0, 7.0, 1.2, 'Standard Indian Recipe Analysis (IFCT-derived)', 'SIRA-B001', 'APPROXIMATE_RECIPE', 'plate', 250.0, '{"plate": 250, "half plate": 150, "bowl": 200, "g": 1}', 'Restaurant preparations contain variable amounts of ghee, oil, and chicken piece cuts with skin/bone.'),
('10000000-0000-0000-0000-000000000012', 'IFCT_VEG_BIRYANI', 'Vegetable Dum Biryani', 'veg biryani, vegetable pulao biryani', 'RICE_DISHES', 'Basmati rice cooked with spiced vegetables, saffron, mint and fried onions', 160.0, 3.8, 26.0, 4.5, 2.5, 'Standard Indian Recipe Analysis (IFCT-derived)', 'SIRA-B002', 'APPROXIMATE_RECIPE', 'plate', 250.0, '{"plate": 250, "half plate": 150, "bowl": 200, "g": 1}', 'Cooking oil and fried onions (birista) contribute to calorie variation.'),
('10000000-0000-0000-0000-000000000013', 'IFCT_KHICHDI', 'Moong Dal Khichdi', 'khichdi, khichuri, dal khichadi', 'RICE_DISHES', 'Rice and yellow moong dal slow-cooked together with turmeric and cumin', 120.0, 3.8, 22.0, 1.8, 2.0, 'ICMR-NIN IFCT 2017', 'IFCT-2017-B015', 'STANDARD_RECIPE', 'bowl (katori)', 220.0, '{"bowl (katori)": 220, "plate": 280, "g": 1}', 'Add ~45 kcal per teaspoon of ghee added on top.'),

-- Flatbreads & Roti
('10000000-0000-0000-0000-000000000014', 'IFCT_CHAPATI', 'Chapati / Phulka', 'roti, phulka, fulka, chapatti', 'BREADS', 'Whole wheat flour flatbread cooked dry on tawa without fat', 260.0, 7.8, 50.0, 2.0, 7.0, 'ICMR-NIN IFCT 2017', 'IFCT-2017-B001', 'STANDARD_RECIPE', 'roti', 40.0, '{"roti": 40, "2 rotis": 80, "3 rotis": 120, "g": 1}', 'Unbuttered whole wheat roti. Add ~35-45 kcal if brushed with ghee or oil.'),
('10000000-0000-0000-0000-000000000015', 'IFCT_PARATHA_PLAIN', 'Plain Tawa Paratha', 'paratha, parotta, tawa paratha', 'BREADS', 'Layered whole wheat flatbread roasted on tawa with oil or ghee', 320.0, 6.5, 45.0, 12.5, 5.5, 'ICMR-NIN IFCT 2017', 'IFCT-2017-B002', 'STANDARD_RECIPE', 'paratha', 70.0, '{"paratha": 70, "g": 1}', 'Fat content varies depending on oil/ghee used during pan-roasting.'),
('10000000-0000-0000-0000-000000000016', 'IFCT_PURI', 'Poori / Puri', 'puri, poori, deep fried flatbread', 'BREADS', 'Unleavened wheat flour dough rolled thin and deep fried in oil', 380.0, 6.8, 48.0, 18.0, 5.0, 'ICMR-NIN IFCT 2017', 'IFCT-2017-B003', 'STANDARD_RECIPE', 'puri', 35.0, '{"puri": 35, "2 puris": 70, "g": 1}', 'High fat density due to deep frying; oil absorption varies with oil heat.'),
('10000000-0000-0000-0000-000000000017', 'IFCT_BHATURA', 'Bhatura', 'bhatoora, chole bhature bhatura', 'BREADS', 'Fermented refined flour deep-fried leavened flatbread', 340.0, 7.0, 49.0, 13.0, 2.5, 'ICMR-NIN IFCT 2017', 'IFCT-2017-B008', 'STANDARD_RECIPE', 'piece', 80.0, '{"piece": 80, "2 pieces": 160, "g": 1}', 'Refined flour and frying oil significantly increase energy density.'),
('10000000-0000-0000-0000-000000000018', 'IFCT_NAAN_BUTTER', 'Butter Naan', 'naan, tandoori butter naan', 'BREADS', 'Tandoor-baked leavened flatbread glazed with butter', 290.0, 7.8, 47.0, 8.3, 2.2, 'Standard Indian Recipe Analysis (IFCT-derived)', 'SIRA-B004', 'APPROXIMATE_RECIPE', 'naan', 90.0, '{"naan": 90, "g": 1}', 'Refined flour flatbread; butter quantity varies by restaurant.'),

-- Dals & Pulses
('10000000-0000-0000-0000-000000000019', 'IFCT_DAL_TADKA', 'Dal Tadka', 'yellow dal, toor dal tadka, arhar dal', 'CURRIES_GRAVIES', 'Boiled yellow pigeon pea (toor dal) with cumin-ghee tadka', 115.0, 5.5, 15.0, 3.8, 3.5, 'ICMR-NIN IFCT 2017', 'IFCT-2017-C001', 'STANDARD_RECIPE', 'bowl (katori)', 150.0, '{"bowl (katori)": 150, "cup": 200, "g": 1}', 'Ghee/oil in tadka alters calorie density.'),
('10000000-0000-0000-0000-000000000020', 'IFCT_DAL_MAKHANI', 'Dal Makhani', 'maa ki dal, black dal with butter and cream', 'CURRIES_GRAVIES', 'Slow-cooked whole black gram and red kidney beans with cream and butter', 140.0, 5.0, 12.0, 8.0, 3.0, 'ICMR-NIN IFCT 2017', 'IFCT-2017-C002', 'APPROXIMATE_RECIPE', 'bowl (katori)', 200.0, '{"bowl (katori)": 200, "cup": 240, "g": 1}', 'Restaurant preparations often contain generous butter and dairy cream.'),
('10000000-0000-0000-0000-000000000021', 'IFCT_RAJMA', 'Rajma Masala', 'rajma chawal gravy, red kidney bean curry', 'CURRIES_GRAVIES', 'Red kidney beans stewed in spiced onion-tomato gravy', 130.0, 5.8, 18.0, 4.0, 4.8, 'ICMR-NIN IFCT 2017', 'IFCT-2017-C005', 'STANDARD_RECIPE', 'bowl (katori)', 180.0, '{"bowl (katori)": 180, "cup": 220, "g": 1}', 'Rich in complex carbohydrates and dietary fiber; gravy oil varies.'),
('10000000-0000-0000-0000-000000000022', 'IFCT_CHOLE', 'Chole / Chana Masala', 'chole curry, punjabi chana masala, chickpea curry', 'CURRIES_GRAVIES', 'White chickpeas simmered in spicy onion-tomato gravy', 145.0, 6.2, 20.0, 4.5, 5.2, 'ICMR-NIN IFCT 2017', 'IFCT-2017-C006', 'STANDARD_RECIPE', 'bowl (katori)', 180.0, '{"bowl (katori)": 180, "plate": 250, "g": 1}', 'Chickpeas are naturally nutrient-dense and high in prebiotic fiber.'),

-- Vegetables & Paneer
('10000000-0000-0000-0000-000000000023', 'IFCT_PALAK_PANEER', 'Palak Paneer', 'spinach paneer, saag paneer', 'CURRIES_GRAVIES', 'Cottage cheese cubes simmered in spiced pureed spinach gravy', 145.0, 7.5, 5.0, 11.0, 2.5, 'ICMR-NIN IFCT 2017', 'IFCT-2017-C015', 'STANDARD_RECIPE', 'bowl (katori)', 180.0, '{"bowl (katori)": 180, "g": 1}', 'Paneer and cooking cream/ghee determine total fat content.'),
('10000000-0000-0000-0000-000000000024', 'IFCT_KADAI_PANEER', 'Kadai Paneer', 'karahi paneer, capsicum paneer', 'CURRIES_GRAVIES', 'Paneer and bell peppers cooked in freshly ground coriander-chili masala', 160.0, 8.0, 6.0, 12.0, 2.0, 'ICMR-NIN IFCT 2017', 'IFCT-2017-C016', 'STANDARD_RECIPE', 'bowl (katori)', 200.0, '{"bowl (katori)": 200, "g": 1}', 'Rich in dairy protein and calcium; gravy oil varies.'),
('10000000-0000-0000-0000-000000000025', 'IFCT_ALOO_GOBI', 'Aloo Gobi', 'alu gobhi, potato cauliflower sabzi', 'CURRIES_GRAVIES', 'Pan-sautéed potatoes and cauliflower florets with cumin and turmeric', 95.0, 2.2, 14.0, 3.5, 3.0, 'ICMR-NIN IFCT 2017', 'IFCT-2017-C021', 'STANDARD_RECIPE', 'bowl (katori)', 150.0, '{"bowl (katori)": 150, "g": 1}', 'Dry preparation; cooking oil determines calorie density.'),
('10000000-0000-0000-0000-000000000026', 'IFCT_BHINDI_MASALA', 'Bhindi Masala', 'okra fry, lady finger sabzi, bhindi fry', 'CURRIES_GRAVIES', 'Sautéed okra cooked with sliced onions, cumin, amchur and garam masala', 85.0, 2.0, 9.0, 4.5, 3.5, 'ICMR-NIN IFCT 2017', 'IFCT-2017-C023', 'STANDARD_RECIPE', 'bowl (katori)', 130.0, '{"bowl (katori)": 130, "g": 1}', 'Oil used to prevent slime during pan frying affects fat content.'),

-- Eggs, Poultry & Seafood
('10000000-0000-0000-0000-000000000027', 'USDA_BOILED_EGG', 'Boiled Egg', 'hard boiled egg, anda, boiled anda', 'PROTEIN_EGG_MEAT', 'Whole egg boiled in water without added fat', 155.0, 12.6, 1.1, 10.6, 0.0, 'USDA FoodData Central', 'FDC-171287', 'MEASURED_FOOD', 'egg', 50.0, '{"egg": 50, "2 eggs": 100, "egg white only": 33, "g": 1}', 'Values for 1 whole large boiled egg (50g). Egg whites only: 17 kcal/white.'),
('10000000-0000-0000-0000-000000000028', 'USDA_SCRAMBLED_EGGS', 'Scrambled Eggs', 'anda bhurji, scrambled egg', 'PROTEIN_EGG_MEAT', 'Beaten eggs pan-cooked with 1 teaspoon butter', 165.0, 11.0, 1.5, 12.5, 0.0, 'USDA FoodData Central', 'FDC-173424', 'STANDARD_RECIPE', 'portion (2 eggs)', 100.0, '{"portion (2 eggs)": 100, "1 egg": 50, "g": 1}', 'Cooking butter, oil, or cream will add extra calories.'),
('10000000-0000-0000-0000-000000000029', 'IFCT_CHICKEN_CURRY', 'Home-style Chicken Curry', 'chicken gravy, murgh curry, tari wala chicken', 'PROTEIN_EGG_MEAT', 'Bone-in chicken simmered in onion-tomato-ginger gravy', 150.0, 14.0, 4.5, 8.5, 1.2, 'Standard Indian Recipe Analysis (IFCT-derived)', 'SIRA-M001', 'APPROXIMATE_RECIPE', 'bowl (katori)', 180.0, '{"bowl (katori)": 180, "g": 1}', 'Skinless bone-in meat estimate. Boneless breast meat is leaner.'),
('10000000-0000-0000-0000-000000000030', 'USDA_CHICKEN_BREAST', 'Grilled Chicken Breast', 'grilled chicken, roasted chicken breast', 'PROTEIN_EGG_MEAT', 'Skinless boneless chicken breast seasoned and grilled', 165.0, 31.0, 0.0, 3.6, 0.0, 'USDA FoodData Central', 'FDC-171077', 'MEASURED_FOOD', 'portion', 120.0, '{"portion": 120, "g": 1}', 'Lean high-protein food. Oil marinades or glazes increase calorie count.'),
('10000000-0000-0000-0000-000000000031', 'IFCT_FISH_CURRY', 'South Indian Fish Curry', 'meen kulambu, chepala pulusu, fish curry', 'PROTEIN_EGG_MEAT', 'Fish simmered in tangy tamarind, chili and coconut gravy', 125.0, 13.5, 3.5, 6.2, 0.8, 'ICMR-NIN IFCT 2017', 'IFCT-2017-E004', 'STANDARD_RECIPE', 'bowl (katori)', 180.0, '{"bowl (katori)": 180, "g": 1}', 'Fish species (lean vs oily) and coconut milk volume affect total fat.'),

-- Snacks, Street Foods & Mixed Dishes
('10000000-0000-0000-0000-000000000032', 'IFCT_SAMOSA', 'Samosa', 'aloo samosa, vegetable samosa, singara', 'SNACKS_STREETFOOD', 'Deep-fried pastry filled with spiced potatoes and peas', 262.0, 4.4, 30.0, 13.8, 2.5, 'ICMR-NIN IFCT 2017', 'IFCT-2017-D001', 'STANDARD_RECIPE', 'piece', 80.0, '{"piece": 80, "2 pieces": 160, "g": 1}', 'Deep-fried item; sweet tamarind chutney adds extra sugar if consumed.'),
('10000000-0000-0000-0000-000000000033', 'IFCT_DHOKLA', 'Khaman Dhokla', 'dhokla, khaman, gujarati dhokla', 'SNACKS_STREETFOOD', 'Steamed fermented chickpea/gram flour cake with mustard seed tempering', 200.0, 6.25, 32.5, 5.0, 2.5, 'ICMR-NIN IFCT 2017', 'IFCT-2017-D005', 'STANDARD_RECIPE', 'piece', 40.0, '{"piece": 40, "2 pieces": 80, "plate (4 pieces)": 160, "g": 1}', 'Sugar syrup added during tempering can increase carbohydrate calories.'),
('10000000-0000-0000-0000-000000000034', 'IFCT_PANI_PURI', 'Pani Puri / Golgappa', 'golgappa, puchka, batasha, pakodi', 'SNACKS_STREETFOOD', 'Crisp semolina puris filled with potato-chickpea and spiced mint water', 150.0, 2.5, 23.3, 5.0, 1.7, 'ICMR-NIN IFCT 2017', 'IFCT-2017-D008', 'STANDARD_RECIPE', 'plate (6 puris)', 120.0, '{"plate (6 puris)": 120, "puri": 20, "g": 1}', 'Sweet dates/tamarind chutney adds sugar; mint water has near-zero calories.'),
('10000000-0000-0000-0000-000000000035', 'IFCT_PAV_BHAJI', 'Pav Bhaji', 'bhaji pav, bombay pav bhaji', 'SNACKS_STREETFOOD', 'Mashed spiced vegetable curry served with toasted buttered dinner rolls (pav)', 158.0, 3.2, 20.8, 7.2, 2.4, 'ICMR-NIN IFCT 2017', 'IFCT-2017-D012', 'APPROXIMATE_RECIPE', 'plate', 250.0, '{"plate": 250, "bhaji only (180g)": 180, "1 pav (35g)": 35, "g": 1}', 'Includes 180g bhaji and 2 buttered pav (70g). Street stalls often use heavy butter.'),
('10000000-0000-0000-0000-000000000036', 'IFCT_PAKODA', 'Onion Pakoda / Bhajji', 'pakode, onion pakora, kanda bhaji, pyaaz pakoda', 'SNACKS_STREETFOOD', 'Sliced onions coated in spiced gram flour (besan) and deep-fried', 280.0, 5.0, 24.0, 18.0, 3.0, 'ICMR-NIN IFCT 2017', 'IFCT-2017-D015', 'STANDARD_RECIPE', 'plate', 100.0, '{"plate": 100, "piece": 20, "g": 1}', 'High surface-area deep-fried snack with significant oil absorption.'),
('10000000-0000-0000-0000-000000000037', 'IFCT_MOMOS', 'Steamed Vegetable Momos', 'momos, dim sum, veg dumplings', 'SNACKS_STREETFOOD', 'Steamed thin dough wrappers stuffed with minced cabbage, onion and carrot', 160.0, 5.3, 24.0, 4.7, 1.5, 'Standard Indian Recipe Analysis (IFCT-derived)', 'SIRA-S006', 'STANDARD_RECIPE', 'portion (6 pieces)', 150.0, '{"portion (6 pieces)": 150, "momo (piece)": 25, "g": 1}', 'Steamed food; chili dipping sauce is typically low calorie unless oil-based.'),

-- Fresh Fruits, Vegetables & Salads
('10000000-0000-0000-0000-000000000038', 'USDA_SALAD', 'Fresh Garden Salad', 'green salad, kachumber, mixed salad', 'VEGETABLES', 'Raw sliced cucumber, tomato, carrot and onion with lemon dressing', 30.0, 1.2, 5.5, 0.3, 2.0, 'USDA FoodData Central', 'FDC-170379', 'MEASURED_FOOD', 'bowl', 150.0, '{"bowl": 150, "plate": 200, "g": 1}', 'Salad dressings or oils can add 70-150 kcal depending on preparation.'),
('10000000-0000-0000-0000-000000000039', 'USDA_APPLE', 'Fresh Apple', 'apple, seb, raw apple', 'FRUITS', 'Raw whole apple with skin', 52.0, 0.3, 13.8, 0.2, 2.4, 'USDA FoodData Central', 'FDC-171688', 'MEASURED_FOOD', 'piece', 150.0, '{"piece": 150, "small (120g)": 120, "large (200g)": 200, "g": 1}', 'Rich in pectin fiber; average medium apple weighs ~150g.'),
('10000000-0000-0000-0000-000000000040', 'USDA_BANANA', 'Fresh Banana', 'banana, kela, raw banana', 'FRUITS', 'Raw fresh peeled banana', 89.0, 1.1, 22.8, 0.3, 2.6, 'USDA FoodData Central', 'FDC-173944', 'MEASURED_FOOD', 'piece', 100.0, '{"piece": 100, "large (125g)": 125, "g": 1}', 'Rich in potassium and easily digestible carbohydrates.'),

-- Dairy & Beverages
('10000000-0000-0000-0000-000000000041', 'IFCT_CHAI', 'Masala Chai', 'tea, ginger tea, chai with milk', 'BEVERAGES', 'Brewed black tea with whole milk, spices and ~1 tsp sugar', 73.0, 2.3, 9.3, 3.0, 0.0, 'Standard Indian Recipe Analysis (IFCT-derived)', 'SIRA-B005', 'STANDARD_RECIPE', 'cup', 150.0, '{"cup": 150, "cutting chai (80ml)": 80, "g": 1}', 'Unsweetened chai is ~40 kcal per cup; whole milk vs skim milk alters fat.'),
('10000000-0000-0000-0000-000000000042', 'IFCT_DAHI', 'Plain Curd / Dahi', 'dahi, curd, yogurt, plain dahi', 'BEVERAGES', 'Fermented dairy curd from standardized cow/buffalo milk', 60.0, 3.5, 4.5, 3.2, 0.0, 'ICMR-NIN IFCT 2017', 'IFCT-2017-G001', 'MEASURED_FOOD', 'bowl (katori)', 150.0, '{"bowl (katori)": 150, "cup": 200, "g": 1}', 'Full-fat vs toned milk curd affects total calories and fat.'),
('10000000-0000-0000-0000-000000000043', 'IFCT_GULAB_JAMUN', 'Gulab Jamun', 'gulab jamun, jamun', 'SWEETS_DESSERTS', 'Deep-fried milk solids (khoya) dumplings soaked in flavored sugar syrup', 320.0, 4.5, 52.0, 10.5, 0.5, 'ICMR-NIN IFCT 2017', 'IFCT-2017-H002', 'STANDARD_RECIPE', 'piece', 40.0, '{"piece": 40, "2 pieces": 80, "g": 1}', 'High in simple sugars and saturated fats from khoya and frying medium.'),
('10000000-0000-0000-0000-000000000044', 'IFCT_JALEBI', 'Jalebi', 'jilapi, zulbi, crispy jalebi', 'SWEETS_DESSERTS', 'Deep-fried fermented refined flour swirls soaked in saffron sugar syrup', 400.0, 1.7, 73.3, 11.7, 0.8, 'ICMR-NIN IFCT 2017', 'IFCT-2017-H005', 'STANDARD_RECIPE', 'piece', 30.0, '{"piece": 30, "2 pieces": 60, "g": 1}', 'Very high carbohydrate and sugar density; deep fried in ghee or oil.')
ON CONFLICT (code) DO UPDATE SET
    canonical_name = EXCLUDED.canonical_name,
    regional_aliases = EXCLUDED.regional_aliases,
    category = EXCLUDED.category,
    preparation_method = EXCLUDED.preparation_method,
    calories_per_100g = EXCLUDED.calories_per_100g,
    protein_per_100g = EXCLUDED.protein_per_100g,
    carbohydrates_per_100g = EXCLUDED.carbohydrates_per_100g,
    fat_per_100g = EXCLUDED.fat_per_100g,
    fiber_per_100g = EXCLUDED.fiber_per_100g,
    data_source = EXCLUDED.data_source,
    source_reference_id = EXCLUDED.source_reference_id,
    recipe_type = EXCLUDED.recipe_type,
    default_serving_unit = EXCLUDED.default_serving_unit,
    default_serving_grams = EXCLUDED.default_serving_grams,
    serving_conversions = EXCLUDED.serving_conversions,
    default_warning = EXCLUDED.default_warning,
    updated_at = now();
