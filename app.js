document.addEventListener("DOMContentLoaded", () => {
    const signinBtn = document.getElementById("signin-btn");
    const authStatus = document.getElementById("auth-status");
    const gameArena = document.getElementById("game-arena");
    const playerUsername = document.getElementById("player-username");

    signinBtn.addEventListener("click", () => handlePiAuthentication());

    // Automatically trigger authentication when app loads
    initializePiSDK();

    async function initializePiSDK() {
        try {
            // Treat Pi.init as a Promise and await configuration
            await Pi.init({ version: "2.0", sandbox: true });
            console.log("Pi SDK Initialized successfully.");
            await handlePiAuthentication();
        } catch (error) {
            console.error("Pi SDK Initialization failed:", error);
            authStatus.textContent = "Initialization Failed. Use Pi Browser.";
        }
    }

    async function handlePiAuthentication() {
        authStatus.textContent = "Authenticating...";
        signinBtn.style.display = "none";

        try {
            const scopes = ["username"];
            
            // Explicit callbacks mandated by Pi SDK
            function onIncompletePaymentFound(payment) {
                console.log("Incomplete payment found:", payment);
            }

            const authResult = await Pi.authenticate(scopes, onIncompletePaymentFound);
            console.log("Authenticated completely:", authResult);

            // Forward returned auth parameters to backend session verification endpoint
            const serverVerified = await verifyUserSessionWithBackend(authResult);

            if (serverVerified) {
                authStatus.textContent = "Verified";
                playerUsername.textContent = authResult.user.username;
                gameArena.style.display = "block";
            } else {
                authStatus.textContent = "Server Verification Failed.";
                signinBtn.style.display = "block";
            }
        } catch (error) {
            console.error("Authentication flow failed:", error);
            authStatus.textContent = "Sign In Failed.";
            signinBtn.style.display = "block";
        }
    }

    async function verifyUserSessionWithBackend(authResult) {
        try {
            const response = await fetch("/api/auth/session", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    accessToken: authResult.accessToken,
                    user: authResult.user
                })
            });
            const data = await response.json();
            return data.success;
        } catch (err) {
            console.error("Backend communication error:", err);
            return false;
        }
    }
});
