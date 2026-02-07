// EcoPatrol Main JS
const tg = window.Telegram.WebApp
const API_URL = 'http://localhost:5000/api' // Change to VPS IP in production

let map
let markers = []
let currentUser = null
let selectedLevel = 1

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
	tg.expand()
	tg.ready()

	initMap()
	await authUser()
	setupEventListeners()
	loadPollutions()
})

function initMap() {
	map = new maplibregl.Map({
		container: 'map',
		style: 'https://demotiles.maplibre.org/style.json', // Basic style without API key
		center: [37.6173, 55.7558], // Moscow coordinates
		zoom: 12,
	})

	map.on('load', () => {
		console.log('Map loaded')
	})
}

async function authUser() {
	const initData = tg.initDataUnsafe
	const user = initData.user || {
		id: 12345,
		first_name: 'Тестовый',
		last_name: 'Пользователь',
	}

	try {
		const response = await fetch(`${API_URL}/init`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				telegram_id: user.id,
				username: user.username || user.first_name,
				initData: tg.initData,
			}),
		})
		const data = await response.json()
		currentUser = data.user
		updateUI()
	} catch (e) {
		console.error('Auth error:', e)
	}
}

function updateUI() {
	if (currentUser) {
		document.getElementById('username').textContent = currentUser.username
		document.getElementById('balance').textContent = `💰 ${currentUser.balance}`
	}
}

function setupEventListeners() {
	document.getElementById('add-btn').addEventListener('click', showAddForm)
	document
		.getElementById('list-btn')
		.addEventListener('click', showPollutionList)
	document.getElementById('close-modal').addEventListener('click', hideModal)
}

async function loadPollutions() {
	try {
		const response = await fetch(`${API_URL}/pollutions`)
		const pollutions = await response.json()

		// Clear old markers
		markers.forEach(m => m.remove())
		markers = []

		pollutions.forEach(p => {
			const el = document.createElement('div')
			el.className = 'marker active-pollution'
			el.style.backgroundColor = getLevelColor(p.level)
			el.style.width = '20px'
			el.style.height = '20px'
			el.style.borderRadius = '50%'
			el.style.border = '2px solid white'

			const marker = new maplibregl.Marker(el)
				.setLngLat([p.lng, p.lat])
				.addTo(map)

			el.addEventListener('click', () => showPollutionDetails(p))
			markers.push(marker)
		})
	} catch (e) {
		console.error('Load pollutions error:', e)
	}
}

function getLevelColor(level) {
	if (level === 1) return '#4CAF50'
	if (level === 2) return '#FF9800'
	return '#F44336'
}

function showAddForm() {
	const center = map.getCenter()
	const body = document.getElementById('modal-body')
	body.innerHTML = `
        <h2>Отметить загрязнение</h2>
        <div class="form-group">
            <label>Уровень опасности</label>
            <div class="level-selector">
                <button class="level-btn active" onclick="window.setLevel(1)">1</button>
                <button class="level-btn" onclick="window.setLevel(2)">2</button>
                <button class="level-btn" onclick="window.setLevel(3)">3</button>
            </div>
        </div>
        <div class="form-group">
            <label>Тип мусора</label>
            <select id="pollution-type" multiple>
                <option value="plastic">Пластик</option>
                <option value="trash">Бытовой мусор</option>
                <option value="water">Загрязнение воды</option>
                <option value="other">Другое</option>
            </select>
        </div>
        <div class="form-group">
            <label>Описание</label>
            <textarea id="pollution-desc" rows="3"></textarea>
        </div>
        <button class="action-btn primary" onclick="window.submitPollution(${center.lat}, ${center.lng})">Отправить</button>
    `
	showModal()
}

// Global functions for modal interactions
window.setLevel = level => {
	selectedLevel = level
	document.querySelectorAll('.level-btn').forEach((btn, idx) => {
		btn.classList.toggle('active', idx + 1 === level)
	})
}

window.submitPollution = async (lat, lng) => {
	const desc = document.getElementById('pollution-desc').value
	const typeSelect = document.getElementById('pollution-type')
	const types = Array.from(typeSelect.selectedOptions).map(opt => opt.value)

	try {
		const response = await fetch(`${API_URL}/pollutions`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				user_id: currentUser.id,
				lat,
				lng,
				level: selectedLevel,
				types,
				description: desc,
				photos: [], // In real app, upload to Cloudinary first
			}),
		})
		if (response.ok) {
			hideModal()
			loadPollutions()
			tg.showAlert('Загрязнение отмечено!')
		}
	} catch (e) {
		tg.showAlert('Ошибка при отправке')
	}
}

async function showPollutionList() {
	const body = document.getElementById('modal-body')
	body.innerHTML =
		'<h2>Биржа загрязнений</h2><div id="list-items">Загрузка...</div>'
	showModal()

	try {
		const response = await fetch(`${API_URL}/pollutions`)
		const pollutions = await response.json()
		const listItems = document.getElementById('list-items')
		listItems.innerHTML = ''

		pollutions.forEach(p => {
			const item = document.createElement('div')
			item.className = 'list-item'
			item.innerHTML = `
                <div style="border-bottom: 1px solid #eee; padding: 12px 0;">
                    <strong>Уровень: ${p.level}</strong><br>
                    <span>${p.types.join(', ')}</span><br>
                    <button class="action-btn secondary" style="padding: 8px; margin-top: 8px;" onclick="window.goToPollution(${p.lat}, ${p.lng})">На карте</button>
                </div>
            `
			listItems.appendChild(item)
		})
	} catch (e) {
		console.error(e)
	}
}

window.goToPollution = (lat, lng) => {
	map.flyTo({ center: [lng, lat], zoom: 16 })
	hideModal()
}

function showPollutionDetails(p) {
	const body = document.getElementById('modal-body')
	body.innerHTML = `
        <h2>Детали загрязнения</h2>
        <p><strong>Тип:</strong> ${p.types.join(', ')}</p>
        <p><strong>Уровень:</strong> ${p.level}</p>
        <p>${p.description}</p>
        <button class="action-btn primary" onclick="window.cleanPollution(${p.id})">✅ Я убрал это!</button>
    `
	showModal()
}

window.cleanPollution = async id => {
	try {
		const response = await fetch(`${API_URL}/pollutions/${id}/clean`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ photos: [] }),
		})
		const data = await response.json()
		if (response.ok) {
			currentUser.balance = data.new_balance
			updateUI()
			hideModal()
			loadPollutions()
			tg.showConfirm('Поздравляем! Вам начислено вознаграждение.')
		}
	} catch (e) {
		tg.showAlert('Ошибка при очистке')
	}
}

function showModal() {
	document.getElementById('modal-overlay').classList.remove('hidden')
}

function hideModal() {
	document.getElementById('modal-overlay').classList.add('hidden')
}
