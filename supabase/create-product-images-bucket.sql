-- Create storage bucket for product images
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  false,
  5242880,
  '{image/jpeg,image/png,image/webp}'
)
ON CONFLICT (id) DO NOTHING;

-- Allow public SELECT on objects (anyone can view images)
CREATE POLICY "Public SELECT product-images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

-- Allow anon INSERT into product-images
CREATE POLICY "Anon INSERT product-images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'product-images');

-- Allow anon UPDATE on product-images
CREATE POLICY "Anon UPDATE product-images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'product-images');

-- Allow anon DELETE on product-images
CREATE POLICY "Anon DELETE product-images"
ON storage.objects FOR DELETE
USING (bucket_id = 'product-images');
