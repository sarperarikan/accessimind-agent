let currentSession = null;

function el(id) {
  return document.getElementById(id);
}

const msgInput = el('msg');
const sendBtn = el('send');
const messages = el('messages');
const status = el('status');

// Tab switching - class-based with URL state
function switchTab(tabName) {
  console.log('switchTab called:', tabName);
  
  // Update URL without reload
  const url = new URL(window.location);
  url.searchParams.set('tab', tabName);
  window.history.pushState({}, '', url);
  
  // Hide all tab contents
  document.querySelectorAll('.tab-content').forEach(function(c) {
    c.classList.remove('visible');
    c.style.display = 'none';
  });
  
  // Show target
  var target = document.getElementById(tabName);
  if (target) {
    target.classList.add('visible');
    target.style.display = 'flex';
  }
  
  // Update tab buttons
  document.querySelectorAll('.tab').forEach(function(t) {
    t.classList.remove('active');
    if (t.getAttribute('data-tab') === tabName) {
      t.classList.add('active');
    }
  });
  
  // Load data for specific tabs
  if (tabName === 'skills') {
    loadSkills();
  }
  if (tabName === 'hafiza') {
    loadMemory();
  }
}

// Initialize tab from URL on page load
function initTabsFromURL() {
  const url = new URL(window.location);
  const tab = url.searchParams.get('tab');
  if (tab && document.getElementById(tab)) {
    switchTab(tab);
  }
}

// Browser back/forward support
window.addEventListener('popstate', function() {
  const url = new URL(window.location);
  const tab = url.searchParams.get('tab') || 'sohbet';
  // Just update buttons, don't reload data
  document.querySelectorAll('.tab').forEach(function(t) {
    t.classList.remove('active');
    if (t.getAttribute('data-tab') === tab) {
      t.classList.add('active');
    }
  });
  // Show/hide content
  document.querySelectorAll('.tab-content').forEach(function(c) {
    c.classList.remove('visible');
    c.style.display = 'none';
  });
  var target = document.getElementById(tab);
  if (target) {
    target.classList.add('visible');
    target.style.display = 'flex';
  }
});

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', function() {
  initTabsFromURL();
  loadSettings();
});

function addMessage(text, role, meta, status) {
  meta = meta || '';
  status = status || '';
  var statusIcon = '';
  if (status === 'sending') statusIcon = '⏳ ';
  else if (status === 'error') statusIcon = '❌ ';
  
  // Timestamp
  const now = new Date();
  const timestamp = now.toLocaleTimeString('tr-TR', {hour: '2-digit', minute: '2-digit'});
  const dateStr = now.toLocaleDateString('tr-TR', {day: 'numeric', month: 'short'});
  
  // Markdown render
  const rendered = renderMarkdown(text);
  
  const div = document.createElement('div');
  div.className = 'message ' + role;
  if (status === 'error') div.classList.add('error');
  div.setAttribute('data-timestamp', now.toISOString());
  div.innerHTML = '<div class="message-content">' + statusIcon + rendered + '</div>' +
    '<div class="message-actions">' +
      '<button class="action-btn" onclick="copyMessage(this)" title="Kopyala">📋</button>' +
      (role === 'user' ? '<button class="action-btn" onclick="editMessage(this)" title="Düzenle">✏️</button>' : '') +
      '<button class="action-btn reaction-btn" onclick="addReaction(this, \'👍\')" title="Beğen">👍</button>' +
      '<button class="action-btn reaction-btn" onclick="addReaction(this, \'👎\')" title="Beğenme">👎</button>' +
    '</div>' +
    '<div class="meta">' + timestamp + ' · ' + dateStr + ' · ' + meta + '</div>';
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

// Simple markdown renderer
function renderMarkdown(text) {
  if (!text) return '';
  
  // Escape HTML first
  text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  
  // Code blocks
  text = text.replace(/```(\w*)\n?([\s\S]*?)```/g, function(m, lang, code) {
    return '<pre class="code-block" data-lang="' + (lang || '') + '"><code>' + code.trim() + '</code></pre>';
  });
  
  // Inline code
  text = text.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
  
  // Bold
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  
  // Italic
  text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  
  // Links
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
  
  // Line breaks
  text = text.replace(/\n/g, '<br>');
  
  return text;
}

function copyMessage(btn) {
  const content = btn.closest('.message').querySelector('.message-content').innerText;
  navigator.clipboard.writeText(content).then(function() {
    btn.textContent = '✅';
    setTimeout(function() { btn.textContent = '📋'; }, 1500);
  });
}

function editMessage(btn) {
  const msgEl = btn.closest('.message');
  const content = msgEl.querySelector('.message-content').innerText;
  const newText = prompt('Mesajı düzenle:', content);
  if (newText && newText !== content) {
    msgEl.querySelector('.message-content').innerHTML = renderMarkdown(newText);
    msgEl.classList.add('edited');
  }
}

function addReaction(btn, reaction) {
  const msgEl = btn.closest('.message');
  let reactions = msgEl.querySelector('.reactions');
  if (!reactions) {
    reactions = document.createElement('div');
    reactions.className = 'reactions';
    msgEl.appendChild(reactions);
  }
  const span = document.createElement('span');
  span.textContent = reaction;
  reactions.appendChild(span);
}

async function sendMessage() {
  const text = msgInput.value.trim();
  if (!text) return;
  
  const model = el('model').value;
  const toolsets = el('toolsets').value;
  const skills = el('skills').value;
  
  addMessage(text, 'user', '', 'sending');
  msgInput.value = '';
  sendBtn.disabled = true;
  showTyping();
  status.classList.add('thinking');
  status.querySelector('span:last-child').textContent = 'Düşünüyor...';
  
  try {
    const resp = await fetch('/api/chat', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        message: text,
        session_id: currentSession,
        model: model,
        toolsets: toolsets,
        skills: skills
      })
    });
    const data = await resp.json();
    currentSession = data.session_id;
    hideTyping();
    addMessage(data.response || 'Yanıt alınamadı', 'assistant', 'Model: ' + (data.model || model));
  } catch (e) {
    hideTyping();
    addMessage('Hata: ' + e.message, 'system', '', 'error');
  }
  
  sendBtn.disabled = false;
  status.classList.remove('thinking');
  status.querySelector('span:last-child').textContent = 'Hazır';
}

