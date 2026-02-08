// EcoPatrol - Premium Edition
const tg = window.Telegram.WebApp
const API_URL = window.location.origin + '/api'
const CLOUDINARY_CLOUD_NAME = 'dxjyi9id6' // From your .env
const CLOUDINARY_UPLOAD_PRESET = 'ecopatrol' // You'll need to create this in Cloudinary

let map
let markers = []
let currentUser = null
let selectedLevel = 1
let uploadedPhotos = []
let currentPollution = null

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
	tg.expand()
	tg.ready()
	tg.setHeaderColor('#064e3b')

	initMap()
	await authUser()
	setupEventListeners()
	loadPollutions()
})

function initMap() {
	if (typeof maplibregl === 'undefined') {
		setTimeout(initMap, 500)
		return
	}

	map = new maplibregl.Map({
		container: 'map',
		style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
		center: [37.6173, 55.7558],
		zoom: 13,
		pitch: 45,
		antialias: true,
	})

	map.on('load', () => {
		console.log('Map loaded')
	})
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
		updateProfileUI()
	} catch (e) {
		console.error('Auth error:', e)
	}
}

function updateProfileUI() {
	if (!currentUser) return
	document.getElementById('sidebar-username').textContent = currentUser.username
	document.getElementById('sidebar-balance').textContent =
		`$${currentUser.balance.toFixed(2)}`
}

function setupEventListeners() {
	// Profile
	document.getElementById('profile-btn').addEventListener('click', openSidebar)
	document
		.getElementById('sidebar-close')
		.addEventListener('click', closeSidebar)

	// Geolocation
	document.getElementById('geolocate-btn').addEventListener('click', geolocate)

	// Add pollution
	document.getElementById('add-btn').addEventListener('click', showAddForm)

	// Overlay
	document.getElementById('overlay').addEventListener('click', closeAll)
}

function openSidebar() {
	document.getElementById('sidebar').classList.add('active')
	document.getElementById('overlay').classList.add('active')
	loadProfileStats()
}

function closeSidebar() {
	document.getElementById('sidebar').classList.remove('active')
	document.getElementById('overlay').classList.remove('active')
}

function openBottomSheet() {
	document.getElementById('bottom-sheet').classList.add('active')
	document.getElementById('overlay').classList.add('active')
}

function closeBottomSheet() {
	document.getElementById('bottom-sheet').classList.remove('active')
	document.getElementById('overlay').classList.remove('active')
}

function closeAll() {
	closeSidebar()
	closeBottomSheet()
}

async function loadProfileStats() {
	if (!currentUser) return
	try {
		const response = await fetch(`${API_URL}/profile/${currentUser.id}`)
		const data = await response.json()
		document.getElementById('sidebar-cleaned').textContent = data.cleaned_count
	} catch (e) {
		console.error(e)
	}
}

function geolocate() {
	if (!navigator.geolocation) {
		tg.showAlert('Геолокация недоступна')
		return
	}

	navigator.geolocation.getCurrentPosition(
		position => {
			map.flyTo({
				center: [position.coords.longitude, position.coords.latitude],
				zoom: 16,
				duration: 2000,
			})
			tg.HapticFeedback.impactOccurred('light')
		},
		error => {
			tg.showAlert('Не удалось определить местоположение')
		},
	)
}

async function loadPollutions() {
	try {
		const response = await fetch(`${API_URL}/pollutions`)
		const pollutions = await response.json()

		markers.forEach(m => m.remove())
		markers = []

		pollutions.forEach(p => {
			const el = document.createElement('div')
			el.className = `pollution-marker level-${p.level}`

			const marker = new maplibregl.Marker({ element: el })
				.setLngLat([p.lng, p.lat])
				.addTo(map)

			el.addEventListener('click', () => showPollutionDetails(p))
			markers.push(marker)
		})
	} catch (e) {
		console.error('Load pollutions error:', e)
	}
}

