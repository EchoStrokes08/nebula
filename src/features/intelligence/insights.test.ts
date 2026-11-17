import { buildInsights, weeklySummary } from './insights';
import type { Task } from '@/features/tasks/api';
import type { DayKey } from '@/lib/dates';
const today='2026-11-16' as DayKey;
const task=(patch: Partial<Task>)=>({ id:'t',title:'Informe',status:'todo',priority:2,postponedCount:0,...patch }) as Task;
it('no inventa señales sin datos y explica la fricción con una propuesta',()=>{
 expect(buildInsights([],[],[],today)).toEqual([]);
 const result=buildInsights([],[],[task({postponedCount:3})],today);
 expect(result[0]?.reason).toContain('3 veces');
 expect(result[0]?.action).toMatchObject({type:'create_task',minutes:15});
});
it('el resumen respeta el día civil del perfil al cruzar medianoche UTC',()=>{
 const tasks=[task({completedAt:'2026-11-17T02:00:00Z',status:'done'})];
 expect(weeklySummary(tasks,[],today,'America/Bogota').tasksCompleted).toBe(1);
 expect(weeklySummary(tasks,[],today,'UTC').tasksCompleted).toBe(0);
});
it('no presenta riesgo de pérdida de constancia sin catorce periodos evaluables',()=>{
 expect(buildInsights([],[],[],today).filter(i=>i.id.startsWith('consistency'))).toEqual([]);
});
it('explica sobrecarga con estimaciones sin eliminar compromisos',()=>{
 const tasks=Array.from({length:17},(_,i)=>task({id:`t${i}`,dueDate:today,estimateMinutes:null}));
 const result=buildInsights([],[],tasks,today);
 expect(result.find(i=>i.id==='overload')?.reason).toContain('510 min');
 expect(tasks).toHaveLength(17);
});
