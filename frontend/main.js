// EcoPatrol - Onboarding Edition
const tg = window.Telegram.WebApp
const API_URL = window.location.origin + '/api'
console.log('--- ECOPATROL DEBUG: VERSION 1.3.1 LOADED (AUTOPILOT-FIX) ---')

// Flag to bypass border checks during programmatic moves (e.g. "Show on Map")
window.isProgrammaticMove = false

// UZBEKISTAN_COORDS is loaded from uzbekistan_border.js
if (!window.UZBEKISTAN_COORDS) {
	console.error('CRITICAL: uzbekistan_border.js not loaded!')
	window.UZBEKISTAN_COORDS = [
		[55.9, 37.0],
		[73.1, 37.0],
		[73.1, 45.6],
		[55.9, 45.6],
		[55.9, 37.0],
	]
}

function isPointInPolygon(point, polygon) {
	const x = point[0],
		y = point[1]
	let inside = false
	for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
		const xi = polygon[i][0],
			yi = polygon[i][1]
		const xj = polygon[j][0],
			yj = polygon[j][1]
		const intersect =
			yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
		if (intersect) inside = !inside
	}
	return inside
}

let lastValidCenter = [69.2401, 41.2995]

// Viewer Functions (Global)
window.openPhotoViewer = function (url) {
	console.log('--- EXECUTING openPhotoViewer ---', url)
	const viewer = document.getElementById('photo-viewer')
	const img = document.getElementById('viewer-img')
	if (!viewer || !img) {
		console.error('VIEWER ELEMENTS NOT FOUND', { viewer: !!viewer, img: !!img })
		return
	}
	img.src = url
	viewer.classList.add('active')
	console.log('Viewer should be visible now (added .active)')
	tg.HapticFeedback.impactOccurred('medium')
}

window.closePhotoViewer = function () {
	const viewer = document.getElementById('photo-viewer')
	if (viewer) viewer.classList.remove('active')
}

let map
let markers = []
let pollutionsVisible = true // Track state
let lastGeolocateTime = 0 // Debounce geolocate
let currentUser = null
let selectedLevel = 1
let uploadedPhotos = []
let currentPollution = null
let isDragging = false
let isRegistered = false
let uploadingCount = 0 // Global state for optimistic UI
window.currentLang = localStorage.getItem('language') || 'ru'
let currentLang = window.currentLang
window.cityStats = {
	aqi: null,
	temp: null,
	wind: null,
	radiation: '0.11 мкЗв/ч',
}
window.adminStats = { total_users: 0, total_rewards_paid: 0 }

// Translation Helper
window.t = function (key) {
	const keys = key.split('.')
	let result = translations[currentLang]
	for (const k of keys) {
		if (result && result[k]) {
			result = result[k]
		} else {
			return key // Fallback to key name
		}
	}
	// Dynamic Version Replacement
	if (typeof result === 'string' && result.includes('%VERSION%')) {
		return result.replace('%VERSION%', window.APP_VERSION || 'v2.x')
	}
	return result
}

// Language Helper
window.toggleLangPicker = function () {
	const picker = document.getElementById('language-picker')
	if (picker) {
		picker.classList.toggle('active')
	}
}

window.setLanguage = async function (lang) {
	currentLang = lang
	localStorage.setItem('lang', lang)

	// Close picker
	const picker = document.getElementById('language-picker')
	if (picker) picker.classList.remove('active')

	// Update UI
	document.querySelectorAll('.lang-picker-item').forEach(opt => {
		opt.classList.remove('active')
		if (opt.id === `lang-${lang}`) opt.classList.add('active')
	})

	// Update Current Label on Picker
	const flag = document.getElementById('current-lang-flag')
	const name = document.getElementById('current-lang-name')
	if (flag && name) {
		if (lang === 'uz') {
			flag.textContent = '🇺🇿'
			name.textContent = "O'zbek"
		} else if (lang === 'ru') {
			flag.textContent = '🇷🇺'
			name.textContent = 'Русский'
		} else {
			flag.textContent = '🇬🇧'
			name.textContent = 'English'
		}
	}

	translatePage()
	if (typeof updateStatus === 'function') updateStatus()

	// Update Backend if logged in
	if (currentUser && currentUser.id) {
		try {
			await fetch(`${API_URL}/profile/${currentUser.id}/language`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ language: lang }),
			})
		} catch (e) {
			if (navigator.onLine)
				console.error('Failed to sync language to backend', e)
		}
	}

	tg.HapticFeedback.selectionChanged()
}

const locationPromise = new Promise(resolve => {
	if (!navigator.geolocation) {
		const cached = localStorage.getItem('last_known_loc')
		resolve(cached ? { coords: JSON.parse(cached), source: 'cache' } : null)
		return
	}

	navigator.geolocation.getCurrentPosition(
		pos => {
			const coords = [pos.coords.longitude, pos.coords.latitude]
			localStorage.setItem('last_known_loc', JSON.stringify(coords))
			resolve({ coords: coords, source: 'live' })
		},
		err => {
			console.log('Pre-fetch geo error:', err)
			// For any error (denied, unavailable, timeout), we treat it as "no permission"
			// to trigger the help screen if they are not seeing the map properly.
			resolve({ error: 'denied', code: err.code })
		},
		{ enableHighAccuracy: false, timeout: 3000, maximumAge: 30000 },
	)
})

function setupConnectivityListeners() {
	const offlineOverlay = document.getElementById('offline-overlay')

	const updateStatus = () => {
		if (navigator.onLine) {
			offlineOverlay.classList.add('hidden')
			console.log('Online: connection restored')
		} else {
			offlineOverlay.classList.remove('hidden')
			console.log('Offline: connection lost')
		}
	}

	window.addEventListener('online', updateStatus)
	window.addEventListener('offline', updateStatus)

	// Initial check
	updateStatus()
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
	console.log('--- ECOPATROL DEBUG: DOMContentLoaded (VERSION 1.2.2) ---')
	// 0. IMMEDIATE FIX: Force height to prevent gray blocks
	function fixHeight() {
		const vh = window.innerHeight
		document.documentElement.style.setProperty('--vh', `${vh}px`)
		document.body.style.height = `${vh}px`
		document.getElementById('map').style.height = `${vh}px`
	}
	window.addEventListener('resize', fixHeight)
	fixHeight()

	tg.expand()
	tg.isVerticalSwipesEnabled = false
	setupConnectivityListeners()
	tg.enableClosingConfirmation()
	tg.ready()

	// 1. Initial Theme Logic (Quick)
	loadTheme()

	// Set header/bg color based on initial theme
	const initialDark =
		document.documentElement.getAttribute('data-theme') === 'dark'
	const headerColor = initialDark ? '#111827' : '#ffffff'
	tg.setHeaderColor(headerColor)
	tg.setBackgroundColor(headerColor)

	// Listen for theme changes from Telegram
	tg.onEvent('themeChanged', () => {
		console.log('--- THEME CHANGED EVENT ---')
		loadTheme()
	})

	// Enable fullscreen mode
	try {
		tg.requestFullscreen()
	} catch (e) {
		console.log('Fullscreen not supported')
	}

	initBottomSheetDrag('bottom-sheet')
	initBottomSheetDrag('detail-sheet')

	// 0.5. Load Language
	const savedLang = localStorage.getItem('language') || 'ru'
	window.setLanguage(savedLang)

	// DELAY MAP INIT: Wait for Telegram animation to finish
	// IMMEDIATE MAP INIT: No need to wait 300ms
	checkRegistration()
})

function renderDetailSheet(html) {
	const content = document.getElementById('detail-content')
	const sheet = document.getElementById('detail-sheet')
	if (!content || !sheet) return

	content.innerHTML = html
	content.classList.remove('fade-in')
	void content.offsetWidth
	content.classList.add('fade-in')

	openDetailSheet()
}

function initBottomSheetDrag(sheetId) {
	const sheet = document.getElementById(sheetId)
	if (!sheet) return
	const handle = sheet.querySelector('.sheet-handle')
	if (!handle) return

	let startY = 0
	let currentY = 0
	let dragging = false

	handle.addEventListener(
		'touchstart',
		e => {
			startY = e.touches[0].clientY
			currentY = startY
			dragging = true
			sheet.classList.add('dragging')
		},
		{ passive: true },
	)

	window.addEventListener(
		'touchmove',
		e => {
			if (!dragging) return
			currentY = e.touches[0].clientY
			const delta = currentY - startY
			if (delta > 0) {
				sheet.style.transform = `translateY(${delta}px)`
			}
		},
		{ passive: false },
	)

	window.addEventListener('touchend', () => {
		if (!dragging) return
		dragging = false
		sheet.classList.remove('dragging')

		const delta = currentY - startY
		if (delta > 100) {
			if (sheetId === 'detail-sheet') {
				closeDetailSheet()
			} else {
				closeBottomSheet()
			}
		}
		sheet.style.transform = ''
	})
}

// Navigation History for Bottom Sheet
let sheetHistory = []

function renderSheetPage(
	html,
	addToHistory = true,
	context = null,
	skipLock = false,
) {
	const content = document.getElementById('sheet-content')
	const sheet = document.getElementById('bottom-sheet')
	if (!content || !sheet) return

	if (context) {
		content.dataset.context = context
	} else {
		delete content.dataset.context
	}

	if (addToHistory && content.innerHTML.trim() !== '') {
		sheetHistory.push({
			html: content.innerHTML,
			context: content.dataset.context,
		})
	}

	// 1. Check if sheet is currently OPEN
	const isCurrentlyOpen = sheet.classList.contains('active')
	const beforeH = content.offsetHeight

	// 2. Prep for new content
	content.classList.remove('sheet-page-anim')

	// Only lock height if we are ALREADY open (switching pages) AND not skipping
	if (!skipLock && isCurrentlyOpen && beforeH > 0) {
		content.style.minHeight = beforeH + 'px'
	} else {
		content.style.minHeight = '0'
	}

	// 3. Swap content
	content.innerHTML = html

	// 4. Trigger Fade-in
	content.classList.remove('fade-in')
	void content.offsetWidth // Force reflow
	content.classList.add('fade-in')

	// 4. Measure new height
	content.style.height = 'auto'
	const afterH = content.scrollHeight || 300

	// 5. Apply smooth transition if internal switch
	if (!skipLock && isCurrentlyOpen && beforeH > 0) {
		void content.offsetHeight // force reflow
		content.style.minHeight = afterH + 'px'

		setTimeout(() => {
			if (content.innerHTML === html) {
				content.style.minHeight = 'auto'
			}
		}, 400)
	} else {
		// Fresh open or skipped: No min-height lock
		content.style.minHeight = '0'
	}

	content.classList.add('sheet-page-anim')
	openBottomSheet()
}

