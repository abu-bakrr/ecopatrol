// EcoPatrol Premium JS
const tg = window.Telegram.WebApp
const API_URL = window.location.origin + '/api'

let map
let markers = []
let currentUser = null
let selectedLevel = 1

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
	tg.expand()
	tg.ready()
	tg.headerColor = '#10b981'

	initMap()
	await authUser()
	setupEventListeners()
	loadPollutions()
})

function initMap() {
	// Ждем, пока библиотека загрузится
	if (typeof maplibregl === 'undefined') {
		console.error('MapLibre GL not loaded. Retrying...')
		setTimeout(initMap, 500)
		return
	}

	map = new maplibregl.Map({
		container: 'map',
		style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json', // More beautiful clean style
		center: [37.6173, 55.7558],
		zoom: 13,
		pitch: 45, // 3D perspective
		antialias: true,
	})

	map.on('load', () => {
		console.log('Map initialized')
		// Add 3D buildings for Wow-effect
		map.addLayer({
			id: '3d-buildings',
			source: 'composite',
			'source-layer': 'building',
			filter: ['==', 'extrude', 'true'],
			type: 'fill-extrusion',
			minzoom: 15,
			paint: {
				'fill-extrusion-color': '#aaa',
				'fill-extrusion-height': ['get', 'height'],
				'fill-extrusion-base': ['get', 'min_height'],
				'fill-extrusion-opacity': 0.6,
			},
		})
	})

	const crosshair = document.getElementById('map-center-marker')
	map.on('movestart', () => crosshair.classList.add('active'))
	map.on('moveend', () => crosshair.classList.remove('active'))
}

async function authUser() {
	const initData = tg.initDataUnsafe
	const user = initData.user || {
		id: 12345,
		first_name: 'Эко',
		last_name: 'Герой',
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
		document.getElementById('username').textContent =
			user.username || user.first_name
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
	document.getElementById('modal-overlay').addEventListener('click', e => {
		if (e.target.id === 'modal-overlay') hideModal()
	})
}

function getLevelColor(level) {
	if (level === 1) return '#10b981'
	if (level === 2) return '#f59e0b'
	return '#ef4444'
}

async function loadPollutions() {
	try {
		const response = await fetch(`${API_URL}/pollutions`)
		const pollutions = await response.json()

		markers.forEach(m => m.remove())
		markers = []

		pollutions.forEach(p => {
			const el = document.createElement('div')
			el.className = 'pollution-marker'
			el.innerHTML = `
                <div style="
                    width: 24px; 
                    height: 24px; 
                    background: ${getLevelColor(p.level)}; 
                    border: 3px solid white; 
                    border-radius: 50%;
                    box-shadow: 0 4px 10px rgba(0,0,0,0.3);
                "></div>
            `

			const marker = new maplibregl.Marker(el)
				.setLngLat([p.lng, p.lat])
				.addTo(map)

			el.addEventListener('click', () => showPollutionDetails(p))
			markers.push(marker)
		})
	} catch (e) {
		console.error('Markers error:', e)
	}
}

function showAddForm() {
	const center = map.getCenter()
	const body = document.getElementById('modal-body')
	body.innerHTML = `
        <h2 class="modal-title">Новое загрязнение</h2>
        <div class="form-group">
            <label>ОПАСНОСТЬ</label>
            <div class="level-picker">
                <button class="lvl-btn active" data-lvl="1" onclick="window.setLevel(1)">Низкая</button>
                <button class="lvl-btn" data-lvl="2" onclick="window.setLevel(2)">Средняя</button>
                <button class="lvl-btn" data-lvl="3" onclick="window.setLevel(3)">Высокая</button>
            </div>
        </div>
        <div class="form-group">
            <label>ЧТО ТАМ?</label>
            <textarea id="pollution-desc" rows="3" placeholder="Опишите масштаб проблемы..."></textarea>
        </div>
        <button class="btn btn-primary" onclick="window.submitPollution(${center.lat}, ${center.lng})">🚀 Отправить патруль</button>
    `
	showModal()
}

window.setLevel = level => {
	selectedLevel = level
	document.querySelectorAll('.lvl-btn').forEach(btn => {
		btn.classList.toggle('active', parseInt(btn.dataset.lvl) === level)
	})
}

window.submitPollution = async (lat, lng) => {
	const desc = document.getElementById('pollution-desc').value
	tg.MainButton.showProgress()

	try {
		const response = await fetch(`${API_URL}/pollutions`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				user_id: currentUser.id,
				lat,
				lng,
				level: selectedLevel,
				types: ['trash'], // Simplified for MVP
				description: desc,
				photos: [],
			}),
		})
		if (response.ok) {
			hideModal()
			loadPollutions()
			tg.HapticFeedback.notificationOccurred('success')
		}
	} catch (e) {
		tg.showAlert('Ошибка сети')
	}
	tg.MainButton.hideProgress()
}

async function showPollutionList() {
	const body = document.getElementById('modal-body')
	body.innerHTML =
		'<h2 class="modal-title">Биржа заданий</h2><div id="list-items">🔍 Ищем мусор...</div>'
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
                <div class="list-item-header">
                    <div>
                        <span class="badge" style="background: ${getLevelColor(p.level)}1A; color: ${getLevelColor(p.level)}">
                            Уровень ${p.level}
                        </span>
                        <p style="margin: 8px 0; font-size: 0.9rem;">${p.description || 'Без описания'}</p>
                    </div>
                    <button class="btn btn-secondary" style="padding: 10px; flex: 0;" onclick="window.goToPollution(${p.lat}, ${p.lng})">📍</button>
                </div>
            `
			listItems.appendChild(item)
		})
	} catch (e) {
		console.error(e)
	}
}

window.goToPollution = (lat, lng) => {
	map.flyTo({ center: [lng, lat], zoom: 17, duration: 2000 })
	hideModal()
}

function showPollutionDetails(p) {
	const body = document.getElementById('modal-body')
	body.innerHTML = `
        <h2 class="modal-title">Детали объекта</h2>
        <div class="list-item" style="border: none; background: #f1f5f9;">
             <p><strong>Опасность:</strong> ${p.level}/3</p>
             <p>${p.description || 'Описание отсутствует'}</p>
        </div>
        <button class="btn btn-primary" onclick="window.cleanPollution(${p.id})">🌿 Я убрал этот мусор!</button>
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
			tg.HapticFeedback.impactOccurred('heavy')
		}
	} catch (e) {
		tg.showAlert('Ошибка сервера')
	}
}

function showModal() {
	document.getElementById('modal-overlay').classList.add('active')
}

function hideModal() {
	document.getElementById('modal-overlay').classList.remove('active')
}
