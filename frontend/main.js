// EcoPatrol - Onboarding Edition
const tg = window.Telegram.WebApp
const API_URL = window.location.origin + '/api'

let map
let markers = []
let currentUser = null
let selectedLevel = 1
let uploadedPhotos = []
let currentPollution = null
let isDragging = false
let isRegistered = false

// Start pre-fetching location immediately
const locationPromise = new Promise(resolve => {
	// 1. Try cache first
	const cached = localStorage.getItem('last_known_loc')
	if (cached) {
		resolve({ coords: JSON.parse(cached), source: 'cache' })
	}

	// 2. Try live location in parallel
	if (navigator.geolocation) {
		navigator.geolocation.getCurrentPosition(
			pos => {
				// Update cache
				const coords = [pos.coords.longitude, pos.coords.latitude]
				localStorage.setItem('last_known_loc', JSON.stringify(coords))
				// Resolve if not already resolved (Promise handles this mostly, but we want live data if fast enough)
				resolve({ coords: coords, source: 'live' })
			},
			err => {
				console.log('Pre-fetch geo error:', err)
				if (!cached) resolve(null)
			},
			{ enableHighAccuracy: false, timeout: 5000, maximumAge: 30000 },
		)
	} else {
		if (!cached) resolve(null)
	}
})

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
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
	tg.ready()

	// Enable fullscreen mode
	tg.requestFullscreen()

	// Set header color based on theme
	const savedTheme = localStorage.getItem('theme') || 'light'
	const headerColor = savedTheme === 'dark' ? '#111827' : '#ffffff'
	const bgColor = savedTheme === 'dark' ? '#242f3e' : '#fcfcfc'

	tg.setHeaderColor(headerColor)
	tg.setBackgroundColor(bgColor) // Set immediately

	loadTheme()
	checkRegistration()
})

function loadTheme() {
	const savedTheme = localStorage.getItem('theme') || 'light'
	document.documentElement.setAttribute('data-theme', savedTheme)
	if (savedTheme === 'dark') {
		document.getElementById('theme-toggle')?.classList.add('active')
	}
}

function toggleTheme() {
	const current = document.documentElement.getAttribute('data-theme')
	const newTheme = current === 'dark' ? 'light' : 'dark'
	document.documentElement.setAttribute('data-theme', newTheme)
	localStorage.setItem('theme', newTheme)
	document.getElementById('theme-toggle').classList.toggle('active')
	tg.HapticFeedback.impactOccurred('light')

	// Update header color based on theme
	const headerColor = newTheme === 'dark' ? '#111827' : '#ffffff'
	tg.setHeaderColor(headerColor)

	// Update map style based on theme
	if (map) {
		const style =
			newTheme === 'dark' ?
				'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
			:	'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json'
		map.setStyle(style)
	}
}

