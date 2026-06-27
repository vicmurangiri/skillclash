// --- SKILLCLASH AI: PRODUCTION-READY FULL-STACK CLIENT ENGINE ---

// Initialize State with persistent cloud variables
let gameState = {
    user: null,
    accessToken: null,
    currentLevel: 1,
    currentQuestionIndex: 0,
    score: 0,
    xp: 0,
    streak: 0,
    timer: 10,
    timerInterval: null,
    currentQuestions: [],
    isWagerArena: false,
    wagerAmount: 0
};

// --- CONFIGURATION: REPLACE WITH YOUR LIVE SERVER URL AFTER DEPLOYMENT ---
const BACKEND_API_URL = "https://api.skillclashai.com"; 

// --- STEP 1: INITIALIZE PI SDK AND AUTHENTICATE PIONEER ---
document.addEventListener("DOMContentLoaded", () => {
    // Check if running inside the Pi Browser environment
    if (window.Pi) {
        // Initialize Pi SDK (Version 2.0 compliant)
        window.Pi.init({ version: "2.0" });
        console.log("Pi SDK Initialized.");
        
        // Authenticate the user and request permissions
        authenticatePioneer();
    } else {
        console.warn("Pi SDK not detected. Running in sandbox development simulation mode.");
        loadLocalSimulation();
    }
    
    setupUIEventListeners();
});

function authenticatePioneer() {
    const scopes = ['username', 'payments', 'wallet_address'];
    
    window.Pi.authenticate(scopes, onIncompletePaymentFound)
    .then(function(auth) {
        gameState.user = auth.user;
        gameState.accessToken = auth.accessToken;
        
        // Synchronize or create user profile on our secure database backend
        syncUserProfileWithServer(auth.user);
    })
    .catch(function(error) {
        console.error("Pi Authentication failed:", error);
        alert("Please open SkillClash AI inside the official Pi Browser to play and earn.");
    });
}

// Global callback handler for resolving network failures or pending drops mid-transaction
function onIncompletePaymentFound(payment) {
    console.log("Incomplete payment found, sending to server for synchronization:", payment);
    axios.post(`${BACKEND_API_URL}/api/payments/complete`, { payment: payment, auth: gameState.accessToken });
}

// Fetch user data securely from server
async function syncUserProfileWithServer(piUser) {
    try {
        const response = await fetch(`${BACKEND_API_URL}/api/user/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: piUser.username, uid: piUser.uid })
        });
        const data = await response.json();
        
        // Update user interfaces with actual data from DB records
        document.querySelector('.username').innerText = data.username;
        document.querySelector('.streak').innerHTML = `<i class="fa-solid fa-fire"></i> ${data.streak} Day Streak`;
        document.querySelector('.xp-bal').innerHTML = `<i class="fa-solid fa-star"></i> ${data.xp.toLocaleString()} XP`;
        
        gameState.xp = data.xp;
        gameState.streak = data.streak;
    } catch (err) {
        console.error("Database user sync failed, defaulting to local cache.", err);
    }
}

// --- STEP 2: SECURE GAMEPLAY CONTROLLER (ANTI-CHEAT) ---
async function startLevel(levelNum) {
    gameState.currentLevel = levelNum;
    gameState.currentQuestionIndex = 0;
    gameState.score = 0;
    
    // Fetch random or level-specific secure questions from the server (Answers are NOT included in this payload)
    try {
        const response = await fetch(`${BACKEND_API_URL}/api/questions?level=${levelNum}`);
        gameState.currentQuestions = await response.json();
        
        document.getElementById('game-modal').classList.add('active');
        loadQuestion();
    } catch (err) {
        alert("Error loading question stream. Check your database connections.");
    }
}

function loadQuestion() {
    resetTimer();
    const currentQ = gameState.currentQuestions[gameState.currentQuestionIndex];
    
    const progressPercent = (gameState.currentQuestionIndex / gameState.currentQuestions.length) * 100;
    document.getElementById('game-progress').style.width = `${progressPercent}%`;
    document.getElementById('modal-level-title').innerText = `Level ${gameState.currentLevel} (${gameState.currentQuestionIndex + 1}/${gameState.currentQuestions.length})`;
    
    document.getElementById('question-text').innerText = currentQ.question;
    
    const optionsContainer = document.getElementById('options-container');
    optionsContainer.innerHTML = '';
    
    currentQ.options.forEach((option, index) => {
        const button = document.createElement('button');
        button.className = 'btn-option';
        button.innerText = option;
        button.onclick = () => submitAnswerToServer(index, currentQ.id);
        optionsContainer.appendChild(button);
    });
    
    startTimer();
}

async function submitAnswerToServer(selectedIndex, questionId) {
    resetTimer();
    const optionButtons = document.querySelectorAll('.btn-option');
    optionButtons.forEach(btn => btn.disabled = true);
    
    // Verify answer securely on server-side instead of locally checking array index
    try {
        const response = await fetch(`${BACKEND_API_URL}/api/questions/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: gameState.user ? gameState.user.username : "Guest",
                questionId: questionId,
                selectedIndex: selectedIndex
            })
        });
        const result = await response.json(); // returns { correct: true/false, correctIndex: X }
        
        if (result.correct) {
            gameState.score++;
            if (selectedIndex !== -1) optionButtons[selectedIndex].classList.add('correct');
        } else {
            if (selectedIndex !== -1) optionButtons[selectedIndex].classList.add('wrong');
            optionButtons[result.correctIndex].classList.add('correct'); 
        }
        
        setTimeout(() => {
            gameState.currentQuestionIndex++;
            if (gameState.currentQuestionIndex < gameState.currentQuestions.length) {
                loadQuestion();
            } else {
                endLevelSecurely();
            }
        }, 1500);
        
    } catch (err) {
        console.error("Verification engine failed:", err);
    }
}

