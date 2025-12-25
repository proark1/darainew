-- Add kindergarten and school attendance fields to family_members
ALTER TABLE public.family_members 
ADD COLUMN attends_kindergarten boolean DEFAULT false,
ADD COLUMN attends_school boolean DEFAULT false,
ADD COLUMN kindergarten_name text,
ADD COLUMN kindergarten_teacher_name text,
ADD COLUMN kindergarten_teacher_contact text;