# 🧠 Análisis BI Completo - MI SPA

## 1. Dashboard Ejecutivo (Home)

### KPIs Principales
| Métrica | Fórmula | Decisión que permite |
|---------|---------|---------------------|
| **Ventas del Período** | SUM(total) | Rendimiento general |
| **Variación vs Período Anterior** | (Actual - Anterior) / Anterior * 100 | Tendencia de crecimiento |
| **Ticket Promedio** | SUM(total) / COUNT(DISTINCT documento) | Efectividad de venta |
| **Unidades Vendidas** | SUM(cantidad) | Volumen de operación |
| **Margen Bruto** | (Venta - Costo) / Venta * 100 | Rentabilidad |

### Gráficos Necesarios
- 📈 Tendencia de ventas (diaria/semanal/mensual)
- 🥧 Distribución por tienda (EPICBIKE vs BLUEFISHING)
- 📊 Comparativo YoY (año vs año)
- 🎯 Cumplimiento de meta (si hay)

---

## 2. Análisis de Ventas

### KPIs de Ventas
| Métrica | Fórmula | Decisión |
|---------|---------|----------|
| **Ventas por Categoría** | SUM(total) GROUP BY categoria | Qué categorías potenciar |
| **Ventas por Día de Semana** | SUM(total) GROUP BY día | Planificar personal |
| **Ventas por Hora** | SUM(total) GROUP BY hora | Horarios pico |
| **Top 10 Productos** | ORDER BY total DESC LIMIT 10 | Productos estrella |
| **Productos sin Venta** | WHERE ventas = 0 | Descontinuar/promocionar |
| **Crecimiento MoM** | (Mes actual - Mes anterior) / Mes anterior | Tendencia mensual |
| **Estacionalidad** | Promedio histórico por mes | Planificar compras |

### Análisis Avanzados
- **Análisis de Canasta**: Productos que se venden juntos
- **Elasticidad de Precio**: Cómo afecta el precio a las ventas
- **Curva ABC de Productos**: 80/20 de ventas

---

## 3. Análisis de Clientes

### KPIs de Clientes
| Métrica | Fórmula | Decisión |
|---------|---------|----------|
| **Clientes Activos** | DISTINCT clientes con compra en 90 días | Base activa |
| **Clientes Nuevos** | Primera compra en período | Captación |
| **Tasa de Retención** | Clientes que repiten / Total | Fidelización |
| **Frecuencia de Compra** | Compras / Cliente / Período | Engagement |
| **LTV (Lifetime Value)** | Promedio compra * Frecuencia * Tiempo | Valor del cliente |

### Segmentación RFM
| Segmento | Recency | Frequency | Monetary | Acción |
|----------|---------|-----------|----------|--------|
| **Champions** | Reciente | Alta | Alto | Recompensar |
| **Loyal** | Reciente | Alta | Medio | Upsell |
| **Potential** | Reciente | Baja | Alto | Fidelizar |
| **At Risk** | Antiguo | Alta | Alto | Reactivar |
| **Lost** | Muy antiguo | Baja | Bajo | Win-back campaign |

---

## 4. Análisis de Inventario

### KPIs de Inventario
| Métrica | Fórmula | Decisión |
|---------|---------|----------|
| **Valor del Inventario** | SUM(stock * precio_costo) | Capital inmovilizado |
| **Rotación** | Costo de ventas / Inventario promedio | Eficiencia |
| **Días de Cobertura** | Stock / Venta diaria promedio | Cuándo reponer |
| **Quiebre de Stock** | Productos con stock = 0 y ventas > 0 | Urgencia de compra |
| **Sobrestock** | Stock > (Venta * 90 días) | Liquidar |
| **Stock Muerto** | Sin movimiento en 180 días | Descontinuar |

### Análisis ABC de Inventario
| Clase | % Productos | % Valor | Gestión |
|-------|-------------|---------|---------|
| **A** | 20% | 80% | Control estricto |
| **B** | 30% | 15% | Control moderado |
| **C** | 50% | 5% | Control mínimo |

---

## 5. Análisis de Cobranza

