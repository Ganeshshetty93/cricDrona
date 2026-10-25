import { demoEvents } from '../server/demo.js';
const date = days => new Date(Date.now()+days*86400000).toISOString().slice(0,10);
export const playerId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const coachId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
export const profiles=[
  {id:playerId,name:'Arjun Sharma',email:'arjun@example.test',phone:'9876543210',dob:'2013-04-12',interest:'Both',playing_role:'All-rounder',role:'player'},
  {id:coachId,name:'Rahul Desai',email:'rahul@example.test',role:'coach'},
  ...['Aarav Patel','Ishaan Rao','Kabir Singh','Riya Nair','Vihaan Mehta','Ananya Shah','Dev Kumar','Sara Khan','Aditya Joshi','Meera Reddy'].map((name,i)=>({id:`cccccccc-cccc-4ccc-8ccc-${String(i+1).padStart(12,'0')}`,name,email:`${name.toLowerCase().replace(' ','.')}@example.test`,role:'player'})),
];
export const events=demoEvents.map((e,i)=>({...e,date:date(3+i*3)}));
events.push({...events[0],id:'55555555-5555-4555-8555-555555555555',title:'Friday Floodlight Friendly',date:date(20),status:'draft'});
export const batches=[
  {id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',name:'Junior Strikers',ball:'Hard ball',age:'Under 14',coach:'Rahul Desai',coach_id:coachId,schedule:'Tue & Thu · 4:00–5:30 PM',capacity:16},
  {id:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',name:'Weekend Fundamentals',ball:'Tennis ball',age:'Under 16',coach:'Rahul Desai',coach_id:coachId,schedule:'Sat & Sun · 7:00–8:30 AM',capacity:20},
];
export const registrations=Array.from({length:16},(_,i)=>({id:`ffffffff-ffff-4fff-8fff-${String(i+1).padStart(12,'0')}`,user_id:i<2?playerId:profiles[2+i%10].id,event_id:events[i<2?i:i%4].id,batch_id:i%4===1?batches[0].id:i%4===3?batches[1].id:null,status:i===15?'cancelled':'confirmed',created_at:new Date(Date.now()-i*3600000).toISOString()}));
export const messages=[
  {id:'11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa',name:'Priya Nair',email:'priya@example.test',topic:'Coaching classes',message:'My daughter is 12 and new to hard-ball cricket. Which weekend batch would be a good place to start?',status:'unread',created_at:new Date().toISOString()},
  {id:'22222222-aaaa-4aaa-8aaa-aaaaaaaaaaaa',name:'Karan Shah',email:'karan@example.test',topic:'Match registration',message:'Can our neighbourhood team join the next tennis-ball tournament? We have eight interested players.',status:'unread',created_at:new Date(Date.now()-86400000).toISOString()},
  {id:'33333333-aaaa-4aaa-8aaa-aaaaaaaaaaaa',name:'Anita Rao',email:'anita@example.test',topic:'Age categories & batches',message:'Thank you for explaining the age groups. We will complete the player profile this week.',status:'read',created_at:new Date(Date.now()-172800000).toISOString()},
];
export const currentRole=()=>sessionStorage.getItem('cricdrona-preview-role')||'owner';
export const currentProfile=()=>({...profiles[0],role:currentRole(),...(currentRole()==='coach'?{id:coachId,name:'Rahul Desai',email:'rahul@example.test'}:{})});
export const countedEvents=()=>events.map(e=>({...e,registered_count:registrations.filter(r=>r.event_id===e.id&&r.status==='confirmed').length}));
export const countedBatches=()=>batches.map(b=>({...b,registered_count:registrations.filter(r=>r.batch_id===b.id&&r.status==='confirmed').length}));
export const joinedRegistrations=()=>registrations.map(r=>({...r,event:countedEvents().find(e=>e.id===r.event_id),batch:countedBatches().find(b=>b.id===r.batch_id)||null,profile:profiles.find(p=>p.id===r.user_id)}));
