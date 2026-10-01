DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='content_skill' AND e.enumlabel='listening') THEN ALTER TYPE public.content_skill ADD VALUE 'listening'; END IF; END $$;

INSERT INTO public.listening_items (title, level, audio_url, transcript_jp, translation_id, duration_seconds, sort_order, is_published, question_type, audio_license, source)
VALUES
('駅で待ち合わせ N4','N4',NULL,'明日の朝、駅の前で会いましょう。八時半に来てください。遅れるときは電話してください。','Besok pagi, mari bertemu di depan stasiun. Datang pukul 08.30. Jika terlambat, telepon.',40,10,true,'main_point',NULL,'enonihongo original'),
('週末の予定 N3', 'N3',NULL,'土曜日は友達と映画を見に行く予定です。映画のあとで駅の近くの店で昼ご飯を食べます。日曜日は家でゆっくり休むつもりです。','Hari Sabtu saya berencana menonton film bersama teman. Setelah itu makan siang di toko dekat stasiun. Minggu saya berencana beristirahat di rumah.',50,20,true,'main_point',NULL,'enonihongo original'),
('仕事の連絡 N2','N2',NULL,'会議の資料は今日の午後三時までに共有してください。もし内容に変更がある場合は、午前中に担当者へ知らせてください。','Tolong bagikan materi rapat paling lambat pukul tiga sore hari ini. Jika ada perubahan isi, beri tahu penanggung jawab pada pagi hari.',55,30,true,'main_point',NULL,'enonihongo original'),
('地域イベントのお知らせ N1','N1',NULL,'来月の地域交流会では、外国人住民と地元の人が一緒に地域の課題について意見を交換します。参加者には事前に資料が配布され、当日は小グループで具体的な提案をまとめる予定です。','Pada acara pertukaran masyarakat bulan depan, warga asing dan penduduk setempat akan bertukar pendapat tentang persoalan daerah. Materi dibagikan sebelumnya dan peserta akan menyusun usulan konkret dalam kelompok kecil.',65,40,true,'main_point',NULL,'enonihongo original')
ON CONFLICT DO NOTHING;

INSERT INTO public.questions (prompt,prompt_note,choices,correct_index,explanation_id,level,skill,listening_id,is_published,source,question_type)
SELECT 'いつ駅の前で会いますか。',NULL,'["8時","8時半","9時","9時半"]'::jsonb,1,'本文では「八時半に来てください」と言っています。','N4'::public.jlpt_level,'listening'::public.content_skill,li.id,true,'enonihongo original','main_point'
FROM public.listening_items li WHERE li.title='駅で待ち合わせ N4'
AND NOT EXISTS (SELECT 1 FROM public.questions q WHERE q.listening_id=li.id);

INSERT INTO public.questions (prompt,prompt_note,choices,correct_index,explanation_id,level,skill,listening_id,is_published,source,question_type)
SELECT '日曜日はどうする予定ですか。',NULL,'["映画を見る","友達と会う","家で休む","買い物をする"]'::jsonb,2,'日曜日は家でゆっくり休むつもりだと述べています。','N3'::public.jlpt_level,'listening'::public.content_skill,li.id,true,'enonihongo original','main_point'
FROM public.listening_items li WHERE li.title='週末の予定 N3'
AND NOT EXISTS (SELECT 1 FROM public.questions q WHERE q.listening_id=li.id);

INSERT INTO public.questions (prompt,prompt_note,choices,correct_index,explanation_id,level,skill,listening_id,is_published,source,question_type)
SELECT '資料を共有する期限はいつですか。',NULL,'["午前中","正午","午後3時","午後5時"]'::jsonb,2,'資料は今日の午後三時までに共有するよう求められています。','N2'::public.jlpt_level,'listening'::public.content_skill,li.id,true,'enonihongo original','main_point'
FROM public.listening_items li WHERE li.title='仕事の連絡 N2'
AND NOT EXISTS (SELECT 1 FROM public.questions q WHERE q.listening_id=li.id);

INSERT INTO public.questions (prompt,prompt_note,choices,correct_index,explanation_id,level,skill,listening_id,is_published,source,question_type)
SELECT '当日は何をする予定ですか。',NULL,'["資料を配るだけ","小グループで提案をまとめる","試験を受ける","地域を見学する"]'::jsonb,1,'当日は小グループで具体的な提案をまとめる予定です。','N1'::public.jlpt_level,'listening'::public.content_skill,li.id,true,'enonihongo original','main_point'
FROM public.listening_items li WHERE li.title='地域イベントのお知らせ N1'
AND NOT EXISTS (SELECT 1 FROM public.questions q WHERE q.listening_id=li.id);