function goBackInSheet() {
	if (sheetHistory.length > 0) {
		const prev = sheetHistory.pop()
		renderSheetPage(prev.html, false, prev.context)
	}
}

function checkRegistration() {
	isRegistered = localStorage.getItem('registered') === 'true'

	// Initialize Tour system
	if (window.Tour) Tour.init()

	if (isRegistered) {
		hideOnboarding()

		// FETCH PUBLIC CONFIG (Like Debug Mode)
		fetch(`${API_URL}/config`)
			.then(r => r.json())
			.then(s => {
				const debugBtn = document.getElementById('debug-toggle-btn')
				if (debugBtn) {
					debugBtn.style.display =
						s.debug_logs_enabled === 'true' ? 'block' : 'none'
				}
			})
			.catch(e => {
				if (navigator.onLine) console.log('Config fetch error:', e)
			})

		// SPEED OPTIMIZATION...
		const cached = localStorage.getItem('last_known_loc')
		if (cached) {
			try {
				const coords = JSON.parse(cached)
				initMap(coords)
			} catch (e) {
				console.error('Failed to parse cached location', e)
			}
		}

		authUser()
		setupEventListeners()

		// Check permissions/update location in background
		checkLocationStatus()

		// Auto-start tour for new users who haven't completed it
		const tourDone = localStorage.getItem('tour_completed')
		if (!tourDone && window.Tour) {
			setTimeout(() => Tour.start(), 2000)
		}
	} else {
		showOnboarding()
	}
}

async function checkLocationStatus() {
	console.log('--- CHECKING LOCATION STATUS ---')
	const overlay = document.getElementById('location-blocked-overlay')

	// 1. Try to get current position
	navigator.geolocation.getCurrentPosition(
		position => {
			console.log('Location access granted')
			const coords = [position.coords.longitude, position.coords.latitude]
			localStorage.setItem('last_known_loc', JSON.stringify(coords))

			overlay.classList.add('hidden')
			if (!map) {
				initMap(coords)
			} else {
				map.flyTo({ center: coords, zoom: 16 })
			}
		},
		error => {
			console.error('Location check failed/denied:', error)
			overlay.classList.remove('hidden')
			// Even if it failed, we might show map with default if we want,
			// but here we block everything with overlay.
			if (!map) {
				initMap()
			}
		},
		{ enableHighAccuracy: false, timeout: 3000, maximumAge: 30000 },
	)
}

function showOnboarding() {
	document.getElementById('onboarding').classList.remove('hidden')
	const form = document.getElementById('onboarding-form')
	form.addEventListener('submit', e => {
		e.preventDefault()
		handleRegistration()
	})
}

function hideOnboarding(data = null) {
	const onboarding = document.getElementById('onboarding')
	onboarding.classList.add('hidden')

	if (data) {
		currentUser = data
		isRegistered = true
		updateSidebarProfile()

		// Sync language from profile
		if (data.language) {
			window.setLanguage(data.language)
		}
	}
}

async function handleRegistration() {
	const firstName = document.getElementById('first-name').value.trim()
	const lastName = document.getElementById('last-name').value.trim()
	const age = parseInt(document.getElementById('age').value)
	const phone = document.getElementById('phone').value.trim()

	console.log('Registration attempt:', { firstName, lastName, age, phone })

	// Validation
	if (!firstName || !lastName || !age || !phone) {
		tg.showAlert('Пожалуйста, заполните все поля')
		return
	}

	if (age < 13 || age > 120) {
		tg.showAlert('Пожалуйста, введите корректный возраст (13-120)')
		return
	}

	// Validate phone starts with +998
	if (!phone.startsWith('+998')) {
		tg.showAlert('Номер телефона должен начинаться с +998')
		return
	}

	// Request geolocation
	if (!navigator.geolocation) {
		tg.showAlert('Геолокация недоступна на вашем устройстве')
		return
	}

	tg.HapticFeedback.impactOccurred('medium')

	// REGISTRATION PROCEEDS IMMEDIATELY (No more nested geo callback)
	const initData = tg.initDataUnsafe
	const user = initData.user || {
		id: Date.now(),
		username: `${firstName}_${lastName}`.toLowerCase(),
	}

	console.log('Telegram user:', user)

	try {
		const requestBody = {
			telegram_id: user.id,
			username: user.username || `${firstName} ${lastName}`,
			first_name: firstName,
			last_name: lastName,
			age: age,
			phone: phone,
			initData: tg.initData || '',
		}

		console.log('Sending registration request:', requestBody)

		const response = await fetch(`${API_URL}/init`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(requestBody),
		})

		console.log('Response status:', response.status)

		if (!response.ok) {
			const errorText = await response.text()
			console.error(`Registration failed: ${response.status}`, errorText)
			throw new Error(`Registration failed: ${response.status}`)
		}

		const responseText = await response.text()
		let data
		try {
			data = JSON.parse(responseText)
		} catch (parseError) {
			console.error('Failed to parse registration response:', responseText)
			throw new Error('Server returned invalid JSON')
		}
		console.log('Registration successful:', data)

		currentUser = data.user

		localStorage.setItem('registered', 'true')
		isRegistered = true

		hideOnboarding()
		authUser() // Re-authenticate to ensure currentUser is fully set up after registration
		setupEventListeners()
		loadPollutions()
		updateProfileUI()

		tg.HapticFeedback.notificationOccurred('success')
		tg.showAlert(window.t('reg_success') || 'Регистрация успешна!')

		// START TOUR AUTOMATICALLY AFTER REGISTRATION
		if (window.Tour) {
			setTimeout(() => Tour.start(), 1500)
		}

		// Now check location specifically for the app access
		checkLocationStatus()
	} catch (e) {
		console.error('Registration error:', e)
		tg.showAlert(`Ошибка регистрации: ${e.message}`)
	}
}

// Add global listener for retry button
document.addEventListener('DOMContentLoaded', () => {
	const retryBtn = document.getElementById('retry-geo-btn')
	if (retryBtn) {
		retryBtn.addEventListener('click', () => {
			document.getElementById('location-help').classList.add('hidden')
			document.getElementById('onboarding-form').classList.remove('hidden')
			document.getElementById('submit-onboarding').classList.remove('hidden')
			handleRegistration()
		})
	}

	const retryBtnGlobal = document.getElementById('retry-geo-btn-global')
	if (retryBtnGlobal) {
		retryBtnGlobal.addEventListener('click', () => {
			tg.HapticFeedback.impactOccurred('light')
			checkLocationStatus()
		})
	}
})

function initMap(initialCenter = null) {
	if (typeof maplibregl === 'undefined') {
		setTimeout(initMap, 500)
		return
	}

	const theme = document.documentElement.getAttribute('data-theme')
	const style =
		theme === 'dark' ?
			'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
		:	'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json'

	map = new maplibregl.Map({
		container: 'map',
		style: style,
		center: initialCenter || [69.2401, 41.2995], // Tashkent, Uzbekistan
		zoom: 15,
		minZoom: 2, // Temporarily unlocked (was 10)
		maxZoom: 18,
		pitch: 0,
		antialias: true,
		attributionControl: false,
		dragRotate: false,
		touchPitch: false,
		// maxBounds: [[55.9, 37.1], [73.2, 45.6]] // Temporarily disabled
	})

	map.on('load', () => {
		map.resize()
		console.log('Map load triggered')

		// 1. Add Uzbekistan Border
		addUzbekistanBorder(map)

		// 2. Load markers
		loadPollutions()

		// 3. Trigger geolocation
		geolocate.trigger()

		// 4. Hide loader
		const loader = document.getElementById('map-loading-overlay')
		if (loader) loader.classList.add('hidden')

		console.log('Map initialization complete')
	})

	// Global helper for manual tuning
	window.setVignetteColor = color => {
		document.documentElement.style.setProperty('--map-bg', color)
		console.log('Vignette color overridden to:', color)
	}

	// Disable rotation by touch (keep zoom)
	map.touchZoomRotate.disableRotation()

	// Set background color to match map to avoid gray flashes
	tg.setBackgroundColor(theme === 'dark' ? '#0e0e0e' : '#fbf8f3') // Exact map colors

	// Add Geolocate Control
	const geolocate = new maplibregl.GeolocateControl({
		positionOptions: { enableHighAccuracy: true },
		trackUserLocation: true,
		showUserLocation: true,
	})
	map.addControl(geolocate)

	// Handle map movement
	map.on('movestart', () => {
		isDragging = true
		document.getElementById('center-marker').classList.add('dragging')
	})

	map.on('move', () => {
		// BYPASS: If moving programmatically, don't enforce wall
		if (window.isProgrammaticMove) return

		const center = map.getCenter()
		const point = [center.lng, center.lat]

		if (!isPointInPolygon(point, UZBEKISTAN_COORDS)) {
			// Hit the wall!
			map.setCenter(lastValidCenter)
			tg.HapticFeedback.impactOccurred('heavy')
		} else {
			lastValidCenter = point
		}
	})

	map.on('moveend', () => {
		isDragging = false
		document.getElementById('center-marker').classList.remove('dragging')
	})

	// Handle zoom for marker sizing
	map.on('zoom', () => {
		const zoom = map.getZoom()
		const container = document.getElementById('map')
		if (zoom < 13) {
			container.classList.add('map-zoom-out')
		} else {
			container.classList.remove('map-zoom-out')
		}
	})
}

function addUzbekistanBorder(map) {
	const uzBounds = UZBEKISTAN_COORDS

	if (!map.getSource('uzbekistan-border')) {
		map.addSource('uzbekistan-border', {
			type: 'geojson',
			data: {
				type: 'Feature',
				geometry: {
					type: 'LineString',
					coordinates: uzBounds,
				},
			},
		})
	}

	if (!map.getLayer('uzbekistan-border-glow')) {
		map.addLayer({
			id: 'uzbekistan-border-glow',
			type: 'line',
			source: 'uzbekistan-border',
			paint: {
				'line-color': '#10b981',
				'line-width': 10,
				'line-blur': 8,
				'line-opacity': 0.6,
			},
		})
	}

	if (!map.getLayer('uzbekistan-border-line')) {
		map.addLayer({
			id: 'uzbekistan-border-line',
			type: 'line',
			source: 'uzbekistan-border',
			paint: {
				'line-color': '#10b981',
				'line-width': 2,
				'line-opacity': 1,
			},
		})
	}
}

