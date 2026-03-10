// ============================================================================
// MI SPA BI SYSTEM - Logger a Base de Datos
// ============================================================================

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { LogLevel, ETLComponente, ETLStats } from './types.ts';

export class ETLLogger {
  private jobId: string | null = null;
  private startTime = Date.now();
  private stats: ETLStats = { procesados: 0, insertados: 0, actualizados: 0, errores: 0 };

  constructor(private supabase: SupabaseClient, private tipo: string) {}

  async startJob(parametros?: Record<string, unknown>): Promise<string> {
    try {
      const { data, error } = await this.supabase.rpc('etl_start_job', {
        p_tipo: this.tipo,
        p_parametros: parametros as any || null
      });
      if (error) {
        console.warn(`⚠️ Logging no disponible: ${error.message}`);
        this.jobId = `local-${Date.now()}`;
      } else {
        this.jobId = data;
      }
    } catch (e) {
      console.warn(`⚠️ Logging no disponible`);
      this.jobId = `local-${Date.now()}`;
    }
    console.log(`📋 Job iniciado: ${this.jobId}`);
    return this.jobId;
  }

  async log(nivel: LogLevel, componente: ETLComponente, mensaje: string, datos?: Record<string, unknown>): Promise<void> {
    const emoji = { DEBUG: '🔍', INFO: 'ℹ️', WARN: '⚠️', ERROR: '❌', FATAL: '💀' }[nivel];
    console.log(`${emoji} [${componente}] ${mensaje}`);
    
    if (this.jobId && !this.jobId.startsWith('local-')) {
      try {
        await this.supabase.rpc('etl_log', {
          p_job_id: this.jobId,
          p_nivel: nivel,
          p_componente: componente,
          p_mensaje: mensaje,
          p_datos: datos as any || null
        });
      } catch (e) {
        // Logging a DB falló, solo mostrar en consola
      }
    }
    
    if (nivel === 'ERROR' || nivel === 'FATAL') this.stats.errores++;
  }

  async info(comp: ETLComponente, msg: string, data?: Record<string, unknown>) { await this.log('INFO', comp, msg, data); }
  async warn(comp: ETLComponente, msg: string, data?: Record<string, unknown>) { await this.log('WARN', comp, msg, data); }
  async error(comp: ETLComponente, msg: string, data?: Record<string, unknown>) { await this.log('ERROR', comp, msg, data); }

  incrementProcessed(n = 1) { this.stats.procesados += n; }
  incrementInserted(n = 1) { this.stats.insertados += n; }
  incrementErrors(n = 1) { this.stats.errores += n; }
  getStats(): ETLStats { return { ...this.stats }; }
  getJobId(): string | null { return this.jobId; }
  getDuration(): number { return Date.now() - this.startTime; }

  async endJob(estado: 'SUCCESS' | 'FAILED' | 'PARTIAL', mensaje?: string): Promise<void> {
    if (!this.jobId) return;
    try {
      if (!this.jobId.startsWith('local-')) {
        await this.supabase.rpc('etl_end_job', {
          p_job_id: this.jobId,
          p_estado: estado,
          p_mensaje: mensaje || `Completado en ${(this.getDuration() / 1000).toFixed(2)}s`,
          p_stats: this.stats as any
        });
      }
    } catch (e) {
      console.warn(`⚠️ No se pudo registrar fin de job`);
    }
    console.log(`${estado === 'SUCCESS' ? '✅' : '❌'} Job finalizado: ${estado}`);
  }
}

export function createLogger(supabase: SupabaseClient, tipo: string): ETLLogger {
  return new ETLLogger(supabase, tipo);
}
