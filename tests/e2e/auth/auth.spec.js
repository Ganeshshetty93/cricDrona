import { test, expect } from '@playwright/test';
const user={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',email:'player@example.test',aud:'authenticated',role:'authenticated',created_at:new Date().toISOString(),user_metadata:{name:'Test Player'},app_metadata:{provider:'email'},identities:[]};
const token=`${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:user.id,email:user.email,role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.signature`;
const session={access_token:token,refresh_token:'test-refresh-token',token_type:'bearer',expires_in:3600,user};
async function mock(page,{loginError=false,confirmationRequired=false}={}){
  const requests=[];
  await page.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
    if(url.hostname==='auth-fixture.supabase.co'){
      requests.push({path:url.pathname,body:req.postDataJSON()});
      if(url.pathname.endsWith('/signup'))return json(confirmationRequired?user:session);
      if(url.pathname.endsWith('/token'))return loginError?json({code:'invalid_credentials',msg:'Invalid login credentials'},400):json(session);
      if(url.pathname.endsWith('/user'))return json(user);
      if(url.pathname.endsWith('/logout'))return route.fulfill({status:204});
      if(url.pathname.endsWith('/recover'))return json({});
      return json({message:'Unhandled mock auth request'},400);
    }
    if(url.origin==='http://127.0.0.1:5185'&&url.pathname.startsWith('/api/')){
      const data={'/api/health':{configured:true,mode:'connected'},'/api/events':[],'/api/profile':{...user,name:'Test Player',dob:'2000-01-01',phone:'',interest:'Both',playing_role:'Batter'},'/api/registrations':[]}[url.pathname];
      return data!==undefined?json({data}):json({error:'Not found.'},404);
    }
    if(url.origin!=='http://127.0.0.1:5185'&&/^https?:$/.test(url.protocol))return route.abort();
    return route.continue();
  });
  return requests;
}
test('signup uses the supplied email and opens the dashboard without confirmation',async({page})=>{
  const requests=await mock(page);await page.goto('/register');
  await page.getByLabel('Full name',{exact:true}).fill('Test Player');
  await page.getByLabel('Email address',{exact:true}).fill(user.email);
  await page.getByLabel('Password',{exact:true}).fill('FixturePassword123!');
  await page.getByLabel('Confirm password',{exact:true}).fill('FixturePassword123!');
  await page.getByRole('button',{name:'Create account'}).click();
  await expect(page).toHaveURL('/dashboard');
  await page.reload();await expect(page.getByRole('navigation',{name:'Clubhouse navigation'})).toBeVisible();
  const signup=requests.find(r=>r.path.endsWith('/signup'));
  expect(signup.body.email).toBe(user.email);expect(signup.body.data.name).toBe('Test Player');
});

test('signup does not claim success when Supabase still requires activation',async({page})=>{
  await mock(page,{confirmationRequired:true});await page.goto('/register');
  await page.getByLabel('Full name',{exact:true}).fill('Test Player');
  await page.getByLabel('Email address',{exact:true}).fill(user.email);
  await page.getByLabel('Password',{exact:true}).fill('FixturePassword123!');
  await page.getByLabel('Confirm password',{exact:true}).fill('FixturePassword123!');
  await page.getByRole('button',{name:'Create account'}).click();
  await expect(page.getByRole('alert')).toContainText('requires account activation');
  await expect(page).toHaveURL('/register');
});
test('login opens the player dashboard, survives reload and logs out',async({page})=>{
  await mock(page);await page.goto('/login');
  await page.getByLabel('Email or existing username').fill(user.email);
  await page.getByLabel('Password',{exact:true}).fill('FixturePassword123!');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page).toHaveURL('/dashboard');await expect(page.getByRole('heading',{level:1})).toContainText('Test');
  await page.reload();await expect(page.getByRole('navigation',{name:'Clubhouse navigation'})).toBeVisible();
  await page.getByRole('button',{name:'Log out',exact:true}).click();
  await expect(page.getByRole('link',{name:'Log in',exact:true})).toBeVisible();
  await expect(page.getByRole('navigation',{name:'Clubhouse navigation'})).toHaveCount(0);
  await page.goto('/dashboard');await expect(page).toHaveURL(/\/login\?next=/);
});
test('invalid credentials show an actionable error without opening dashboard',async({page})=>{
  await mock(page,{loginError:true});await page.goto('/login');
  await page.getByLabel('Email or existing username').fill(user.email);
  await page.getByLabel('Password',{exact:true}).fill('WrongPassword123!');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('do not match');await expect(page).toHaveURL('/login');
});
test('password recovery requests a reset link and rejects an unauthenticated reset page',async({page})=>{
  const requests=await mock(page);await page.goto('/forgot-password');
  await page.getByLabel('Email address',{exact:true}).fill(user.email);
  await page.getByRole('button',{name:'Send reset link'}).click();
  await expect(page.getByRole('status')).toContainText('If an account exists');
  expect(requests.some(r=>r.path.endsWith('/recover'))).toBeTruthy();
  await page.goto('/reset-password');await expect(page.getByRole('alert')).toContainText('Open the password reset link');
});
