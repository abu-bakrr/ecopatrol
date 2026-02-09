// EcoPatrol - Onboarding Edition
const tg = window.Telegram.WebApp
const API_URL = window.location.origin + '/api'

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
let currentLang = 'ru' // Default

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
	return result
}

window.setLanguage = async function (lang) {
	if (!['uz', 'ru', 'en'].includes(lang)) return
	console.log('--- SETTING LANGUAGE ---', lang)
	currentLang = lang
	localStorage.setItem('language', lang)

	// Mark active in UI
	document.querySelectorAll('.lang-option').forEach(opt => {
		opt.classList.remove('active')
		if (opt.textContent.toLowerCase().includes(lang)) {
			opt.classList.add('active')
		}
	})

	// Translate static elements
	document.querySelectorAll('[data-t]').forEach(el => {
		const key = el.getAttribute('data-t')
		el.innerHTML = window.t(key)
	})

	document.querySelectorAll('[data-t-placeholder]').forEach(el => {
		const key = el.getAttribute('data-t-placeholder')
		el.placeholder = window.t(key)
	})

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

	tg.HapticFeedback.impactOccurred('light')
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
	console.log('--- DOMContentLoaded ---')
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

	initBottomSheetDrag()

	// 0.5. Load Language
	const savedLang = localStorage.getItem('language') || 'ru'
	window.setLanguage(savedLang)

	// DELAY MAP INIT: Wait for Telegram animation to finish
	// IMMEDIATE MAP INIT: No need to wait 300ms
	checkRegistration()
})

function initBottomSheetDrag() {
	const sheet = document.getElementById('bottom-sheet')
	const handle = sheet.querySelector('.sheet-handle')
	if (!sheet || !handle) return

	let startY = 0
	let currentY = 0
	let dragging = false

	handle.addEventListener(
		'touchstart',
		e => {
			startY = e.touches[0].clientY
			currentY = startY // Initialize to avoid jumps
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
			closeBottomSheet()
		}
		sheet.style.transform = ''
	})
}

// Navigation History for Bottom Sheet
let sheetHistory = []

function renderSheetPage(html, addToHistory = true) {
	const content = document.getElementById('sheet-content')
	if (!content) return

	if (addToHistory && content.innerHTML.trim() !== '') {
		sheetHistory.push(content.innerHTML)
	}

	// Apply animation class
	content.classList.remove('sheet-page-anim')
	void content.offsetWidth // Force reflow
	content.classList.add('sheet-page-anim')

	content.innerHTML = html
	openBottomSheet()
}

function goBackInSheet() {
	if (sheetHistory.length > 0) {
		const prev = sheetHistory.pop()
		renderSheetPage(prev, false)
	} else {
		// If we are already at the bottom of history, we can't go back further
		// But in our current logic, closeBottomSheet handles this.
	}
}

