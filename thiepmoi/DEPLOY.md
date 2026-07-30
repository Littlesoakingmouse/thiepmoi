# Deploy Cloudflare Pages + Supabase

## 1. Tao database Supabase

1. Tao project tren Supabase.
2. Mo SQL Editor.
3. Chay noi dung trong `supabase/schema.sql`.
4. Vao Project Settings > API va lay:
   - `Project URL`
   - `service_role key`

Khong dua `service_role key` vao file frontend. Key nay chi dat trong bien moi truong Cloudflare.

## 2. Cau hinh Cloudflare Pages

Neu deploy qua Git:

- Root directory: `thiepmoi`
- Build command: `npm run build`
- Build output directory: `_site`

Them Environment variables:

- `SUPABASE_URL`: Project URL cua Supabase
- `SUPABASE_SERVICE_ROLE_KEY`: service_role key cua Supabase, hoac dung `SUPABASE_SECRET_KEY` neu Supabase hien key moi dang `sb_secret_...`
- `ADMIN_TOKEN`: mat khau rieng de mo trang quan tri tao thu moi

## 3. Chay build local de kiem tra

```bash
cd thiepmoi
npm run build
```

Thu muc `_site` se gom source web va chi cac file trong `resource` dang duoc su dung.

## 4. Cach dung sau khi deploy

- Mo `/tao-thu-moi.html` de tao link moi rieng cho tung nguoi.
- Khi trang quan tri hoi token, nhap gia tri `ADMIN_TOKEN` da tao tren Cloudflare.
- Link moi tao ra se co dang `/index.html?guest=Ten%20Khach`.
- Khach mo link, bam la thu, nhac bat dau chay va RSVP se duoc luu vao Supabase.