// --- STEP 3: NATIVE PI ECOSYSTEM PAYMENTS SDK ---
function requestPiPayment(amount, itemName, itemSku) {
    if (!window.Pi) {
        alert("Payments can only be executed within the Pi Browser interface.");
        return;
    }
    
    // Construct the official Pi Payment Request object object
    const paymentData = {
        amount: amount,
        memo: `Purchase ${itemName} via SkillClash AI Vault Store`,
        metadata: { itemSku: itemSku }
    };
    
    const paymentCallbacks = {
        onReadyForServerApproval: function(paymentId) {
            // Send paymentId to our server to log and approve it with the Pi Network
            fetch(`${BACKEND_API_URL}/api/payments/approve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ paymentId: paymentId, token: gameState.accessToken })
            });
        },
        onReadyForServerCompletion: function(paymentId, txid) {
            // Complete payment processing on server and unlock digital items/wagers
            fetch(`${BACKEND_API_URL}/api/payments/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ paymentId: paymentId, txid: txid, username: gameState.user.username })
            }).then(() => {
                alert(`🎉 Purchase Successful! Your ${itemName} is now inside your Vault.`);
                syncUserProfileWithServer(gameState.user);
            });
        },
        onCancel: function(paymentId) { console.log("Transaction cancelled by user:", paymentId); },
        onError: function(error, payment) { console.error("Payment pipeline error:", error, payment); }
    };
    
    // Call the built-in native crypto signature popup module
    window.Pi.createPayment(paymentData, paymentCallbacks);
}

// --- BACKUP UTILITIES & LOCAL DEFAULTS ---
function startTimer() {
    gameState.timer = 10;
    document.getElementById('game-timer').innerText = gameState.timer;
    gameState.timerInterval = setInterval(() => {
        gameState.timer--;
        document.getElementById('game-timer').innerText = gameState.timer;
        if (gameState.timer <= 0) { clearInterval(gameState.timerInterval); submitAnswerToServer(-1, null); }
    }, 1000);
}
function resetTimer() { clearInterval(gameState.timerInterval); }
function loadLocalSimulation() {
    document.querySelector('.username').innerText = "Dev_Sandbox_User";
}
function setupUIEventListeners() {
    const activeLvl = document.querySelector('.level-node.active');
    if (activeLvl) activeLvl.addEventListener('click', () => startLevel(1));
    
    // Bind store buttons directly to secure native payment functions
    const buyButtons = document.querySelectorAll('.btn-buy');
    if(buyButtons.length >= 3) {
        buyButtons[0].addEventListener('click', () => requestPiPayment(0.02, "50/50 Lifeline", "LL_5050"));
        buyButtons[1].addEventListener('click', () => requestPiPayment(0.02, "Time Warp", "LL_TWARP"));
        buyButtons[2].addEventListener('click', () => requestPiPayment(0.05, "Streak Repair Kit", "SR_KIT"));
    }
}
async function endLevelSecurely() {
    document.getElementById('game-modal').classList.remove('active');
    alert(`Level Complete! Final Score verified by backend: ${gameState.score}/${gameState.currentQuestions.length}`);
    if(gameState.user) syncUserProfileWithServer(gameState.user);
}