async function authUser() {
	if (currentUser) return // Already authenticated during registration

	const initData = tg.initDataUnsafe
	const user = initData.user || {
		id: 12345,
		first_name: 'Эко',
		last_name: 'Герой',
	}

	console.log('--- FETCHING /api/init ---', { telegram_id: user.id })
	try {
		const response = await fetch(`${API_URL}/init`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				telegram_id: user.id,
				username:
					user.username || `${user.first_name} ${user.last_name || ''}`.trim(),
				initData: tg.initData,
			}),
		})
		console.log('--- AUTH RESPONSE STATUS ---', response.status)
		if (!response.ok) {
			const errorText = await response.text()
			console.error(`Auth failed: ${response.status}`, errorText)
			return
		}

		const responseText = await response.text()
		let data
		try {
			data = JSON.parse(responseText)
		} catch (parseError) {
			console.error('Failed to parse auth response:', responseText)
			return
		}

		// Check if user needs registration
		if (data.needs_registration) {
			console.log('--- USER NEEDS REGISTRATION ---')
			// Clear registered flag and show onboarding
			localStorage.removeItem('registered')
			isRegistered = false
			showOnboarding()
			return
		}

		// User is fully registered
		currentUser = data.user
		updateProfileUI()
	} catch (e) {
		console.error('Auth error:', e)
	}
}

function updateProfileUI() {
	if (!currentUser) return
	const fullName =
		currentUser.first_name && currentUser.last_name ?
			`${currentUser.first_name} ${currentUser.last_name}`
		:	currentUser.username
	document.getElementById('sidebar-username').textContent = fullName
	document.getElementById('sidebar-userid').textContent =
		`ID: ${currentUser.telegram_id}`
	document.getElementById('sidebar-balance').textContent =
		`${window.t('currency')}${currentUser.balance.toFixed(0)}`
	setProfileAvatar(fullName)
}

