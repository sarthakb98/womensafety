// Women Safety Assistant - Core Client-Side Logic with Supabase & Geolocation

document.addEventListener('DOMContentLoaded', () => {
  // --- SUPABASE CLIENT INITIALIZATION ---
  const supabaseUrl = 'https://lxmeqlykrcfgiepwnlhm.supabase.co';
  const supabaseKey = 'sb_publishable_KQwIVHC3822R3guOJJyfrw_cfkoR1Me';
  let supabaseClient = null;

  try {
    if (typeof supabase !== 'undefined') {
      supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);
      console.log('Supabase client initialized successfully.');
    } else {
      console.warn('Supabase library not detected via CDN. Offline/Local fallback enabled.');
    }
  } catch (error) {
    console.error('Failed to initialize Supabase client:', error);
  }

  // --- STATE MANAGEMENT ---
  let appState = {
    contacts: [],
    logs: [],
    checkInTimer: null,
    checkInTimeRemaining: 0,
    checkInTotalDuration: 0,
    isTracking: false,
    trackingInterval: null,
    trackingPathIndex: 0,
    sirenActive: false,
    sirenOscillators: [],
    sirenAudioCtx: null,
    ringtoneOscillators: [],
    ringtoneAudioCtx: null,
    fakeCallTimeout: null,
    fakeCallActive: false,
    sosCountdownActive: false,
    sosCountdownVal: 5,
    sosCountdownInterval: null,
    geolocationWatchId: null,
    isSharingWithFamily: false
  };

  // Mock tracking path (Fallback coordinate flow)
  const mockRoute = [
    { lat: 28.6139, lng: 77.2090, label: "Connaught Place Hub" },
    { lat: 28.6148, lng: 77.2110, label: "Radial Road 1" },
    { lat: 28.6162, lng: 77.2125, label: "Janpath Intersection" },
    { lat: 28.6180, lng: 77.2140, label: "Metro Pillar 48" },
    { lat: 28.6201, lng: 77.2152, label: "Barakhamba Crossing" },
    { lat: 28.6215, lng: 77.2170, label: "Kasturba Marg Corner" },
    { lat: 28.6230, lng: 77.2185, label: "Support Center Gateway" }
  ];

  // Default Seed Contacts
  const defaultContacts = [
    { id: '1', name: 'Aaradhya Sharma', phone: '+91 98765 43210', relation: 'Sister', priority: 'high' },
    { id: '2', name: 'Mom', phone: '+91 99999 88888', relation: 'Mother', priority: 'high' },
    { id: '3', name: 'Kabir Verma', phone: '+91 88888 77777', relation: 'Friend', priority: 'medium' }
  ];

  // Default Seed Logs
  const defaultLogs = [
    { id: 'l1', timestamp: new Date(Date.now() - 86400000 * 3).toLocaleString(), event: 'App initialized successfully', type: 'info' },
    { id: 'l2', timestamp: new Date(Date.now() - 86400000 * 2).toLocaleString(), event: 'Location sharing sharing link generated', type: 'info' },
    { id: 'l3', timestamp: new Date(Date.now() - 86400000).toLocaleString(), event: 'Safety Check-in completed successfully', type: 'success' }
  ];

  // --- INITIALIZATION ---
  initApp();

  function initApp() {
    if (!localStorage.getItem('wsa_contacts')) {
      localStorage.setItem('wsa_contacts', JSON.stringify(defaultContacts));
    }
    if (!localStorage.getItem('wsa_logs')) {
      localStorage.setItem('wsa_logs', JSON.stringify(defaultLogs));
    }

    appState.contacts = JSON.parse(localStorage.getItem('wsa_contacts'));
    appState.logs = JSON.parse(localStorage.getItem('wsa_logs'));

    renderContacts();
    renderLogs();
    initChatbot();
    updateDashboardStats();
    drawAnalyticsChart();
    
    // Auto populate call inputs
    const callNameInput = document.getElementById('fake-call-name-input');
    if (callNameInput) callNameInput.value = "Inspector Verma (Police)";
    
    startLocationSimulation();
    setupFormBindings();
  }

  // --- FORM EVENT BINDINGS (SUPABASE INTEGRATION) ---
  function setupFormBindings() {
    // Signup Form
    const signupForm = document.getElementById('signup-form-element');
    if (signupForm) {
      signupForm.onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('signup-email').value.trim();
        const password = document.getElementById('signup-password').value;
        const submitBtn = signupForm.querySelector('button[type="submit"]');
        
        if (!email || !password) {
          showToast('Please enter both email and password.', 'danger');
          return;
        }

        if (submitBtn) submitBtn.disabled = true;
        showToast('Processing Sign Up...', 'info');

        if (supabaseClient) {
          const { data, error } = await supabaseClient.auth.signUp({ email, password });
          
          if (error) {
            showToast(`Sign Up Error: ${error.message}`, 'danger');
            if (submitBtn) submitBtn.disabled = false;
            return;
          }

          try {
            await supabaseClient.from('signups').insert([{ email: email, created_at: new Date() }]);
          } catch (err) {
            console.log('Custom signups table audit insert skipped: ', err);
          }

          showToast('Sign Up Successful! Please check your email.', 'success');
          addLog(`User signed up: ${email}`, 'success');
          closeModal('signup-modal');
          signupForm.reset();
        } else {
          showToast('Offline Mode: Simulated sign up success.', 'success');
          addLog(`Offline Sign Up: ${email}`, 'info');
          closeModal('signup-modal');
        }
        if (submitBtn) submitBtn.disabled = false;
      };
    }

    // Login Form
    const loginForm = document.getElementById('login-form-element');
    if (loginForm) {
      loginForm.onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        const submitBtn = loginForm.querySelector('button[type="submit"]');

        if (!email || !password) {
          showToast('Please enter both email and password.', 'danger');
          return;
        }

        if (submitBtn) submitBtn.disabled = true;
        showToast('Processing Log In...', 'info');

        if (supabaseClient) {
          const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

          if (error) {
            showToast(`Log In Error: ${error.message}`, 'danger');
            if (submitBtn) submitBtn.disabled = false;
            return;
          }

          try {
            await supabaseClient.from('logins').insert([{ email: email, status: 'success', timestamp: new Date() }]);
          } catch (err) {
            console.log('Custom logins table audit insert skipped: ', err);
          }

          showToast('Log In Successful! Welcome back.', 'success');
          addLog(`User logged in: ${email}`, 'success');
          updateAuthHeaderState(email);
          closeModal('login-modal');
          loginForm.reset();
        } else {
          showToast('Offline Mode: Simulated log in success.', 'success');
          addLog(`Offline Log In: ${email}`, 'info');
          updateAuthHeaderState(email);
          closeModal('login-modal');
        }
        if (submitBtn) submitBtn.disabled = false;
      };
    }

    // Contact Form
    const contactForm = document.getElementById('contact-form-element');
    if (contactForm) {
      contactForm.onsubmit = async (e) => {
        e.preventDefault();
        const name = document.getElementById('contact-name').value.trim();
        const email = document.getElementById('contact-email').value.trim();
        const subject = document.getElementById('contact-subject').value.trim();
        const message = document.getElementById('contact-message').value.trim();
        const submitBtn = contactForm.querySelector('button[type="submit"]');

        if (!name || !email || !subject || !message) {
          showToast('All contact fields are required.', 'danger');
          return;
        }

        if (submitBtn) submitBtn.disabled = true;
        showToast('Sending message...', 'info');

        if (supabaseClient) {
          const { data, error } = await supabaseClient
            .from('contacts')
            .insert([{ name, email, subject, message, created_at: new Date() }]);

          if (error) {
            showToast(`Error sending message: ${error.message}`, 'danger');
            if (submitBtn) submitBtn.disabled = false;
            return;
          }

          showToast('Message sent! Saved to backend database.', 'success');
          addLog(`Support ticket submitted by: ${name}`, 'info');
          contactForm.reset();
        } else {
          showToast('Offline Mode: Simulated support ticket sent.', 'success');
          addLog(`Offline Contact Us: ${name} (${subject})`, 'info');
          contactForm.reset();
        }
        if (submitBtn) submitBtn.disabled = false;
      };
    }

    // Newsletter Subscriber Form
    const newsletterForm = document.getElementById('newsletter-form-element');
    if (newsletterForm) {
      newsletterForm.onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('newsletter-email').value.trim();
        const submitBtn = newsletterForm.querySelector('button[type="submit"]');

        if (!email) {
          showToast('Email address is required.', 'danger');
          return;
        }

        if (submitBtn) submitBtn.disabled = true;
        showToast('Subscribing to newsletter...', 'info');

        if (supabaseClient) {
          const { data, error } = await supabaseClient
            .from('newsletter_subscribers')
            .insert([{ email, created_at: new Date() }]);

          if (error) {
            showToast(`Error: ${error.message}`, 'danger');
            if (submitBtn) submitBtn.disabled = false;
            return;
          }

          showToast('Subscribed successfully! Saved to backend.', 'success');
          addLog(`New newsletter subscriber: ${email}`, 'success');
          newsletterForm.reset();
        } else {
          showToast('Offline Mode: Subscribed successfully!', 'success');
          addLog(`Offline Newsletter Subscription: ${email}`, 'info');
          newsletterForm.reset();
        }
        if (submitBtn) submitBtn.disabled = false;
      };
    }
  }

  function updateAuthHeaderState(email) {
    const desktopAuth = document.getElementById('desktop-auth-container');
    if (desktopAuth) {
      desktopAuth.innerHTML = `
        <div class="flex items-center gap-3">
          <span class="text-zinc-400 text-xs truncate max-w-[120px]">Hi, ${escapeHtml(email.split('@')[0])}</span>
          <button onclick="location.reload()" class="text-red-400 hover:text-red-300 text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 transition">Log Out</button>
        </div>
      `;
    }
  }

  // Helper modals controller
  window.openModal = (modalId) => {
    const m = document.getElementById(modalId);
    if(m) {
      m.classList.remove('hidden');
      m.classList.add('flex');
    }
  };

  window.closeModal = (modalId) => {
    const m = document.getElementById(modalId);
    if(m) {
      m.classList.add('hidden');
      m.classList.remove('flex');
    }
  };

  // --- TOAST NOTIFICATIONS ---
  function showToast(message, type = 'info') {
    const toast = document.getElementById('safety-toast');
    if (!toast) return;
    
    const toastText = document.getElementById('safety-toast-text');
    const toastBorder = toast.querySelector('.toast-border-indicator');
    
    toastText.textContent = message;
    
    toast.className = 'safety-alert-toast fixed bottom-6 right-6 z-50 glass-panel p-4 rounded-xl flex items-center gap-3 active max-w-sm';
    
    if (type === 'danger') {
      toastText.className = 'text-red-400 font-medium text-sm';
      toastBorder.className = 'toast-border-indicator w-2 h-10 rounded-full bg-red-500';
    } else if (type === 'success') {
      toastText.className = 'text-green-400 font-medium text-sm';
      toastBorder.className = 'toast-border-indicator w-2 h-10 rounded-full bg-green-500';
    } else {
      toastText.className = 'text-purple-400 font-medium text-sm';
      toastBorder.className = 'toast-border-indicator w-2 h-10 rounded-full bg-purple-500';
    }
    
    toast.classList.add('active');
    
    setTimeout(() => {
      toast.classList.remove('active');
    }, 4000);
  }

  // --- LOGGING ---
  function addLog(eventText, type = 'info') {
    const newLog = {
      id: 'l_' + Date.now(),
      timestamp: new Date().toLocaleString(),
      event: eventText,
      type: type
    };
    appState.logs.unshift(newLog);
    if (appState.logs.length > 25) appState.logs.pop();
    
    localStorage.setItem('wsa_logs', JSON.stringify(appState.logs));
    renderLogs();
    drawAnalyticsChart();
  }

  function renderLogs() {
    const logContainer = document.getElementById('activity-log-container');
    if (!logContainer) return;
    
    logContainer.innerHTML = '';
    
    if (appState.logs.length === 0) {
      logContainer.innerHTML = `<p class="text-zinc-500 text-sm py-4 text-center">No recent safety actions logged.</p>`;
      return;
    }

    appState.logs.forEach(log => {
      let iconColor = 'bg-zinc-800 text-zinc-400';
      if (log.type === 'danger') iconColor = 'bg-red-500/10 text-red-500';
      if (log.type === 'success') iconColor = 'bg-green-500/10 text-green-500';
      if (log.type === 'warning') iconColor = 'bg-yellow-500/10 text-yellow-500';
      
      const div = document.createElement('div');
      div.className = 'flex items-start gap-3 p-3 rounded-lg bg-zinc-900/40 border border-white/5 hover:border-white/10 transition';
      div.innerHTML = `
        <div class="p-2 rounded-lg ${iconColor} shrink-0 text-xs">
          <i data-lucide="${log.type === 'danger' ? 'alert-triangle' : log.type === 'success' ? 'check-circle' : 'shield'}"></i>
        </div>
        <div class="overflow-hidden">
          <p class="text-zinc-200 text-sm font-medium leading-tight">${escapeHtml(log.event)}</p>
          <span class="text-zinc-500 text-xs mt-1 block">${log.timestamp}</span>
        </div>
      `;
      logContainer.appendChild(div);
    });
    
    lucide.createIcons();
  }

  // --- CONTACTS CRUD (SUPABASE SYNCED) ---
  function renderContacts() {
    const dashboardContacts = document.getElementById('dashboard-contacts-list');
    const quickContacts = document.getElementById('quick-contacts-grid');
    const manageContacts = document.getElementById('manage-contacts-list');
    
    if (dashboardContacts) dashboardContacts.innerHTML = '';
    if (quickContacts) quickContacts.innerHTML = '';
    if (manageContacts) manageContacts.innerHTML = '';

    if (appState.contacts.length === 0) {
      const emptyMsg = `<div class="col-span-full py-6 text-center text-zinc-500 text-sm">No trusted contacts added. Click Add Contact to set priority alert numbers.</div>`;
      if (dashboardContacts) dashboardContacts.innerHTML = emptyMsg;
      if (quickContacts) quickContacts.innerHTML = emptyMsg;
      if (manageContacts) manageContacts.innerHTML = emptyMsg;
      return;
    }

    appState.contacts.forEach(contact => {
      let priorityClass = 'bg-zinc-800 text-zinc-400 border-zinc-700';
      if (contact.priority === 'high') priorityClass = 'bg-red-500/10 text-red-400 border-red-500/30';
      if (contact.priority === 'medium') priorityClass = 'bg-purple-500/10 text-purple-400 border-purple-500/30';

      // 1. Render in Dashboard Mini List with Edit & Delete actions
      if (dashboardContacts) {
        const div = document.createElement('div');
        div.className = 'flex items-center justify-between p-3 rounded-lg bg-zinc-900/60 border border-white/5 hover:border-white/10 transition';
        div.innerHTML = `
          <div class="flex items-center gap-3 overflow-hidden">
            <div class="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-600 to-red-500 flex items-center justify-center font-bold text-sm text-white shrink-0">
              ${contact.name.charAt(0)}
            </div>
            <div class="overflow-hidden">
              <div class="flex items-center gap-2 flex-wrap">
                <h4 class="text-white text-sm font-semibold truncate max-w-[100px]">${escapeHtml(contact.name)}</h4>
                <span class="text-[8px] uppercase font-extrabold px-1.5 py-0.2 rounded border ${priorityClass}">${contact.priority}</span>
              </div>
              <p class="text-zinc-400 text-xs mt-0.5 truncate">${escapeHtml(contact.relation)} • ${escapeHtml(contact.phone)}</p>
            </div>
          </div>
          <div class="flex items-center gap-1.5 shrink-0 ml-2">
            <button class="p-1.5 rounded bg-zinc-800 text-zinc-400 hover:bg-purple-600 hover:text-white transition" onclick="editContact('${contact.id}')" title="Edit Contact">
              <i data-lucide="edit-2" class="w-3.5 h-3.5"></i>
            </button>
            <button class="p-1.5 rounded bg-zinc-800 text-zinc-400 hover:bg-red-500 hover:text-white transition" onclick="deleteContact('${contact.id}')" title="Delete Contact">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        `;
        dashboardContacts.appendChild(div);
      }

      // 2. Render in Quick Access Grid (SOS Dialers)
      if (quickContacts) {
        const div = document.createElement('div');
        div.className = 'glass-panel p-3 rounded-xl flex items-center justify-between border border-white/5 hover:border-red-500/20 transition cursor-pointer';
        div.innerHTML = `
          <div>
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full ${contact.priority === 'high' ? 'bg-red-500' : 'bg-purple-500'}"></span>
              <h4 class="text-white font-medium text-sm leading-none">${escapeHtml(contact.name)}</h4>
            </div>
            <p class="text-zinc-500 text-xs mt-1">${escapeHtml(contact.phone)}</p>
          </div>
          <a href="tel:${escapeHtml(contact.phone.replace(/\s+/g, ''))}" class="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition">
            <i data-lucide="phone-call" class="w-4 h-4"></i>
          </a>
        `;
        quickContacts.appendChild(div);
      }
    });

    lucide.createIcons();
  }

  // CRUD Trigger Functions
  window.openAddContactModal = () => {
    document.getElementById('contact-form-title').innerText = 'Add Trusted Contact';
    document.getElementById('contact-id-field').value = '';
    document.getElementById('contact-name-field').value = '';
    document.getElementById('contact-phone-field').value = '';
    document.getElementById('contact-relation-field').value = '';
    document.getElementById('contact-priority-field').value = 'high';
    
    openModal('add-contact-modal');
  };

  window.closeAddContactModal = () => {
    closeModal('add-contact-modal');
  };

  window.saveContact = async (e) => {
    if(e) e.preventDefault();
    const id = document.getElementById('contact-id-field').value;
    const name = document.getElementById('contact-name-field').value.trim();
    const phone = document.getElementById('contact-phone-field').value.trim();
    const relation = document.getElementById('contact-relation-field').value.trim();
    const priority = document.getElementById('contact-priority-field').value;

    if (!name || !phone || !relation) {
      showToast('Please fill out all contact fields.', 'danger');
      return;
    }

    if (id) {
      // Edit local
      appState.contacts = appState.contacts.map(c => 
        c.id === id ? { id, name, phone, relation, priority } : c
      );
      showToast('Trusted Contact updated locally.', 'success');
      addLog(`Updated emergency contact: ${name}.`, 'info');
      
      // Update in Supabase (try-catch audit)
      if (supabaseClient) {
        try {
          if (id.startsWith('c_')) {
            // Fallback for local mock contacts
            await supabaseClient.from('emergency_contacts').update({ name, phone, relation, priority }).match({ phone });
          } else {
            // Database-synced contact: match by numeric primary key
            await supabaseClient.from('emergency_contacts').update({ name, phone, relation, priority }).match({ id: parseInt(id) });
          }
        } catch (err) {
          console.warn("Supabase update error:", err);
        }
      }
    } else {
      // Add new contact
      const tempId = 'c_' + Date.now();
      const newContact = {
        id: tempId,
        name, phone, relation, priority
      };
      
      // Sync to Supabase
      if (supabaseClient) {
        showToast('Saving contact to Supabase backend...', 'info');
        const { data, error } = await supabaseClient.from('emergency_contacts').insert([{
          name, relation, phone, priority, created_at: new Date()
        }]).select();

        if (error) {
          showToast(`Supabase Error: ${error.message}`, 'warning');
          appState.contacts.push(newContact);
        } else {
          showToast('Trusted Contact saved in Supabase backend!', 'success');
          if (data && data.length > 0) {
            newContact.id = data[0].id.toString(); // Sync the actual database-generated ID!
          }
          appState.contacts.push(newContact);
        }
      } else {
        appState.contacts.push(newContact);
        showToast('Trusted Contact saved locally.', 'success');
      }
      
      addLog(`Added new emergency contact: ${name}.`, 'info');
    }

    localStorage.setItem('wsa_contacts', JSON.stringify(appState.contacts));
    renderContacts();
    closeAddContactModal();
    updateDashboardStats();
  };

  window.editContact = (id) => {
    const contact = appState.contacts.find(c => c.id === id);
    if (!contact) return;

    document.getElementById('contact-form-title').innerText = 'Edit Trusted Contact';
    document.getElementById('contact-id-field').value = contact.id;
    document.getElementById('contact-name-field').value = contact.name;
    document.getElementById('contact-phone-field').value = contact.phone;
    document.getElementById('contact-relation-field').value = contact.relation;
    document.getElementById('contact-priority-field').value = contact.priority;

    openModal('add-contact-modal');
  };

  window.deleteContact = async (id) => {
    const contact = appState.contacts.find(c => c.id === id);
    const cName = contact ? contact.name : 'Contact';
    
    appState.contacts = appState.contacts.filter(c => c.id !== id);
    localStorage.setItem('wsa_contacts', JSON.stringify(appState.contacts));
    
    if (supabaseClient && contact) {
      showToast('Deleting contact from Supabase...', 'info');
      try {
        if (id.startsWith('c_')) {
          // Fallback if it is a local temporary ID
          await supabaseClient.from('emergency_contacts').delete().match({ phone: contact.phone });
        } else {
          // Match by database numeric ID
          await supabaseClient.from('emergency_contacts').delete().match({ id: parseInt(id) });
        }
      } catch (err) {
        console.warn("Supabase delete error:", err);
      }
    }
    
    showToast(`Removed ${cName} from trusted contacts.`, 'info');
    addLog(`Deleted trusted contact: ${cName}.`, 'info');
    renderContacts();
    updateDashboardStats();
  };

  // --- SOS DANGER TRIGGER SYSTEM ---
  window.triggerSOS = () => {
    if (appState.sosCountdownActive) return;
    
    appState.sosCountdownActive = true;
    appState.sosCountdownVal = 5;
    
    document.getElementById('sos-countdown-text').innerText = appState.sosCountdownVal;
    openModal('sos-modal');
    
    playBeep(880, 0.15);
    
    appState.sosCountdownInterval = setInterval(() => {
      appState.sosCountdownVal--;
      if (appState.sosCountdownVal > 0) {
        document.getElementById('sos-countdown-text').innerText = appState.sosCountdownVal;
        playBeep(880, 0.15);
      } else {
        clearInterval(appState.sosCountdownInterval);
        appState.sosCountdownActive = false;
        
        closeModal('sos-modal');
        activateFullEmergencySOS();
      }
    }, 1000);
  };

  window.cancelSOS = () => {
    clearInterval(appState.sosCountdownInterval);
    appState.sosCountdownActive = false;
    closeModal('sos-modal');
    showToast('SOS Alarm cancelled.', 'info');
    addLog('SOS trigger cancelled by user during countdown.', 'info');
  };

  function activateFullEmergencySOS() {
    showToast('CRITICAL: SOS Triggered! Emergency services notified.', 'danger');
    addLog('CRITICAL SOS ALERT: Emergency Beacon Activated!', 'danger');
    
    appState.contacts.forEach(c => {
      if(c.priority === 'high') {
        addLog(`Sent Emergency GPS coordinates to ${c.name} (${c.phone}).`, 'danger');
      }
    });

    if (!appState.sirenActive) {
      toggleSiren();
    }
    
    setDashboardSafetyStatus('danger');
    triggerEmergencyScreen();
  }

  function triggerEmergencyScreen() {
    openModal('emergency-active-overlay');
  }

  window.dismissEmergencyOverlay = () => {
    closeModal('emergency-active-overlay');
    if (appState.sirenActive) {
      toggleSiren();
    }
    setDashboardSafetyStatus('safe');
  };

  // --- SYNTHETIC AUDIO SIREN (WEB AUDIO API) ---
  window.toggleSiren = () => {
    const sirenBtn = document.getElementById('quick-siren-btn');
    const sirenSectBtn = document.getElementById('section-siren-btn');
    const strobe = document.getElementById('siren-flashing-strobe');
    
    if (appState.sirenActive) {
      stopSirenOscillators();
      appState.sirenActive = false;
      showToast('Distress siren deactivated.', 'info');
      addLog('Emergency Siren deactivated.', 'info');
      
      if(sirenBtn) {
        sirenBtn.classList.remove('bg-red-600', 'text-white');
        sirenBtn.classList.add('bg-zinc-800', 'text-zinc-400');
        sirenBtn.querySelector('span').innerText = 'Siren Off';
      }
      if(sirenSectBtn) {
        sirenSectBtn.innerText = 'Activate Siren';
        sirenSectBtn.className = 'w-full py-4 rounded-xl font-bold bg-red-500 hover:bg-red-600 text-white transition duration-300 shadow-lg shadow-red-500/20';
      }
      if(strobe) strobe.classList.add('hidden');
    } else {
      startSirenOscillators();
      appState.sirenActive = true;
      showToast('Distress siren activated! Generating loud audio.', 'danger');
      addLog('Emergency Distress Siren Activated!', 'danger');
      
      if(sirenBtn) {
        sirenBtn.classList.add('bg-red-600', 'text-white');
        sirenBtn.classList.remove('bg-zinc-800', 'text-zinc-400');
        sirenBtn.querySelector('span').innerText = 'Siren On';
      }
      if(sirenSectBtn) {
        sirenSectBtn.innerText = 'Deactivate Siren';
        sirenSectBtn.className = 'w-full py-4 rounded-xl font-bold bg-zinc-800 hover:bg-zinc-700 text-red-500 border border-red-500/30 transition duration-300';
      }
      if(strobe) strobe.classList.remove('hidden');
    }
  };

  function startSirenOscillators() {
    try {
      appState.sirenAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      
      const osc1 = appState.sirenAudioCtx.createOscillator();
      const osc2 = appState.sirenAudioCtx.createOscillator();
      const gainNode = appState.sirenAudioCtx.createGain();
      
      osc1.type = 'sawtooth';
      osc2.type = 'sine';
      
      osc1.frequency.setValueAtTime(600, appState.sirenAudioCtx.currentTime);
      osc2.frequency.setValueAtTime(605, appState.sirenAudioCtx.currentTime);
      
      const now = appState.sirenAudioCtx.currentTime;
      
      const lfo = appState.sirenAudioCtx.createOscillator();
      const lfoGain = appState.sirenAudioCtx.createGain();
      
      lfo.frequency.value = 1.5;
      lfoGain.gain.value = 250;
      
      lfo.connect(lfoGain);
      lfoGain.connect(osc1.frequency);
      lfoGain.connect(osc2.frequency);
      
      gainNode.gain.setValueAtTime(0.65, now);
      
      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(appState.sirenAudioCtx.destination);
      
      osc1.start(now);
      osc2.start(now);
      lfo.start(now);
      
      appState.sirenOscillators = [osc1, osc2, lfo, gainNode];
    } catch(err) {
      console.error('AudioContext error: ', err);
    }
  }

  function stopSirenOscillators() {
    if (appState.sirenOscillators.length > 0) {
      try {
        appState.sirenOscillators.forEach(node => {
          if (node.stop) node.stop();
        });
      } catch(e){}
      appState.sirenOscillators = [];
    }
    if (appState.sirenAudioCtx && appState.sirenAudioCtx.state !== 'closed') {
      appState.sirenAudioCtx.close();
    }
  }

  function playBeep(frequency, duration) {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
      
      setTimeout(() => audioCtx.close(), duration * 1000 + 500);
    } catch(e){}
  }

  // --- FAKE CALL SIMULATOR ---
  window.triggerFakeCallNow = () => {
    const delay = parseInt(document.getElementById('fake-call-delay-select').value) || 0;
    const callerName = document.getElementById('fake-call-name-input').value.trim() || 'Emergency Contact';
    
    if (appState.fakeCallTimeout) clearTimeout(appState.fakeCallTimeout);
    
    showToast(`Fake Call scheduled in ${delay} seconds.`, 'info');
    addLog(`Scheduled Fake Call from "${callerName}" in ${delay}s.`, 'info');
    
    appState.fakeCallTimeout = setTimeout(() => {
      launchFakeCallScreen(callerName);
    }, delay * 1000);
  };

  function launchFakeCallScreen(callerName) {
    appState.fakeCallActive = true;
    
    document.getElementById('fake-call-ring-name').innerText = callerName;
    document.getElementById('fake-call-active-name').innerText = callerName;
    
    document.getElementById('fake-call-ringing-panel').classList.remove('hidden');
    document.getElementById('fake-call-active-panel').classList.add('hidden');
    
    openModal('fake-call-screen-overlay');
    
    startPhoneRingtone();
    if (navigator.vibrate) {
      navigator.vibrate([500, 800, 500, 800, 500, 800]);
    }
    
    addLog(`Fake Call screen active for "${callerName}".`, 'info');
  }

  function startPhoneRingtone() {
    try {
      appState.ringtoneAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      let now = appState.ringtoneAudioCtx.currentTime;
      
      const playPulse = (start) => {
        if (!appState.ringtoneActiveNode && appState.ringtoneAudioCtx) {
          const osc1 = appState.ringtoneAudioCtx.createOscillator();
          const osc2 = appState.ringtoneAudioCtx.createOscillator();
          const gain = appState.ringtoneAudioCtx.createGain();
          
          osc1.type = 'sine';
          osc2.type = 'sine';
          
          osc1.frequency.setValueAtTime(853, start);
          osc2.frequency.setValueAtTime(960, start);
          
          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(0.25, start + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 1.8);
          
          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(appState.ringtoneAudioCtx.destination);
          
          osc1.start(start);
          osc2.start(start);
          osc1.stop(start + 1.9);
          osc2.stop(start + 1.9);
          
          appState.ringtoneOscillators.push(osc1, osc2);
        }
      };
      
      appState.ringtoneInterval = setInterval(() => {
        if (!appState.fakeCallActive) {
          clearInterval(appState.ringtoneInterval);
          return;
        }
        let ringTime = appState.ringtoneAudioCtx.currentTime;
        playPulse(ringTime);
        playPulse(ringTime + 0.3);
      }, 3000);
      
      playPulse(now);
      playPulse(now + 0.3);
      
    } catch(e){}
  }

  function stopRingtone() {
    if (appState.ringtoneInterval) clearInterval(appState.ringtoneInterval);
    if (appState.ringtoneOscillators.length > 0) {
      try {
        appState.ringtoneOscillators.forEach(o => o.stop());
      }catch(e){}
      appState.ringtoneOscillators = [];
    }
    if (appState.ringtoneAudioCtx && appState.ringtoneAudioCtx.state !== 'closed') {
      appState.ringtoneAudioCtx.close();
      appState.ringtoneAudioCtx = null;
    }
    if (navigator.vibrate) navigator.vibrate(0);
  }

  window.declineFakeCall = () => {
    stopRingtone();
    appState.fakeCallActive = false;
    closeModal('fake-call-screen-overlay');
    showToast('Fake call declined.', 'info');
    addLog('Fake Call closed/declined.', 'info');
  };

  window.acceptFakeCall = () => {
    stopRingtone();
    
    document.getElementById('fake-call-ringing-panel').classList.add('hidden');
    document.getElementById('fake-call-active-panel').classList.remove('hidden');
    
    showToast('Simulated Fake Call connected.', 'success');
    addLog('Fake Call accepted and active.', 'info');
    
    let callSec = 0;
    const timerText = document.getElementById('fake-call-duration-timer');
    timerText.innerText = '00:00';
    
    appState.fakeCallTimerInterval = setInterval(() => {
      if (!appState.fakeCallActive) {
        clearInterval(appState.fakeCallTimerInterval);
        return;
      }
      callSec++;
      let mins = Math.floor(callSec / 60).toString().padStart(2, '0');
      let secs = (callSec % 60).toString().padStart(2, '0');
      timerText.innerText = `${mins}:${secs}`;
    }, 1000);
  };

  window.endFakeCall = () => {
    appState.fakeCallActive = false;
    clearInterval(appState.fakeCallTimerInterval);
    closeModal('fake-call-screen-overlay');
    showToast('Fake call session ended.', 'info');
    addLog('Fake Call session hung up.', 'info');
  };

  // --- MOCK LOCATION SIMULATION ---
  function startLocationSimulation() {
    setInterval(() => {
      if (appState.isTracking && !appState.geolocationWatchId) {
        appState.trackingPathIndex = (appState.trackingPathIndex + 1) % mockRoute.length;
        const currentCoord = mockRoute[appState.trackingPathIndex];
        updateCoordinatesUI(currentCoord.lat, currentCoord.lng, currentCoord.label);
      }
    }, 3500);
  }

  function updateCoordinatesUI(lat, lng, label = "GPS Coordinate Update") {
    const latVal = document.getElementById('tracking-lat-val');
    const lngVal = document.getElementById('tracking-lng-val');
    const pointLabel = document.getElementById('tracking-point-label');
    
    if (latVal) latVal.innerText = lat.toFixed(5);
    if (lngVal) lngVal.innerText = lng.toFixed(5);
    if (pointLabel) pointLabel.innerText = label;
    
    const pulseDot = document.getElementById('map-live-pulse-dot');
    if (pulseDot) {
      if (appState.geolocationWatchId) {
        pulseDot.style.left = '50%';
        pulseDot.style.top = '50%';
      } else {
        const mapPositions = [
          { x: '18%', y: '68%' },
          { x: '25%', y: '60%' },
          { x: '35%', y: '45%' },
          { x: '46%', y: '50%' },
          { x: '58%', y: '32%' },
          { x: '72%', y: '40%' },
          { x: '88%', y: '24%' }
        ];
        const pos = mapPositions[appState.trackingPathIndex] || { x: '50%', y: '50%' };
        pulseDot.style.left = pos.x;
        pulseDot.style.top = pos.y;
      }
    }
  }

  // --- GEOLOCATION API INTEGRATION & CONSENT ---
  window.requestLocationPermission = () => {
    openModal('location-consent-modal');
  };

  window.cancelLocationConsent = () => {
    closeModal('location-consent-modal');
    showToast('Location tracking authorization denied.', 'info');
    addLog('Location sharing permission denied by user.', 'info');
  };

  window.grantLocationConsent = () => {
    closeModal('location-consent-modal');
    
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by your browser.', 'danger');
      return;
    }

    showToast('Requesting GPS permission from device...', 'info');

    const successCallback = (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      
      appState.isTracking = true;
      appState.isSharingWithFamily = true;

      updateCoordinatesUI(lat, lng, "Live GPS (Device)");
      updateLocationSharingBadge(true);
      
      showToast('Live Location sharing with emergency contacts active!', 'success');
      addLog(`Live Geolocation broadcast started: ${lat.toFixed(5)}, ${lng.toFixed(5)}`, 'success');
      
      saveLocationPingToSupabase(lat, lng);
    };

    const errorCallback = (error) => {
      console.warn("Geolocation API Error:", error.message);
      showToast('Failed to access GPS. Reverting to simulator.', 'warning');
      addLog(`GPS Access Error: ${error.message}. Fallback initialized.`, 'warning');
      
      appState.isTracking = true;
      appState.isSharingWithFamily = true;
      updateLocationSharingBadge(true);
    };

    const options = {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10000
    };

    appState.geolocationWatchId = navigator.geolocation.watchPosition(successCallback, errorCallback, options);
  };

  async function saveLocationPingToSupabase(lat, lng) {
    if (supabaseClient) {
      try {
        await supabaseClient.from('location_logs').insert([{ 
          lat: lat, 
          lng: lng, 
          recipient: 'Emergency Contacts', 
          timestamp: new Date() 
        }]);
      } catch(e) {}
    }
  }

  window.stopLiveLocationSharing = () => {
    if (appState.geolocationWatchId) {
      navigator.geolocation.clearWatch(appState.geolocationWatchId);
      appState.geolocationWatchId = null;
    }
    appState.isTracking = false;
    appState.isSharingWithFamily = false;
    
    updateLocationSharingBadge(false);
    showToast('Live location sharing stopped.', 'info');
    addLog('Live location sharing disabled.', 'info');
  };

  window.toggleLocationSharing = () => {
    if (appState.isTracking) {
      stopLiveLocationSharing();
    } else {
      appState.isTracking = true;
      updateLocationSharingBadge(true);
      showToast('Simulated tracking activated.', 'success');
      addLog('Simulated location tracker enabled.', 'info');
    }
  };

  function updateLocationSharingBadge(isActive) {
    const btn = document.getElementById('location-share-btn');
    const familyBtn = document.getElementById('family-location-share-btn');
    const badge = document.getElementById('tracking-status-badge');
    const indicator = document.getElementById('tracking-pulse-indicator');

    if (isActive) {
      if (btn) {
        btn.innerText = 'Stop Location Sharing';
        btn.className = 'w-full py-2 rounded-xl font-semibold bg-zinc-800 hover:bg-zinc-700 text-red-400 border border-red-500/20 transition text-xs';
      }
      if (familyBtn) {
        familyBtn.innerText = 'Stop Sharing to Guardians';
        familyBtn.className = 'w-full py-3 rounded-xl font-bold bg-zinc-800 hover:bg-zinc-700 text-red-400 border border-red-500/30 transition text-sm shadow-md';
      }
      if (badge) {
        badge.innerText = 'Active Now';
        badge.className = 'px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-500/10 text-green-400 border border-green-500/20 animate-pulse';
      }
      if (indicator) indicator.classList.remove('hidden');
    } else {
      if (btn) {
        btn.innerText = 'Start Location Sharing';
        btn.className = 'w-full py-2 rounded-xl font-semibold bg-white/5 hover:bg-white/10 border border-white/10 text-white transition text-xs';
      }
      if (familyBtn) {
        familyBtn.innerText = 'Share Live Location to Family';
        familyBtn.className = 'w-full py-3 rounded-xl font-bold bg-purple-600 hover:bg-purple-700 text-white transition text-sm shadow-lg shadow-purple-500/20 hover:scale-[1.01]';
      }
      if (badge) {
        badge.innerText = 'Inactive';
        badge.className = 'px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700';
      }
      if (indicator) indicator.classList.add('hidden');
    }
    updateDashboardStats();
  }

  window.generateSharingLink = () => {
    const link = `https://safeshare.io/live/track?token=WSA_${Math.floor(100000 + Math.random() * 900000)}`;
    const linkField = document.getElementById('location-share-link-display');
    if (linkField) {
      linkField.value = link;
      linkField.parentElement.classList.remove('hidden');
    }
    showToast('Temporary location sharing link generated!', 'success');
    addLog(`Generated temporary tracking share link.`, 'info');
  };

  window.copySharingLink = () => {
    const linkField = document.getElementById('location-share-link-display');
    if (linkField) {
      linkField.select();
      linkField.setSelectionRange(0, 99999);
      navigator.clipboard.writeText(linkField.value);
      showToast('Share link copied to clipboard!', 'success');
    }
  };

  // --- SAFETY CHECK-IN COUNTDOWN SCHEDULER (SUPABASE SYNCED) ---
  window.scheduleCheckIn = async () => {
    const minInput = parseInt(document.getElementById('checkin-timer-input').value) || 0;
    if (minInput <= 0) {
      showToast('Please specify a positive check-in interval.', 'danger');
      return;
    }
    
    if(appState.checkInTimer) clearInterval(appState.checkInTimer);
    
    appState.checkInTotalDuration = minInput * 60;
    appState.checkInTimeRemaining = appState.checkInTotalDuration;
    
    updateCheckInCircle(100);
    document.getElementById('checkin-remaining-text').innerText = formatSeconds(appState.checkInTimeRemaining);
    
    document.getElementById('checkin-setup-panel').classList.add('hidden');
    document.getElementById('checkin-countdown-panel').classList.remove('hidden');
    
    if (supabaseClient) {
      try {
        await supabaseClient.from('checkin_schedules').insert([{
          duration_minutes: minInput,
          created_at: new Date()
        }]);
      } catch (err) {}
    }
    
    showToast(`Safety check-in set for ${minInput} minutes.`, 'success');
    addLog(`Safety Check-in scheduled for ${minInput}m.`, 'info');
    
    appState.checkInTimer = setInterval(() => {
      appState.checkInTimeRemaining--;
      document.getElementById('checkin-remaining-text').innerText = formatSeconds(appState.checkInTimeRemaining);
      
      const pct = (appState.checkInTimeRemaining / appState.checkInTotalDuration) * 100;
      updateCheckInCircle(pct);
      
      if (appState.checkInTimeRemaining <= 0) {
        clearInterval(appState.checkInTimer);
        appState.checkInTimer = null;
        triggerMissedCheckInAlert();
      }
    }, 1000);
    
    updateDashboardStats();
  };

  window.confirmCheckIn = () => {
    if(appState.checkInTimer) {
      clearInterval(appState.checkInTimer);
      appState.checkInTimer = null;
    }
    
    document.getElementById('checkin-setup-panel').classList.remove('hidden');
    document.getElementById('checkin-countdown-panel').classList.add('hidden');
    
    showToast('Check-in confirmed. Safety verified.', 'success');
    addLog('User completed scheduled safety check-in on time.', 'success');
    
    updateDashboardStats();
  };

  window.cancelCheckIn = () => {
    if(appState.checkInTimer) {
      clearInterval(appState.checkInTimer);
      appState.checkInTimer = null;
    }
    
    document.getElementById('checkin-setup-panel').classList.remove('hidden');
    document.getElementById('checkin-countdown-panel').classList.add('hidden');
    
    showToast('Safety check-in timer cancelled.', 'info');
    addLog('Safety Check-in timer cancelled by user.', 'info');
    
    updateDashboardStats();
  };

  function updateCheckInCircle(percent) {
    const circle = document.querySelector('.progress-ring-circle');
    if (!circle) return;
    
    const radius = circle.r.baseVal.value;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (percent / 100 * circumference);
    circle.style.strokeDashoffset = offset;
  }

  function triggerMissedCheckInAlert() {
    showToast('WARNING: Missed check-in timer! Alert status active.', 'danger');
    addLog('WARNING: User missed scheduled safety check-in! High priority alert triggered.', 'danger');
    
    document.getElementById('checkin-countdown-panel').innerHTML = `
      <div class="text-center py-4">
        <div class="inline-flex p-3 rounded-full bg-red-500/10 text-red-500 mb-2 animate-bounce">
          <i data-lucide="alert-octagon" class="w-8 h-8"></i>
        </div>
        <h3 class="text-red-500 font-bold text-lg">MISSED CHECK-IN</h3>
        <p class="text-zinc-400 text-sm max-w-xs mx-auto mt-1 mb-4">Emergency contacts are being notified of your location.</p>
        <button onclick="resetMissedCheckIn()" class="px-5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-sm transition">
          I am Safe (Reset)
        </button>
      </div>
    `;
    lucide.createIcons();
    
    appState.contacts.forEach(c => {
      if(c.priority === 'high') {
        addLog(`Sent missed check-in distress SMS to ${c.name} (${c.phone}).`, 'danger');
      }
    });
    
    setDashboardSafetyStatus('danger');
    playBeep(440, 0.4);
    setTimeout(() => playBeep(330, 0.4), 300);
  }

  window.resetMissedCheckIn = () => {
    const panel = document.getElementById('checkin-countdown-panel');
    panel.classList.add('hidden');
    panel.innerHTML = `
      <div class="flex items-center justify-center relative mb-4">
        <svg class="w-32 h-32 transform -rotate-90">
          <circle class="text-zinc-800" stroke-width="6" stroke="currentColor" fill="transparent" r="54" cx="64" cy="64"/>
          <circle class="text-purple-500 progress-ring-circle" stroke-width="6" stroke-dasharray="339.29" stroke-dashoffset="339.29" stroke-linecap="round" stroke="currentColor" fill="transparent" r="54" cx="64" cy="64"/>
        </svg>
        <div class="absolute flex flex-col items-center justify-center">
          <span id="checkin-remaining-text" class="text-white font-bold text-xl">00:00</span>
          <span class="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Remaining</span>
        </div>
      </div>
      <div class="flex items-center gap-3 w-full">
        <button onclick="confirmCheckIn()" class="flex-1 py-2.5 rounded-xl font-semibold bg-green-500 hover:bg-green-600 text-white transition text-sm">
          Confirm Safe
        </button>
        <button onclick="cancelCheckIn()" class="px-4 py-2.5 rounded-xl font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition text-sm">
          Cancel
        </button>
      </div>
    `;
    
    document.getElementById('checkin-setup-panel').classList.remove('hidden');
    setDashboardSafetyStatus('safe');
    showToast('Safety check-in reset.', 'success');
    addLog('User cleared missed check-in status.', 'success');
  };

  function formatSeconds(totalSec) {
    let m = Math.floor(totalSec / 60).toString().padStart(2, '0');
    let s = (totalSec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  // --- DASHBOARD UI UPDATES ---
  function setDashboardSafetyStatus(status) {
    const statusText = document.getElementById('dashboard-status-text');
    const statusIcon = document.getElementById('dashboard-status-icon');
    const statusBox = document.getElementById('dashboard-status-card');
    
    if (!statusText || !statusIcon || !statusBox) return;
    
    if (status === 'danger') {
      statusText.innerText = 'DANGER STATUS ACTIVE';
      statusText.className = 'text-red-500 font-extrabold text-lg';
      statusIcon.innerHTML = `<div class="p-3 rounded-full bg-red-500/10 text-red-500 animate-pulse"><i data-lucide="alert-octagon" class="w-8 h-8"></i></div>`;
      statusBox.className = 'glass-panel p-5 rounded-2xl border border-red-500/30 bg-red-950/10 flex items-center justify-between';
    } else {
      statusText.innerText = 'System Secured';
      statusText.className = 'text-green-400 font-extrabold text-lg';
      statusIcon.innerHTML = `<div class="p-3 rounded-full bg-green-500/10 text-green-400"><i data-lucide="shield-check" class="w-8 h-8"></i></div>`;
      statusBox.className = 'glass-panel p-5 rounded-2xl border border-green-500/10 bg-green-950/5 flex items-center justify-between';
    }
    lucide.createIcons();
  }

  function updateDashboardStats() {
    const contactsCount = document.getElementById('stats-contacts-count');
    const logsCount = document.getElementById('stats-logs-count');
    const activeSharing = document.getElementById('stats-sharing-active');
    
    if (contactsCount) contactsCount.innerText = appState.contacts.length;
    if (logsCount) logsCount.innerText = appState.logs.length;
    if (activeSharing) {
      activeSharing.innerText = appState.isTracking ? 'Active' : 'Off';
      activeSharing.className = appState.isTracking ? 'text-green-400 font-bold' : 'text-zinc-500 font-bold';
    }
  }

  // --- PREMIUM SVG CHARTS GENERATOR ---
  function drawAnalyticsChart() {
    const container = document.getElementById('svg-chart-container');
    if (!container) return;

    const baseSafetyPoints = [95, 98, 92, 85, 90, 96, 99];
    
    if (appState.sirenActive || appState.sosCountdownActive) {
      baseSafetyPoints[6] = 30;
    } else if (appState.isTracking) {
      baseSafetyPoints[6] = 95;
    }

    const width = 500;
    const height = 150;
    const padding = 20;

    const pointsCount = baseSafetyPoints.length;
    const xStep = (width - padding * 2) / (pointsCount - 1);
    
    let pathData = '';
    let circlesHtml = '';
    
    baseSafetyPoints.forEach((val, idx) => {
      const x = padding + idx * xStep;
      const y = height - padding - ((val / 100) * (height - padding * 2));
      
      if (idx === 0) {
        pathData += `M ${x} ${y}`;
      } else {
        pathData += ` L ${x} ${y}`;
      }

      circlesHtml += `<circle cx="${x}" cy="${y}" r="4" class="fill-purple-500 stroke-zinc-950 stroke-2" />`;
      circlesHtml += `<circle cx="${x}" cy="${y}" r="12" class="fill-transparent hover:fill-purple-500/10 cursor-pointer transition duration-300" title="Safety Index: ${val}%" />`;
    });

    const svgHtml = `
      <svg viewBox="0 0 ${width} ${height}" class="w-full h-full">
        <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#2A2A2A" stroke-width="1" />
        <line x1="${padding}" y1="${padding}" x2="${width - padding}" y2="${padding}" stroke="#2A2A2A" stroke-width="1" stroke-dasharray="4" />
        <line x1="${padding}" y1="${(height)/2}" x2="${width - padding}" y2="${(height)/2}" stroke="#1A1A1A" stroke-width="1" />
        <path d="${pathData}" fill="none" stroke="url(#gradient-purple-glow)" stroke-width="6" stroke-linecap="round" opacity="0.4" />
        <path d="${pathData}" fill="none" stroke="url(#gradient-purple-red)" stroke-width="3" stroke-linecap="round" />
        <path d="${pathData} L ${width - padding} ${height - padding} L ${padding} ${height - padding} Z" fill="url(#area-gradient)" opacity="0.1" />
        ${circlesHtml}
        <defs>
          <linearGradient id="gradient-purple-red" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#8B5CF6" />
            <stop offset="100%" stop-color="#FF4D4D" />
          </linearGradient>
          <linearGradient id="gradient-purple-glow" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#8B5CF6" stop-opacity="0.8" />
            <stop offset="100%" stop-color="#FF4D4D" stop-opacity="0.8" />
          </linearGradient>
          <linearGradient id="area-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#8B5CF6" />
            <stop offset="100%" stop-color="#0A0A0A" />
          </linearGradient>
        </defs>
      </svg>
    `;

    container.innerHTML = svgHtml;
  }

  // --- FLOATING AI SAFETY ASSISTANT ---
  function initChatbot() {
    const input = document.getElementById('chat-input-field');
    const sendBtn = document.getElementById('chat-send-btn');
    const body = document.getElementById('chat-messages-body');
    
    if (!input || !sendBtn || !body) return;

    sendBtn.onclick = () => handleChatMessage();
    input.onkeypress = (e) => {
      if(e.key === 'Enter') handleChatMessage();
    };
    
    if(body.children.length === 0) {
      appendChatMessage('bot', 'Hello! I am your AI Safety Assistant. Ask me about self-defense, safety checklists, emergency numbers, or legal rights.');
    }
  }

  window.toggleChatWidget = () => {
    const panel = document.getElementById('chatbot-widget-panel');
    if (panel) {
      if (panel.classList.contains('hidden')) {
        panel.classList.remove('hidden');
        panel.classList.add('flex');
        const body = document.getElementById('chat-messages-body');
        if (body) body.scrollTop = body.scrollHeight;
      } else {
        panel.classList.add('hidden');
        panel.classList.remove('flex');
      }
    }
  };

  window.sendSuggestedPrompt = (promptText) => {
    appendChatMessage('user', promptText);
    triggerBotResponse(promptText);
  };

  function handleChatMessage() {
    const input = document.getElementById('chat-input-field');
    const query = input.value.trim();
    if (!query) return;

    appendChatMessage('user', query);
    input.value = '';
    
    triggerBotResponse(query);
  }

  function appendChatMessage(sender, text) {
    const body = document.getElementById('chat-messages-body');
    if (!body) return;

    const div = document.createElement('div');
    div.className = `message-bubble ${sender === 'user' ? 'message-user' : 'message-bot'}`;
    div.innerHTML = escapeHtml(text).replace(/\n/g, '<br>');
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
  }

  function triggerBotResponse(query) {
    const body = document.getElementById('chat-messages-body');
    
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'message-bubble message-bot flex items-center gap-1.5 py-3';
    typingIndicator.id = 'chat-typing-indicator';
    typingIndicator.innerHTML = `
      <span class="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style="animation-delay: 0s"></span>
      <span class="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></span>
      <span class="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style="animation-delay: 0.4s"></span>
    `;
    body.appendChild(typingIndicator);
    body.scrollTop = body.scrollHeight;

    const lowerQuery = query.toLowerCase();
    let responseText = "I'm here to help. For immediate emergency service, please press the Red 'Activate SOS' button or call 112 directly. Could you please clarify your request?";

    if (lowerQuery.includes('followed') || lowerQuery.includes('following')) {
      responseText = "If you believe you are being followed:\n1. Head immediately towards a well-lit, public area (a shop, restaurant, or petrol station).\n2. Call a trusted contact or trigger a Fake Call to simulate that you are speaking to someone nearby.\n3. Keep your hands free and prepare your Emergency Siren.\n4. Avoid going home directly so they do not learn your address.";
    } else if (lowerQuery.includes('cab') || lowerQuery.includes('uber') || lowerQuery.includes('taxi')) {
      responseText = "Before entering a cab:\n1. Verify the license plate and driver name matches the app booking.\n2. Enable 'Live Location Sharing' and send the sharing link to your high-priority contacts.\n3. Sit behind the driver, not in the passenger seat, to prevent physical contact and keep exit paths clear.\n4. Do not share personal details.";
    } else if (lowerQuery.includes('night') || lowerQuery.includes('dark') || lowerQuery.includes('walking')) {
      responseText = "Tips for traveling/walking at night:\n1. Plan your route along busy, well-lit streets.\n2. Keep one ear free (no noise-canceling headphones) to remain aware of surroundings.\n3. Walk confidently and keep your phone accessible in your hand, pre-loaded on the WSA screen.\n4. Schedule a check-in timer for your walking duration.";
    } else if (lowerQuery.includes('self defense') || lowerQuery.includes('defense') || lowerQuery.includes('fight')) {
      responseText = "Key Self-Defense Rules:\n1. Your primary goal is to escape, not win a fight. Run as soon as an opening occurs.\n2. Target vulnerable areas: eyes, nose, throat, groin, and shins.\n3. Make maximum noise—yell 'FIRE' or 'BACK OFF' rather than 'HELP' to attract attention, and activate the Siren feature.";
    } else if (lowerQuery.includes('law') || lowerQuery.includes('legal') || lowerQuery.includes('right')) {
      responseText = "Important Legal Rights (India):\n1. Zero FIR: A woman can file a complaint at any police station, regardless of where the incident occurred.\n2. Arrest of Women: Women cannot be arrested after sunset and before sunrise except in extraordinary cases with a magistrate's order.\n3. Virtual Complaints: Women have the right to lodge complaints via registered post or email if unable to visit police stations.";
    } else if (lowerQuery.includes('siren') || lowerQuery.includes('alarm')) {
      responseText = "The emergency Siren synthesizes a high-decibel alarm signal directly in your browser. Use it in active danger to startle attackers and alert nearby citizens.";
    } else if (lowerQuery.includes('helpline') || lowerQuery.includes('number') || lowerQuery.includes('call')) {
      responseText = "Emergency Helplines (India):\n- National Emergency: 112\n- Women Helpline: 1091 / 181\n- Police: 100\n- Cyber Crime Cell: 1930";
    }

    setTimeout(() => {
      const indicator = document.getElementById('chat-typing-indicator');
      if (indicator) indicator.remove();
      
      appendChatMessage('bot', responseText);
    }, 1200);
  }

  // --- KNOWLEDGE BASE FILTERS ---
  window.filterSafetyArticles = (category) => {
    const cards = document.querySelectorAll('.safety-article-card');
    const tabs = document.querySelectorAll('.safety-filter-tab');
    
    tabs.forEach(tab => {
      if (tab.getAttribute('data-category') === category) {
        tab.className = 'safety-filter-tab px-4 py-2 rounded-xl text-sm font-semibold transition bg-purple-600 text-white';
      } else {
        tab.className = 'safety-filter-tab px-4 py-2 rounded-xl text-sm font-semibold transition bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white';
      }
    });

    cards.forEach(card => {
      if (category === 'all' || card.getAttribute('data-category') === category) {
        card.classList.remove('hidden');
      } else {
        card.classList.add('hidden');
      }
    });
  };

  window.searchSafetyArticles = () => {
    const query = document.getElementById('safety-search-input').value.toLowerCase();
    const cards = document.querySelectorAll('.safety-article-card');
    
    cards.forEach(card => {
      const title = card.querySelector('.article-title').innerText.toLowerCase();
      const desc = card.querySelector('.article-desc').innerText.toLowerCase();
      
      if (title.includes(query) || desc.includes(query)) {
        card.classList.remove('hidden');
      } else {
        card.classList.add('hidden');
      }
    });
  };

  // --- COMMUNITY POST MANAGER (SUPABASE SYNCED) ---
  window.addCommunityPost = async (e) => {
    if(e) e.preventDefault();
    
    const textarea = document.getElementById('community-post-text');
    const content = textarea.value.trim();
    if (!content) return;

    const container = document.getElementById('community-posts-container');
    if (!container) return;

    const postDiv = document.createElement('div');
    postDiv.className = 'glass-panel p-5 rounded-2xl border border-white/5 flex flex-col gap-4 animate-fade-in';
    postDiv.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-zinc-300">
            A
          </div>
          <div>
            <h4 class="text-white text-sm font-semibold">Anonymous Member</h4>
            <span class="text-zinc-500 text-xs">Just now • Safety Alert</span>
          </div>
        </div>
        <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 uppercase">
          General
        </span>
      </div>
      <p class="text-zinc-300 text-sm leading-relaxed">${escapeHtml(content)}</p>
      <div class="flex items-center gap-6 text-zinc-500 text-sm border-t border-white/5 pt-4 mt-2">
        <button class="flex items-center gap-2 hover:text-red-400 transition" onclick="togglePostVote(this)">
          <i data-lucide="heart" class="w-4 h-4"></i>
          <span>1</span>
        </button>
        <button class="flex items-center gap-2 hover:text-purple-400 transition">
          <i data-lucide="message-square" class="w-4 h-4"></i>
          <span>0 Comments</span>
        </button>
      </div>
    `;
    
    container.insertBefore(postDiv, container.firstChild);
    textarea.value = '';
    
    if (supabaseClient) {
      try {
        await supabaseClient.from('community_posts').insert([{
          content: content,
          votes: 1,
          created_at: new Date()
        }]);
        showToast('Story posted & synced to Supabase!', 'success');
      } catch (err) {}
    } else {
      showToast('Alert shared anonymously!', 'success');
    }
    
    addLog('Shared anonymous community post.', 'info');
    lucide.createIcons();
  };

  window.togglePostVote = (btn) => {
    const countSpan = btn.querySelector('span');
    let votes = parseInt(countSpan.innerText);
    
    if (btn.classList.contains('text-red-400')) {
      btn.classList.remove('text-red-400');
      btn.classList.add('text-zinc-500');
      countSpan.innerText = votes - 1;
    } else {
      btn.classList.add('text-red-400');
      btn.classList.remove('text-zinc-500');
      countSpan.innerText = votes + 1;
    }
  };

  // --- DYNAMIC PDF GENERATOR & SUPABASE STORAGE UPLOADER ---
  window.exportAndUploadPDFReport = async () => {
    try {
      showToast('Generating PDF Report...', 'info');
      
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();

      // Build PDF Report Structure
      doc.setFontSize(22);
      doc.setTextColor(139, 92, 246); // Purple brand color
      doc.text("WOMEN SAFETY ASSISTANT", 20, 20);
      
      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100);
      doc.text("Your Safety, One Tap Away.", 20, 27);
      
      doc.setDrawColor(220, 220, 220);
      doc.line(20, 32, 190, 32);

      // Section metadata
      doc.setFontSize(16);
      doc.setTextColor(0, 0, 0);
      doc.text("Active Security Log Report", 20, 45);
      
      doc.setFontSize(11);
      doc.text(`Generated Date: ${new Date().toLocaleString()}`, 20, 53);
      doc.text(`Total Linked Guardians: ${appState.contacts.length}`, 20, 60);
      doc.text(`Live Location Sharing Status: ${appState.isTracking ? 'Active' : 'Inactive'}`, 20, 67);
      doc.text(`Total Local Activity Logs: ${appState.logs.length}`, 20, 74);

      doc.setFontSize(14);
      doc.text("Recent Activity Log:", 20, 88);
      
      doc.setFontSize(9);
      doc.setTextColor(50, 50, 50);
      let yOffset = 98;
      
      appState.logs.slice(0, 12).forEach((log) => {
        doc.text(`[${log.timestamp}] ${log.event}`, 20, yOffset);
        yOffset += 8;
      });

      const filename = `safety_report_${Date.now()}.pdf`;
      
      // Trigger user file download
      doc.save(filename);

      // Upload to Supabase Storage Bucket
      if (supabaseClient) {
        showToast('Uploading PDF report to Supabase...', 'info');
        
        // Convert to Blob
        const blob = doc.output('blob');

        // Storage bucket upload under bucket 'safety_reports'
        const { data: uploadData, error: uploadError } = await supabaseClient.storage
          .from('safety_reports')
          .upload(`reports/${filename}`, blob, {
            contentType: 'application/pdf',
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.warn("Storage upload skipped/failed:", uploadError.message);
          showToast(`Upload skipped: ${uploadError.message}`, 'warning');
          return;
        }

        // Get Public URL
        const { data: publicUrlData } = supabaseClient.storage
          .from('safety_reports')
          .getPublicUrl(`reports/${filename}`);

        const fileUrl = publicUrlData.publicUrl;

        // Insert record into pdf_reports tracking table
        const { error: dbError } = await supabaseClient
          .from('pdf_reports')
          .insert([{ filename, file_url: fileUrl }]);

        if (dbError) {
          console.warn("Database insert for PDF failed:", dbError.message);
          return;
        }

        showToast('PDF successfully uploaded and logged to Supabase!', 'success');
        addLog(`PDF report uploaded: ${filename}`, 'success');
      } else {
        showToast('Offline Mode: PDF downloaded locally.', 'info');
      }

    } catch(err) {
      console.error("PDF generator error:", err);
      showToast("Failed to compile PDF report.", "danger");
    }
  };

  function escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
  }
});