// Typing indicator
function showTyping() {
  const indicator = document.createElement('div');
  indicator.className = 'message assistant typing-indicator';
  indicator.id = 'typing';
  indicator.innerHTML = '<div class="dots"><span>.</span><span>.</span><span>.</span></div>';
  messages.appendChild(indicator);
  messages.scrollTop = messages.scrollHeight;
}

function hideTyping() {
  const indicator = document.getElementById('typing');
  if (indicator) indicator.remove();
}

// Message search
function searchMessages(query) {
  if (!query) {
    document.querySelectorAll('.message').forEach(function(m) { m.classList.remove('highlight'); });
    return;
  }
  query = query.toLowerCase();
  document.querySelectorAll('.message').forEach(function(m) {
    const content = m.querySelector('.message-content').innerText.toLowerCase();
    m.classList.toggle('highlight', content.includes(query));
  });
}

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
  // Ctrl/Cmd + F: Search
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    e.preventDefault();
    el('search-input').focus();
  }
  // Ctrl/Cmd + K: Quick command
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    msgInput.focus();
  }
  // Escape: Close modals
  if (e.key === 'Escape') {
    closeSkillEditor();
  }
});

// Event listeners
el('new-chat').addEventListener('click', function() {
  currentSession = null;
  addMessage('Yeni sohbet başladı', 'system');
});

sendBtn.addEventListener('click', sendMessage);

msgInput.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    sendMessage();
  } else if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    // Shift+Enter yeni satır, sadece Enter göndermez (multi-line için)
  }
});

msgInput.addEventListener('input', function() {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 120) + 'px';
});

msgInput.focus();

// File attachment
var attachedFiles = [];
el('attach-btn').addEventListener('click', function() {
  el('file-input').click();
});
el('file-input').addEventListener('change', function(e) {
  var files = Array.from(e.target.files);
  files.forEach(function(f) {
    attachedFiles.push(f);
    renderAttachedFiles();
  });
  this.value = '';
});
function renderAttachedFiles() {
  var container = el('attached-files');
  if (!container) {
    container = document.createElement('div');
    container.id = 'attached-files';
    container.className = 'attached-files';
    el('input-area').insertBefore(container, el('msg'));
  }
  container.innerHTML = attachedFiles.map(function(f, i) {
    return '<div class="attached-file"><span>' + f.name + '</span><span class="remove" onclick="removeAttachedFile(' + i + ')">✕</span></div>';
  }).join('');
}
function removeAttachedFile(index) {
  attachedFiles.splice(index, 1);
  renderAttachedFiles();
}

