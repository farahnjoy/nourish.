-- Create profiles table with user management
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create vitamins/nutrients reference table
CREATE TABLE IF NOT EXISTS public.nutrients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  daily_recommended_value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user symptoms log
CREATE TABLE IF NOT EXISTS public.symptom_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symptoms TEXT NOT NULL,
  ai_response JSONB,
  recommended_nutrients TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user nutrient tracking
CREATE TABLE IF NOT EXISTS public.nutrient_intake (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nutrient_id UUID REFERENCES public.nutrients(id) ON DELETE SET NULL,
  amount DECIMAL,
  unit TEXT,
  source TEXT, -- 'food_scan' or 'manual'
  meal_time TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create meals table for food scanner
CREATE TABLE IF NOT EXISTS public.meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meal_name TEXT NOT NULL,
  meal_type TEXT, -- breakfast, lunch, dinner, snack
  image_url TEXT,
  nutrients_detected JSONB,
  meal_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.symptom_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrient_intake ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can delete their own profile" ON public.profiles
  FOR DELETE USING (auth.uid() = id);

-- RLS Policies for symptom_logs
CREATE POLICY "Users can view their own symptom logs" ON public.symptom_logs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own symptom logs" ON public.symptom_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own symptom logs" ON public.symptom_logs
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own symptom logs" ON public.symptom_logs
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for nutrient_intake
CREATE POLICY "Users can view their own nutrient intake" ON public.nutrient_intake
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own nutrient intake" ON public.nutrient_intake
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own nutrient intake" ON public.nutrient_intake
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own nutrient intake" ON public.nutrient_intake
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for meals
CREATE POLICY "Users can view their own meals" ON public.meals
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own meals" ON public.meals
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own meals" ON public.meals
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own meals" ON public.meals
  FOR DELETE USING (auth.uid() = user_id);

-- Allow anyone to read nutrients (reference table)
CREATE POLICY "Anyone can view nutrients" ON public.nutrients
  FOR SELECT USING (true);
