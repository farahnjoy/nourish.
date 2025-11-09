-- Seed common vitamins and nutrients
INSERT INTO public.nutrients (name, description, daily_recommended_value) VALUES
  ('Vitamin D', 'Supports bone health, immune function, and mood regulation', '600-800 IU'),
  ('Vitamin B12', 'Essential for nerve function, red blood cell production, and DNA synthesis', '2.4 mcg'),
  ('Iron', 'Crucial for oxygen transport in blood and energy production', '8-18 mg'),
  ('Magnesium', 'Supports muscle and nerve function, blood sugar control, and bone health', '310-420 mg'),
  ('Vitamin C', 'Boosts immune system, aids in collagen production, and acts as an antioxidant', '75-90 mg'),
  ('Calcium', 'Essential for strong bones and teeth, muscle function, and nerve signaling', '1000-1200 mg'),
  ('Omega-3 Fatty Acids', 'Supports heart health, brain function, and reduces inflammation', '250-500 mg'),
  ('Zinc', 'Important for immune function, wound healing, and protein synthesis', '8-11 mg'),
  ('Vitamin A', 'Supports vision, immune function, and skin health', '700-900 mcg'),
  ('Folate (Vitamin B9)', 'Crucial for DNA synthesis, cell division, and fetal development', '400 mcg'),
  ('Potassium', 'Regulates fluid balance, muscle contractions, and nerve signals', '2600-3400 mg'),
  ('Vitamin E', 'Acts as an antioxidant, protects cells from damage', '15 mg')
ON CONFLICT DO NOTHING;