// Emoji picker
var emojiPickerShown = false;
el('emoji-btn').addEventListener('click', function(e) {
  e.stopPropagation();
  emojiPickerShown = !emojiPickerShown;
  el('emoji-picker').classList.toggle('hidden', !emojiPickerShown);
  el('session-panel').classList.add('hidden');
});
document.querySelectorAll('.emoji-grid span').forEach(function(span) {
  span.addEventListener('click', function() {
    msgInput.value += this.textContent;
    msgInput.focus();
    emojiPickerShown = false;
    el('emoji-picker').classList.add('hidden');
  });
});
document.addEventListener('click', function(e) {
  if (emojiPickerShown && !el('emoji-picker').contains(e.target) && e.target !== el('emoji-btn')) {
    emojiPickerShown = false;
    el('emoji-picker').classList.add('hidden');
  }
});

// Keyboard shortcuts - Updated
document.addEventListener('keydown', function(e) {
  // Ctrl/Cmd + F: Search
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    e.preventDefault();
    el('search-input').focus();
  }
  // Ctrl/Cmd + K: Quick command
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    msgInput.focus();
  }
  // Ctrl/Cmd + Enter: Send
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    sendMessage();
  }
  // Escape: Close modals
  if (e.key === 'Escape') {
    closeSkillEditor();
    el('session-panel').classList.add('hidden');
    emojiPickerShown = false;
    el('emoji-picker').classList.add('hidden');
  }
});

// Session panel
var sessions = [];
function toggleSessionPanel() {
  el('session-panel').classList.toggle('hidden');
  el('emoji-picker').classList.add('hidden');
  if (!el('session-panel').classList.contains('hidden')) {
    loadSessions();
  }
}
function loadSessions() {
  var list = el('sessions-list');
  fetch('/api/sessions').then(function(r) { return r.json(); }).then(function(data) {
    var sessions_list = data.sessions || [];
    if (!sessions_list.length) {
      list.innerHTML = '<div class="empty-state">Oturum yok</div>';
      return;
    }
    list.innerHTML = sessions_list.map(function(s) {
      var sizeKB = Math.round(s.size_bytes / 1024);
      return '<div class="session-item" onclick="loadSession(\'' + s.id + '\')"><div class="name">' + s.name + '</div><div class="meta">' + s.message_count + ' mesaj - ' + sizeKB + ' KB</div><div class="session-actions"><button onclick="event.stopPropagation();archiveSession(\'' + s.id + '\')">📦</button><button onclick="event.stopPropagation();exportSession(\'' + s.id + '\')">📤</button><button onclick="event.stopPropagation();deleteSession(\'' + s.id + '\')">🗑️</button></div></div>';
    }).join('');
  }).catch(function(e) {
    list.innerHTML = '<div class="empty-state">Yüklenemedi: ' + e.message + '</div>';
  });
}

function archiveSession(id) {
  if (!confirm('Bu oturumu arşivlemek istediğinize emin misiniz?')) return;
  fetch('/api/sessions/' + id + '/archive', {method: 'POST'}).then(function(r) { return r.json(); }).then(function(data) {
    alert('Oturum arşivlendi: ' + data.to);
    loadSessions();
  }).catch(function(e) {
    alert('Hata: ' + e.message);
  });
}

function filterSessions(query) {
  query = (query || '').toLowerCase();
  document.querySelectorAll('.session-item').forEach(function(item) {
    var name = item.querySelector('.name').innerText.toLowerCase();
    item.style.display = name.includes(query) ? 'block' : 'none';
  });
}

