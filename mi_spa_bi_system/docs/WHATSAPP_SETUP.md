# 📱 Configuración WhatsApp Business API - MI SPA BI

## Requisitos Previos

1. ✅ Cuenta de Meta Business (Facebook Business)
2. ✅ Número de teléfono para WhatsApp Business
3. ✅ Proyecto Supabase activo

---

## Paso 1: Crear App en Meta Developers

1. Ve a [Meta Developers](https://developers.facebook.com/)
2. Crea una nueva app o usa una existente
3. En el dashboard, selecciona **"Agregar producto"** → **"WhatsApp"**
4. Sigue el asistente de configuración

### Obtener credenciales:

En la sección **WhatsApp** → **API Setup**:

| Variable | Dónde encontrarla |
|----------|-------------------|
| `WHATSAPP_TOKEN` | Token de acceso temporal (arriba) |
| `WHATSAPP_PHONE_ID` | ID del número de teléfono |

---

## Paso 2: Configurar Variables en Supabase

En tu dashboard de Supabase, ve a:
**Settings** → **Edge Functions** → **Secrets**

Agrega estas variables:

```
WHATSAPP_TOKEN=EAAxxxxxx...  (tu token de Meta)
WHATSAPP_PHONE_ID=1234567890  (ID del número)
WHATSAPP_VERIFY_TOKEN=mi_spa_bi_verify  (token personalizado para verificar)
```

---

## Paso 3: Desplegar la Edge Function

Desde tu terminal:

```bash
cd mi_spa_bi_system

# Login en Supabase
supabase login

# Link al proyecto
supabase link --project-ref TU_PROJECT_REF

# Desplegar función
supabase functions deploy whatsapp-webhook --no-verify-jwt
```

⚠️ **IMPORTANTE**: `--no-verify-jwt` es necesario porque Meta no envía JWT.

---

## Paso 4: Registrar Webhook en Meta

1. Ve a tu app en Meta Developers
2. **WhatsApp** → **Configuration** → **Webhooks**
3. Configura:

| Campo | Valor |
|-------|-------|
| **Callback URL** | `https://<tu-proyecto>.supabase.co/functions/v1/whatsapp-webhook` |
| **Verify Token** | `mi_spa_bi_verify` (o el que configuraste) |

4. Suscríbete a estos eventos:
   - ✅ `messages`
   - ✅ `message_status` (opcional)

---

## Paso 5: Probar el Bot

Envía un mensaje al número de WhatsApp Business con:

- `"¿Cuánto hemos vendido?"` → Resumen de ventas
- `"¿Cómo está el inventario?"` → Estado del stock
- `"¿Cuánto tenemos por cobrar?"` → Cobranza pendiente
- `"¿Hay alertas?"` → Alertas de stock crítico
- `"ayuda"` → Lista de comandos

---

## Comandos del Bot

| Pregunta | Respuesta |
|----------|-----------|
| ventas / vendido | Ventas últimos 30 días por tienda |
| ventas epicbike | Solo ventas EPICBIKE |
| ventas bluefishing | Solo ventas BLUEFISHING |
| stock / inventario | Unidades y valor del inventario |
| cobranza / pendiente | Montos por cobrar |
| predicción / proyección | Forecast de ventas |
| alertas | Stock crítico |

---

## Troubleshooting

### Error 403 en verificación
- Verifica que `WHATSAPP_VERIFY_TOKEN` sea igual en Supabase y Meta

### Mensajes no llegan
- Verifica que la función esté desplegada: `supabase functions list`
- Revisa logs: `supabase functions logs whatsapp-webhook`

### Error de autenticación Meta
- El token temporal expira. Genera un token permanente en Meta.

---

## Estructura del Proyecto

```
supabase/functions/
└── whatsapp-webhook/
    └── index.ts    # Webhook principal
```

## URL del Webhook

```
https://[PROJECT_REF].supabase.co/functions/v1/whatsapp-webhook
```

Reemplaza `[PROJECT_REF]` con tu ID de proyecto Supabase.
