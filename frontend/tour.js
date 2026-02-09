/**
 * EcoPatrol Interactive Tour System
 */
const Tour = {
	steps: [],
	currentStep: 0,
	isActive: false,

	init() {
		this.steps = [
			{
				target: 'body',
				title: { ru: 'Добро пожаловать!', en: 'Welcome!' },
				content: {
					ru: 'Давайте пройдем короткий тур по приложению Экопатруль.',
					en: "Let's take a short tour of the EcoPatrol app.",
				},
				position: 'center',
			},
			{
				target: '#map',
				title: { ru: 'Карта загрязнений', en: 'Pollution Map' },
				content: {
					ru: 'Здесь вы видите все отмеченные загрязнения в городе. Вы можете перемещать и масштабировать карту.',
					en: 'Here you see all reported pollutions in the city. You can move and zoom the map.',
				},
				position: 'bottom',
			},
			{
				target: '#add-pollution-btn',
				title: { ru: 'Добавить отчет', en: 'Add Report' },
				content: {
					ru: 'Нажмите сюда, чтобы сообщить о новом загрязнении. Сфотографируйте и укажите место.',
					en: 'Click here to report new pollution. Take a photo and specify the location.',
				},
				position: 'top',
			},
			{
				target: '#air-widget-container',
				title: { ru: 'Качество воздуха', en: 'Air Quality' },
				content: {
					ru: 'Следите за состоянием воздуха в вашем районе в режиме реального времени.',
					en: 'Monitor air quality in your area in real-time.',
				},
				position: 'bottom',
			},
			{
				target: '#profile-btn',
				title: { ru: 'Ваш профиль', en: 'Your Profile' },
				content: {
					ru: 'Здесь вы можете увидеть свой баланс, историю отчетов и сменить язык.',
					en: 'Here you can see your balance, report history, and change the language.',
				},
				position: 'left',
			},
			{
				target: '.balance-display',
				title: { ru: 'Награды', en: 'Rewards' },
				content: {
					ru: 'За каждое подтвержденное сообщение и очистку вы получаете эко-коины!',
					en: 'For every confirmed report and cleanup, you receive eco-coins!',
				},
				position: 'bottom',
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
		document.getElementById('tour-overlay').classList.add('active')
		document.getElementById('tour-tooltip').classList.add('active')
		this.renderStep()
		tg.HapticFeedback.impactOccurred('medium')
	},

	stop() {
		this.isActive = false
		document.getElementById('tour-overlay').classList.remove('active')
		document.getElementById('tour-tooltip').classList.remove('active')
		this.removeSpotlight()
		localStorage.setItem('tour_completed', 'true')
		tg.HapticFeedback.impactOccurred('light')
	},

	next() {
		if (this.currentStep < this.steps.length - 1) {
			this.currentStep++
			this.renderStep()
			tg.HapticFeedback.impactOccurred('light')
		} else {
			this.stop()
		}
	},

	prev() {
		if (this.currentStep > 0) {
			this.currentStep--
			this.renderStep()
			tg.HapticFeedback.impactOccurred('light')
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
		const targetEl = document.querySelector(step.target)

		this.removeSpotlight()

		if (!targetEl || step.target === 'body') {
			tooltip.style.top = '50%'
			tooltip.style.left = '50%'
			tooltip.style.transform = 'translate(-50%, -50%)'
			return
		}

		const rect = targetEl.getBoundingClientRect()
		const padding = 8

		this.addSpotlight(rect)

		const tooltipRect = tooltip.getBoundingClientRect()
		let top, left

		tooltip.style.transform = 'none'

		if (step.position === 'bottom') {
			top = rect.bottom + 15
			left = rect.left + rect.width / 2 - tooltipRect.width / 2
		} else if (step.position === 'top') {
			top = rect.top - tooltipRect.height - 15
			left = rect.left + rect.width / 2 - tooltipRect.width / 2
		} else if (step.position === 'left') {
			top = rect.top + rect.height / 2 - tooltipRect.height / 2
			left = rect.left - tooltipRect.width - 15
		} else if (step.position === 'right') {
			top = rect.top + rect.height / 2 - tooltipRect.height / 2
			left = rect.right + 15
		} else {
			top = window.innerHeight / 2 - tooltipRect.height / 2
			left = window.innerWidth / 2 - tooltipRect.width / 2
		}

		// Boundary checks
		if (left < 10) left = 10
		if (left + tooltipRect.width > window.innerWidth - 10)
			left = window.innerWidth - tooltipRect.width - 10
		if (top < 10) top = 10
		if (top + tooltipRect.height > window.innerHeight - 10)
			top = window.innerHeight - tooltipRect.height - 10

		tooltip.style.top = `${top}px`
		tooltip.style.left = `${left}px`
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
	},
}

window.Tour = Tour