function applyTheme(theme) {
	const root = document.documentElement
	const icon = document.getElementById('theme-icon')
	const isDark = theme === 'dark'

	root.setAttribute('data-theme', theme)
	localStorage.setItem('theme', theme)

	// Update Telegram Colors
	const color = isDark ? '#111827' : '#ffffff'
	tg.setHeaderColor(color)
	tg.setBackgroundColor(color)

	// Update Sidebar Icon
	if (icon) {
		if (isDark) {
			icon.innerHTML = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />`
		} else {
			icon.innerHTML = `
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            `
		}
	}

	// Update Map Style
	if (map) {
		const style =
			isDark ?
				'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
			:	'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json'
		map.setStyle(style)
	}
}

function loadTheme() {
	// 1. Priority: Telegram Theme
	const tgTheme = tg.colorScheme // 'light' or 'dark'

	// 2. Fallback: Saved preference or system
	let themeToApply = tgTheme

	if (!themeToApply) {
		const savedTheme = localStorage.getItem('theme')
		if (savedTheme) {
			themeToApply = savedTheme
		} else {
			const prefersDark = window.matchMedia(
				'(prefers-color-scheme: dark)',
			).matches
			themeToApply = prefersDark ? 'dark' : 'light'
		}
	}

	applyTheme(themeToApply)
}

function toggleTheme() {
	const current = document.documentElement.getAttribute('data-theme')
	const next = current === 'dark' ? 'light' : 'dark'
	applyTheme(next)
	tg.HapticFeedback.impactOccurred('light')
}

function setProfileAvatar(name) {
	const avatar = document.getElementById('sidebar-avatar')
	if (!avatar || !name) return
	const initials = name
		.split(' ')
		.map(word => word[0])
		.join('')
		.toUpperCase()
		.substring(0, 2)
	avatar.textContent = initials
}

function setupEventListeners() {
	document.getElementById('profile-btn').addEventListener('click', openSidebar)
	document.getElementById('balance-btn').addEventListener('click', () => {
		showExchange()
	})
	document.getElementById('theme-toggle').addEventListener('click', toggleTheme)
	document.getElementById('geolocate-btn').addEventListener('click', geolocate)

	// Menu Item Listeners
	document.getElementById('menu-exchange').addEventListener('click', () => {
		showExchange()
	})
	document.getElementById('menu-reports').addEventListener('click', () => {
		showMyReports()
	})
	document.getElementById('menu-history').addEventListener('click', () => {
		showMyHistory()
	})
	document.getElementById('menu-leaderboard').addEventListener('click', () => {
		showLeaderboard()
	})
	document.getElementById('menu-info').addEventListener('click', () => {
		showAboutInfo()
	})
	document.getElementById('menu-safety').addEventListener('click', () => {
		showSafetyGuide()
	})

	document
		.getElementById('toggle-pollutions-btn')
		.addEventListener('click', togglePollutions)
	document.getElementById('add-btn').addEventListener('click', showAddForm)
	document.getElementById('overlay').addEventListener('click', closeAll)
}

function openSidebar() {
	document.getElementById('sidebar').classList.add('active')
	document.getElementById('overlay').classList.add('active')
	loadProfileStats()
	tg.HapticFeedback.impactOccurred('light')
}

function closeSidebar() {
	document.getElementById('sidebar').classList.remove('active')
	document.getElementById('overlay').classList.remove('active')
	tg.HapticFeedback.impactOccurred('light')
}
window.closeSidebar = closeSidebar

function openBottomSheet() {
	document.getElementById('bottom-sheet').classList.add('active')
	document.getElementById('overlay').classList.add('active')
	tg.HapticFeedback.impactOccurred('light')
}

function closeBottomSheet(forceClose = false) {
	const detailSheet = document.getElementById('detail-sheet')
	const mainSheet = document.getElementById('bottom-sheet')

	// 1. If detail-sheet is open, close IT first
	if (detailSheet.classList.contains('active')) {
		closeDetailSheet()
		if (!forceClose) return
	}

	// 2. If main sheet is in a sub-page (like report-details inside IT), go back
	const content = document.getElementById('sheet-content')
	const context = content ? content.dataset.context : null

	if (
		!forceClose &&
		context === 'my-report-details' &&
		sheetHistory.length > 0
	) {
		goBackInSheet()
		return
	}

	// 3. Otherwise, close entire system
	mainSheet.classList.remove('active')
	document.getElementById('overlay').classList.remove('active')
	sheetHistory = []
}

function openDetailSheet() {
	document.getElementById('detail-sheet').classList.add('active')
	tg.HapticFeedback.impactOccurred('light')
}

function closeDetailSheet() {
	document.getElementById('detail-sheet').classList.remove('active')
	// We DON'T remove overlay here because bottom-sheet might still be active under it
}

// --- CITY PASSPORT STATE ---
// NOTE: cityStats is already declared globally as window.cityStats at the top of the file
// We use window.cityStats to avoid scope issues
let aqiData = {}
let adminStats = {}

async function fetchAdminStats() {
	try {
		const res = await fetch(`${API_URL}/stats/public`)
		if (res.ok) adminStats = await res.json()
	} catch (e) {
		console.error('Failed to fetch stats', e)
	}
}

function getAqiColor(aqi) {
	if (!aqi || isNaN(aqi)) return 'var(--text-secondary)'
	if (aqi <= 50) return '#10b981'
	if (aqi <= 100) return '#f59e0b'
	return '#ef4444'
}

function getAqiLabel(aqi) {
	if (!aqi || isNaN(aqi)) return '---'
	if (aqi <= 50) return window.t('quality_good')
	if (aqi <= 100) return window.t('quality_moderate')
	return window.t('quality_bad')
}

window.showCityStatus = async function showCityStatus() {
	try {
		if (typeof closeSidebar === 'function') closeSidebar()

		// 1. Translation Helper
		const t = window.t || (k => k)

		// 2. Prepare Icons once
		const iconMap =
			'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>'
		const iconClean =
			'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
		const iconRad =
			'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2v20"/><path d="M2 12h20"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>'

		const getTemplate = (
			aqi,
			temp,
			wind,
			rad,
			total,
			cleaned,
			isLoading = false,
		) => `
            <div style="flex: 1; display: flex; flex-direction: column;">
                <div class="info-sheet">
                <div style="text-align: center; margin-bottom: 24px; height: 110px;">
                    <div style="width: 56px; height: 56px; background: var(--bg-secondary); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; border: 1px solid var(--border);">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <defs>
                                <linearGradient id="buildingGradFinal" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" style="stop-color:var(--primary);stop-opacity:1" />
                                    <stop offset="100%" style="stop-color:var(--primary);stop-opacity:0.6" />
                                </linearGradient>
                            </defs>
                            <rect x="3" y="10" width="4" height="11" fill="url(#buildingGradFinal)" rx="0.5"/>
                            <rect x="8" y="6" width="4" height="15" fill="url(#buildingGradFinal)" rx="0.5"/>
                            <rect x="13" y="8" width="4" height="13" fill="url(#buildingGradFinal)" rx="0.5"/>
                            <rect x="18" y="4" width="3" height="17" fill="url(#buildingGradFinal)" rx="0.5"/>
                            <line x1="2" y1="21" x2="22" y2="21" stroke="var(--border)" stroke-width="1.5" stroke-linecap="round"/>
                        </svg>
                    </div>
                    <h2 style="font-size: 19px; font-weight: 700; color: var(--text-primary); margin: 0; line-height: 1.2; height: 23px; overflow: hidden;">${t('city_status_title')}</h2>
                    <div style="font-size: 13px; color: var(--text-secondary); margin-top: 2px; height: 16px; line-height: 16px; overflow: hidden;">Tashkent, Uzbekistan</div>
                </div>

                <div style="background: linear-gradient(135deg, ${isLoading ? 'var(--bg-secondary)' : getAqiColor(aqi) + '10'}, var(--bg-secondary)); border-radius: 20px; padding: 20px; border: 1px solid ${isLoading ? 'var(--border)' : getAqiColor(aqi) + '30'}; margin-bottom: 20px; text-align: center; height: 170px; display: flex; flex-direction: column; justify-content: center;">
                    <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 8px; height: 18px;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${isLoading ? 'var(--text-secondary)' : getAqiColor(aqi)}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 8v4l3 3"/></svg>
                        <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-secondary); line-height: 1;">${t('air_quality')}</span>
                    </div>
                    <div class="${isLoading ? 'skeleton' : ''}" style="font-size: 48px; font-weight: 900; height: 52px; border-radius: 8px; color: ${isLoading ? 'transparent' : getAqiColor(aqi)}; line-height: 52px; letter-spacing: -2px; margin: 4px 0;">
                        ${isLoading ? '00' : aqi || '--'}
                    </div>
                    <div style="margin-top: 6px; height: 26px;">
                        <span class="${isLoading ? 'skeleton' : ''}" style="display: inline-block; padding: 4px 14px; border-radius: 20px; font-size: 12px; font-weight: 800; min-width: 100px; height: 22px; line-height: 14px; background: ${isLoading ? 'var(--bg-secondary)' : getAqiColor(aqi) + '18'}; color: ${isLoading ? 'transparent' : getAqiColor(aqi)}; border: 1px solid ${isLoading ? 'var(--border)' : getAqiColor(aqi) + '25'}; white-space: nowrap;">
                            ${isLoading ? 'Label Content' : getAqiLabel(aqi)}
                        </span>
                    </div>
                    <div style="font-size: 10px; color: var(--text-secondary); margin-top: 8px; opacity: 0.6; height: 12px; line-height: 12px;">European AQI</div>
                </div>

                <div class="city-stats-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; height: 110px;">
                    <div class="stat-card" style="margin: 0; height: 110px; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 10px; overflow: hidden;">
                        <div class="stat-card-icon" style="color: var(--primary); height: 18px; margin-bottom: 4px;">${iconMap}</div>
                        <div class="stat-card-label" style="height: 14px; line-height: 14px; font-size: 11px; color: var(--text-secondary); overflow: hidden; white-space: nowrap; text-align: center; width: 100%;">${t('stat_on_map')}</div>
                        <div class="stat-value ${isLoading ? 'skeleton' : ''}" style="min-width: 60px; height: 32px; line-height: 32px; border-radius: 4px; color: ${isLoading ? 'transparent' : 'var(--primary)'}; font-size: 26px; font-weight: 800; text-align: center;">
                            ${isLoading ? '000' : total}
                        </div>
                    </div>
                    <div class="stat-card" style="margin: 0; height: 110px; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 10px; overflow: hidden;">
                        <div class="stat-card-icon" style="color: var(--primary); height: 18px; margin-bottom: 4px;">${iconClean}</div>
                        <div class="stat-card-label" style="height: 14px; line-height: 14px; font-size: 11px; color: var(--text-secondary); overflow: hidden; white-space: nowrap; text-align: center; width: 100%;">${t('stat_cleaned')}</div>
                        <div class="stat-value ${isLoading ? 'skeleton' : ''}" style="min-width: 60px; height: 32px; line-height: 32px; border-radius: 4px; color: ${isLoading ? 'transparent' : 'var(--primary)'}; font-size: 26px; font-weight: 800; text-align: center;">
                            ${isLoading ? '000' : cleaned}
                        </div>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 24px; height: 110px;">
                     <div style="text-align: center; background: linear-gradient(135deg, rgba(59,130,246,0.08), rgba(59,130,246,0.02)); border-radius: 16px; padding: 8px 4px; border: 1px solid rgba(59,130,246,0.15); height: 110px; display: flex; flex-direction: column; justify-content: center; align-items: center; overflow: hidden;">
                        <div style="width: 32px; height: 32px; background: rgba(59,130,246,0.12); border-radius: 10px; display: flex; align-items: center; justify-content: center; margin-bottom: 6px;">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>
                        </div>
                        <div class="${isLoading ? 'skeleton' : ''}" style="font-size: 16px; font-weight: 800; height: 20px; line-height: 20px; border-radius: 6px; color: ${isLoading ? 'transparent' : 'var(--text-primary)'}; width: 90%; white-space: nowrap;">
                            ${isLoading ? '00°C' : `${temp}°C`}
                        </div>
                        <div style="font-size: 8.5px; color: #3b82f6; text-transform: uppercase; letter-spacing: 0.3px; margin-top: 4px; font-weight: 700; height: 10px; line-height: 10px; width: 100%; overflow: hidden; white-space: nowrap;">${t('weather_temp')}</div>
                     </div>
                     <div style="text-align: center; background: linear-gradient(135deg, rgba(6,182,212,0.08), rgba(6,182,212,0.02)); border-radius: 16px; padding: 8px 4px; border: 1px solid rgba(6,182,212,0.15); height: 110px; display: flex; flex-direction: column; justify-content: center; align-items: center; overflow: hidden;">
                        <div style="width: 32px; height: 32px; background: rgba(6,182,212,0.12); border-radius: 10px; display: flex; align-items: center; justify-content: center; margin-bottom: 6px;">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/></svg>
                        </div>
                        <div class="${isLoading ? 'skeleton' : ''}" style="font-size: 16px; font-weight: 800; height: 20px; line-height: 20px; border-radius: 6px; color: ${isLoading ? 'transparent' : 'var(--text-primary)'}; width: 90%; white-space: nowrap;">
                            ${isLoading ? '00 km/h' : `${wind} <small style="font-size: 10px; font-weight: 600; vertical-align: baseline;">km</small>`}
                        </div>
                        <div style="font-size: 8.5px; color: #06b6d4; text-transform: uppercase; letter-spacing: 0.3px; margin-top: 4px; font-weight: 700; height: 10px; line-height: 10px; width: 100%; overflow: hidden; white-space: nowrap;">${t('weather_wind')}</div>
                     </div>
                     <div style="text-align: center; background: linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.02)); border-radius: 16px; padding: 8px 4px; border: 1px solid rgba(245,158,11,0.15); height: 110px; display: flex; flex-direction: column; justify-content: center; align-items: center; overflow: hidden;">
                        <div style="width: 32px; height: 32px; background: rgba(245,158,11,0.12); border-radius: 10px; display: flex; align-items: center; justify-content: center; margin-bottom: 6px;">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 2v20"/><path d="M2 12h20"/><circle cx="12" cy="12" r="3" fill="#f59e0b"/></svg>
                        </div>
                        <div class="${isLoading ? 'skeleton' : ''}" style="font-size: 16px; font-weight: 800; height: 20px; line-height: 20px; border-radius: 6px; color: ${isLoading ? 'transparent' : 'var(--text-primary)'}; width: 90%; white-space: nowrap;">
                            ${isLoading ? '0.00 μSv' : `${rad}<small style="font-size: 9px; vertical-align: baseline;">μS</small>`}
                        </div>
                        <div style="font-size: 8.5px; color: #f59e0b; text-transform: uppercase; letter-spacing: 0.3px; margin-top: 4px; font-weight: 700; height: 10px; line-height: 10px; width: 100%; overflow: hidden; white-space: nowrap;">${t('weather_radiation')}</div>
                     </div>
                </div>

                 <div style="text-align: center; opacity: 0.4; padding: 0 16px; height: 34px;">
                     <div style="font-size: 11px; line-height: 1.5; height: 34px; overflow: hidden;">${t('city_passport_desc')}</div>
                </div>
            </div>
        </div>
        `

		// 3. Render STATIC skeleton (Immediate)
		renderSheetPage(getTemplate('--', '--', '--', '--', 0, 0, true), false)

		// 4. Fetch actual data
		console.log('🚀 Starting data fetch...')
		await Promise.all([fetchAirQuality(), fetchAdminStats(), loadPollutions()])
		console.log('✅ All fetches complete')

		console.log('🔍 window.cityStats:', window.cityStats)
		const stats = window.cityStats || {}
		console.log('📦 stats variable:', stats)

		const aqi = stats.aqi !== undefined ? stats.aqi : '--'
		const temp = stats.temp !== undefined ? Math.round(stats.temp) : '--'
		const wind = stats.wind !== undefined ? Math.round(stats.wind) : '--'
		const radiation = stats.radiation || '0.11'

		console.log('📊 Final values being passed to template:', {
			aqi,
			temp,
			wind,
			radiation,
			'typeof temp': typeof temp,
			'typeof wind': typeof wind,
		})

		const totalReports = markers.length || 0
		const cleanedReports = markers.filter(m =>
			m.getElement().classList.contains('cleaned'),
		).length

		// 5. Render FINAL content (Smooth switch)
		renderSheetPage(
			getTemplate(
				aqi,
				temp,
				wind,
				radiation,
				totalReports,
				cleanedReports,
				false,
			),
			false,
		)
	} catch (e) {
		console.error('showCityStatus failed', e)
	}
}

function togglePollutions() {
	pollutionsVisible = !pollutionsVisible
	const btn = document.getElementById('toggle-pollutions-btn')
	const icon = document.getElementById('toggle-icon')

	markers.forEach(marker => {
		const el = marker.getElement()
		if (pollutionsVisible) {
			el.style.display = 'block'
		} else {
			el.style.display = 'none'
		}
	})

	if (pollutionsVisible) {
		btn.classList.remove('hidden-state')
		icon.innerHTML = `
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
        `
	} else {
		btn.classList.add('hidden-state')
		// Crossed eye icon
		icon.innerHTML = `
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
        `
	}

	tg.HapticFeedback.impactOccurred('light')
}

function closeAll() {
	closeSidebar()
	closeBottomSheet(true)
}

async function showMyReports() {
	closeSidebar()
	if (!currentUser) return
	const html = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
            <h2 style="font-size: 20px; font-weight: 600;">${window.t('menu_reports')}</h2>
        </div>
        <div id="reports-list" class="reports-list">
            <!-- Skeleton Loader -->
            <div class="skeleton-card">
                <div class="skeleton skeleton-title"></div>
                <div class="skeleton skeleton-text"></div>
            </div>
            <div class="skeleton-card">
                <div class="skeleton skeleton-title"></div>
                <div class="skeleton skeleton-text"></div>
            </div>
            <div class="skeleton-card">
                <div class="skeleton skeleton-title"></div>
                <div class="skeleton skeleton-text"></div>
            </div>
        </div>
        <div style="height: 20px;"></div>
    `
	// Clear history so this becomes the new "root" of the sheet
	sheetHistory = []
	renderSheetPage(html, false, 'my-reports-list')

	try {
		const response = await fetch(`${API_URL}/pollutions/user/${currentUser.id}`)
		if (!response.ok) throw new Error('Fetch failed')
		const reports = await response.json()

		const list = document.getElementById('reports-list')
		if (!list) return

		if (reports.length === 0) {
			const emptyHtml = `
                <div class="empty-state">
                    <div class="empty-icon" style="color: var(--text-secondary); opacity: 0.4;">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                    </div>
                    <div class="empty-title">${window.t('reports_empty_title')}</div>
                    <div class="empty-text">${window.t('reports_empty_text')}</div>
                </div>
            `
			renderSheetPage(emptyHtml, false, 'my-reports-list')
			return
		}

		let listHtml = ''
		listHtml += reports
			.map((r, idx) => {
				const date = new Date(r.created_at).toLocaleDateString(
					currentLang === 'uz' ? 'uz-UZ' : 'ru-RU',
					{
						day: 'numeric',
						month: 'short',
					},
				)
				const photo = r.photos[0] || ''
				const statusText =
					r.status === 'active' ?
						window.t('status_active')
					:	window.t('status_cleaned')

				// Use a global array or similar to store reports for the click handler
				if (!window.currentUserReports) window.currentUserReports = {}
				window.currentUserReports[r.id] = r

				return `
                <div class="report-card" onclick="handleReportCardClick(${r.lng}, ${r.lat}, ${r.level}, '${r.status}', ${r.id})">
                    <div class="report-thumb" style="background-image: url('${photo}')"></div>
                    <div class="report-info">
                        <div class="report-date">${date}</div>
                        <div class="report-desc">${r.description || (currentLang === 'uz' ? 'Tavsifsiz' : 'Без описания')}</div>
                    </div>
                    <div class="status-badge ${r.status}">${statusText}</div>
                </div>
            `
			})
			.join('')

		list.innerHTML = listHtml

		// Add global click handler for clarity
		window.handleReportCardClick = (lng, lat, level, status, id) => {
			const report = window.currentUserReports[id]
			if (report) showReportDetails(report)
		}
	} catch (e) {
		console.error(e)
		document.getElementById('reports-list').innerHTML = `
            <div style="padding: 20px; text-align: center; color: #ef4444;">
                Ошибка при загрузке данных
            </div>
        `
	}
}

// Global helper for flying to report
window.flyToReport = (lng, lat, level = 1, status = 'active') => {
	sheetHistory = [] // Force clear history so we actually close the entire sheet
	closeAll()

	// AUTO-SHOW markers if they were hidden
	if (!pollutionsVisible) {
		togglePollutions()
	}

	// If cleaned, show a "ghost" marker temporarily
	if (status === 'cleaned') {
		showGhostMarker(lng, lat, level)
	}

	// Enable programmatic flag
	window.isProgrammaticMove = true
	map.flyTo({ center: [lng, lat], zoom: 17, duration: 1500 })
	tg.HapticFeedback.impactOccurred('medium')

	// Disable flag after move ends
	map.once('moveend', () => {
		window.isProgrammaticMove = false
	})
}

async function showMyHistory() {
	closeSidebar()
	if (!currentUser) return
	const html = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
            <h2 style="font-size: 20px; font-weight: 600;">${window.t('menu_history')}</h2>
        </div>
        <div id="history-list" class="history-list">
            <div class="skeleton-history-item skeleton"></div>
            <div class="skeleton-history-item skeleton"></div>
            <div class="skeleton-history-item skeleton" style="opacity: 0.6"></div>
            <div class="skeleton-history-item skeleton" style="opacity: 0.3"></div>
        </div>
        <div style="height: 20px;"></div>
    `
	// Clear history so this becomes the new "root" of the sheet
	sheetHistory = []
	renderSheetPage(html, false)

	try {
		const response = await fetch(`${API_URL}/history/user/${currentUser.id}`)
		if (!response.ok) throw new Error('Fetch failed')
		const history = await response.json()

		if (history.length === 0) {
			const emptyHtml = `
                <div class="empty-state">
                    <div class="empty-icon" style="color: var(--text-secondary); opacity: 0.4;">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                    </div>
                    <div class="empty-title">${window.t('history_empty_title')}</div>
                    <div class="empty-text">${window.t('history_empty_text')}</div>
                </div>
            `
			renderSheetPage(emptyHtml, false)
			return
		}

		let listHtml = '<div class="history-list">'
		listHtml += history
			.map(h => {
				const date = new Date(h.date).toLocaleDateString('ru-RU', {
					day: 'numeric',
					month: 'short',
				})
				return `
                <div class="history-item">
                    <div class="history-left">
                        <div class="history-title">${h.description || 'Уборка территории'}</div>
                        <div class="history-date">${date}</div>
                    </div>
                    <div class="history-amount">+$${h.reward}</div>
                </div>
            `
			})
			.join('')
		listHtml += '</div><div style="height: 20px;"></div>'

		const finalHtml = `
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
                <h2 style="font-size: 20px; font-weight: 600;">${window.t('menu_history')}</h2>
            </div>
            ${listHtml}
        `
		renderSheetPage(finalHtml, false)
	} catch (e) {
		console.error(e)
		const errorHtml = `
            <div style="padding: 20px; text-align: center; color: #ef4444;">
                Ошибка при загрузке данных
            </div>
        `
		renderSheetPage(errorHtml, false, 'my-history')
	}
}

async function showExchange() {
	if (typeof closeSidebar === 'function') closeSidebar()

	// 1. Initial Skeleton Render
	const skeletonHtml = `
            <div class="sheet-loading">
                <div class="skeleton" style="height: 100px; border-radius: 20px; margin-bottom: 12px;"></div>
                <div class="skeleton" style="height: 100px; border-radius: 20px; margin-bottom: 12px;"></div>
                <div class="skeleton" style="height: 100px; border-radius: 20px;"></div>
            </div>
    `
	sheetHistory = [] // Reset history for this root page
	renderSheetPage(skeletonHtml, false, 'exchange-root')

	try {
		const response = await fetch(`${API_URL}/pollutions`)
		if (!response.ok) throw new Error('Fetch failed')
		const pollutions = await response.json()

		// Filter active and sort by reward (higher first)
		const activePollutions = pollutions
			.filter(p => p.status === 'active')
			.sort((a, b) => (b.level || 0) - (a.level || 0))

		if (activePollutions.length === 0) {
			const emptyHtml = `
                <div class="empty-state">
                    <div class="empty-icon" style="color: var(--text-secondary); opacity: 0.4;">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
                    </div>
                    <div class="empty-title">${window.t('city_clean_title')}</div>
                    <div class="empty-text">${window.t('city_clean_text')}</div>
                </div>
            `
			renderSheetPage(emptyHtml, false)
			return
		}

		let html = '<div class="exchange-list">'
		activePollutions.forEach(p => {
			const typesStr =
				Array.isArray(p.types) ?
					p.types.map(t => window.t(`types.${t}`)).join(', ')
				:	window.t('types.other')
			html += `
                <div class="exchange-card" onclick="flyToReport(${p.lng}, ${p.lat})">
                    <div class="exchange-info">
                        <div class="exchange-types">${typesStr}</div>
                        <div class="exchange-desc">${p.description || ''}</div>
                        <div class="exchange-meta">
                            <span>📍 ${window.t('reward')} ${p.level || 1}</span>
                        </div>
                    </div>
                    <div class="exchange-reward-badge">+$${p.level || 1}</div>
                </div>
            `
		})
		const finalHtml = `${html}<div style="height: 20px;"></div>`
		renderSheetPage(finalHtml, false, 'exchange-root')
	} catch (e) {
		console.error('Exchange error:', e)
		renderSheetPage(
			'<div class="error-msg">Не удалось загрузить биржу задач</div>',
			false,
		)
	}
}

async function showSafetyGuide() {
	closeSidebar()
	const lang = currentLang || 'ru'
	const data = window.safetyContent[lang]

	const html = `
        <div class="info-sheet">
            <div class="info-header-img" style="background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%);">🛡️</div>
            
            <h2 style="font-size: 22px; font-weight: 800; margin-bottom: 24px; text-align: center;">${data.title}</h2>

            <!-- Pollution Levels -->
            <div style="margin-bottom: 32px;">
                <div class="info-tag" style="background: rgba(16, 185, 129, 0.1); color: #10b981; margin-bottom: 16px;">
                    ${t('safety_levels_title')}
                </div>
                ${data.levels
									.map(
										(l, i) => `
                    <div class="safety-level-card level-${i + 1}">
                        <div class="safety-level-header">
                            <span class="safety-level-dot"></span>
                            <strong>${l.label}</strong>
                        </div>
                        <p class="safety-level-desc">${l.description}</p>
                        <div class="safety-level-tools">
                            <strong>${t('safety_equipment')}:</strong> ${l.tools}
                        </div>
                    </div>
                `,
									)
									.join('')}
            </div>

            <!-- General Rules -->
            <div class="info-card">
                <div class="info-tag">${t('safety_rules_title')}</div>
                <div class="info-list">
                    ${data.rules
											.map(
												r => `
                        <div class="info-list-item">
                            <div class="info-list-icon" style="background: #10b981;">✓</div>
                            <div class="info-text" style="margin-bottom: 0; font-size: 14px;">${r}</div>
                        </div>
                    `,
											)
											.join('')}
                </div>
            </div>

            <!-- Glass Specific Rule -->
            <div class="info-card" style="border-left: 4px solid #ef4444; background: rgba(239, 68, 68, 0.05); margin-bottom: 16px;">
                <div class="info-tag" style="background: rgba(239, 68, 68, 0.1); color: #ef4444;">${data.glass_rule.title}</div>
                <div class="info-text" style="color: var(--text-primary); font-weight: 500;">
                    ${data.glass_rule.text}
                </div>
            </div>

            <!-- Bio-Chem Specific Rule -->
            <div class="info-card" style="border-left: 4px solid #f59e0b; background: rgba(245, 158, 11, 0.05); margin-bottom: 16px;">
                <div class="info-tag" style="background: rgba(245, 158, 11, 0.1); color: #f59e0b;">${data.bio_chem_rule.title}</div>
                <div class="info-text" style="color: var(--text-primary); font-weight: 500;">
                    ${data.bio_chem_rule.text}
                </div>
            </div>

            <!-- Sun/Heat Rule -->
            <div class="info-card" style="border-left: 4px solid #3b82f6; background: rgba(59, 130, 246, 0.05); margin-bottom: 16px;">
                <div class="info-tag" style="background: rgba(59, 130, 246, 0.1); color: #3b82f6;">${data.sun_rule.title}</div>
                <div class="info-text" style="color: var(--text-primary); font-weight: 500;">
                    ${data.sun_rule.text}
                </div>
            </div>

            <!-- Physical Safety Rule -->
            <div class="info-card" style="border-left: 4px solid #8b5cf6; background: rgba(139, 92, 246, 0.05); margin-bottom: 24px;">
                <div class="info-tag" style="background: rgba(139, 92, 246, 0.1); color: #8b5cf6;">${data.physical_rule.title}</div>
                <div class="info-text" style="color: var(--text-primary); font-weight: 500;">
                    ${data.physical_rule.text}
                </div>
            </div>

            <!-- Emergency Contacts -->
            <div style="margin-bottom: 32px;">
                <div class="info-tag" style="background: rgba(239, 68, 68, 0.1); color: #ef4444; margin-bottom: 16px;">
                    ${t('safety_contacts_title')}
                </div>
                <div style="display: grid; grid-template-columns: 1fr; gap: 12px;">
                    ${data.emergency_contacts
											.map(
												c => `
                        <div style="background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 16px; padding: 14px 18px; display: flex; align-items: center; justify-content: space-between;">
                            <div style="display: flex; align-items: center; gap: 14px;">
                                <span style="font-size: 24px;">${c.icon}</span>
                                <div style="display: flex; flex-direction: column;">
                                    <span style="font-size: 14px; font-weight: 700;">${c.name}</span>
                                    <span style="font-size: 13px; color: var(--text-secondary);">${t('safety_free_call')}</span>
                                </div>
                            </div>
                            <a href="tel:${c.phone}" style="background: #ef4444; color: white; padding: 8px 16px; border-radius: 10px; font-weight: 800; text-decoration: none; font-size: 14px;">
                                ${c.phone}
                            </a>
                        </div>
                    `,
											)
											.join('')}
                </div>
            </div>

            <div style="text-align: center; margin-top: 32px; opacity: 0.5; font-size: 13px;">
                ${t('safety_footer_msg')}
                <br>${t('safety_footer_care')}
            </div>
        </div>
        <div style="height: 40px;"></div>
    `
	sheetHistory = []
	renderSheetPage(html, false)
}

async function showAboutInfo() {
	closeSidebar()
	const html = `
        <div class="info-sheet">
            <div class="info-header-img">🏛️</div>
            
            <div class="info-card">
                <div class="info-tag">${window.t('about_official_status')}</div>
                <div class="info-title">${window.t('about_initiative_title')}</div>
                <div class="info-text">
                    ${window.t('about_initiative_text')}
                </div>
                <div class="info-text">
                    ${window.t('about_mission_text')}
                </div>
                <div class="info-text" style="font-weight: 600; color: var(--text-primary); margin-top: 12px; border-left: 3px solid #10b981; padding-left: 12px;">
                    ${window.t('about_dev_team')}<br>
                    <span style="color: #10b981; font-size: 18px;">${window.t('about_dev_name')}</span>
                </div>
            </div>

            <div class="info-card">
                <div class="info-tag">${window.t('about_principles')}</div>
                <div class="info-list">
                    <div class="info-list-item">
                        <div class="info-list-icon">1</div>
                        <div class="info-text" style="margin-bottom: 0;">${window.t('about_step_1')}</div>
                    </div>
                    <div class="info-list-item">
                        <div class="info-list-icon">2</div>
                        <div class="info-text" style="margin-bottom: 0;">${window.t('about_step_2')}</div>
                    </div>
                    <div class="info-list-item">
                        <div class="info-list-icon">3</div>
                        <div class="info-text" style="margin-bottom: 0;">${window.t('about_step_3')}</div>
                    </div>
                </div>
            </div>

            <div class="info-card" style="margin-bottom: 0;">
                <div class="info-tag">${window.t('about_contact_title')}</div>
                <div class="info-text">${window.t('about_contact_text')}</div>
                <a href="https://t.me/gayupov_a" target="_blank" class="info-contact-btn">
                    <span>${window.t('about_contact_btn')}</span>
                </a>
            </div>
            
            <div style="text-align: center; margin-top: 24px; opacity: 0.4; font-size: 12px; font-weight: 500;">
                ${window.t('about_version_prefix')} ${window.APP_VERSION}<br>
                Алмазарский район, г. Ташкент
            </div>
        </div>
        <div style="height: 20px;"></div>
    `
	// Clear history so this becomes the new "root" of the sheet
	sheetHistory = []
	renderSheetPage(html, false)
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
	const now = Date.now()
	if (now - lastGeolocateTime < 3000) return // Throttling: 3 seconds
	lastGeolocateTime = now

	// Optimistic UI: check cache first
	const cached = localStorage.getItem('last_known_loc')
	if (cached) {
		const coords = JSON.parse(cached)
		map.flyTo({
			center: coords,
			zoom: 16,
			duration: 1500, // Faster animation
		})
		tg.HapticFeedback.impactOccurred('medium')
	}

	if (!navigator.geolocation) {
		tg.showAlert('Геолокация недоступна')
		return
	}

	navigator.geolocation.getCurrentPosition(
		position => {
			const coords = [position.coords.longitude, position.coords.latitude]
			localStorage.setItem('last_known_loc', JSON.stringify(coords))

			// Only fly if we didn't just fly to the exact same spot (optional, but good)
			// Or just fly again to be precise
			map.flyTo({
				center: coords,
				zoom: 16,
				duration: 1500,
			})
			tg.HapticFeedback.impactOccurred('medium')
		},
		error => {
			// Only show error if we didn't show cached location
			if (!cached) {
				tg.showAlert('Не удалось определить местоположение')
			}
		},
		{ enableHighAccuracy: true, timeout: 5000, maximumAge: 0 },
	)
}

async function loadPollutions() {
	try {
		console.log('Loading pollutions...')
		const response = await fetch(`${API_URL}/pollutions`)
		if (!response.ok) throw new Error('Failed to fetch pollutions')
		const pollutions = await response.json()
		console.log('Pollutions loaded:', pollutions)

		markers.forEach(m => m.remove())
		markers = []

		pollutions.forEach(p => {
			const lat = parseFloat(p.lat)
			const lng = parseFloat(p.lng)

			if (isNaN(lat) || isNaN(lng)) {
				console.warn('Invalid pollution coordinates:', p)
				return
			}

			const el = document.createElement('div')
			el.className = `pollution-marker level-${p.level || 1}`

			const inner = document.createElement('div')
			inner.className = 'pollution-marker-inner'
			el.appendChild(inner)

			const marker = new maplibregl.Marker({ element: el })
				.setLngLat([lng, lat])
				.addTo(map)

			el.addEventListener('click', e => {
				e.stopPropagation()
				console.log('Pollution clicked:', p)
				showPollutionDetails(p)
			})
			markers.push(marker)
		})
	} catch (e) {
		if (navigator.onLine) {
			console.error('Load pollutions error:', e)
			tg.showAlert('Не удалось загрузить данные о загрязнениях')
		}
	}
}

function showAddForm() {
	const center = map.getCenter()
	uploadedPhotos = []
	let selectedTags = []
	let uploadingCount = 0 // Reset global uploading count logic

	const html = `
        <div style="flex: 1;">
            <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 20px;">${window.t('add_pollution_title')}</h2>
            
            <div class="form-group">
                <label class="form-label">${window.t('add_level_label')}</label>
                <div class="level-selector">
                    <button class="level-btn active level-1" data-level="1">${window.t('level_low')}</button>
                    <button class="level-btn level-2" data-level="2">${window.t('level_medium')}</button>
                    <button class="level-btn level-3" data-level="3">${window.t('level_high')}</button>
                </div>
            </div>

            <div class="form-group">
                <label class="form-label">${window.t('add_tags_label')}</label>
                <div class="tag-selector">
                    <button class="tag-btn" data-tag="plastic">${window.t('types.plastic')}</button>
                    <button class="tag-btn" data-tag="glass">${window.t('types.glass')}</button>
                    <button class="tag-btn" data-tag="paper">${window.t('types.paper')}</button>
                    <button class="tag-btn" data-tag="metal">${window.t('types.metal')}</button>
                    <button class="tag-btn" data-tag="organic">${window.t('types.organic')}</button>
                    <button class="tag-btn" data-tag="construction">${window.t('types.construction')}</button>
                    <button class="tag-btn" data-tag="electronic">${window.t('types.electronic')}</button>
                    <button class="tag-btn" data-tag="tires">${window.t('types.tires')}</button>
                    <button class="tag-btn" data-tag="hazardous">${window.t('types.hazardous')}</button>
                    <button class="tag-btn" data-tag="bulky">${window.t('types.bulky')}</button>
                    <button class="tag-btn" data-tag="chemical">${window.t('types.chemical')}</button>
                    <button class="tag-btn" data-tag="other">${window.t('types.other')}</button>
                </div>
            </div>
            
            <div class="form-group">
                <label class="form-label" data-t="add_pollution_desc">${window.t('add_pollution_desc')}</label>
                <textarea class="form-textarea" id="pollution-desc" rows="3" placeholder="${window.t('add_pollution_desc')}"></textarea>
            </div>
            
            <div class="form-group">
                <label class="form-label">${window.t('add_pollution_photo')}</label>
                <div class="file-upload" id="upload-trigger">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin: 0 auto 8px; opacity: 0.5;">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21 15 16 10 5 21"/>
                    </svg>
                    <p style="color: var(--text-secondary); font-size: 14px;">${window.t('add_photo_click')}</p>
                    <input type="file" id="photo-input" accept="image/*" multiple>
                </div>
                <div id="photo-preview" class="photo-grid"></div>
            </div>
        </div>
        
        <div style="padding-bottom: 24px;">
            <button class="btn btn-primary" style="width: 100%; height: 60px; font-size: 17px; font-weight: 700; border-radius: 18px;" id="submit-pollution">
                ${window.t('add_pollution_submit')}
            </button>
        </div>
    `

	renderSheetPage(html)

	// --- Viewer Delegation ---
	// Handle clicks on photo items (both uploaded and loading, though loading won't have url)
	document.getElementById('photo-preview').addEventListener('click', e => {
		console.log('Preview clicked', e.target)
		const item = e.target.closest('.photo-item')
		if (item && item.dataset.url) {
			console.log('Photo item found, URL:', item.dataset.url)
			window.openPhotoViewer(item.dataset.url)
		}
	})

	// --- Logic for Levels ---
	document.querySelectorAll('#sheet-content .level-btn').forEach(btn => {
		btn.addEventListener('click', () => {
			document
				.querySelectorAll('#sheet-content .level-btn')
				.forEach(b => b.classList.remove('active'))
			btn.classList.add('active')
			selectedLevel = parseInt(btn.dataset.level)
			tg.HapticFeedback.impactOccurred('light')
		})
	})

	// --- Logic for Tags ---
	document.querySelectorAll('#sheet-content .tag-btn').forEach(btn => {
		btn.addEventListener('click', () => {
			btn.classList.toggle('active')
			const tag = btn.dataset.tag
			if (btn.classList.contains('active')) {
				selectedTags.push(tag)
			} else {
				selectedTags = selectedTags.filter(t => t !== tag)
			}
			tg.HapticFeedback.impactOccurred('light')
		})
	})

	// --- Layout Fix: input focus ---
	// When textarea is focused, ensure sheet is scrolled to it and doesn't get covered
	const descInput = document.getElementById('pollution-desc')
	if (descInput) {
		descInput.addEventListener('focus', () => {
			setTimeout(() => {
				descInput.scrollIntoView({ behavior: 'smooth', block: 'center' })
			}, 300)
		})
	}

	const uploadTrigger = document.getElementById('upload-trigger')
	if (uploadTrigger) {
		uploadTrigger.addEventListener('click', () => {
			document.getElementById('photo-input').click()
		})
	}

	const photoInput = document.getElementById('photo-input')
	if (photoInput) {
		photoInput.addEventListener('change', handlePhotoUpload)
	}

	const submitBtn = document.getElementById('submit-pollution')
	if (submitBtn) {
		submitBtn.addEventListener('click', () => {
			submitPollution(center.lat, center.lng, selectedTags)
		})
	}
}

async function handlePhotoUpload(event) {
	const files = Array.from(event.target.files)
	if (files.length === 0) return

	// Optimistic UI: Show skeletons immediately
	uploadingCount += files.length
	updatePhotoPreview()

	for (const file of files) {
		try {
			const formData = new FormData()
			formData.append('file', file)
			formData.append('upload_preset', 'ecopatrol')

			const response = await fetch(
				`https://api.cloudinary.com/v1_1/dxjyi9id6/image/upload`,
				{ method: 'POST', body: formData },
			)

			const data = await response.json()

			if (data.error) throw new Error(data.error.message)
			if (!data.secure_url) throw new Error('No url')

			uploadedPhotos.push(data.secure_url)
			tg.HapticFeedback.notificationOccurred('success')
		} catch (e) {
			console.error('Upload error:', e)
			tg.showAlert('Ошибка: ' + (e.message || 'Загрузка не удалась'))
		} finally {
			// Decrement global uploading count
			if (typeof uploadingCount !== 'undefined' && uploadingCount > 0) {
				uploadingCount--
			}
			updatePhotoPreview()
		}
	}
}

