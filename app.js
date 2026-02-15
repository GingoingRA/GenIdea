// app.js - WORKING VERSION WITH PROPER DATA PARSING
import { createClient, createAccount, generatePrivateKey } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';

let client;
let userAccount;

// CONTRACT ADDRESS - Your deployed contract
const CONTRACT_ADDRESS = '0x3005f35FdFFF14A0d85A37EEe9c0be54aAF54448';

// Wait for DOM to be fully loaded, then auto-connect
window.addEventListener('DOMContentLoaded', async () => {
    // Add character counter event listener
    const ideaInput = document.getElementById('idea-input');
    if (ideaInput) {
        ideaInput.addEventListener('input', function() {
            const count = this.value.length;
            document.getElementById('char-count').textContent = count;
            if (count > 500) {
                this.value = this.value.substring(0, 500);
                document.getElementById('char-count').textContent = '500';
            }
        });
    }
    
    // Auto-connect
    await connect();
});

// Helper function to convert Map to plain object
function mapToObject(map) {
    if (!map || typeof map.get !== 'function') return map;
    
    const obj = {};
    for (const [key, value] of map) {
        // Convert BigInt to regular number
        if (typeof value === 'bigint') {
            obj[key] = Number(value);
        } else if (Array.isArray(value)) {
            obj[key] = value.map(item => mapToObject(item));
        } else if (value && typeof value.get === 'function') {
            obj[key] = mapToObject(value);
        } else {
            obj[key] = value;
        }
    }
    return obj;
}

// Connect to contract
async function connect() {
    try {
        showStatus('Connecting to GenLayer Studio...', 'info');
        
        // Create account with generated private key
        const privateKey = generatePrivateKey();
        const account = createAccount(privateKey);
        
        // Create client configured for GenLayer Studio with studionet chain
        client = createClient({
            chain: studionet,
            account: account,
        });
        
        userAccount = account.address;
        
        showStatus(`✅ Connected! Your address: ${userAccount}`, 'success');
        
        const submitSection = document.getElementById('submit-section');
        if (submitSection) {
            submitSection.style.display = 'block';
        }
        
        // Check if user already has a username
        await checkUsername();
        await loadLeaderboard();
        
    } catch (error) {
        showStatus(`Connection error: ${error.message}`, 'error');
        console.error('Full error:', error);
    }
}

// Check if user has already set a username
async function checkUsername() {
    try {
        const myDataRaw = await client.readContract({
            address: CONTRACT_ADDRESS,
            functionName: 'get_my_ideas',
            args: []
        });
        
        const myData = mapToObject(myDataRaw);
        console.log('My ideas (parsed):', myData);
        
        if (myData && myData.username) {
            const usernameSection = document.getElementById('username-section');
            const ideaSection = document.getElementById('idea-section');
            const ideasRemaining = document.getElementById('ideas-remaining');
            
            if (usernameSection) usernameSection.style.display = 'none';
            if (ideaSection) ideaSection.style.display = 'block';
            if (ideasRemaining) ideasRemaining.textContent = myData.ideas_remaining || 0;
            
            showStatus(`Welcome back, ${myData.username}! You have ${myData.ideas_remaining} ideas remaining.`, 'info');
            await loadMyIdeas();
        }
    } catch (error) {
        console.log('No username set yet:', error.message);
        // This is expected for new users
    }
}

// Set username
window.setUsername = async function() {
    const usernameInput = document.getElementById('username-input');
    if (!usernameInput) return;
    
    const username = usernameInput.value.trim();
    
    if (username.length < 2 || username.length > 30) {
        showStatus('Username must be 2-30 characters', 'error');
        return;
    }
    
    try {
        showStatus('Setting username... This may take 30-60 seconds', 'info');
        
        const hash = await client.writeContract({
            address: CONTRACT_ADDRESS,
            functionName: 'set_username',
            args: [username]
        });
        
        showStatus('⏳ Waiting for transaction confirmation...', 'info');
        
        const receipt = await client.waitForTransactionReceipt({ 
            hash,
            timeout: 120000
        });
        
        console.log('Transaction receipt:', receipt);
        
        showStatus(`✅ Username "${username}" set successfully!`, 'success');
        
        const usernameSection = document.getElementById('username-section');
        const ideaSection = document.getElementById('idea-section');
        const ideasRemaining = document.getElementById('ideas-remaining');
        
        if (usernameSection) usernameSection.style.display = 'none';
        if (ideaSection) ideaSection.style.display = 'block';
        if (ideasRemaining) ideasRemaining.textContent = '3';
        
    } catch (error) {
        showStatus(`Error: ${error.message}`, 'error');
        console.error('setUsername error:', error);
    }
}

