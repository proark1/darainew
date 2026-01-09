-- Remove the old redundant policy that conflicts with the new sharing policy
DROP POLICY IF EXISTS "Users can view shared contracts" ON public.contracts;