function updatePhotoPreview() {
	const preview = document.getElementById('photo-preview')
	if (!preview) return

	let html = ''

	// 1. Render uploaded photos
	html += uploadedPhotos
		.map(
			url => `
        <div class="photo-item" 
             style="background-image: url('${url}'); background-size: cover; background-position: center;"
             data-url="${url}">
        </div>
    `,
		)
		.join('')

	// 2. Render loading skeletons
	for (let i = 0; i < uploadingCount; i++) {
		html += `
            <div class="photo-item loading">
                <div class="spinner"></div>
            </div>
        `
	}

	preview.innerHTML = html

	if (uploadedPhotos.length > 0 || uploadingCount > 0) {
		// Use setTimeout to ensure DOM render
		setTimeout(() => {
			preview.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
		}, 50)
	}
}

async function submitPollution(lat, lng, tags = []) {
	const desc = document.getElementById('pollution-desc').value

	// VALIDATION: Photos are mandatory
	if (uploadedPhotos.length === 0) {
		tg.showAlert(window.t('photo_required'))
		tg.HapticFeedback.notificationOccurred('error')
		return
	}

	// VALIDATION: At least one tag OR description recommended
	if (tags.length === 0 && !desc.trim()) {
		tg.showAlert(window.t('tag_required'))
		tg.HapticFeedback.notificationOccurred('error')
		return
	}

	try {
		const btn = document.getElementById('submit-pollution')
		if (btn) {
			btn.textContent = window.t('submit_loading')
			btn.disabled = true
		}

		const response = await fetch(`${API_URL}/pollutions`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				user_id: currentUser.id,
				lat,
				lng,
				level: selectedLevel,
				types: tags.length > 0 ? tags : ['trash'], // Fallback if needed, but validation handles it
				description: desc,
				photos: uploadedPhotos,
			}),
		})

		if (response.ok) {
			closeBottomSheet()
			loadPollutions()
			tg.HapticFeedback.notificationOccurred('success')
			tg.showAlert(window.t('submit_success'))
		}
	} catch (e) {
		tg.showAlert(window.t('submit_error'))
	}
}

