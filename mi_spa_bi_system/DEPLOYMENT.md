# MI SPA BI System - Guía de Deployment

## 📋 Requisitos Previos

- Cuenta de [Supabase](https://supabase.com) (gratuita)
- Cuenta de [Vercel](https://vercel.com) (gratuita)
- Token de acceso de Bsale
- Node.js 18+ instalado

---

## 🚀 PASO 1: Configurar Supabase

### 1.1 Crear Proyecto
1. Ve a https://supabase.com → New Project
2. Nombre: `mi-spa-bi`
3. Región: South America (São Paulo)
4. Guarda la contraseña de la base de datos

### 1.2 Ejecutar Migraciones SQL
Ve a **SQL Editor** y ejecuta cada archivo en orden:

```
supabase/migrations/001_schema_completo.sql     ← Tablas y dimensiones
supabase/migrations/002_etl_logging.sql         ← Sistema de logs
supabase/migrations/003_etl_fixes.sql           ← Funciones de diagnóstico
supabase/migrations/004_grants_views.sql        ← Permisos
supabase/migrations/005_predicciones_alertas.sql ← Predicciones e IA
```

### 1.3 Obtener Credenciales
Ve a **Settings > API** y copia:
- `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
- `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` → Para Edge Functions (secreto)
- `Project Reference` → Para Supabase CLI

---

## 🚀 PASO 2: Mapear Bodegas de Bsale

### 2.1 Obtener IDs de Bodegas
1. Abre `tools/bsale_explorer.html` en el navegador
2. Ingresa tu token de Bsale
3. Click "Explorar"
4. Anota los IDs de cada bodega

### 2.2 Actualizar en Supabase
Ejecuta en SQL Editor (reemplaza X con IDs reales):

```sql
UPDATE bi.dim_bodegas SET bsale_office_id = X WHERE codigo = 'CASA_MATRIZ';
UPDATE bi.dim_bodegas SET bsale_office_id = X WHERE codigo = 'TIENDA_WEB';
UPDATE bi.dim_bodegas SET bsale_office_id = X WHERE codigo = 'CURANIPE';
UPDATE bi.dim_bodegas SET bsale_office_id = X WHERE codigo = 'MELI';
```

---

## 🚀 PASO 3: Deploy Edge Functions

### 3.1 Instalar Supabase CLI
```bash
npm install -g supabase
```

### 3.2 Login y Conectar Proyecto
```bash
supabase login
supabase link --project-ref TU_PROJECT_REF
```

### 3.3 Configurar Secretos
```bash
supabase secrets set BSALE_ACCESS_TOKEN=tu_token_de_bsale
```

### 3.4 Deploy Funciones
```bash
supabase functions deploy etl-bsale
supabase functions deploy etl-cobranza
supabase functions deploy refresh-views
supabase functions deploy whatsapp-webhook   # Opcional
```

---

## 🚀 PASO 4: Deploy Dashboard en Vercel

### 4.1 Preparar Proyecto
```bash
cd mi_spa_bi_system/dashboard
npm install
```

### 4.2 Opción A: Deploy con Vercel CLI
```bash
npm install -g vercel
vercel
```

Cuando pregunte por variables de entorno:
- `NEXT_PUBLIC_SUPABASE_URL` = tu URL de Supabase
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = tu anon key

### 4.2 Opción B: Deploy desde GitHub
1. Sube el código a GitHub
2. Ve a vercel.com → New Project
3. Importa tu repositorio
4. **Root Directory**: `mi_spa_bi_system/dashboard`
5. Agrega las Environment Variables
6. Deploy

---

## 🚀 PASO 5: Primera Carga de Datos

### 5.1 Ejecutar ETL Completo
Desde terminal:
```bash
curl -X POST https://TU_PROYECTO.supabase.co/functions/v1/etl-bsale \
  -H "Authorization: Bearer TU_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"tipo": "all"}'
```

O desde el dashboard en `/etl` → "Ejecutar ETL Completo"

### 5.2 Generar Alertas Iniciales
En SQL Editor:
```sql
SELECT bi.generar_alertas_sistema();
```

### 5.3 Verificar Datos
```sql
-- Conteos
SELECT 
  (SELECT COUNT(*) FROM bi.dim_productos) as productos,
  (SELECT COUNT(*) FROM bi.dim_clientes) as clientes,
  (SELECT COUNT(*) FROM bi.fact_ventas) as ventas,
  (SELECT COUNT(*) FROM bi.fact_stock) as stock;

-- Salud del sistema
SELECT * FROM bi.check_data_freshness();
SELECT * FROM bi.check_orphan_rate();
```

---

## ⚙️ PASO 6: Automatización (Opcional)

### Cron Job para ETL Diario
En Supabase, ve a **Database > Extensions** y habilita `pg_cron`.

Luego en SQL Editor:
```sql
-- ETL de stock diario a las 6 AM Chile
SELECT cron.schedule(
  'etl-stock-diario',
  '0 9 * * *',  -- 9 AM UTC = 6 AM Chile
  $$SELECT net.http_post(
    url := 'https://TU_PROYECTO.supabase.co/functions/v1/etl-bsale',
    headers := '{"Authorization": "Bearer TU_SERVICE_ROLE_KEY", "Content-Type": "application/json"}'::jsonb,
    body := '{"tipo": "stock"}'::jsonb
  );$$
);

-- ETL completo semanal (domingos 3 AM)
SELECT cron.schedule(
  'etl-completo-semanal',
  '0 6 * * 0',  -- 6 AM UTC = 3 AM Chile
  $$SELECT net.http_post(
    url := 'https://TU_PROYECTO.supabase.co/functions/v1/etl-bsale',
    headers := '{"Authorization": "Bearer TU_SERVICE_ROLE_KEY", "Content-Type": "application/json"}'::jsonb,
    body := '{"tipo": "all"}'::jsonb
  );$$
);
```

---

## 📱 WhatsApp (Opcional)

Para habilitar consultas por WhatsApp:

1. Crear app en Meta Business (developers.facebook.com)
2. Configurar WhatsApp Business API
3. Agregar secretos:
```bash
supabase secrets set WHATSAPP_TOKEN=tu_token
supabase secrets set WHATSAPP_PHONE_ID=tu_phone_id
```
4. Configurar webhook URL: `https://TU_PROYECTO.supabase.co/functions/v1/whatsapp-webhook`

---

## ✅ Checklist Final

- [ ] SQLs ejecutados (001-005)
- [ ] Bodegas mapeadas con IDs reales
- [ ] Edge Functions desplegadas
- [ ] Dashboard en Vercel
- [ ] Variables de entorno configuradas
- [ ] ETL ejecutado exitosamente
- [ ] Dashboard muestra datos
- [ ] Alertas generadas

---

## 🆘 Troubleshooting

### "BSALE_ACCESS_TOKEN no configurado"
```bash
supabase secrets set BSALE_ACCESS_TOKEN=tu_token
supabase functions deploy etl-bsale
```

### Dashboard no muestra datos
1. Verificar que ETL se ejecutó sin errores
2. Ejecutar: `SELECT bi.refresh_all_materialized_views();`
3. Verificar permisos en tablas

### Error de permisos en vistas
Ejecutar `004_grants_views.sql` nuevamente

### ETL muy lento
- Bsale tiene rate limits, el sistema hace backoff automático
- Primera carga puede tardar 10-30 minutos