async function checkRegistration() {
    // 1. Check if we have Telegram user data
    const tgUser = tg.initDataUnsafe?.user;
    if (!tgUser) {
        // Fallback for dev/testing without Telegram
        isRegistered = localStorage.getItem('registered') === 'true'
        if (isRegistered) {
            hideOnboarding()
            initMap()
            authUser() // Try to refresh data
            setupEventListeners()
            loadPollutions()
        } else {
            showOnboarding()
        }
        return;
    }

    try {
        // 2. Try to get user profile from backend
        // We use the ID to check if user exists. 
        // Assuming GET /profile/:id returns 200 if exists, 404 if not.
        const response = await fetch(`${API_URL}/profile/${tgUser.id}`)
        
        if (response.ok) {
            const data = await response.json()
            console.log('User found, auto-login:', data)
            
            // User exists! Login.
            currentUser = data; // Profile endpoint returns user data directly?
            // "loadProfileStats" expects { cleaned_count: ... } but profile endpoint might return full user?
            // "authUser" uses /init and gets { user: ... }
            // Let's assume /profile/:id returns the user object or something we can use.
            // Actually, let's use /init with just ID to be safe if /profile structure is unknown?
            // But /init is POST.
            // Let's stick to /profile check. If it works, we know user exists.
            // Then we can call authUser() to ensure we have full "currentUser" structure as expected by app.
            
            // Wait, "loadProfileStats" response: "document.getElementById('sidebar-cleaned').textContent = data.cleaned_count"
            // So /profile/:id returns stats? Or user?
            // Let's check "loadProfileStats" implementation... 
            // It says: const response = await fetch(`${API_URL}/profile/${currentUser.id}`)
            // const data = await response.json()
            // And uses data.cleaned_count.
            
            // If /profile/:id returns full user + stats, we are good. 
            // If it only returns stats, we might miss "balance" etc.
            
            // Better approach: Try to call /init (authUser logic) to "login".
            // If /init with just ID returns user, great.
            // If it fails because of missing fields, then we know we need registration.
            
            // Let's try authUser's logic here directly.
            await attemptAutoLogin(tgUser);
            
        } else {
            // 404 or other error -> Not registered
            console.log('User not found (or error), showing onboarding')
            throw new Error('User not found')
        }
    } catch (e) {
        // Fallback or show onboarding
        // If local storage says registered but server says no -> Server is truth. Show onboarding.
        // If server error -> Check local storage as backup?
        // Let's assume if network works and user not found -> Onboarding.
        // If network fails -> Try local storage.
        
        if (localStorage.getItem('registered') === 'true' && e.message !== 'User not found') {
             console.log('Network error, falling back to local storage')
             hideOnboarding()
             initMap()
             setupEventListeners()
             loadPollutions()
             // Try to auth in background?
        } else {
            showOnboarding()
        }
    }
}

async function attemptAutoLogin(tgUser) {
    // Re-use authUser logic but handle success/fail explicitly
	try {
		const response = await fetch(`${API_URL}/init`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				telegram_id: tgUser.id,
				username: tgUser.username || `${tgUser.first_name || ''} ${tgUser.last_name || ''}`.trim(),
				initData: tg.initData,
			}),
		})
		
        if (!response.ok) {
            throw new Error('Auto-login failed')
        }

		const data = await response.json()
        console.log('Auto-login success:', data)
		currentUser = data.user
        
        isRegistered = true
        localStorage.setItem('registered', 'true')
        
        hideOnboarding()
        
        // Use cached location or wait for live?
        // Let's just init map. 
        initMap()
        
        updateProfileUI()
        setupEventListeners()
        loadPollutions()
	} catch (e) {
        console.error('Auto-login error:', e)
        throw e
	}
}

function showOnboarding() {
	document.getElementById('onboarding').classList.remove('hidden')
	const form = document.getElementById('onboarding-form')
    // Remove old listeners to avoid duplicates if called multiple times?
    // Better to clone or check. For now, simple standard way.
    // Use "onclick" on button or just simple addEventListener (might stack if not careful)
    // But checkRegistration is usually called once.
    // To be safe against multiple listeners:
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);
    
	newForm.addEventListener('submit', e => {
		e.preventDefault()
		handleRegistration()
	})
}

function hideOnboarding() {
	document.getElementById('onboarding').classList.add('hidden')
}

