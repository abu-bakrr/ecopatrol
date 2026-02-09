const safetyContent = {
	uz: {
		title: 'Xavfsizlik yoʻriqnomasi',
		levels: [
			{
				label: 'Past daraja (Yashil)',
				description:
					'Muntazam maishiy chiqindilar: qogʻoz, plastik idishlar, qadoqlash materiallari. Inson salomatligi uchun bevosita xavf tugʻdirmaydi, ammo gigiyena qoidalariga rioya qilish shart.',
				tools: 'Oddiy toʻqimali qoʻlqoplar, axlat qoplari.',
			},
			{
				label: 'Oʻrtacha daraja (Sariq)',
				description:
					'Qurilish chiqindilari, singan shishalar, oʻtkir metall buyumlar, eski maishiy texnika qismlari va zanglagan konstruksiyalar.',
				tools:
					'Zich rezina yoki charm qoʻlqoplar, yopiq qalin poyabzal, singan shishalar uchun choʻtka va belkurak.',
			},
			{
				label: 'Yuqori daraja (Qizil)',
				description:
					'Zaharli va xavfli chiqindilar: kimyoviy moddalar, batareyalar, elektronika, tibbiy chiqindilar (shpritslar, noma’lum dori-darmonlar), shuningdek, ko‘p miqdordagi chirigan oziq-ovqat qoldiqlari.',
				tools:
					'Respirator (FFP2/FFP3), germetik rezina qoʻlqoplar, himoya koʻzoynaklari va maxsus qisqichlar. Noma’lum moddalarga MUTLAQO tegmang!',
			},
		],
		rules: [
			'Hech qachon axlatga (ayniqsa shisha va metallga) yalangʻoch qoʻl bilan tegmang.',
			'Noma’lum suyuqliklar, flakonlar va yopiq idishlarni ochmang yoki hidlamang.',
			'Singan shishalarni tozalashda faqat qalin qoʻlqop va vositalardan (belkurak, qisqich) foydalaning.',
			'Agar chiqindi xavfli koʻrinsa (tibbiy, kimyoviy), uni oʻzingiz tozalashga urinmang, mutaxassislarni chaqiring.',
			'Tozalashdan soʻng qoʻlingizni yaxshilab yuving yoki antiseptik bilan ishlov bering.',
			'Har doim yopiq poyabzalda ishlang – sirt ostida shisha yoki mixlar bo‘lishi mumkin.',
		],
		glass_rule: {
			title: 'Shisha bilan ishlash',
			text: 'Shisha parchalarini hech qachon qoʻl bilan yigʻmang. Faqat belkurak va choʻtkadan foydalaning. Singan shishalarni oddiy plastik paketga solmang (teshib oʻtishi mumkin), karton quti yoki qalin chelakdan foydalaning. Shisha yig‘ilgan idishni "Xavfli: Shisha" deb belgilash tavsiya etiladi.',
		},
		bio_chem_rule: {
			title: 'Kimyoviy va biologik xavf',
			text: 'Kimyoviy chiqindilar (bo‘yoqlar, erituvchilar, kislotalar) nafaqat tabiatni zaharlaydi, balki kiyimingizni eritib yuborishi yoki teringizda qattiq kuyish hosil qilishi mumkin. Batareyalar va lyuminessent lampalarda simob va qo‘rg‘oshin bor. Chirigan organika o‘pkaga zarar yetkazuvchi mog‘or sporalari va bakteriyalar manbai hisoblanadi. Bunday joylarda NIQOB (respirator) taqish shart!',
		},
		sun_rule: {
			title: 'Issiq urishi va quyoshdan saqlanish',
			text: 'Tozalash ishlarini kunning salqin vaqtida (ertalab soat 10:00 gacha yoki kechki 18:00 dan keyin) bajaring. O‘zingiz bilan kamida 1.5 litr ichimlik suvi oling. Har doim bosh kiyim (kepka, panama) kiying. Agar boshingiz aylansa yoki ko‘nglingiz aynisa, darrov soyaga o‘ting va suv iching.',
		},
		physical_rule: {
			title: 'Jismoniy xavfsizlik',
			text: 'Og‘ir qoplarni ko‘tarayotganda belingizni emas, balki tizzalaringizni buking (o‘tirgan holda ko‘taring). Juda og‘ir yuklarni yolg‘iz ko‘tarmang, boshqa ko‘ngillilarni yordamga chaqiring. Kuchingizni to‘g‘ri taqsimlang, har 20-30 daqiqada dam oling.',
		},
		emergency_contacts: [
			{ name: 'Tez yordam', phone: '103', icon: '🚑' },
			{ name: 'FVV (MChS)', phone: '1050', icon: '🚨' },
			{ name: 'Yong‘indan saqlash', phone: '101', icon: '🚒' },
		],
	},
	ru: {
		title: 'Руководство по безопасности',
		levels: [
			{
				label: 'Низкий уровень (Зеленый)',
				description:
					'Обычный бытовой мусор: бумага, пластиковые бутылки, упаковки. Не представляет прямой угрозы здоровью, но требует соблюдения гигиены.',
				tools: 'Обычные тканевые перчатки, пакеты для мусора.',
			},
			{
				label: 'Средний уровень (Желтый)',
				description:
					'Строительные отходы, разбитое стекло, острые металлические предметы, части старой техники и ржавые конструкции.',
				tools:
					'Плотные прорезиненные или кожаные перчатки, закрытая обувь с толстой подошвой, совок и щетка.',
			},
			{
				label: 'Высокий уровень (Красный)',
				description:
					'Токсичные и опасные отходы: химикаты, батарейки, ртутные лампы, медотходы (шприцы), а также большие скопления гниющей органики.',
				tools:
					'Респиратор (FFP2/FFP3), герметичные перчатки, защитные очки и щипцы. К неизвестным веществам НЕ прикасаться!',
			},
		],
		rules: [
			'Никогда не трогайте мусор (особенно стекло и металл) голыми руками.',
			'Не открывайте и не нюхайте неизвестные флаконы и емкости.',
			'При уборке стекла используйте только толстые перчатки и инвентарь (совок, щипцы).',
			'Если отходы выглядят опасно (медицинские, химические), не убирайте их сами, вызовите специалистов.',
			'После уборки обязательно вымойте руки с мылом или обработайте антисептиком.',
			'Работайте только в закрытой обуви — под слоем мусора могут быть гвозди или битое стекло.',
		],
		glass_rule: {
			title: 'Работа со стеклом',
			text: 'Не собирайте осколки руками. Используйте веник и совок. Не кладите стекло в обычные пакеты — они проткнутся. Используйте коробки или плотные ведра. Рекомендуется пометить тару надписью "Опасно: Стекло".',
		},
		bio_chem_rule: {
			title: 'Химическая и био-угроза',
			text: 'Химикаты (растворители, кислоты, щелочи) могут разъесть одежду или вызвать ожоги. Батарейки и лампы содержат ртуть и свинец. Гниющая органика — источник спор плесени, которые могут попасть в легкие и вызвать аллергию или инфекцию. Использование РЕСПИРАТОРА в таких местах обязательно!',
		},
		sun_rule: {
			title: 'Жара и защита от солнца',
			text: 'Старайтесь проводить уборку в прохладное время (до 10:00 или после 18:00). С собой должно быть не менее 1.5 литров воды. Обязательно ношение головного убора. При головокружении немедленно уйдите в тень.',
		},
		physical_rule: {
			title: 'Физическая безопасность',
			text: 'При подъеме тяжелых мешков сгибайте колени, а не спину (поднимайте "ногами"). Не поднимайте слишком тяжелые объекты в одиночку. Делайте перерывы каждые 20-30 минут физической работы.',
		},
		emergency_contacts: [
			{ name: 'Скорая помощь', phone: '103', icon: '🚑' },
			{ name: 'МЧС (Служба спасения)', phone: '1050', icon: '🚨' },
			{ name: 'Пожарная служба', phone: '101', icon: '🚒' },
		],
	},
	en: {
		title: 'Safety Guide',
		levels: [
			{
				label: 'Low Level (Green)',
				description:
					'Common household waste: paper, plastic bottles, packaging. Does not pose a direct threat, but basic hygiene is required.',
				tools: 'Regular textile gloves, trash bags.',
			},
			{
				label: 'Medium Level (Yellow)',
				description:
					'Construction waste, broken glass, sharp metal objects, old machinery parts, and rusty structures.',
				tools:
					'Thick rubber-coated or leather gloves, closed sturdy shoes, dustpan and brush.',
			},
			{
				label: 'High Level (Red)',
				description:
					'Toxic and hazardous waste: chemicals, batteries, mercury lamps, medical waste (syringes), and large piles of rotting organics.',
				tools:
					'Respirator (FFP2/FFP3), airtight gloves, safety goggles, and tongs. Do NOT touch unknown substances!',
			},
		],
		rules: [
			'Never touch trash (especially glass and metal) with bare hands.',
			'Do not open or smell unknown bottles or containers.',
			'When cleaning glass, use only thick gloves and proper tools (dustpan, tongs).',
			'If waste looks hazardous, do not clean it yourself, call professionals.',
			'Wash hands thoroughly with soap or use antiseptic after cleaning.',
			'Always wear closed-toe shoes — glass or nails may be hidden under the surface.',
		],
		glass_rule: {
			title: 'Handling Glass',
			text: 'Never pick up shards with hands. Use only a broom and dustpan. Do not put glass in regular bags as they will puncture. Use boxes or thick buckets. Label the container "Danger: Glass".',
		},
		bio_chem_rule: {
			title: 'Chemical & Bio-Hazards',
			text: 'Chemicals (solvents, acids) can corrode clothing or cause burns. Batteries contain mercury and lead. Rotting food waste is a source of mold spores and bacteria; using a RESPIRATOR in such areas is mandatory!',
		},
		sun_rule: {
			title: 'Heat & Sun Protection',
			text: 'Plan cleanups for cooler times (before 10 AM or after 6 PM). Bring at least 1.5 liters of water. Always wear a hat. If you feel dizzy, move to the shade immediately.',
		},
		physical_rule: {
			title: 'Physical Safety',
			text: 'When lifting heavy bags, bend your knees, not your back. Do not lift heavy objects alone. Take breaks every 20-30 minutes of physical labor.',
		},
		emergency_contacts: [
			{ name: 'Ambulance', phone: '103', icon: '🚑' },
			{ name: 'Emergency Services', phone: '1050', icon: '🚨' },
			{ name: 'Fire Department', phone: '101', icon: '🚒' },
		],
	},
}

window.safetyContent = safetyContent
