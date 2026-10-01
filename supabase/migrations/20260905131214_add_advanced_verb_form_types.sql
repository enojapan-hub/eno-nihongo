insert into public.verb_form_types (form_code,label_ja,label_id,category,sort_order,is_active) values
('passive','受身形','Bentuk Pasif','conjugation',160,true),
('causative','使役形','Bentuk Kausatif','conjugation',170,true),
('causative_passive','使役受身形','Bentuk Kausatif-Pasif','conjugation',180,true),
('imperative','命令形','Bentuk Perintah','conjugation',190,true),
('prohibitive','禁止形','Bentuk Larangan','conjugation',200,true)
on conflict (form_code) do update set label_ja=excluded.label_ja,label_id=excluded.label_id,category=excluded.category,sort_order=excluded.sort_order,is_active=true;
