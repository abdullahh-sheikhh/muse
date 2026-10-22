-- Cover photos for the demo museums so the picker and museum pages show a real image.
UPDATE public.museums SET image_url = '/__l5e/assets-v1/7e9a4cb6-845e-4f9d-ab22-b553916ed154/musee-lumiere.jpg' WHERE slug = 'musee-lumiere';
UPDATE public.museums SET image_url = '/__l5e/assets-v1/425e480c-6374-6446-aa96-bd30d0a9caff/maison-des-brumes.jpg' WHERE slug = 'maison-des-brumes';
UPDATE public.museums SET image_url = '/__l5e/assets-v1/73769683-1f8f-4fc3-bed5-8b355c424a20/galerie-saint-roch.jpg' WHERE slug = 'galerie-saint-roch';