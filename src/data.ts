import type { Store, Task } from './types';
const make = (id:string,title:string,place:Task['place'],order:number, more:Partial<Task>={}):Task => ({id,title,place,order,state:null,stoppedAt:'',nextStep:'',waitingFor:'',result:'',attentionAt:null,createdAt:Date.now()-order*1000,completedAt:null,...more});
export const demo:Store={tasks:[
  make('kpi','KPI Пасты','now',0,{stoppedAt:'Определил базовую почасовую ставку.',nextStep:'Рассчитать индивидуальный процент от выручки.',result:'Финальная модель оплаты утверждена.'}),
  make('evgenia','Маркетолог Евгения','today',1,{state:'waiting',stoppedAt:'Обсудили формат работы и ожидания по зарплате.',waitingFor:'Евгения — финальный ответ по условиям.',nextStep:'Принять решение по офферу.'}),
  make('events','Мероприятия','today',2,{state:'delegated',stoppedAt:'Передал список мероприятий.',waitingFor:'Обратную связь команды.',nextStep:'Выбрать 3 приоритетных мероприятия.'}),
  make('vendors','Разобраться с поставщиками','week',3,{nextStep:'Собрать актуальные условия.'}),
  make('cheese','Проверить документы на сыр','pool',4),
]};
export const STORAGE_KEY='today-cockpit-v1';