### KPIs de Cobranza
| Métrica | Fórmula | Decisión |
|---------|---------|----------|
| **Cartera Total** | SUM(monto_pendiente) | Exposición |
| **DSO** | (Cuentas por cobrar / Ventas) * Días | Días para cobrar |
| **Tasa de Morosidad** | Vencido / Total * 100 | Riesgo de cartera |
| **Recuperación** | Cobrado / Vencido * 100 | Efectividad cobranza |

### Aging de Cartera
| Tramo | Rango | Acción |
|-------|-------|--------|
| **Corriente** | 0-30 días | Monitorear |
| **Vencido 30** | 31-60 días | Llamar |
| **Vencido 60** | 61-90 días | Carta formal |
| **Vencido 90+** | >90 días | Cobranza judicial |

---

## 6. Predicciones y Alertas

### Predicciones
| Tipo | Método | Uso |
|------|--------|-----|
| **Forecast de Ventas** | Promedio móvil + Estacionalidad | Planificar inventario |
| **Predicción de Stock** | Venta diaria * Lead time | Punto de reorden |
| **Proyección de Flujo** | Ventas esperadas + Cobranza | Tesorería |
| **Riesgo de Mora** | Score basado en historial | Límites de crédito |

### Alertas Automáticas
| Alerta | Trigger | Prioridad |
|--------|---------|-----------|
| **Quiebre de Stock** | Stock = 0 con ventas | 🔴 Crítica |
| **Stock Bajo** | Cobertura < 7 días | 🟠 Alta |
| **Mora Crítica** | Vencido > 90 días | 🔴 Crítica |
| **Cliente en Riesgo** | Score > 70 | 🟠 Alta |
| **Venta Inusual** | Desviación > 2σ | 🟡 Media |
| **Meta no Cumplida** | Actual < Meta * 0.8 | 🟠 Alta |

---

## 7. Comparativo por Tienda

### Métricas Comparativas EPICBIKE vs BLUEFISHING
| Métrica | Comparar |
|---------|----------|
| Ventas totales | Por período |
| Ticket promedio | Por transacción |
| Productos más vendidos | Top 10 cada uno |
| Rotación de inventario | Por categoría |
| Margen promedio | Por categoría |
| Clientes activos | Únicos por tienda |
| Estacionalidad | Meses fuertes |

---

## 8. Datos a Extraer de Bsale

### Endpoints Necesarios
```
GET /v1/variants.json          ✅ Productos
GET /v1/clients.json           ✅ Clientes  
GET /v1/documents.json         ✅ Ventas
GET /v1/documents/{id}/details ✅ Detalles
GET /v1/stocks.json            ✅ Stock
GET /v1/payments.json          ❌ Pagos (FALTA)
GET /v1/users.json             ❌ Vendedores (FALTA)
GET /v1/price_lists.json       ❌ Listas precio (FALTA)
GET /v1/product_types.json     ✅ Categorías
GET /v1/offices.json           ✅ Sucursales
```

### Datos Adicionales para Calcular
- **Costo de productos**: Para calcular margen
- **Metas de venta**: Para cumplimiento
- **Vendedores**: Para comisiones

---

## 9. Vistas SQL a Crear

```sql
-- Vista: Resumen diario de ventas
-- Vista: Análisis RFM de clientes
-- Vista: Rotación de inventario
-- Vista: Aging de cartera
-- Vista: Predicción de demanda
-- Vista: Alertas automáticas
-- Vista: Comparativo por tienda
-- Vista: ABC de productos
```

---

## 10. Próximos Pasos Recomendados

### Fase 1: Completar Datos (Semana 1)
1. ✅ Productos con categorías
2. ✅ Stock por bodega
3. ✅ Ventas históricas
4. ❌ Pagos y cobranza
5. ❌ Precios de costo

### Fase 2: Métricas Avanzadas (Semana 2)
1. Análisis RFM de clientes
2. Rotación de inventario
3. ABC de productos
4. Aging de cartera

### Fase 3: Predicciones (Semana 3)
1. Forecast de ventas
2. Alertas automáticas
3. Sugerencias de reposición

### Fase 4: AI Agent (Semana 4)
1. Consultas en lenguaje natural
2. Integración WhatsApp