// Submit idea
window.submitIdea = async function() {
    const ideaInput = document.getElementById('idea-input');
    if (!ideaInput) return;
    
    const idea = ideaInput.value.trim();
    
    if (idea.length < 20) {
        showStatus('Idea must be at least 20 characters', 'error');
        return;
    }
    
    if (idea.length > 500) {
        showStatus('Idea must not exceed 500 characters', 'error');
        return;
    }
    
    const submitBtn = document.getElementById('submit-btn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';
    }
    
    try {
        showStatus('📤 Submitting your idea... This may take 30-60 seconds', 'info');
        
        const hash = await client.writeContract({
            address: CONTRACT_ADDRESS,
            functionName: 'submit_idea',
            args: [idea]
        });
        
        showStatus('⏳ Waiting for confirmation...', 'info');
        
        const receipt = await client.waitForTransactionReceipt({ 
            hash,
            timeout: 120000
        });
        
        console.log('Transaction receipt:', receipt);
        
        showStatus('✅ Idea submitted successfully!', 'success');
        
        // Clear input
        ideaInput.value = '';
        const charCount = document.getElementById('char-count');
        if (charCount) charCount.textContent = '0';
        
        // Reload data after submission
        setTimeout(async () => {
            await checkUsername();
            await loadMyIdeas();
            await loadLeaderboard();
        }, 2000);
        
    } catch (error) {
        let msg = error.message;
        if (msg.includes('Maximum 3 ideas')) {
            msg = 'You\'ve reached the maximum of 3 ideas per user!';
        } else if (msg.includes('set username first')) {
            msg = 'Please set your username first!';
        }
        showStatus(`❌ Error: ${msg}`, 'error');
        console.error('submitIdea error:', error);
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Idea';
        }
    }
}

// Load user's submitted ideas
async function loadMyIdeas() {
    try {
        console.log('Loading my ideas...');
        
        const myDataRaw = await client.readContract({
            address: CONTRACT_ADDRESS,
            functionName: 'get_my_ideas',
            args: []
        });
        
        const myData = mapToObject(myDataRaw);
        console.log('My ideas (parsed):', myData);
        
        const container = document.getElementById('my-ideas-container');
        const section = document.getElementById('my-ideas-section');
        
        if (!container || !section) return;
        
        if (!myData || !myData.my_ideas || myData.my_ideas.length === 0) {
            console.log('No ideas found');
            section.style.display = 'none';
            return;
        }
        
        section.style.display = 'block';
        
        container.innerHTML = myData.my_ideas.map(item => {
            const shortIdea = item.idea.length > 60 
                ? item.idea.substring(0, 60) + '...' 
                : item.idea;
            
            return `
                <div class="my-idea-item">
                    <div class="idea-info">
                        <span class="idea-id">ID ${item.id}</span>
                        <span>${escapeHtml(shortIdea)}</span>
                    </div>
                    <button 
                        class="score-btn" 
                        onclick="scoreIdea(${item.id})" 
                        ${item.evaluated ? 'disabled' : ''}
                    >
                        ${item.evaluated ? '✅ Scored' : '🎯 Score This'}
                    </button>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error loading my ideas:', error);
        // Don't show error to user if it's just because they have no ideas yet
    }
}

// Score an idea using AI validators
window.scoreIdea = async function(ideaId) {
    try {
        showStatus(`🤖 AI validators are scoring idea #${ideaId}... This will take 1-2 minutes`, 'info');
        
        const hash = await client.writeContract({
            address: CONTRACT_ADDRESS,
            functionName: 'score_idea',
            args: [ideaId]
        });
        
        showStatus('⏳ Waiting for AI consensus... (this takes time)', 'info');
        
        const receipt = await client.waitForTransactionReceipt({ 
            hash,
            timeout: 180000
        });
        
        console.log('Score transaction receipt:', receipt);
        
        showStatus(`🎉 Idea #${ideaId} has been scored!`, 'success');
        
        // Reload data
        await loadMyIdeas();
        await loadLeaderboard();
        
    } catch (error) {
        showStatus(`❌ Error scoring: ${error.message}`, 'error');
        console.error('scoreIdea error:', error);
    }
}

// Load and display leaderboard
window.loadLeaderboard = async function() {
    try {
        const leaderboardRaw = await client.readContract({
            address: CONTRACT_ADDRESS,
            functionName: 'get_leaderboard',
            args: []
        });
        
        const leaderboard = mapToObject(leaderboardRaw);
        console.log('Leaderboard (parsed):', leaderboard);
        
        const container = document.getElementById('leaderboard-container');
        if (!container) return;
        
        if (!leaderboard || !leaderboard.ideas || leaderboard.ideas.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">💭</div>
                    <p>No ideas submitted yet. Be the first!</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = leaderboard.ideas.map((idea, index) => {
            let rankClass = '';
            if (index === 0) rankClass = 'gold';
            else if (index === 1) rankClass = 'silver';
            else if (index === 2) rankClass = 'bronze';
            
            const pendingBadge = !idea.evaluated 
                ? '<span class="pending-badge">⏳ Not scored yet</span>' 
                : '';
            
            return `
                <div class="leaderboard-item" style="animation-delay: ${index * 0.05}s">
                    <span class="rank-badge ${rankClass}">${index + 1}</span>
                    <div class="idea-content">
                        <div class="idea-header">
                            <div>
                                <span class="username">${escapeHtml(idea.username)}</span>
                                ${pendingBadge}
                            </div>
                            <div class="score-display">${idea.score}/100</div>
                        </div>
                        <div class="idea-text">${escapeHtml(idea.idea)}</div>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error loading leaderboard:', error);
        const container = document.getElementById('leaderboard-container');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>Error loading leaderboard. Please refresh the page.</p>
                </div>
            `;
        }
    }
}

// Show status message to user
function showStatus(message, type) {
    const statusDiv = document.getElementById('status-message');
    if (!statusDiv) return;
    
    statusDiv.innerHTML = `<div class="status ${type}">${message}</div>`;
    
    if (type === 'success') {
        setTimeout(() => {
            statusDiv.innerHTML = '';
        }, 5000);
    }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

// Auto-refresh leaderboard every 30 seconds
setInterval(async () => {
    if (client) {
        await loadLeaderboard();
    }
}, 30000);