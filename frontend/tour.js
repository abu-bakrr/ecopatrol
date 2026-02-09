/**
 * EcoPatrol Interactive Tour System
 */
const tg = window.Telegram ? window.Telegram.WebApp : null
const Tour = {
	steps: [],
	currentStep: 0,
	isActive: false,

	init() {
		this.steps = [
			{
				target: 'body',
				title: {
					ru: '🌿 Добро пожаловать!',
					en: '🌿 Welcome!',
					uz: '🌿 Xush kelibsiz!',
				},
				content: {
					ru: 'Это Экопатруль. Мы вместе делаем город чище. Сейчас я покажу основные функции.',
					en: 'This is EcoPatrol. Together we make the city cleaner. Let me show you the main features.',
					uz: "Bu Eko-patrul. Biz birgalikda shaharni tozaroq qilamiz. Hozir asosiy funksiyalarni ko'rsataman.",
				},
				position: 'center',
			},
			{
				target: '#add-btn',
				title: {
					ru: '📸 Станьте героем!',
					en: '📸 Become a Hero!',
					uz: '📸 Qahramonga aylaning!',
				},
				content: {
					ru: 'Увидели свалку? Нажмите эту кнопку, сделайте фото и укажите место на карте.',
					en: 'Seen a dump? Press this button, take a photo and mark it on the map.',
					uz: "Axlatni ko'rdingizmi? Ushbu tugmani bosing, rasmga oling va uni xaritada belgilang.",
				},
				position: 'center',
			},
			{
				target: '#air-widget',
				title: {
					ru: '🌬 Качество воздуха',
					en: '🌬 Air Quality',
					uz: '🌬 Havo sifati',
				},
				content: {
					ru: 'Этот виджет показывает состояние воздуха. Зеленый — всё отлично, красный — загрязнение.',
					en: 'This widget shows air quality. Green is great, red is pollution.',
					uz: "Ushbu vidjet havo sifatini ko'rsatadi. Yashil - hammasi yaxshi, qizil - ifloslanish.",
				},
				position: 'center',
			},
			{
				target: '#profile-btn',
				title: {
					ru: '👤 Ваш профиль',
					en: '👤 Your Profile',
					uz: '👤 Sizning filmingiz',
				},
				content: {
					ru: 'Здесь хранятся ваши достижения, баланс и история ваших отчетов.',
					en: 'Your achievements, balance, and report history are stored here.',
					uz: 'Bu yerda yutuqlaringiz, balansingiz va hisobotlaringiz tarixi saqlanadi.',
				},
				position: 'center',
			},
			{
				target: '.balance-display',
				title: {
					ru: '💰 Эко-коины',
					en: '💰 Eco-Coins',
					uz: '💰 Eko-tangalar',
				},
				content: {
					ru: 'Получайте коины за помощь городу и обменивайте их на призы от партнеров!',
					en: 'Get coins for helping the city and exchange them for prizes from partners!',
					uz: "Shaharga yordam borganingiz uchun tangalar oling va ularni sovg'alarga almashtiring!",
				},
				position: 'center',
			},
			{
				target: 'body',
				title: {
					ru: '🚀 Поехали!',
					en: "🚀 Let's Go!",
					uz: '🚀 Ketdik!',
				},
				content: {
					ru: 'Вы готовы! Тур всегда можно перезапустить из настроек профиля. Удачи!',
					en: "You're ready! You can always restart the tour from settings. Good luck!",
					uz: 'Siz tayyorsiz! Turni har doim sozlamalardan qayta ishga tushirishingiz mumkin. Omad!',
				},
				position: 'center',
			},
		]

		this.createUI()
	},

	createUI() {
		if (document.getElementById('tour-overlay')) return

		const overlay = document.createElement('div')
		overlay.id = 'tour-overlay'
		overlay.className = 'tour-overlay'
		overlay.onclick = e => {
			if (e.target === overlay) this.stop()
		}

		const tooltip = document.createElement('div')
		tooltip.id = 'tour-tooltip'
		tooltip.className = 'tour-tooltip'

		tooltip.innerHTML = `
            <div class="tour-header">
                <span id="tour-title"></span>
                <button class="tour-close" onclick="Tour.stop()">&times;</button>
            </div>
            <div id="tour-content" class="tour-body"></div>
            <div class="tour-footer">
                <div id="tour-progress" class="tour-dots"></div>
                <div class="tour-btns">
                    <button id="tour-prev" class="btn-tour-outline" onclick="Tour.prev()">Назад</button>
                    <button id="tour-next" class="btn-tour-solid" onclick="Tour.next()">Далее</button>
                </div>
            </div>
        `

		document.body.appendChild(overlay)
		document.body.appendChild(tooltip)
	},

	start() {
		if (this.isActive) return
		this.isActive = true
		this.currentStep = 0

		// Close sidebar if it's open
		if (window.closeSidebar) window.closeSidebar()

		// Prepare content immediately to prevent empty flash
		this.renderStep()

		document.body.classList.add('tour-active')
		document.getElementById('tour-overlay').classList.add('active')
		document.getElementById('tour-tooltip').classList.add('active')

		// Re-position after sidebar settles
		setTimeout(() => {
			this.positionTooltip(this.steps[this.currentStep])
		}, 300)

		if (tg) tg.HapticFeedback.impactOccurred('medium')
	},

	stop() {
		this.isActive = false
		document.body.classList.remove('tour-active')
		document.getElementById('tour-overlay').classList.remove('active')
		document.getElementById('tour-tooltip').classList.remove('active')
		this.removeSpotlight()
		localStorage.setItem('tour_completed', 'true')
		if (tg) tg.HapticFeedback.impactOccurred('light')
	},

	next() {
		if (this.currentStep < this.steps.length - 1) {
			this.currentStep++
			this.renderStep()
			if (tg) tg.HapticFeedback.impactOccurred('light')
		} else {
			this.stop()
		}
	},

	prev() {
		if (this.currentStep > 0) {
			this.currentStep--
			this.renderStep()
			if (tg) tg.HapticFeedback.impactOccurred('light')
		}
	},

	renderStep() {
		const step = this.steps[this.currentStep]
		const lang = window.currentLang || 'ru'

		document.getElementById('tour-title').innerText = step.title[lang]
		document.getElementById('tour-content').innerText = step.content[lang]

		// Update Buttons
		const nextBtn = document.getElementById('tour-next')
		const prevBtn = document.getElementById('tour-prev')

		nextBtn.innerText =
			this.currentStep === this.steps.length - 1 ?
				lang === 'ru' ?
					'Завершить'
				:	'Finish'
			: lang === 'ru' ? 'Далее'
			: 'Next'
		prevBtn.style.visibility = this.currentStep === 0 ? 'hidden' : 'visible'
		prevBtn.innerText = lang === 'ru' ? 'Назад' : 'Back'

		// Update Dots
		const dots = document.getElementById('tour-progress')
		dots.innerHTML = this.steps
			.map(
				(_, i) =>
					`<div class="tour-dot ${i === this.currentStep ? 'active' : ''}"></div>`,
			)
			.join('')

		this.positionTooltip(step)
	},

	positionTooltip(step) {
		const tooltip = document.getElementById('tour-tooltip')
		const overlay = document.getElementById('tour-overlay')
		const targetEl = document.querySelector(step.target)

		this.removeSpotlight()

		// Always keep tooltip centered as requested
		tooltip.style.left = '50%'
		tooltip.style.top = '50%'
		tooltip.style.transform = 'translate(-50%, -50%)'

		if (!targetEl || step.target === 'body') {
			overlay.style.clipPath = 'none'
			return
		}

		const rect = targetEl.getBoundingClientRect()
		const margin = 5

		this.addSpotlight(rect)

		// Fix Blur: apply clip-path to overlay to EXCLUDE the spotlight area
		const r = {
			t: rect.top - margin,
			l: rect.left - margin,
			w: rect.width + margin * 2,
			h: rect.height + margin * 2,
		}
		overlay.style.clipPath = `polygon(
            0% 0%, 0% 100%, 
            ${r.l}px 100%, ${r.l}px ${r.t}px, 
            ${r.l + r.w}px ${r.t}px, ${r.l + r.w}px ${r.t + r.h}px, 
            ${r.l}px ${r.t + r.h}px, ${r.l}px 100%, 
            100% 100%, 100% 0%
        )`
	},

	addSpotlight(rect) {
		const spotlight = document.createElement('div')
		spotlight.id = 'tour-spotlight'
		spotlight.className = 'tour-spotlight'
		spotlight.style.top = `${rect.top - 5}px`
		spotlight.style.left = `${rect.left - 5}px`
		spotlight.style.width = `${rect.width + 10}px`
		spotlight.style.height = `${rect.height + 10}px`
		document.body.appendChild(spotlight)
	},

	removeSpotlight() {
		const el = document.getElementById('tour-spotlight')
		if (el) el.remove()
		const overlay = document.getElementById('tour-overlay')
		if (overlay) overlay.style.clipPath = 'none'
	},
}

window.Tour = Tour