function searchSessions(query) {
  if (!query) {
    loadSessions();
    return;
  }
  fetch('/api/search-sessions?q=' + encodeURIComponent(query)).then(function(r) { return r.json(); }).then(function(data) {
    var list = el('sessions-list');
    if (data.sessions && data.sessions.length) {
      var html = '';
      data.sessions.forEach(function(s) {
        html += '<div class="session-item" onclick="viewSession(\'' + s.session_id + '\')">' +
          '<div class="session-id">' + s.session_id + '</div>' +
          '<div class="session-preview" style="color:#fbbf24">' + (s.matched_content || '').substring(0, 100) + '</div></div>';
      });
      list.innerHTML = html;
    } else {
      list.innerHTML = '<div class="empty-state">Sonuç yok</div>';
    }
  }).catch(function(e) {
    alert('Arama hatası: ' + e.message);
  });
}
function loadSession(id) {
  var session = sessions.find(function(s) { return s.id === id; });
  if (session) {
    currentSession = id;
    // Load messages
  }
}
function renameSession(id) {
  var session = sessions.find(function(s) { return s.id === id; });
  if (!session) return;
  var newName = prompt('Oturum adı:', session.name);
  if (newName && newName !== session.name) {
    session.name = newName;
    loadSessions();
  }
}
function deleteSession(id) {
  if (!confirm('Bu oturumu silmek istediğinize emin misiniz?')) return;
  fetch('/api/sessions/' + id, {method: 'DELETE'}).then(function(r) { return r.json(); }).then(function(data) {
    loadSessions();
  }).catch(function(e) {
    alert('Hata: ' + e.message);
  });
}

