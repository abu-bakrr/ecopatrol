const safetyContent = {
	uz: {
		title: 'Xavfsizlik yoʻriqnomasi',
		levels: [
			{
				label: 'Past daraja (Yashil)',
				description:
					'Muntazam maishiy chiqindilar: qogʻoz, plastik idishlar, qadoqlash materiallari. Inson salomatligi uchun bevosita xavf tugʻdirmaydi.',
				tools: 'Oddiy toʻqimali qoʻlqoplar, axlat qoplari.',
			},
			{
				label: 'Oʻrtacha daraja (Sariq)',
				description:
					'Qurilish chiqindilari, singan shishalar, oʻtkir metall buyumlar, eski maishiy texnika qismlari.',
				tools:
					'Zich rezina yoki charm qoʻlqoplar, yopiq poyabzal, singan shishalar uchun choʻtka va belkurak.',
			},
			{
				label: 'Yuqori daraja (Qizil)',
				description:
					'Zaharli va xavfli chiqindilar: kimyoviy moddalar, batareyalar, elektronika, tibbiy chiqindilar (shpritslar, dori-darmonlar), shuningdek, ko‘p miqdordagi chirigan oziq-ovqat qoldiqlari.',
				tools:
					'Respirator, germetik rezina qo‘lqoplar, himoya ko‘zoynaklari va maxsus qisqichlar. Noma’lum moddalarga MUTLAQO tegmang!',
			},
		],
		rules: [
			'Hech qachon axlatga (ayniqsa shisha va metallga) yalangʻoch qoʻl bilan tegmang.',
			'Noma’lum suyuqliklar va idishlarni ochmang yoki hidlamang.',
			'Singan shishalarni tozalashda faqat qalin qoʻlqop va vositalardan (belkurak, qisqich) foydalaning.',
			'Agar chiqindi xavfli koʻrinsa (tibbiy, kimyoviy), uni oʻzingiz tozalashga urinmang, mutaxassislarni chaqiring.',
			'Tozalashdan soʻng qoʻlingizni yaxshilab yuving yoki antiseptik bilan ishlov bering.',
		],
		glass_rule: {
			title: 'Shisha bilan ishlash qoidalari',
			text: 'Shisha parchalarini qoʻl bilan yigʻmang. Faqat belkurak va choʻtkadan foydalaning. Singan shishalarni oddiy paketga solmang (teshib oʻtishi mumkin), karton quti yoki qalin materialdan foydalaning.',
		},
		bio_chem_rule: {
			title: 'Kimyoviy va biologik xavf',
			text: 'Kimyoviy chiqindilar (bo‘yoqlar, erituvchilar, kislotalar, ishqorlar) nafaqat tabiatni zaharlaydi, balki kiyimingizni eritib yuborishi yoki teringizda qattiq kuyish hosil qilishi mumkin. Batareyalar, akkumulyatorlar va lyuminessent lampalar tarkibida simob, kadmiy va qo‘rg‘oshin kabi o‘ta zaharli metallar bor — ularni oddiy axlat bilan aralashtirmang. \n\nOziq-ovqat qoldiqlari (organika) chiriganda xavfli gazlar ajratib chiqaradi va patogen bakteriyalar, mog‘or hamda kemiruvchilar (kalamushlar) uchun oziqlanish joyi hisoblanadi. Bunday joylarni tozalashda NIQOB (respirator) taqish shart, chunki mog‘or sporalari o‘pkaga zarar yetkazishi mumkin. Organikani yig‘ishda qo‘l bilan emas, faqat belkurakdan foydalaning va ularni qalin, germetik paketlarga soling.',
		},
	},
	ru: {
		title: 'Руководство по безопасности',
		levels: [
			{
				label: 'Низкий уровень (Зеленый)',
				description:
					'Обычный бытовой мусор: бумага, пластиковые бутылки, упаковки. Не представляет прямой угрозы здоровью.',
				tools: 'Обычные тканевые перчатки, пакеты для мусора.',
			},
			{
				label: 'Средний уровень (Желтый)',
				description:
					'Строительные отходы, разбитое стекло, острые металлические предметы, части старой техники.',
				tools:
					'Плотные прорезиненные или кожаные перчатки, закрытая обувь, совок и щетка для осколков.',
			},
			{
				label: 'Высокий уровень (Красный)',
				description:
					'Токсичные и опасные отходы: химикаты, батарейки, ртутные лампы, электроника, медицинские отходы (шприцы), а также гниющая органика в больших количествах.',
				tools:
					'Респиратор или маска, герметичные резиновые перчатки, защитные очки и щипцы. Не трогайте неизвестные вещества!',
			},
		],
		rules: [
			'Никогда не трогайте мусор (особенно стекло и металл) голыми руками.',
			'Не открывайте и не нюхайте неизвестные флаконы и емкости.',
			'При уборке стекла используйте только толстые перчатки и инвентарь (совок, щипцы).',
			'Если отходы выглядят опасно (медицинские, химические), не пытайтесь убрать их сами, вызовите специалистов.',
			'После уборки обязательно вымойте руки с мылом или обработайте антисептиком.',
		],
		glass_rule: {
			title: 'Работа со стеклом',
			text: 'Не собирайте осколки руками. Используйте только веник и совок. Не кладите стекло в обычные пакеты (они проткнутся), используйте коробки или плотную тару.',
		},
		bio_chem_rule: {
			title: 'Химическая и био-угроза',
			text: 'Химические отходы (краски, растворители, кислоты, щелочи) могут не только отравить почву, но и разъесть одежду или вызвать сильные химические ожоги. Батарейки, аккумуляторы и люминесцентные лампы содержат ртуть, кадмий и свинец — их нельзя выбрасывать с общим мусором. \n\nПищевые отходы (органика) при гниении выделяют опасные газы и становятся рассадником болезнетворных бактерий, плесени и грызунов. При уборке таких мест обязательно использование РЕСПИРАТОРА, так как споры плесени могут попасть в легкие. Используйте лопаты вместо рук и упаковывайте органику в плотные, герметичные пакеты.',
		},
	},
	en: {
		title: 'Safety Guide',
		levels: [
			{
				label: 'Low Level (Green)',
				description:
					'Common household waste: paper, plastic bottles, packaging. Does not pose a direct threat to health.',
				tools: 'Regular textile gloves, trash bags.',
			},
			{
				label: 'Medium Level (Yellow)',
				description:
					'Construction waste, broken glass, sharp metal objects, parts of old machinery.',
				tools:
					'Thick rubber-coated or leather gloves, closed shoes, dustpan and brush for shards.',
			},
			{
				label: 'High Level (Red)',
				description:
					'Toxic and hazardous waste: chemicals, batteries, mercury lamps, electronics, medical waste (syringes), and large amounts of rotting organic food waste.',
				tools:
					'Respirator or mask, airtight rubber gloves, safety goggles, and tongs. Do not touch unknown substances!',
			},
		],
		rules: [
			'Never touch trash (especially glass and metal) with bare hands.',
			'Do not open or smell unknown bottles or containers.',
			'When cleaning glass, use only thick gloves and tools (dustpan, tongs).',
			'If waste looks hazardous (medical, chemical), do not attempt to clean it yourself, call professionals.',
			'After cleaning, be sure to wash your hands with soap or use antiseptic.',
		],
		glass_rule: {
			title: 'Handling Glass',
			text: 'Do not pick up shards with your hands. Use only a broom and dustpan. Do not put glass in regular bags (they will puncture), use boxes or thick containers.',
		},
		bio_chem_rule: {
			title: 'Chemical & Bio-Hazards',
			text: 'Chemical waste (paints, solvents, acids, alkalis) can not only poison the soil but also corrode clothing or cause severe chemical burns. Batteries, accumulators, and fluorescent lamps contain mercury, cadmium, and lead — they must not be mixed with general waste. \n\nFood waste (organics) releases hazardous gases during decomposition and becomes a breeding ground for pathogenic bacteria, mold, and rodents. When cleaning such areas, a RESPIRATOR is mandatory, as mold spores can Enter the lungs. Use shovels instead of hands and pack organics into thick, airtight bags.',
		},
	},
}

window.safetyContent = safetyContent
