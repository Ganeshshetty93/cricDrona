-- OPTIONAL sample content adapted from the supplied prototype.
-- Run only after reviewing venue/fees/dates. Never runs automatically.
-- Relative dates keep these samples bookable whenever a new test project is set up.
insert into public.events(id,title,type,ball,age,date,time,place,fee,seats,description,status) values
('11111111-1111-4111-8111-111111111111','Weekend Warriors Cup','Match','Tennis ball','Open',current_date+14,'07:00','Drona Cricket Ground',499,24,'Sample event. Replace venue, fee and description before publishing a real event.','published'),
('22222222-2222-4222-8222-222222222222','Junior Champions Academy','Class','Hard ball','Under 14',current_date+16,'16:00','Drona Training Nets',2499,16,'Sample coaching class. Replace details before publishing a real class.','published'),
('33333333-3333-4333-8333-333333333333','Leather Ball Premier League','Match','Hard ball','Under 19',current_date+21,'08:00','Drona Cricket Ground',799,32,'Sample event. Replace venue, fee and description before publishing a real event.','published'),
('44444444-4444-4444-8444-444444444444','Tennis Ball Fundamentals','Class','Tennis ball','Under 16',current_date+18,'17:00','Drona Training Nets',1499,20,'Sample coaching class. Replace details before publishing a real class.','published')
on conflict(id) do nothing;

insert into public.batches(id,name,coach,coach_id,age,ball,schedule,capacity) values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Weekend Warriors Skills','Coach Arjun',null,'Open','Tennis ball','Mon / Wed / Fri • 07:00-08:30',18),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Junior Power Hitters','Coach Meera',null,'Under 14','Hard ball','Tue / Thu • 16:00-17:30',12),
('cccccccc-cccc-4ccc-8ccc-cccccccccccc','Fast Bowl Lab','Coach Ishan',null,'Under 16','Tennis ball','Sat • 09:00-10:30',16),
('dddddddd-dddd-4ddd-8ddd-dddddddddddd','League Prep Group','Coach Neha',null,'Under 19','Hard ball','Sun • 08:00-09:30',14)
on conflict(id) do nothing;