function showAddForm() {
	const center = map.getCenter()
	uploadedPhotos = []

	const content = document.getElementById('sheet-content')
	content.innerHTML = `
        <h2 style="font-size: 24px; font-weight: 700; margin-bottom: 24px;">Новое загрязнение</h2>
        
        <div class="form-group">
            <label class="form-label">УРОВЕНЬ ОПАСНОСТИ</label>
            <div class="level-selector">
                <button class="level-btn active level-1" data-level="1">Низкий</button>
                <button class="level-btn level-2" data-level="2">Средний</button>
                <button class="level-btn level-3" data-level="3">Высокий</button>
            </div>
        </div>
        
        <div class="form-group">
            <label class="form-label">ОПИСАНИЕ</label>
            <textarea class="form-textarea" id="pollution-desc" rows="3" placeholder="Опишите проблему..."></textarea>
        </div>
        
        <div class="form-group">
            <label class="form-label">ФОТО</label>
            <div class="file-upload" id="upload-trigger">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" style="margin: 0 auto 12px;">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                </svg>
                <p style="color: #6b7280;">Нажмите для загрузки фото</p>
            </div>
            <div id="photo-preview" class="photo-grid"></div>
        </div>
        
        <button class="btn btn-primary" style="width: 100%;" id="submit-pollution">
            Отправить
        </button>
    `

	openBottomSheet()

	// Level selector
	content.querySelectorAll('.level-btn').forEach(btn => {
		btn.addEventListener('click', () => {
			content
				.querySelectorAll('.level-btn')
				.forEach(b => b.classList.remove('active'))
			btn.classList.add('active')
			selectedLevel = parseInt(btn.dataset.level)
		})
	})

	// Photo upload
	document
		.getElementById('upload-trigger')
		.addEventListener('click', () => uploadPhoto('before'))

	// Submit
	document.getElementById('submit-pollution').addEventListener('click', () => {
		submitPollution(center.lat, center.lng)
	})
}

function uploadPhoto(type) {
	const widget = cloudinary.createUploadWidget(
		{
			cloudName: CLOUDINARY_CLOUD_NAME,
			uploadPreset: CLOUDINARY_UPLOAD_PRESET,
			sources: ['camera', 'local'],
			multiple: true,
			maxFiles: 5,
			clientAllowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
			maxFileSize: 5000000,
		},
		(error, result) => {
			if (!error && result && result.event === 'success') {
				uploadedPhotos.push(result.info.secure_url)
				updatePhotoPreview()
				tg.HapticFeedback.notificationOccurred('success')
			}
		},
	)

	widget.open()
}

function updatePhotoPreview() {
	const preview = document.getElementById('photo-preview')
	if (!preview) return

	preview.innerHTML = uploadedPhotos
		.map(
			url => `
        <div class="photo-item">
            <img src="${url}" alt="Photo">
        </div>
    `,
		)
		.join('')
}

async function submitPollution(lat, lng) {
	const desc = document.getElementById('pollution-desc').value

	try {
		const response = await fetch(`${API_URL}/pollutions`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				user_id: currentUser.id,
				lat,
				lng,
				level: selectedLevel,
				types: ['trash'],
				description: desc,
				photos: uploadedPhotos,
			}),
		})

		if (response.ok) {
			closeBottomSheet()
			loadPollutions()
			tg.HapticFeedback.notificationOccurred('success')
			tg.showAlert('Загрязнение отмечено!')
		}
	} catch (e) {
		tg.showAlert('Ошибка при отправке')
	}
}

