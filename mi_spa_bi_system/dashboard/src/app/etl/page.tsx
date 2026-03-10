'use client';
import { useEffect, useState } from 'react';
import { Card, Title, Text, Table, TableHead, TableRow, TableHeaderCell, TableBody, TableCell, Badge, Button } from '@tremor/react';
import { RefreshCw, Play, CheckCircle, XCircle, Clock } from 'lucide-react';
import { supabase, triggerETL as triggerETLFunc } from '@/lib/supabase';
import { DEMO_MODE } from '@/lib/demo-mode';
import { getDemoETL } from '@/lib/demo-data';
import { formatCompact, Skeleton } from '@/components/ui';

interface ETLJob {
  job_id: string;
  tipo: string;
  estado: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  duracion_segundos: number | null;
  registros_procesados: number;
  registros_insertados: number;
  registros_errores: number;
  mensaje: string | null;
}

interface HealthCheck {
  entidad: string;
  fecha_min: string;
  fecha_max: string;
  registros: number;
  dias_antiguedad: number;
  status: string;
}

export default function ETLPage() {
  const [jobs, setJobs] = useState<ETLJob[]>([]);
  const [health, setHealth] = useState<HealthCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      if (DEMO_MODE) {
        const mock = getDemoETL();
        setJobs(mock.jobs as any);
        setHealth(mock.health as any);
        setLoading(false);
        return;
      }

      const { data: jobsData, error: jobsError } = await supabase
        .from('etl_jobs')
        .select('*')
        .order('fecha_inicio', { ascending: false })
        .limit(20);

      if (jobsError) throw jobsError;
      setJobs((jobsData || []) as ETLJob[]);

      const { data: healthData, error: healthError } = await supabase.rpc('check_data_freshness');
      if (healthError) throw healthError;
      setHealth((healthData || []) as HealthCheck[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const triggerETLHandler = async (tipo: string) => {
    setRunning(true);
    try {
      await triggerETLFunc(tipo);
      alert(`ETL ${tipo} started successfully`);
      setTimeout(loadData, 2000);
    } catch (e: any) {
      console.error(e);
      alert(`Error running ETL: ${e.message || 'Unknown error'}`);
    } finally {
      setRunning(false);
    }
  };

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'SUCCESS':
        return <Badge color="green" icon={CheckCircle}>Success</Badge>;
      case 'FAILED':
        return <Badge color="red" icon={XCircle}>Failed</Badge>;
      case 'RUNNING':
        return <Badge color="yellow" icon={Clock}>Running</Badge>;
      default:
        return <Badge color="gray">{estado}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <Title>ETL Jobs</Title>
          <Text>ETL process monitoring and control</Text>
        </div>
        <div className="flex gap-2">
          <Button
            icon={RefreshCw}
            onClick={loadData}
            variant="secondary"
          >
            Refresh
          </Button>
          <Button
            icon={Play}
            onClick={() => triggerETLHandler('all')}
            disabled={running}
            color="blue"
          >
            Run Full ETL
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Button onClick={() => triggerETLHandler('productos')} disabled={running} variant="secondary">
          Sync Products
        </Button>
        <Button onClick={() => triggerETLHandler('clientes')} disabled={running} variant="secondary">
          Sync Customers
        </Button>
        <Button onClick={() => triggerETLHandler('ventas')} disabled={running} variant="secondary">
          Sync Sales
        </Button>
        <Button onClick={() => triggerETLHandler('stock')} disabled={running} variant="secondary">
          Sync Stock
        </Button>
      </div>

      <Card>
        <Title>Data Health</Title>
        <Table className="mt-4">
          <TableHead>
            <TableRow>
              <TableHeaderCell>Entity</TableHeaderCell>
              <TableHeaderCell>Last Updated</TableHeaderCell>
              <TableHeaderCell>Records</TableHeaderCell>
              <TableHeaderCell>Days Old</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {health.map((h) => (
              <TableRow key={h.entidad}>
                <TableCell className="font-medium">{h.entidad}</TableCell>
                <TableCell>{h.fecha_max ? new Date(h.fecha_max).toLocaleDateString('en-US') : '-'}</TableCell>
                <TableCell>{h.registros.toLocaleString('en-US')}</TableCell>
                <TableCell>{h.dias_antiguedad}</TableCell>
                <TableCell>
                  <Badge color={h.status.includes('OK') ? 'green' : h.status.includes('DESACTUALIZADO') ? 'yellow' : 'red'}>
                    {h.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card>
        <Title>Recent Jobs</Title>
        <Table className="mt-4">
          <TableHead>
            <TableRow>
              <TableHeaderCell>ID</TableHeaderCell>
              <TableHeaderCell>Type</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Started</TableHeaderCell>
              <TableHeaderCell>Duration</TableHeaderCell>
              <TableHeaderCell>Processed</TableHeaderCell>
              <TableHeaderCell>Inserted</TableHeaderCell>
              <TableHeaderCell>Errors</TableHeaderCell>
              <TableHeaderCell>Message</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {jobs.map((job) => (
              <TableRow key={job.job_id}>
                <TableCell className="font-mono text-xs">{job.job_id.slice(0, 8)}...</TableCell>
                <TableCell>{job.tipo}</TableCell>
                <TableCell>{getEstadoBadge(job.estado)}</TableCell>
                <TableCell>{new Date(job.fecha_inicio).toLocaleString('en-US')}</TableCell>
                <TableCell>
                  {job.duracion_segundos
                    ? `${job.duracion_segundos.toFixed(1)}s`
                    : job.estado === 'RUNNING'
                    ? '...'
                    : '-'}
                </TableCell>
                <TableCell>{job.registros_procesados.toLocaleString('en-US')}</TableCell>
                <TableCell className="text-green-600">{job.registros_insertados.toLocaleString('en-US')}</TableCell>
                <TableCell className={job.registros_errores > 0 ? 'text-red-600' : ''}>
                  {job.registros_errores}
                </TableCell>
                <TableCell className="max-w-xs truncate">{job.mensaje || '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