async function handleRegistration() {
	try {
        const firstNameInput = document.getElementById('first-name');
        const lastNameInput = document.getElementById('last-name');
        const ageInput = document.getElementById('age');
        const phoneInput = document.getElementById('phone');

        if (!firstNameInput || !lastNameInput || !ageInput || !phoneInput) {
            console.error('Missing form elements');
            tg.showAlert('Ошибка: форма регистрации повреждена. Попробуйте перезагрузить приложение.');
            return;
        }

        const firstName = firstNameInput.value.trim()
        const lastName = lastNameInput.value.trim()
        const age = parseInt(ageInput.value)
        const phone = phoneInput.value.trim()

        console.log('Registration attempt:', { firstName, lastName, age, phone })

        // Validation
        if (!firstName || !lastName || !age || !phone) {
            tg.showAlert('Пожалуйста, заполните все поля')
            return
        }

        if (isNaN(age) || age < 13 || age > 120) {
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

        navigator.geolocation.getCurrentPosition(
            async position => {
                console.log('Geolocation granted:', position.coords)

                // Geolocation granted, proceed with registration
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
                        console.error('Registration failed:', errorText)
                        // Show specific error from server if available and safe, or generic
                        tg.showAlert(`Ошибка регистрации (${response.status}): ${errorText.substring(0, 100)}`)
                        throw new Error(`Registration failed: ${response.status} ${errorText}`)
                    }

                    const data = await response.json()
                    console.log('Registration successful:', data)

                    currentUser = data.user

                    localStorage.setItem('registered', 'true')
                    isRegistered = true

                    hideOnboarding()
                    // Initialize map with user location
                    if (position && position.coords) {
                        initMap([position.coords.longitude, position.coords.latitude])
                    } else {
                        initMap()
                    }

                    setupEventListeners()
                    loadPollutions()
                    updateProfileUI()

                    tg.HapticFeedback.notificationOccurred('success')
                    tg.showAlert('Регистрация успешна!')
                } catch (e) {
                    console.error('Registration network/server error:', e)
                    tg.showAlert(`Ошибка соединения: ${e.message}`)
                }
            },
            error => {
                console.error('Geolocation error:', error)
                tg.showAlert(
                    'Для регистрации необходим доступ к геолокации. Пожалуйста, разрешите доступ.',
                )
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0,
            },
        )
    } catch (outerError) {
        console.error('Critical registration error:', outerError);
        tg.showAlert('Критическая ошибка формы: ' + outerError.message);
    }
		},
		error => {
			console.error('Geolocation error:', error)
			tg.showAlert(
				'Для использования приложения необходимо разрешить доступ к геолокации',
			)
		},
		{
			enableHighAccuracy: true,
			timeout: 10000,
			maximumAge: 0,
		},
	)
}

	// Determine background color for map container and MapLibre canvas
    const bgColor = theme === 'dark' ? '#242f3e' : '#fcfcfc';

	map = new maplibregl.Map({
		container: 'map',
		style: style,
		center: initialCenter || [37.6173, 55.7558],
		zoom: 15,
		minZoom: 10,
		maxZoom: 18,
		pitch: 0,
		antialias: true,
		attributionControl: false,
		dragRotate: false,
		touchPitch: false,
		maxBounds: [
			[55.0, 36.0], 
			[74.0, 46.0], 
		],
        // CRITICAL: Set renderWorldCopies to false to avoid gray areas outside bounds
        renderWorldCopies: false,
        // Set background color of the GL context to match theme
        // (Note: MapLibre doesn't have direct bg color option, but we handle it via CSS and container)
	})

    // Force map container background immediately
    document.getElementById('map').style.backgroundColor = bgColor;

	// Disable rotation by touch (keep zoom)
	map.touchZoomRotate.disableRotation()

	// Set background color to match map to avoid gray flashes
	tg.setBackgroundColor(bgColor)

	// Add Geolocate Control
	const geolocate = new maplibregl.GeolocateControl({
		positionOptions: { enableHighAccuracy: true },
		trackUserLocation: true,
		showUserLocation: true,
	})
	map.addControl(geolocate)

	map.on('load', () => {
		// Trigger geolocation on load
		geolocate.trigger()
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
		const data = await response.json()
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
		`$${currentUser.balance.toFixed(2)}`
}

function setupEventListeners() {
	document.getElementById('profile-btn').addEventListener('click', openSidebar)
	document.getElementById('balance-btn').addEventListener('click', () => {
		tg.showAlert('Биржа в разработке')
	})
	document
		.getElementById('sidebar-close')
		.addEventListener('click', closeSidebar)
	document.getElementById('theme-toggle').addEventListener('click', toggleTheme)
	document.getElementById('geolocate-btn').addEventListener('click', geolocate)
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
		console.error('Load pollutions error:', e)
		tg.showAlert('Не удалось загрузить данные о загрязнениях')
	}
}

