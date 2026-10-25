import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';
import { loadProjectEnvironment } from '../server/runtime.js';
loadProjectEnvironment();
const {values}=parseArgs({options:{email:{type:'string'}}});
const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL;
const key=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY||process.env.VITE_SUPABASE_PUBLISHABLE_KEY||process.env.VITE_SUPABASE_ANON_KEY;
if(!url||!key)throw new Error('Configure .env.local with your Supabase URL and public key.');
console.log(JSON.stringify({project:new URL(url).hostname.split('.')[0],frontendMatchesBackend:!process.env.VITE_SUPABASE_URL||process.env.VITE_SUPABASE_URL.replace(/\/$/,'')===url.replace(/\/$/,'')}));
for(const [name,path,options] of [['auth','/auth/v1/settings',{}],['catalog','/rest/v1/rpc/list_events',{method:'POST',body:JSON.stringify({p_include_drafts:false})}]]){
  try{const response=await fetch(`${url}${path}`,{...options,headers:{apikey:key,'Content-Type':'application/json'},signal:AbortSignal.timeout(15000)});const data=await response.json();console.log(JSON.stringify({check:name,status:response.status,...(response.ok?(name==='catalog'?{events:data.length}:{emailAuth:data.external?.email,confirmationRequired:!data.mailer_autoconfirm}):{code:data.code,message:data.message})}));if(!response.ok)process.exitCode=1;}
  catch(error){console.error(JSON.stringify({check:name,error:error.cause?.code||error.name}));process.exitCode=1;}
}

// Head-only reads verify every application column without downloading player records.
const secret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
if(secret){
  const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const tables={
    profiles:'id,name,email,phone,dob,playing_role,interest,created_at',
    user_roles:'user_id,role',
    events:'id,title,type,ball,age,date,time,place,fee,seats,description,status,created_at',
    batches:'id,name,coach,coach_id,age,ball,schedule,capacity,created_at',
    registrations:'id,user_id,event_id,batch_id,status,consent_at,created_at',
    contact_messages:'id,user_id,name,email,topic,message,status,created_at',
  };
  await Promise.all(Object.entries(tables).map(async([table,columns])=>{
    const {error,status,count}=await admin.from(table).select(columns,{head:true,count:'exact'}).abortSignal(AbortSignal.timeout(15000));
    console.log(JSON.stringify({check:'table',table,status,...(error?{code:error.code,message:error.message}:{columnsVerified:true,rows:count})}));
    if(error)process.exitCode=1;
  }));
  // Inspect the API schema; do not invoke booking, cancellation or role mutations.
  try{
    const response=await fetch(`${url}/rest/v1/`,{headers:{apikey:secret,Accept:'application/openapi+json'},signal:AbortSignal.timeout(15000)});
    const schema=await response.json();
    if(!response.ok)throw new Error(`API schema inspection returned HTTP ${response.status}.`);
    const required=['current_app_role','list_events','list_batches','register_for_event','cancel_registration','assign_registration_batch','submit_contact','list_team','set_user_role'];
    const missing=required.filter(name=>!schema.paths?.[`/rpc/${name}`]);
    console.log(JSON.stringify({check:'database_functions',required:required.length,missing}));
    if(missing.length)process.exitCode=1;
  }catch(error){console.error(JSON.stringify({check:'database_functions',error:error.cause?.code||error.message}));process.exitCode=1;}
  if(values.email){
    const email=values.email.trim().toLowerCase();
    let account;
    for(let page=1;;page++){
      const {data,error}=await admin.auth.admin.listUsers({page,perPage:200});
      if(error){console.error(JSON.stringify({check:'account',email,error:error.message}));process.exitCode=1;break;}
      account=data.users.find(user=>user.email?.toLowerCase()===email);
      if(account||data.users.length<200)break;
    }
    if(account){
      const [profile,role]=await Promise.all([
        admin.from('profiles').select('id').eq('id',account.id).maybeSingle(),
        admin.from('user_roles').select('role').eq('user_id',account.id).maybeSingle(),
      ]);
      console.log(JSON.stringify({check:'account',email,exists:true,confirmed:Boolean(account.email_confirmed_at),profileExists:Boolean(profile.data),role:role.data?.role||null}));
      if(profile.error||role.error)process.exitCode=1;
    }else console.log(JSON.stringify({check:'account',email,exists:false}));
  }
}else console.log(JSON.stringify({check:'tables',status:'skipped',reason:'Set a backend-only SUPABASE_SECRET_KEY to check every table.'}));
