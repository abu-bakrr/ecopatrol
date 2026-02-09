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
					'Kimyoviy moddalar, batareyalar, lampochkalar, tibbiy chiqindilar, noma’lum suyuqliklar, chirigan organika.',
				tools:
					'Respirator yoki niqob, germetik rezina qoʻlqoplar, himoya koʻzoynaklari. Noma’lum moddalarga tegmang!',
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
					'Химикаты, батарейки, ртутные лампы, медицинские отходы, неизвестные жидкости, гниющая органика.',
				tools:
					'Респиратор или маска, герметичные резиновые перчатки, защитные очки. Не трогайте неизвестные вещества!',
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
					'Chemicals, batteries, mercury lamps, medical waste, unknown liquids, rotting organics.',
				tools:
					'Respirator or mask, airtight rubber gloves, safety goggles. Do not touch unknown substances!',
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
	},
}

window.safetyContent = safetyContent
