BEGIN;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('personnel-hr-payroll','personnel-hr-payroll',false,2097152,ARRAY['application/pdf']);
-- All access is authorized through the scoped HR command before a short signed URL.
-- Restrictive policy also protects against inherited broad permissive policies.
CREATE POLICY hr_payroll_private ON storage.objects AS RESTRICTIVE FOR ALL TO anon,authenticated
USING(bucket_id<>'personnel-hr-payroll') WITH CHECK(bucket_id<>'personnel-hr-payroll');
COMMIT;