function checkRegistration() {
	isRegistered = localStorage.getItem('registered') === 'true'

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
		center: initialCenter || [37.6173, 55.7558],
		zoom: 15,
		minZoom: 10, // Prevent zooming out to world view
		maxZoom: 18, // Prevent getting too close
		pitch: 0,
		antialias: true,
		attributionControl: false, // Cleaner look
		dragRotate: false, // Disable rotation by mouse drag
		touchPitch: false, // Disable pitch by touch
		maxBounds: [
			[55.0, 36.0], // Southwest coordinates (approx)
			[74.0, 46.0], // Northeast coordinates (approx)
		],
	})

	// Force resize to fix gray blocks if map was initialized before full expansion
	map.on('load', () => {
		map.resize()
		console.log('Map resized and loaded')

		// DIAGNOSTIC LOGS FOR THEME MATCHING
		setTimeout(() => {
			const mapEl = document.getElementById('map')
			const bgColor = window.getComputedStyle(mapEl).backgroundColor
			console.log('--- THEME DIAGNOSTIC ---')
			console.log('Theme:', theme)
			console.log('Map Computed BG:', bgColor)
			console.log(
				'Body Computed BG:',
				window.getComputedStyle(document.body).backgroundColor,
			)
			console.log(
				'Vignette var(--map-bg):',
				window
					.getComputedStyle(document.documentElement)
					.getPropertyValue('--map-bg'),
			)
		}, 1000)
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

	map.on('load', () => {
		// 1. Hide the loading overlay
		const loader = document.getElementById('map-loading-overlay')
		if (loader) loader.classList.add('hidden')

		// 2. Load markers only after map is ready
		loadPollutions()

		// 3. Trigger geolocation
		geolocate.trigger()

		console.log('Map fully ready: overlay hidden, markers loaded')
	})

	// Handle map movement
	map.on('movestart', () => {
		isDragging = true
		document.getElementById('center-marker').classList.add('dragging')
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

	map.on('load', () => {
		console.log('Map loaded')
	})
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
		`${currentUser.balance.toFixed(0)} ${window.t('currency')}`
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
}

function openBottomSheet() {
	document.getElementById('bottom-sheet').classList.add('active')
	document.getElementById('overlay').classList.add('active')
	tg.HapticFeedback.impactOccurred('light')
}

function closeBottomSheet() {
	// SMART NAVIGATION: If there is history (e.g. we are in details and came from list),
	// go back to previous page instead of closing the entire sheet.
	if (sheetHistory.length > 0) {
		goBackInSheet()
		return
	}

	document.getElementById('bottom-sheet').classList.remove('active')
	document.getElementById('overlay').classList.remove('active')
	sheetHistory = [] // Clear history on close
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
	closeBottomSheet()
}

async function showMyReports() {
	closeSidebar()
	if (!currentUser) return
	const html = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
            <h2 style="font-size: 20px; font-weight: 600;">${window.t('menu_reports')}</h2>
            <div id="reports-loader" class="loader-small" style="display: none;"></div>
        </div>
        <div id="reports-list" class="reports-list">
            <div style="padding: 20px; text-align: center; opacity: 0.5;">${window.t('loading')}</div>
        </div>
        <div style="height: 20px;"></div>
    `
	// Clear history so this becomes the new "root" of the sheet
	sheetHistory = []
	renderSheetPage(html, false)

	try {
		const response = await fetch(`${API_URL}/pollutions/user/${currentUser.id}`)
		if (!response.ok) throw new Error('Fetch failed')
		const reports = await response.json()

		const list = document.getElementById('reports-list')
		if (reports.length === 0) {
			list.innerHTML = `
                <div style="padding: 40px 20px; text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 16px;">📄</div>
                    <div style="font-size: 16px; font-weight: 500; color: var(--text-primary);">У вас пока нет отчетов</div>
                    <div style="font-size: 14px; color: var(--text-secondary); margin-top: 4px;">Отметьте первое загрязнение на карте!</div>
                </div>
            `
			return
		}

		list.innerHTML = reports
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

	map.flyTo({ center: [lng, lat], zoom: 17, duration: 1500 })
	tg.HapticFeedback.impactOccurred('medium')
}

async function showMyHistory() {
	closeSidebar()
	if (!currentUser) return
	const html = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
            <h2 style="font-size: 20px; font-weight: 600;">История начислений</h2>
            <div id="history-loader" class="loader-small" style="display: none;"></div>
        </div>
        <div id="history-list" class="history-list">
            <div style="padding: 20px; text-align: center; opacity: 0.5;">Загрузка...</div>
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

		const list = document.getElementById('history-list')
		if (history.length === 0) {
			list.innerHTML = `
                <div style="padding: 40px 20px; text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 16px;">💰</div>
                    <div style="font-size: 16px; font-weight: 500; color: var(--text-primary);">У вас пока нет начислений</div>
                    <div style="font-size: 14px; color: var(--text-secondary); margin-top: 4px;">Очищайте территорию, чтобы зарабатывать!</div>
                </div>
            `
			return
		}

		list.innerHTML = history
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
	} catch (e) {
		console.error(e)
		document.getElementById('history-list').innerHTML = `
            <div style="padding: 20px; text-align: center; color: #ef4444;">
                Ошибка при загрузке данных
            </div>
        `
	}
}

async function showExchange() {
	closeSidebar()
	const content = document.getElementById('sheet-content')
	content.innerHTML = `
        <div class="sheet-loading">
            <div class="skeleton" style="height: 100px; border-radius: 20px; margin-bottom: 12px;"></div>
            <div class="skeleton" style="height: 100px; border-radius: 20px; margin-bottom: 12px;"></div>
            <div class="skeleton" style="height: 100px; border-radius: 20px;"></div>
        </div>
    `
	// Clear history so this becomes the new "root" of the sheet
	sheetHistory = []
	openBottomSheet()

	try {
		const response = await fetch(`${API_URL}/pollutions`)
		if (!response.ok) throw new Error('Fetch failed')
		const pollutions = await response.json()

		// Filter active and sort by reward (higher first)
		const activePollutions = pollutions
			.filter(p => p.status === 'active')
			.sort((a, b) => (b.level || 0) - (a.level || 0))

		if (activePollutions.length === 0) {
			content.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🌟</div>
                    <div class="empty-title">${window.t('city_clean_title')}</div>
                    <div class="empty-text">${window.t('city_clean_text')}</div>
                </div>
            `
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
		html += '</div><div style="height: 20px;"></div>'
		content.innerHTML = html
	} catch (e) {
		console.error('Exchange error:', e)
		content.innerHTML =
			'<div class="error-msg">Не удалось загрузить биржу задач</div>'
	}
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
                EcoPatrol Institutional Edition v36.0<br>
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
	uploadingCount = 0 // Reset global uploading count logic

	const content = document.getElementById('sheet-content')
	content.innerHTML = `
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
        
        <button class="btn btn-primary" style="width: 100%;" id="submit-pollution">
            ${window.t('add_pollution_submit')}
        </button>
        <!-- Spacer for safe area -->
        <div style="height: 20px;"></div>
    `

	openBottomSheet()

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
	content.querySelectorAll('.level-btn').forEach(btn => {
		btn.addEventListener('click', () => {
			content
				.querySelectorAll('.level-btn')
				.forEach(b => b.classList.remove('active'))
			btn.classList.add('active')
			selectedLevel = parseInt(btn.dataset.level)
			tg.HapticFeedback.impactOccurred('light')
		})
	})

	// --- Logic for Tags ---
	content.querySelectorAll('.tag-btn').forEach(btn => {
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
	descInput.addEventListener('focus', () => {
		setTimeout(() => {
			descInput.scrollIntoView({ behavior: 'smooth', block: 'center' })
		}, 300)
	})

	document.getElementById('upload-trigger').addEventListener('click', () => {
		document.getElementById('photo-input').click()
	})

	document
		.getElementById('photo-input')
		.addEventListener('change', handlePhotoUpload)
	document.getElementById('submit-pollution').addEventListener('click', () => {
		submitPollution(center.lat, center.lng, selectedTags)
	})
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

	content.innerHTML = `
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
        
        <button class="btn btn-primary" style="width: 100%;" id="clean-btn">
            ${window.t('clean_confirm_btn')}
        </button>
    `

	openBottomSheet()

	document.getElementById('clean-btn').addEventListener('click', showCleanForm)
}

function showCleanForm() {
	uploadedPhotos = []
	const content = document.getElementById('sheet-content')

	content.innerHTML = `
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
        
        <button class="btn btn-primary" style="width: 100%;" id="submit-clean">
            ${window.t('clean_submit_btn')}
        </button>
    `

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
        <div id="leaderboard-list" class="loading">${window.t('loading')}</div>
    `
	// Clear history so this becomes the new "root" of the sheet
	sheetHistory = []
	renderSheetPage(html, false)

	try {
		const response = await fetch(`${API_URL}/leaderboard`)
		const users = await response.json()

		const list = document.getElementById('leaderboard-list')
		list.classList.remove('loading')

		if (users.length === 0) {
			list.innerHTML = `<p style="text-align: center; opacity: 0.5;">${window.t('city_clean_text')}</p>`
			return
		}

		list.innerHTML = users
			.map(
				(u, index) => `
            <div class="history-item" style="display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--bg-secondary); border-radius: 12px; margin-bottom: 8px;">
                <div style="font-weight: 800; color: var(--primary); font-size: 18px; min-width: 24px;">${index + 1}</div>
                <div style="flex: 1;">
                    <div style="font-weight: 600; color: var(--text-primary);">${u.first_name}</div>
                    <div style="font-size: 11px; color: var(--text-secondary);">${u.cleaned_count} ${window.t('cleaned')}</div>
                </div>
                <div style="font-weight: 700; color: var(--primary);">${u.balance} ${window.t('currency')}</div>
            </div>
        `,
			)
			.join('')
	} catch (e) {
		if (navigator.onLine) console.error('Leaderboard error:', e)
		const list = document.getElementById('leaderboard-list')
		if (list)
			list.innerHTML = `<p style="color: #ef4444;">${window.t('submit_error')}</p>`
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
                <div style="font-size: 20px; font-weight: 800; color: var(--primary);">${r.level || 0} ${window.t('currency')}</div>
            </div>
            <div style="background: var(--bg-secondary); padding: 16px; border-radius: 20px; border: 1px solid var(--border);">
                <div style="font-size: 10px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 8px;">${window.t('detail_level_label')}</div>
                <div style="font-size: 15px; font-weight: 700; color: var(--primary);">${levelText}</div>
            </div>
            <div style="background: var(--bg-secondary); padding: 16px; border-radius: 20px; border: 1px solid var(--border); text-align: right;">
                <div style="font-size: 10px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 8px;">${window.t('detail_types_label')}</div>
                <div style="font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${translatedTypes}</div>
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
	renderSheetPage(html)
}

// --- CITY PASSPORT & AIR QUALITY ---

let cityStats = {
	aqi: '-',
	pm10: '-',
	temp: '-',
	wind: '-',
	radiation: '0.11 мкЗв/ч', // Simulation
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

			// FIX: Ensure cityStats exists
			if (!window.cityStats) window.cityStats = {}

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
			// FIX: Ensure cityStats exists
			if (!window.cityStats) window.cityStats = {}

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

window.showCityStatus = async () => {
	try {
		console.log('--- showCityStatus STARTED ---')
		if (typeof closeSidebar === 'function') closeSidebar()

		// FIX: Use Strict Check for missing data (0 is valid!)
		const isAqiMissing =
			!window.cityStats ||
			window.cityStats.aqi === undefined ||
			window.cityStats.aqi === null ||
			window.cityStats.aqi === '--'

		// FIX: Use locking to prevent infinite loops / vibration
		// Only trigger fetch if missing, and ONLY recurse if fetch was successful
		if (isAqiMissing && !window._isFetchingCityStatus) {
			console.log(
				'Data missing (aqi=' +
					window.cityStats?.aqi +
					'), triggering background fetch...',
			)
			window._isFetchingCityStatus = true

			fetchAirQuality().finally(() => {
				window._isFetchingCityStatus = false

				// CRITICAL FIX: Check if we actually GOT data before re-rendering
				const newStats = window.cityStats || {}
				if (
					newStats.aqi !== undefined &&
					newStats.aqi !== null &&
					newStats.aqi !== '--'
				) {
					console.log(
						'✅ Data fetched successfully (AQI ' +
							newStats.aqi +
							'), updating UI...',
					)
					// Only re-render if the sheet is actually open
					if (document.querySelector('.aqi-circle')) {
						showCityStatus()
					}
				} else {
					console.warn(
						'⚠️ Fetch finished but AQI is still missing! Stopping recursion to prevent loop.',
					)
				}
			})
		}

		// Safety: Ensure cityStats exists
		const stats = window.cityStats || {}
		const aqi = stats.aqi !== undefined ? stats.aqi : '--'
		const temp = stats.temp !== undefined ? Math.round(stats.temp) : '--' // Round temp
		const wind = stats.wind !== undefined ? Math.round(stats.wind) : '--' // Round wind

		// Safety: Pollutions
		const totalPollutions =
			Array.isArray(window.allPollutions) ? window.allPollutions.length : 0
		const cleanedEl = document.getElementById('sidebar-cleaned')
		const cleanedCount = cleanedEl ? cleanedEl.textContent : '-'

		// Safety: Translation
		const t = k => (window.t ? window.t(k) : k)

		// Icons (SVGs)
		const iconThermometer =
			'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>'
		const iconWind =
			'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/></svg>'
		const iconRadiation =
			'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5 10 10 0 0 0-10 10 4 4 0 0 1-5-5 4 4 0 0 1 5-5z"/><path d="M12 12a2 2 0 1 0 2 2 2 2 0 0 0-2-2z"/></svg>' // Simplified "Radio" feel
		const iconAlert =
			'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
		const iconShield =
			'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>'

		const html = `
        <div class="info-sheet">
            <!-- Modern Header -->
            <div style="text-align: center; margin-bottom: 24px;">
                <div style="width: 60px; height: 60px; background: linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(59, 130, 246, 0.15)); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <linearGradient id="buildingGradient2" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" style="stop-color:#10b981;stop-opacity:1" />
                                <stop offset="100%" style="stop-color:#3b82f6;stop-opacity:1" />
                            </linearGradient>
                        </defs>
                        <!-- Skyline silhouette -->
                        <rect x="3" y="10" width="4" height="11" fill="url(#buildingGradient2)" rx="0.5"/>
                        <rect x="8" y="6" width="4" height="15" fill="url(#buildingGradient2)" rx="0.5"/>
                        <rect x="13" y="8" width="4" height="13" fill="url(#buildingGradient2)" rx="0.5"/>
                        <rect x="18" y="4" width="3" height="17" fill="url(#buildingGradient2)" rx="0.5"/>
                        <!-- Windows -->
                        <rect x="9" y="8" width="1" height="1" fill="white" opacity="0.6"/>
                        <rect x="11" y="8" width="1" height="1" fill="white" opacity="0.6"/>
                        <rect x="9" y="11" width="1" height="1" fill="white" opacity="0.6"/>
                        <rect x="11" y="11" width="1" height="1" fill="white" opacity="0.6"/>
                        <rect x="14" y="10" width="1" height="1" fill="white" opacity="0.6"/>
                        <rect x="16" y="10" width="1" height="1" fill="white" opacity="0.6"/>
                        <rect x="14" y="13" width="1" height="1" fill="white" opacity="0.6"/>
                        <rect x="16" y="13" width="1" height="1" fill="white" opacity="0.6"/>
                        <!-- Base line -->
                        <line x1="2" y1="21" x2="22" y2="21" stroke="url(#buildingGradient2)" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                </div>
                <h2 style="font-size: 20px; font-weight: 700; color: var(--text-primary); margin: 0;">${t('city_status_title')}</h2>
            </div>

            <!-- Central AQI Display with Glow -->
            <div class="aqi-circle-enhanced" style="margin: 0 auto 24px;">
                <div class="aqi-glow"></div>
                <div class="aqi-number" style="color: var(--text-primary); font-size: 48px; font-weight: 900; line-height: 1;">${aqi}</div>
                <div class="aqi-text" style="font-size: 12px; text-transform: uppercase; letter-spacing: 2px; color: var(--text-secondary); font-weight: 600;">AQI</div>
            </div>
            
            <!-- Bento Grid Stats -->
            <div class="city-stats-grid">
                <div class="stat-card">
                    <div class="stat-card-icon">${iconThermometer}</div>
                    <div class="stat-card-label">${t('weather')}</div>
                    <div class="stat-card-value">${temp}°C</div>
                </div>
                 <div class="stat-card">
                    <div class="stat-card-icon">${iconWind}</div>
                    <div class="stat-card-label">${t('wind')}</div>
                    <div class="stat-card-value">${wind} <span style="font-size:12px; font-weight:400; color:var(--text-secondary)">km/h</span></div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-icon">${iconRadiation}</div>
                    <div class="stat-card-label">${t('radiation')}</div>
                    <div class="stat-card-value" style="color: #10b981;">0.12 µSv</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-icon">${iconAlert}</div>
                    <div class="stat-card-label">${t('menu_pollutions')}</div>
                    <div class="stat-card-value" style="color: #ef4444;">${totalPollutions}</div>
                </div>
            </div>
            
            <!-- Cleaned Status -->
            <div class="info-card" style="margin-top: 12px; background: var(--bg-secondary); border: 1px solid var(--border);">
                 <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                    ${iconShield}
                    <span style="font-weight: 600; font-size: 15px; color: var(--text-primary);">${t('cleaned')}</span>
                 </div>
                 
                 <div style="display: flex; align-items: baseline; gap: 8px;">
                     <div style="font-size: 32px; font-weight: 800; color: var(--text-primary);">
                        ${cleanedCount}
                     </div>
                     <div style="font-size: 13px; color: var(--text-secondary);">
                        ликвидировано волонтерами
                     </div>
                 </div>
            </div>

            <div style="height: 32px;"></div>
        </div>
        `

		if (typeof renderSheetPage === 'function') {
			sheetHistory = []
			renderSheetPage(html, false)
		} else {
			console.error('renderSheetPage function missing!')
			tg.showAlert('Internal Error: renderSheetPage missing')
		}
	} catch (e) {
		console.error('showCityStatus CRASH:', e)
		tg.showAlert('Error showing status: ' + e.message)
	}
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
