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
					ru: '🌿 Добро пожаловать в Экопатруль!',
					en: '🌿 Welcome to EcoPatrol!',
					uz: '🌿 Eko-patrulga xush kelibsiz!',
				},
				content: {
					ru: 'Мы рады, что вы с нами! Это приложение поможет нам вместе сделать наш город чище. Давайте я покажу, как здесь всё устроено.',
					en: "We're glad you're here! This app helps us make our city cleaner together. Let me show you how everything works.",
					uz: "Sizni ko'rib turganimizdan xursandmiz! Ushbu ilova shahrimizni birgalikda tozaroq qilishimizga yordam beradi. Keling, bu yerda hamma narsa qanday ishlashini ko'rsataman.",
				},
				position: 'center',
			},
			{
				target: '#map',
				title: {
					ru: '📍 Интерактивная карта',
					en: '📍 Interactive Map',
					uz: '📍 Interaktiv xarita',
				},
				content: {
					ru: 'Перед вами карта города. Все цветные маркеры — это места, где люди нашли мусор. Вы можете нажимать на них, чтобы узнать подробности или построить маршрут.',
					en: 'This is the city map. All colored markers are places where people found trash. You can click on them to see details or get directions.',
					uz: "Bu shahar xaritasi. Barcha rangli belgilar odamlar axlat topgan joylardir. Tafsilotlarni ko'rish yoki yo'nalish olish uchun ularni bosishingiz mumkin.",
				},
				position: 'bottom',
			},
			{
				target: '#add-pollution-btn',
				title: {
					ru: '📸 Станьте героем!',
					en: '📸 Become a Hero!',
					uz: '📸 Qahramonga aylaning!',
				},
				content: {
					ru: 'Увидели свалку? Нажмите эту кнопку! Сделайте фото, добавьте краткое описание, и мы отметим это место на карте, чтобы кто-то мог его убрать.',
					en: "Seen a dump? Press this button! Take a photo, add a short description, and we'll mark it on the map so someone can clean it up.",
					uz: "Chiqindixonani ko'rdingizmi? Ushbu tugmani bosing! Rasmga oling, qisqacha tavsif qo'shing va biz uni xaritada belgilaymiz, shunda kimdir uni tozalashi mumkin.",
				},
				position: 'top',
			},
			{
				target: '#air-widget',
				title: {
					ru: '🌬 Качество воздуха',
					en: '🌬 Air Quality',
					uz: '🌬 Havo sifati',
				},
				content: {
					ru: 'Этот виджет показывает состояние воздуха в реальном времени. Если он зеленый — дышите полной грудью, если красный — будьте осторожны.',
					en: "This widget shows real-time air quality. If it's green, breathe freely; if it's red, be careful.",
					uz: "Ushbu vidjet havo sifatini real vaqtda ko'rsatadi. Agar u yashil bo'lsa, bemalol nafas oling; agar u qizil bo'lsa, ehtiyot bo'ling.",
				},
				position: 'bottom',
			},
			{
				target: '#profile-btn',
				title: {
					ru: '👤 Ваш профиль',
					en: '👤 Your Profile',
					uz: '👤 Sizning filmingiz',
				},
				content: {
					ru: 'Здесь хранятся ваши достижения! Вы можете посмотреть историю своих отчетов, узнать, сколько мусора вы помогли убрать, и сменить настройки.',
					en: 'Your achievements are stored here! You can view your report history, see how much trash you helped clean, and change settings.',
					uz: "Yutuqlaringiz shu yerda saqlanadi! Siz hisobotlaringiz tarixini ko'rishingiz, qancha axlatni tozalashga yordam berganingizni bilishingiz va sozlamalarni o'zgartirishingiz mumkin.",
				},
				position: 'left',
			},
			{
				target: '.balance-display',
				title: {
					ru: '💰 Эко-коины',
					en: '💰 Eco-Coins',
					uz: '💰 Eko-tangalar',
				},
				content: {
					ru: 'За каждый отчет и каждую уборку вы получаете эко-коины. Копите их и обменивайте на ценные призы и бонусы от наших партнеров!',
					en: 'For every report and cleaning, you receive Eco-Coins. Collect them and exchange for valuable prizes and bonuses from our partners!',
					uz: "Har bir hisobot va tozalash uchun siz Eko-tangalarni olasiz. Ularni to'plang va hamkorlarimizning qimmatbaho sovg'alari va bonuslariga almashtiring!",
				},
				position: 'bottom',
			},
			{
				target: 'body',
				title: {
					ru: '🚀 Поехали!',
					en: "🚀 Let's Go!",
					uz: '🚀 Ketdik!',
				},
				content: {
					ru: 'Теперь вы готовы помогать городу. Если что-то забудете — тур всегда можно перезапустить из бокового меню. Удачи, Эко-герой!',
					en: "Now you're ready to help the city. If you forget anything, you can always restart the tour from the sidebar. Good luck, Eco-Hero!",
					uz: "Endi siz shaharga yordam berishga tayyorsiz. Agar biror narsani unutib qo'ysangiz, tur har doim yon menyudan qayta ishga tushirilishi mumkin. Omad, Eko-qahramon!",
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

		document.getElementById('tour-overlay').classList.add('active')
		document.getElementById('tour-tooltip').classList.add('active')

		// Add a small delay to let sidebar animation finish/start
		setTimeout(() => {
			this.renderStep()
		}, 300)

		if (tg) tg.HapticFeedback.impactOccurred('medium')
	},

	stop() {
		this.isActive = false
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

		if (!targetEl || step.target === 'body') {
			tooltip.style.left = '50%'
			tooltip.style.top = '50%'
			tooltip.style.transform = 'translate(-50%, -50%)'
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

		// Tooltip positioning using transform to avoid layout jitter
		const tooltipWidth = 280
		const tooltipHeight = tooltip.offsetHeight || 180

		let tx, ty

		if (step.position === 'bottom') {
			ty = rect.bottom + 20
			tx = rect.left + rect.width / 2 - tooltipWidth / 2
		} else if (step.position === 'top') {
			ty = rect.top - tooltipHeight - 20
			tx = rect.left + rect.width / 2 - tooltipWidth / 2
		} else if (step.position === 'left') {
			ty = rect.top + rect.height / 2 - tooltipHeight / 2
			tx = rect.left - tooltipWidth - 20
		} else if (step.position === 'right') {
			ty = rect.top + rect.height / 2 - tooltipHeight / 2
			tx = rect.right + 20
		} else {
			ty = window.innerHeight / 2 - tooltipHeight / 2
			tx = window.innerWidth / 2 - tooltipWidth / 2
		}

		// Boundary checks
		if (tx < 10) tx = 10
		if (tx + tooltipWidth > window.innerWidth - 10)
			tx = window.innerWidth - tooltipWidth - 10
		if (ty < 10) ty = 10
		if (ty + tooltipHeight > window.innerHeight - 10)
			ty = window.innerHeight - tooltipHeight - 10

		tooltip.style.left = '0'
		tooltip.style.top = '0'
		tooltip.style.transform = `translate3d(${tx}px, ${ty}px, 0)`
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