function showPollutionDetails(pollution) {
	currentPollution = pollution
	const content = document.getElementById('sheet-content')

	const levelColors = {
		1: '#059669',
		2: '#fbbf24',
		3: '#ef4444',
	}

	const levelNames = {
		1: window.t('level_low'),
		2: window.t('level_medium'),
		3: window.t('level_high'),
	}

	const reward = pollution.level

	const html = `
        <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 16px;">${window.t('detail_view_title')}</h2>
        
        <div style="background: ${levelColors[pollution.level]}20; padding: 10px 14px; border-radius: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
            <span style="color: ${levelColors[pollution.level]}; font-weight: 600; font-size: 14px;">
                ${levelNames[pollution.level]} ${window.t('level_label')}
            </span>
        </div>

        ${
					pollution.types && pollution.types.length > 0 ?
						`
            <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px;">
                ${pollution.types
									.map(tag => {
										const tagKey = `types.${tag}`
										return `<span style="background: var(--bg-secondary); color: var(--text-secondary); padding: 4px 10px; border-radius: 20px; font-size: 12px; border: 1px solid var(--border);">${window.t(tagKey)}</span>`
									})
									.join('')}
            </div>
        `
					:	''
				}
        
        ${pollution.description ? `<p style="margin-bottom: 16px; color: var(--text-secondary); font-size: 15px;">${pollution.description}</p>` : ''}
        
        ${
					pollution.photos && pollution.photos.length > 0 ?
						`
            <div class="photo-grid" style="margin-bottom: 16px;">
                ${pollution.photos
									.map(
										url => `
                    <div class="photo-item" 
                         style="background-image: url('${url}'); background-size: cover; background-position: center; width: 80px; height: 80px;"
                         onclick="openPhotoViewer('${url}')">
                    </div>
                `,
									)
									.join('')}
            </div>
        `
					:	''
				}
        
        <div style="background: var(--bg-secondary); padding: 14px; border-radius: 12px; margin-bottom: 16px;">
            <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 6px;">${window.t('reward_label')}</p>
            <p style="font-size: 24px; font-weight: 700; color: var(--primary);">$${reward}</p>
        </div>
        
            <div style="padding-bottom: 24px;">
                <button class="btn btn-primary" style="width: 100%; height: 60px; font-size: 17px; font-weight: 700; border-radius: 18px;" id="clean-btn">
                    ${window.t('clean_confirm_btn')}
                </button>
        </div>
    `
	renderSheetPage(html)

	document.getElementById('clean-btn').addEventListener('click', showCleanForm)
}

