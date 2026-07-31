-- Allow authenticated users to cancel their own pending orders
DROP POLICY IF EXISTS "auth cancel own pending orders" ON orders;
CREATE POLICY "auth cancel own pending orders" ON orders
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status = 'pending')
  WITH CHECK (user_id = auth.uid() AND status = 'cancelled');