function exportSession(id) {
  fetch('/api/sessions/' + id).then(function(r) { return r.json(); }).then(function(data) {
    var exportData = {session_id: data.session_id, filename: data.filename, messages: data.messages};
    var json = JSON.stringify(exportData, null, 2);
    var blob = new Blob([json], {type: 'application/json'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'session-' + id + '.json';
    a.click();
    URL.revokeObjectURL(url);
  }).catch(function(e) {
    alert('Hata: ' + e.message);
  });
}

// Skills functions
var allSkillsData = [];

async function loadSkills() {
  try {
    const resp = await fetch('/api/skills');
    const data = await resp.json();
    const skills = data.skills || [];
    allSkillsData = skills;
    renderSkills(skills);
  } catch (e) {
    el('skills-list').innerHTML = '<div class="empty-state">Yüklenirken hata: ' + e.message + '</div>';
  }
}

function renderSkills(skills) {
  const list = el('skills-list');
  if (!skills.length) {
    list.innerHTML = '<div class="empty-state">Skill bulunamadı.</div>';
    return;
  }
  list.innerHTML = skills.map(function(s) {
    const enabled = s.enabled !== false;
    return '<div class="skill-item' + (enabled ? '' : ' disabled') + '" data-name="' + s.name + '">' +
      '<div class="skill-info">' +
        '<div class="name">' + (enabled ? '' : '🔴 ') + s.name + '</div>' +
        '<div class="desc">' + (s.description || 'Açıklama yok') + '</div>' +
        (s.category ? '<div class="category-tag">' + s.category + '</div>' : '') +
      '</div>' +
      '<div class="actions">' +
        '<label class="switch"><input type="checkbox" ' + (enabled ? 'checked' : '') + ' onchange="toggleSkill(\'' + s.name + '\', this.checked)"><span class="slider"></span></label>' +
        '<button onclick="editSkill(\'' + s.name + '\')">✏️</button>' +
        '<button onclick="exportSkill(\'' + s.name + '\')">📤</button>' +
        '<button onclick="deleteSkill(\'' + s.name + '\')">🗑️</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

function filterSkills() {
  const search = el('skill-search').value.toLowerCase();
  const category = el('skill-category-filter').value;
  const filtered = allSkillsData.filter(function(s) {
    const matchSearch = !search || s.name.toLowerCase().includes(search) || (s.description || '').toLowerCase().includes(search);
    const matchCategory = !category || s.category === category;
    return matchSearch && matchCategory;
  });
  renderSkills(filtered);
}

async function toggleSkill(name, enabled) {
  try {
    const resp = await fetch('/api/skills', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({action: 'enable', name: name, enabled: enabled})
    });
    const data = await resp.json();
    if (data.error) alert(data.error);
  } catch (e) {
    alert('Hata: ' + e.message);
  }
}

async function toggleAllSkills(enabled) {
  allSkillsData.forEach(function(s) {
    toggleSkill(s.name, enabled);
  });
  setTimeout(loadSkills, 500);
}

function exportSkill(name) {
  const skill = allSkillsData.find(function(s) { return s.name === name; });
  if (!skill) return;
  // Get full content from API
  fetch('/api/skills/' + name).then(function(r) { return r.json(); }).then(function(data) {
    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name + '.json';
    a.click();
    URL.revokeObjectURL(url);
  });
}

function exportAllSkills() {
  fetch('/api/skills/export').then(function(r) { return r.json(); }).then(function(data) {
    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'all-skills-' + new Date().toISOString().slice(0,10) + '.json';
    a.click();
    URL.revokeObjectURL(url);
  }).catch(function(e) {
    alert('Dışa aktarma hatası: ' + e.message);
  });
}

function importSkills(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      let skillsArray = [];
      
      // Handle both formats: {skills: [...]} or [...]
      if (Array.isArray(data)) {
        skillsArray = data;
      } else if (data.skills && Array.isArray(data.skills)) {
        skillsArray = data.skills;
      } else if (data.files) {
        // Single skill format with files
        skillsArray = [data];
      } else {
        throw new Error('Geçersiz JSON formatı');
      }
      
      fetch('/api/skills/import', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({skills: skillsArray})
      }).then(function(r) { return r.json(); }).then(function(result) {
        alert(result.imported + ' skill içe aktarıldı' + (result.errors.length ? '\nHatalar: ' + result.errors.join(', ') : ''));
        loadSkills();
      }).catch(function(e) {
        alert('İçe aktarma hatası: ' + e.message);
      });
    } catch(err) {
      alert('JSON okuma hatası: ' + err.message);
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

async function editSkill(name) {
  try {
    const resp = await fetch('/api/skills/' + name);
    const data = await resp.json();
    el('editor-title').textContent = 'Skill Düzenle: ' + name;
    el('skill-name-input').value = name;
    el('skill-name-input').disabled = true;
    el('skill-content-input').value = data.content || '';
    el('skill-editor').style.display = 'flex';
  } catch (e) {
    alert('Skill yüklenirken hata: ' + e.message);
  }
}

function showCreateSkill() {
  el('editor-title').textContent = 'Yeni Skill Oluştur';
  el('skill-name-input').value = '';
  el('skill-name-input').disabled = false;
  el('skill-content-input').value = '# Skill Adı\n\n## Overview\n\n\n## Steps\n\n1. \n\n2. \n\n## Pitfalls\n\n- \n\n## Verification\n\n- \n';
  el('skill-editor').style.display = 'flex';
}

function closeSkillEditor() {
  el('skill-editor').style.display = 'none';
}

async function saveSkill() {
  const name = el('skill-name-input').value.trim();
  const content = el('skill-content-input').value;
  
  if (!name) {
    alert('Lütfen skill adı girin');
    return;
  }
  
  try {
    const resp = await fetch('/api/skills', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        action: el('skill-name-input').disabled ? 'update' : 'create',
        name: name,
        content: content
      })
    });
    const data = await resp.json();
    if (data.error) {
      alert(data.error);
    } else {
      closeSkillEditor();
      loadSkills();
    }
  } catch (e) {
    alert('Kaydetme hatası: ' + e.message);
  }
}

async function deleteSkill(name) {
  if (!confirm(name + ' adlı skill\'i silmek istediğinize emin misiniz?')) {
    return;
  }
  
  try {
    const resp = await fetch('/api/skills', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({action: 'delete', name: name})
    });
    const data = await resp.json();
    if (data.error) {
      alert(data.error);
    } else {
      loadSkills();
    }
  } catch (e) {
    alert('Silme hatası: ' + e.message);
  }
}