function showCleanForm() {
	uploadedPhotos = []
	const content = document.getElementById('sheet-content')

	const html = `
        <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 20px;">${window.t('clean_form_title')}</h2>
        
        <div class="form-group">
            <label class="form-label">${window.t('clean_photo_label')}</label>
            <div class="file-upload" id="upload-after-trigger">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin: 0 auto 8px; opacity: 0.5;">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                </svg>
                <p style="color: var(--text-secondary); font-size: 14px;">${window.t('clean_photo_desc')}</p>
                <input type="file" id="photo-input-after" accept="image/*" multiple>
            </div>
            <div id="photo-preview-after" class="photo-grid"></div>
        </div>
        
        <div class="form-group">
            <label class="form-label">${window.t('clean_comment_label')}</label>
            <textarea class="form-textarea" id="clean-comment" rows="2" placeholder="${window.t('clean_comment_placeholder')}"></textarea>
        </div>
        
        <div style="padding-bottom: 24px;">
            <button class="btn btn-primary" style="width: 100%; height: 60px; font-size: 17px; font-weight: 700; border-radius: 18px;" id="submit-clean">
                ${window.t('clean_submit_btn')}
            </button>
        </div>
    `

	renderSheetPage(html)

	document
		.getElementById('upload-after-trigger')
		.addEventListener('click', () => {
			document.getElementById('photo-input-after').click()
		})

	document
		.getElementById('photo-input-after')
		.addEventListener('change', handlePhotoUploadAfter)
	document.getElementById('submit-clean').addEventListener('click', submitClean)
}

async function handlePhotoUploadAfter(event) {
	const files = Array.from(event.target.files)

	for (const file of files) {
		try {
			const formData = new FormData()
			formData.append('file', file)
			formData.append('upload_preset', 'ecopatrol')

			const response = await fetch(
				`https://api.cloudinary.com/v1_1/dxjyi9id6/image/upload`,
				{
					method: 'POST',
					body: formData,
				},
			)

			const data = await response.json()
			uploadedPhotos.push(data.secure_url)
			updatePhotoPreviewAfter()
			tg.HapticFeedback.notificationOccurred('success')
		} catch (e) {
			console.error('Upload error:', e)
			tg.showAlert('Ошибка загрузки фото')
		}
	}
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
		tg.showAlert('Пожалуйста, загрузите фото после очистки (обязательно)')
		tg.HapticFeedback.notificationOccurred('error')
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

			tg.HapticFeedback.notificationOccurred('success')
			tg.showAlert(`Поздравляем! Вам начислено $${currentPollution.level}`)
		}
	} catch (e) {
		tg.showAlert('Ошибка при подтверждении')
	}
}

async function showLeaderboard() {
	// Close sidebar manually to avoid overlay flicker
	const sidebar = document.getElementById('sidebar')
	if (sidebar) sidebar.classList.remove('active')

	tg.HapticFeedback.impactOccurred('light')
	const html = `
        <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 20px;">${window.t('menu_leaderboard')}</h2>
        <div class="leaderboard-list">
             <div class="skeleton-list-item skeleton" style="height: 60px; margin-bottom: 8px; border-radius: 12px;"></div>
             <div class="skeleton-list-item skeleton" style="height: 60px; margin-bottom: 8px; border-radius: 12px;"></div>
             <div class="skeleton-list-item skeleton" style="height: 60px; margin-bottom: 8px; border-radius: 12px; opacity: 0.6;"></div>
             <div class="skeleton-list-item skeleton" style="height: 60px; margin-bottom: 8px; border-radius: 12px; opacity: 0.3;"></div>
        </div>
    `
	// Clear history so this becomes the new "root" of the sheet
	sheetHistory = []
	renderSheetPage(html, false)

	try {
		const response = await fetch(`${API_URL}/leaderboard`)
		const users = await response.json()

		if (users.length === 0) {
			const emptyHtml = `<p style="text-align: center; opacity: 0.5;">${window.t('city_clean_text')}</p>`
			const finalHtml = `
                <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 20px;">${window.t('menu_leaderboard')}</h2>
                ${emptyHtml}
            `
			renderSheetPage(finalHtml, false)
			return
		}

		let listHtml = users
			.map(
				(u, index) => `
            <div class="history-item" style="display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--bg-secondary); border-radius: 12px; margin-bottom: 8px;">
                <div style="font-weight: 800; color: var(--primary); font-size: 18px; min-width: 24px;">${index + 1}</div>
                <div style="flex: 1;">
                    <div style="font-weight: 600; color: var(--text-primary);">${u.first_name}</div>
                    <div style="font-size: 11px; color: var(--text-secondary);">${u.cleaned_count} ${window.t('cleaned')}</div>
                </div>
                <div style="font-weight: 700; color: var(--primary);">${window.t('currency')}${u.balance}</div>
            </div>
        `,
			)
			.join('')

		const finalHtml = `
            <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 20px;">${window.t('menu_leaderboard')}</h2>
            <div id="leaderboard-list">${listHtml}</div>
        `
		renderSheetPage(finalHtml, false)
	} catch (e) {
		if (navigator.onLine) console.error('Leaderboard error:', e)
		const errorHtml = `<p style="color: #ef4444;">${window.t('submit_error')}</p>`
		const finalHtml = `
            <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 20px;">${window.t('menu_leaderboard')}</h2>
            ${errorHtml}
        `
		renderSheetPage(finalHtml, false)
	}
}