function showAddForm() {
	const center = map.getCenter()
	uploadedPhotos = []

	const content = document.getElementById('sheet-content')
	content.innerHTML = `
        <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 20px;">Новое загрязнение</h2>
        
        <div class="form-group">
            <label class="form-label">Уровень опасности</label>
            <div class="level-selector">
                <button class="level-btn active level-1" data-level="1">Низкий</button>
                <button class="level-btn level-2" data-level="2">Средний</button>
                <button class="level-btn level-3" data-level="3">Высокий</button>
            </div>
        </div>
        
        <div class="form-group">
            <label class="form-label">Описание</label>
            <textarea class="form-textarea" id="pollution-desc" rows="3" placeholder="Опишите проблему..."></textarea>
        </div>
        
        <div class="form-group">
            <label class="form-label">Фото</label>
            <div class="file-upload" id="upload-trigger">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin: 0 auto 8px; opacity: 0.5;">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                </svg>
                <p style="color: var(--text-secondary); font-size: 14px;">Нажмите для загрузки</p>
                <input type="file" id="photo-input" accept="image/*" multiple capture="environment">
            </div>
            <div id="photo-preview" class="photo-grid"></div>
        </div>
        
        <button class="btn btn-primary" style="width: 100%;" id="submit-pollution">
            Отправить
        </button>
    `

	openBottomSheet()

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

	document.getElementById('upload-trigger').addEventListener('click', () => {
		document.getElementById('photo-input').click()
	})

	document
		.getElementById('photo-input')
		.addEventListener('change', handlePhotoUpload)
	document.getElementById('submit-pollution').addEventListener('click', () => {
		submitPollution(center.lat, center.lng)
	})
}

async function handlePhotoUpload(event) {
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
			updatePhotoPreview()
			tg.HapticFeedback.notificationOccurred('success')
		} catch (e) {
			console.error('Upload error:', e)
			tg.showAlert('Ошибка загрузки фото')
		}
	}
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
		3: '#ef4444',
	}

	const levelNames = {
		1: 'Низкий',
		2: 'Средний',
		3: 'Высокий',
	}

	const reward = pollution.level

	content.innerHTML = `
        <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 16px;">Детали загрязнения</h2>
        
        <div style="background: ${levelColors[pollution.level]}20; padding: 10px 14px; border-radius: 12px; margin-bottom: 16px;">
            <span style="color: ${levelColors[pollution.level]}; font-weight: 600; font-size: 14px;">
                ${levelNames[pollution.level]} уровень
            </span>
        </div>
        
        ${pollution.description ? `<p style="margin-bottom: 16px; color: var(--text-secondary); font-size: 15px;">${pollution.description}</p>` : ''}
        
        ${
					pollution.photos && pollution.photos.length > 0 ?
						`
            <div class="photo-grid" style="margin-bottom: 16px;">
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
        
        <div style="background: var(--bg-secondary); padding: 14px; border-radius: 12px; margin-bottom: 16px;">
            <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 6px;">Вознаграждение</p>
            <p style="font-size: 24px; font-weight: 700; color: var(--primary);">$${reward}</p>
        </div>
        
        <button class="btn btn-primary" style="width: 100%;" id="clean-btn">
            Я убрал этот мусор
        </button>
    `

	openBottomSheet()

	document.getElementById('clean-btn').addEventListener('click', showCleanForm)
}

function showCleanForm() {
	uploadedPhotos = []
	const content = document.getElementById('sheet-content')

	content.innerHTML = `
        <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 20px;">Подтверждение очистки</h2>
        
        <div class="form-group">
            <label class="form-label">Фото после очистки</label>
            <div class="file-upload" id="upload-after-trigger">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin: 0 auto 8px; opacity: 0.5;">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                </svg>
                <p style="color: var(--text-secondary); font-size: 14px;">Загрузите фото чистого места</p>
                <input type="file" id="photo-input-after" accept="image/*" multiple capture="environment">
            </div>
            <div id="photo-preview-after" class="photo-grid"></div>
        </div>
        
        <div class="form-group">
            <label class="form-label">Комментарий (необязательно)</label>
            <textarea class="form-textarea" id="clean-comment" rows="2" placeholder="Добавьте комментарий..."></textarea>
        </div>
        
        <button class="btn btn-primary" style="width: 100%;" id="submit-clean">
            Подтвердить очистку
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

			tg.HapticFeedback.notificationOccurred('success')
			tg.showAlert(`Поздравляем! Вам начислено $${currentPollution.level}`)
		}
	} catch (e) {
		tg.showAlert('Ошибка при подтверждении')
	}
}
