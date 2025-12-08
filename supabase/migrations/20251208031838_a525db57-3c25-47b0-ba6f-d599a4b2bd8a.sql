-- Drop the overly permissive UPDATE policy
DROP POLICY IF EXISTS "Anyone can update invite to accept" ON public.tenant_invites;

-- Create a new restrictive policy that only allows users to update invites addressed to their own email
CREATE POLICY "Users can accept own invites"
ON public.tenant_invites
FOR UPDATE
USING (
  -- The invite email must match the authenticated user's email
  LOWER(email) = LOWER(auth.email())
)
WITH CHECK (
  -- Same check for the new row
  LOWER(email) = LOWER(auth.email())
);

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';