function showPollutionDetails(pollution) {
	currentPollution = pollution
	const content = document.getElementById('sheet-content')

	const levelColors = {
		1: '#059669',
		2: '#fbbf24',
		3: '#dc2626',
	}

	const levelNames = {
		1: 'Низкий',
		2: 'Средний',
		3: 'Высокий',
	}

	const reward = pollution.level // $1, $2, $3

	content.innerHTML = `
        <h2 style="font-size: 24px; font-weight: 700; margin-bottom: 16px;">Детали загрязнения</h2>
        
        <div style="background: ${levelColors[pollution.level]}20; padding: 12px 16px; border-radius: 12px; margin-bottom: 20px;">
            <span style="color: ${levelColors[pollution.level]}; font-weight: 600;">
                ${levelNames[pollution.level]} уровень опасности
            </span>
        </div>
        
        ${pollution.description ? `<p style="margin-bottom: 20px; color: #6b7280;">${pollution.description}</p>` : ''}
        
        ${
					pollution.photos && pollution.photos.length > 0 ?
						`
            <div class="photo-grid" style="margin-bottom: 20px;">
                ${pollution.photos
									.map(
										url => `
                    <div class="photo-item">
                        <img src="${url}" alt="Photo">
                    </div>
                `,
									)
									.join('')}
            </div>
        `
					:	''
				}
        
        <div style="background: #f9fafb; padding: 16px; border-radius: 12px; margin-bottom: 20px;">
            <p style="font-size: 14px; color: #6b7280; margin-bottom: 8px;">Вознаграждение за очистку</p>
            <p style="font-size: 32px; font-weight: 700; color: #064e3b;">$${reward}</p>
        </div>
        
        <button class="btn btn-primary" style="width: 100%;" id="clean-btn">
            🌿 Я убрал этот мусор!
        </button>
    `

	openBottomSheet()

	document.getElementById('clean-btn').addEventListener('click', showCleanForm)
}

function showCleanForm() {
	uploadedPhotos = []
	const content = document.getElementById('sheet-content')

	content.innerHTML = `
        <h2 style="font-size: 24px; font-weight: 700; margin-bottom: 24px;">Подтверждение очистки</h2>
        
        <div class="form-group">
            <label class="form-label">ФОТО ПОСЛЕ ОЧИСТКИ</label>
            <div class="file-upload" id="upload-after-trigger">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" style="margin: 0 auto 12px;">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                </svg>
                <p style="color: #6b7280;">Загрузите фото чистого места</p>
            </div>
            <div id="photo-preview-after" class="photo-grid"></div>
        </div>
        
        <div class="form-group">
            <label class="form-label">КОММЕНТАРИЙ (необязательно)</label>
            <textarea class="form-textarea" id="clean-comment" rows="2" placeholder="Добавьте комментарий..."></textarea>
        </div>
        
        <button class="btn btn-primary" style="width: 100%;" id="submit-clean">
            Подтвердить очистку
        </button>
    `

	document
		.getElementById('upload-after-trigger')
		.addEventListener('click', () => uploadPhotoAfter())
	document.getElementById('submit-clean').addEventListener('click', submitClean)
}

function uploadPhotoAfter() {
	const widget = cloudinary.createUploadWidget(
		{
			cloudName: CLOUDINARY_CLOUD_NAME,
			uploadPreset: CLOUDINARY_UPLOAD_PRESET,
			sources: ['camera', 'local'],
			multiple: true,
			maxFiles: 5,
		},
		(error, result) => {
			if (!error && result && result.event === 'success') {
				uploadedPhotos.push(result.info.secure_url)
				updatePhotoPreviewAfter()
			}
		},
	)

	widget.open()
}

function updatePhotoPreviewAfter() {
	const preview = document.getElementById('photo-preview-after')
	if (!preview) return

	preview.innerHTML = uploadedPhotos
		.map(
			url => `
        <div class="photo-item">
            <img src="${url}" alt="Photo">
        </div>
    `,
		)
		.join('')
}

async function submitClean() {
	if (uploadedPhotos.length === 0) {
		tg.showAlert('Пожалуйста, загрузите хотя бы одно фото')
		return
	}

	const comment = document.getElementById('clean-comment')?.value || ''

	try {
		const response = await fetch(
			`${API_URL}/pollutions/${currentPollution.id}/clean`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					user_id: currentUser.id,
					photos: uploadedPhotos,
					comment: comment,
				}),
			},
		)

		const data = await response.json()

		if (response.ok) {
			currentUser.balance = data.new_balance
			updateProfileUI()
			closeBottomSheet()
			loadPollutions()

			// Show reward animation
			tg.HapticFeedback.notificationOccurred('success')
			tg.showAlert(`Поздравляем! Вам начислено $${currentPollution.level}`)
		}
	} catch (e) {
		tg.showAlert('Ошибка при подтверждении')
	}
}