// Viewer Functions
window.openPhotoViewer = function (url) {
	const viewer = document.getElementById('photo-viewer')
	const img = document.getElementById('viewer-img')
	if (!viewer || !img) return

	img.src = url
	viewer.classList.add('active')
	tg.HapticFeedback.impactOccurred('medium')
}

window.closePhotoViewer = function () {
	const viewer = document.getElementById('photo-viewer')
	if (viewer) viewer.classList.remove('active')
}

// Ghost Marker for cleaned items
function showGhostMarker(lng, lat, level) {
	const el = document.createElement('div')
	el.className = `pollution-marker level-${level || 1} ghost`

	const inner = document.createElement('div')
	inner.className = 'pollution-marker-inner'
	el.appendChild(inner)

	const marker = new maplibregl.Marker({ element: el })
		.setLngLat([lng, lat])
		.addTo(map)

	// Auto-cleanup after animation ends
	setTimeout(() => {
		marker.remove()
	}, 5000)
}

function showReportDetails(r) {
	const date = new Date(r.created_at).toLocaleDateString(
		currentLang === 'uz' ? 'uz-UZ' : 'ru-RU',
		{
			day: 'numeric',
			month: 'long',
			year: 'numeric',
		},
	)

	const statusText =
		r.status === 'active' ?
			window.t('status_active')
		:	window.t('status_cleaned')

	// Map level to text
	let levelText = window.t('level_low')
	if (r.level === 2) levelText = window.t('level_medium')
	if (r.level === 3) levelText = window.t('level_high')

	// Map types to translated text
	const translatedTypes =
		r.types ?
			r.types
				.map(t => {
					const key = `type_${t.toLowerCase()}`
					const translated = window.t(key)
					return translated !== key ? translated : t
				})
				.join(', ')
		:	'---'

	const html = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px;">
            <h2 style="font-size: 20px; font-weight: 800; color: var(--text-primary); margin: 0;">${window.t('report_title')}</h2>
            <span class="status-badge ${r.status}" style="padding: 6px 14px; font-weight: 700; border-radius: 12px;">${statusText}</span>
        </div>
        
        <!-- Premium Info Cards -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px;">
            <div style="background: var(--bg-secondary); padding: 16px; border-radius: 20px; border: 1px solid var(--border);">
                <div style="font-size: 10px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 8px;">${window.t('detail_added_at')}</div>
                <div style="font-size: 15px; font-weight: 700;">${date}</div>
            </div>
            <div style="background: var(--bg-secondary); padding: 16px; border-radius: 20px; border: 1px solid var(--border); text-align: right;">
                <div style="font-size: 10px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 8px;">${window.t('reward_label')}</div>
                <div style="font-size: 20px; font-weight: 800; color: var(--primary);">${window.t('currency')}${r.level || 0}</div>
            </div>
            <div style="background: var(--bg-secondary); padding: 16px; border-radius: 20px; border: 1px solid var(--border);">
                <div style="font-size: 10px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 8px;">${window.t('detail_level_label')}</div>
                <div style="font-size: 15px; font-weight: 700; color: var(--primary);">${levelText}</div>
            </div>
            <div style="background: var(--bg-secondary); padding: 16px; border-radius: 20px; border: 1px solid var(--border); text-align: right; min-width: 0;">
                <div style="font-size: 10px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 8px;">${window.t('detail_types_label')}</div>
                <div style="font-size: 13px; font-weight: 600; word-break: break-word; white-space: normal;">${translatedTypes}</div>
            </div>
        </div>

        <!-- Before Section -->
        <div style="background: var(--bg-secondary); padding: 20px; border-radius: 24px; margin-bottom: 24px;">
            <label class="form-label" style="font-weight: 800; font-size: 15px; margin-bottom: 16px; display: block;">
                ${window.t('detail_before_photo')}
            </label>
            <div class="photo-grid">
                ${r.photos
									.map(
										url => `
                    <div class="photo-item contain" style="background-image: url('${url}')" onclick="openPhotoViewer('${url}')"></div>
                `,
									)
									.join('')}
            </div>
            ${
							r.description ?
								`
            <div style="margin-top: 16px; font-size: 14px; color: var(--text-secondary); background: var(--bg-primary); padding: 16px; border-radius: 16px; border-left: 4px solid var(--primary); line-height: 1.6;">
                <div style="font-size: 10px; text-transform: uppercase; font-weight: 700; opacity: 0.5; margin-bottom: 6px;">${window.t('detail_description_label')}</div>
                ${r.description}
            </div>
            `
							:	''
						}
        </div>

        <!-- After Section -->
        ${
					r.status === 'cleaned' ?
						`
        <div style="background: rgba(16, 185, 129, 0.08); padding: 20px; border-radius: 24px; border: 1px solid rgba(16, 185, 129, 0.15); margin-bottom: 24px;">
            <label class="form-label" style="font-weight: 800; font-size: 15px; margin-bottom: 16px; display: block; color: var(--primary);">
                ${window.t('detail_after_photo')}
            </label>
            <div class="photo-grid">
                ${
									r.after_photos && r.after_photos.length > 0 ?
										r.after_photos
											.map(
												url => `
                    <div class="photo-item contain" style="background-image: url('${url}')" onclick="openPhotoViewer('${url}')"></div>
                `,
											)
											.join('')
									:	`<div style="font-size: 13px; color: var(--text-secondary); font-style: italic; opacity: 0.6; text-align: center; width: 100%;">${window.t('no_photo')}</div>`
								}
            </div>
            ${
							r.comment ?
								`
            <div style="margin-top: 16px; font-size: 14px; color: var(--text-secondary); background: white; padding: 16px; border-radius: 16px; border-left: 4px solid var(--primary); line-height: 1.6;">
                <div style="font-size: 10px; text-transform: uppercase; font-weight: 700; opacity: 0.5; margin-bottom: 6px;">${window.t('detail_comment_label')}</div>
                ${r.comment}
            </div>
            `
							:	''
						}
        </div>
        `
					:	''
				}

        <!-- Actions -->
        <div style="margin-top: 12px; padding-bottom: 24px;">
            <button class="btn btn-primary" style="width: 100%; height: 60px; font-size: 17px; font-weight: 700; border-radius: 18px; box-shadow: 0 10px 25px rgba(16, 185, 129, 0.25);" onclick="window.flyToReport(${r.lng}, ${r.lat}, ${r.level}, '${r.status}')">
                ${window.t('show_on_map')}
            </button>
        </div>
    `
	renderDetailSheet(html)
}

async function fetchAirQuality() {
	try {
		let lat = 41.2646
		let lng = 69.2163

		// Try to use map center if available, else usage default Tashkent
		if (typeof map !== 'undefined') {
			const center = map.getCenter()
			lat = center.lat
			lng = center.lng
		}

		console.log(`📍 Fetching air quality for: lat=${lat}, lng=${lng}`)

		// Open-Meteo Air Quality API
		const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&hourly=pm10,pm2_5,european_aqi&current=european_aqi,pm10,pm2_5&timezone=auto`
		console.log(`🔗 AQI URL: ${aqiUrl}`)

		const response = await fetch(aqiUrl)

		if (!response.ok) {
			throw new Error(
				`AQI API returned ${response.status}: ${response.statusText}`,
			)
		}

		const data = await response.json()
		console.log('🌍 Air Quality API Response:', JSON.stringify(data))

		if (data.current) {
			const aqi = data.current.european_aqi
			const pm10 = data.current.pm10

			console.log(`✅ Parsed AQI: ${aqi}, PM10: ${pm10}`)

			// Update global city stats
			window.cityStats.aqi = aqi
			window.cityStats.pm10 = pm10

			updateAirWidget(aqi)
		} else {
			console.warn('⚠️ data.current is MISSING in API response!')
		}

		// Also fetch weather
		const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,wind_speed_10m&timezone=auto`
		console.log(`🔗 Weather URL: ${weatherUrl}`)

		const weatherRes = await fetch(weatherUrl)

		if (!weatherRes.ok) {
			throw new Error(
				`Weather API returned ${weatherRes.status}: ${weatherRes.statusText}`,
			)
		}

		const weatherData = await weatherRes.json()
		console.log('🌤️ Weather API Response:', JSON.stringify(weatherData))

		if (weatherData.current) {
			window.cityStats.temp = weatherData.current.temperature_2m
			window.cityStats.wind = weatherData.current.wind_speed_10m
			console.log(
				`✅ Parsed Weather - Temp: ${weatherData.current.temperature_2m}°C, Wind: ${weatherData.current.wind_speed_10m} km/h`,
			)
		} else {
			console.warn('⚠️ weatherData.current is MISSING in API response!')
		}
	} catch (e) {
		console.error('❌ Air Quality Fetch Error:', e)
		console.error('Error details:', {
			message: e.message,
			stack: e.stack,
			name: e.name,
		})

		// Show user-friendly error in widget
		const widget = document.getElementById('air-widget')
		if (widget) {
			const spinner = widget.querySelector('.air-spinner')
			const valueEl = widget.querySelector('.air-value')
			if (spinner) spinner.style.display = 'none'
			if (valueEl) {
				valueEl.style.display = 'block'
				valueEl.textContent = '⚠️'
				valueEl.title = 'Network error: ' + e.message
			}
		}
	}
}

function updateAirWidget(aqi) {
	const ticket = document.getElementById('air-widget')
	const valueEl = ticket.querySelector('.air-value')
	const spinner = ticket.querySelector('.air-spinner')

	// Hide spinner, show value
	if (spinner) spinner.style.display = 'none'
	if (valueEl) {
		valueEl.style.display = 'block'
		valueEl.textContent = aqi
	}

	// Determine status
	let status = 'good'

	if (aqi > 40) {
		status = 'moderate'
	}
	if (aqi > 80) {
		status = 'bad'
	}

	// Remove old classes
	ticket.classList.remove('air-good', 'air-moderate', 'air-bad')
	ticket.classList.add(`air-${status}`)

	valueEl.textContent = aqi
}

// Init Air Quality (Fetch based on map center when moved)
setTimeout(() => {
	fetchAirQuality()

	// Explicit Event Listener for robustness
	const widget = document.getElementById('air-widget')
	if (widget) {
		widget.addEventListener('click', e => {
			console.log('Air Widget Clicked (JS Listener)')
			e.stopPropagation() // Stop map from catching it
			e.preventDefault()
			tg.HapticFeedback.impactOccurred('medium')
			showCityStatus()
		})
	}
}, 3000)

// Update every 10 mins OR when map moves securely (optional, simple for now)
setInterval(fetchAirQuality, 600000)