// Memory functions
async function loadMemory() {
  try {
    const resp = await fetch('/api/memory');
    const data = await resp.json();
    
    let html = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:1rem">';
    
    // User Memory
    html += '<div class="memory-section"><h3 style="color:#38bdf8;margin-bottom:0.75rem">👤 Kullanıcı Profili</h3>';
    if (data.user && data.user.content) {
      html += '<div class="memory-item"><pre style="white-space:pre-wrap;font-size:0.8rem;color:#94a3b8;margin:0">' + data.user.content.substring(0, 500) + '</pre></div>';
    } else {
      html += '<div class="empty-state" style="padding:1rem">Bilgi yok</div>';
    }
    html += '</div>';
    
    // System Memory
    html += '<div class="memory-section"><h3 style="color:#38bdf8;margin-bottom:0.75rem">🧠 Sistem Hafızası</h3>';
    if (data.memory && data.memory.content) {
      html += '<div class="memory-item"><pre style="white-space:pre-wrap;font-size:0.8rem;color:#94a3b8;margin:0">' + data.memory.content.substring(0, 500) + '</pre></div>';
    } else {
      html += '<div class="empty-state" style="padding:1rem">Bilgi yok</div>';
    }
    html += '</div></div>';
    
    // Sessions
    html += '<div style="margin-top:1.5rem"><h3 style="color:#38bdf8;margin-bottom:0.75rem">📋 Son Oturumlar</h3>';
    if (data.sessions && data.sessions.length) {
      html += '<div class="sessions-list">';
      data.sessions.slice(0, 10).forEach(function(s) {
        html += '<div class="session-item" onclick="viewSession(\'' + s.id + '\')"><div class="session-id">' + s.id + '</div><div class="session-preview">' + s.messages + ' mesaj - ' + s.preview + '</div></div>';
      });
      html += '</div>';
    } else {
      html += '<div class="empty-state">Oturum yok</div>';
    }
    html += '</div>';
    
    el('memory-list').innerHTML = html;
  } catch (e) {
    el('memory-list').innerHTML = '<div class="empty-state">Yüklenirken hata: ' + e.message + '</div>';
  }
}

function viewSession(id) {
  fetch('/api/sessions/' + id).then(function(r) { return r.json(); }).then(function(data) {
    if (data.session && data.session.messages) {
      currentSession = data.session.id;
      messages.innerHTML = '';
      data.session.messages.forEach(function(m) {
        addMessage(m.content || '', m.role || 'user', '');
      });
      switchTab('chat');
      el('session-search').value = '';
      loadSessions();
    } else {
      alert('Oturum bulunamadı');
    }
  }).catch(function(e) {
    alert('Hata: ' + e.message);
  });
}

// Settings functions
async function loadSettings() {
  try {
    const resp = await fetch('/api/config');
    const data = await resp.json();
    const cfg = data.config || {};
    
    if (cfg.default_model) el('default-model').value = cfg.default_model;
    if (cfg.default_toolsets) el('default-toolsets').value = cfg.default_toolsets;
    if (cfg.base_url) el('api-base-url').value = cfg.base_url;
    if (cfg.port) el('dashboard-port').value = cfg.port;
    if (cfg.host) el('server-host').value = cfg.host;
    if (cfg.tts_enabled !== undefined) el('enable-tts').checked = cfg.tts_enabled;
    if (cfg.memory_enabled !== undefined) el('enable-memory').checked = cfg.memory_enabled;
  } catch (e) {
    console.log('Config yüklenirken hata:', e);
  }
}

function resetSettings() {
  if (!confirm('Tüm ayarları varsayılana sıfırlamak istediğinize emin misiniz?')) return;
  
  el('default-model').value = 'minimax-m2.5:cloud';
  el('api-base-url').value = 'https://ollama.com/v1';
  el('default-toolsets').value = 'terminal,file,web,browser';
  el('dashboard-port').value = '9120';
  el('server-host').value = '0.0.0.0';
  el('enable-tts').checked = false;
  el('enable-memory').checked = true;
  
  alert('Ayarlar sıfırlandı!');
}

el('save-settings').addEventListener('click', async function() {
  const btn = this;
  btn.disabled = true;
  btn.textContent = 'Kaydediliyor...';
  
  try {
    const settings = {
      default_model: el('default-model').value,
      default_toolsets: el('default-toolsets').value,
      base_url: el('api-base-url').value,
      port: parseInt(el('dashboard-port').value),
      host: el('server-host').value,
      tts_enabled: el('enable-tts').checked,
      memory_enabled: el('enable-memory').checked
    };
    
    const resp = await fetch('/api/config', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(settings)
    });
    const data = await resp.json();
    
    if (data.error) {
      alert(data.error);
    } else {
      alert('Ayarlar kaydedildi!✅');
    }
  } catch (e) {
    alert('Kaydetme hatası: ' + e.message);
  }
  
  btn.disabled = false;
  btn.textContent = '💾 Kaydet';
});

console.log('Chat UI JS loaded');